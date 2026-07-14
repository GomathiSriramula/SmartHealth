/**
 * notificationRecipients.js
 *
 * Single source of truth for "who gets notified" for alerts/predictions.
 *
 * Rules:
 *  - AUTOMATIC (system-generated) alert/high-risk prediction:
 *      -> ALL admins
 *      -> ONLY the operator assigned to the affected district
 *      -> regular USERS are never notified
 *
 *  - MANUAL notify action (a human clicks "notify"):
 *      -> sender is OPERATOR -> notify ALL admins
 *      -> sender is ADMIN    -> notify ONLY the operator of the affected district
 *      -> regular USERS are never notified (and can't trigger this anyway)
 *
 * Place this file at: utils/notificationRecipients.js
 */

const { User } = require("../models");
const { operatorMatchesDistrict } = require("./auth");

function dedupeEmails(emails) {
    return [...new Set((emails || []).filter(Boolean))];
}

/**
 * All ADMIN emails.
 * @returns {Promise<string[]>}
 */
async function getAdminEmails() {
    const admins = await User.find({
        role: "ADMIN",
        email: { $exists: true, $ne: null, $ne: "" },
    }).lean();

    return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Email(s) of the OPERATOR(s) whose assigned district matches the given district.
 * Reuses operatorMatchesDistrict so the matching logic stays identical to what
 * the rest of the app already uses for district access control.
 * @param {string} district
 * @returns {Promise<string[]>}
 */
async function getOperatorEmailsForDistrict(district) {
    if (!district) return [];

    const operators = await User.find({
        role: "OPERATOR",
        email: { $exists: true, $ne: null, $ne: "" },
    }).lean();

    return operators
        .filter((op) => operatorMatchesDistrict(op, district))
        .map((op) => op.email)
        .filter(Boolean);
}

/**
 * Recipients for an AUTOMATIC (system-triggered) alert/prediction notification.
 * -> all admins + operator of the affected district. No regular users, ever.
 * @param {string} district
 * @returns {Promise<string[]>}
 */
async function getAutomaticAlertRecipients(district) {
    const [adminEmails, operatorEmails] = await Promise.all([
        getAdminEmails(),
        getOperatorEmailsForDistrict(district),
    ]);

    return dedupeEmails([...adminEmails, ...operatorEmails]);
}

/**
 * Recipients for a MANUAL notify action, based on who triggered it.
 *
 * @param {object} sender   - req.user of whoever clicked "notify"
 * @param {string} district - the affected district (e.g. alert.location)
 * @returns {Promise<string[]>}
 */
async function getManualNotificationRecipients(sender, district) {
    const role = sender && sender.role;

    if (role === "OPERATOR") {
        // Operator sends -> notify all admins
        return dedupeEmails(await getAdminEmails());
    }

    if (role === "ADMIN") {
        // Admin sends -> notify only the operator of the affected district
        return dedupeEmails(await getOperatorEmailsForDistrict(district));
    }

    // Regular users / unknown roles: never notified, never a valid sender.
    return [];
}

module.exports = {
    getAdminEmails,
    getOperatorEmailsForDistrict,
    getAutomaticAlertRecipients,
    getManualNotificationRecipients,
};