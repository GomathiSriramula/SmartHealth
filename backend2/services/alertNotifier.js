/**
 * Alert Notifier Service
 * 
 * Sends email notifications when alerts are created.
 * Minimal content: location, risk level, timestamp.
 * Safe error handling - failures don't crash backend.
 * Idempotent - can be called multiple times safely.
 *
 * Recipients:
 *  - If called with an explicit `recipients` array (manual notify flow —
 *    see routes/alertsApi.js), those are used as-is.
 *  - If called with no `recipients` (automatic, system-triggered alert),
 *    it notifies ALL admins + the OPERATOR of the affected district only.
 *    Regular USERS are never notified.
 *
 * 🔑 FIX: This used to create its own nodemailer transporter reading
 * EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD env vars — a completely different set
 * of variables than the rest of the app (utils/mailer.js uses SMTP_HOST/
 * SMTP_USER/SMTP_PASS). Since only SMTP_* was ever configured, this file's
 * transporter silently fell back to placeholder credentials and failed to
 * authenticate on every send — which is why manual admin/operator "Send
 * Alert" notifications never actually delivered mail. Now it reuses
 * sendBulkEmail() / createTransporter() from utils/mailer.js so there is a
 * single source of truth for email config.
 */

const { sendBulkEmail, createTransporter } = require('../utils/mailer');
const { markAlertNotified } = require('./alertChecker');

/**
 * Send alert notification email
 * 
 * @param {Object} alert - Alert object from MongoDB
 * @param {Array<string>} recipients - Email addresses to send to. If omitted,
 *   recipients are auto-computed as admins + operator of alert.location.
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
async function sendAlertNotification(alert, recipients = null) {
  try {
    // Validate alert
    if (!alert || !alert._id) {
      console.warn('[AlertNotifier] Invalid alert object');
      return {
        success: false,
        message: 'Invalid alert object',
      };
    }

    // Explicit recipients (manual notify already computes these based on
    // who's sending — see alertsApi.js). If none were passed, this is an
    // AUTOMATIC system-triggered alert: notify all admins + the operator of
    // the affected district only — never regular users.
    let emailRecipients = recipients;
    if (!emailRecipients) {
      const { getAutomaticAlertRecipients } = require('../utils/notificationRecipients');
      emailRecipients = await getAutomaticAlertRecipients(alert.location);
    }

    if (!emailRecipients || emailRecipients.length === 0) {
      console.log(`[AlertNotifier] No admin/operator emails found for ${alert.location}, skipping`);
      return {
        success: true,
        message: 'No admins/operator to notify',
      };
    }

    // Check if already notified (idempotency)
    if (alert.notificationSent) {
      console.log(`[AlertNotifier] Alert ${alert._id} already notified, skipping`);
      return {
        success: true,
        message: 'Alert already notified',
      };
    }

    // Format timestamp
    const timestamp = alert.createdAt ? new Date(alert.createdAt).toLocaleString() : new Date().toLocaleString();

    // Minimal email content
    const emailContent = {
      location: alert.location || 'Unknown Location',
      riskLevel: alert.riskLevel || 'HIGH',
      timestamp: timestamp,
    };

    // Build email subject and body
    const subject = `⚠️ OUTBREAK ALERT: ${emailContent.location}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .alert-box { 
              background-color: #ffcccc; 
              border: 2px solid #cc0000; 
              padding: 20px; 
              border-radius: 5px;
            }
            .alert-title { 
              color: #cc0000; 
              font-size: 24px; 
              font-weight: bold; 
              margin-bottom: 15px;
            }
            .alert-detail { 
              font-size: 16px; 
              margin: 10px 0; 
            }
            .label { 
              font-weight: bold; 
              color: #333; 
            }
            .value { 
              color: #666; 
            }
          </style>
        </head>
        <body>
          <div class="alert-box">
            <div class="alert-title">🚨 Outbreak Alert Triggered</div>
            
            <div class="alert-detail">
              <span class="label">Location:</span>
              <span class="value">${escapeHtml(emailContent.location)}</span>
            </div>
            
            <div class="alert-detail">
              <span class="label">Risk Level:</span>
              <span class="value" style="color: #cc0000; font-weight: bold;">${escapeHtml(emailContent.riskLevel)}</span>
            </div>
            
            <div class="alert-detail">
              <span class="label">Detected At:</span>
              <span class="value">${escapeHtml(timestamp)}</span>
            </div>

            <div class="alert-detail" style="margin-top: 20px; font-size: 14px; color: #999;">
              <p>This is an automated alert from SmartHealth Monitoring System.</p>
              <p>Please review the dashboard for detailed information.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textBody = `
OUTBREAK ALERT TRIGGERED

Location: ${emailContent.location}
Risk Level: ${emailContent.riskLevel}
Detected At: ${timestamp}

This is an automated alert from SmartHealth Monitoring System.
Please review the dashboard for detailed information.
    `;

    console.log(`[AlertNotifier] Sending alert email for ${alert.location} to ${emailRecipients.length} recipient(s)`);

    // Retry mechanism for email sending
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const info = await sendBulkEmail(emailRecipients, subject, textBody, htmlBody);

        console.log(`[AlertNotifier] Email sent successfully (attempt ${attempt})`);

        // Mark alert as notified
        await markAlertNotified(alert._id, true, null);

        return {
          success: true,
          message: `Email sent to ${emailRecipients.length} recipient(s)`,
          messageId: info.messageId,
        };
      } catch (error) {
        lastError = error;
        console.error(`[AlertNotifier] Attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[AlertNotifier] Retrying in ${waitTime / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed - log error but don't throw (safety)
    console.error(`[AlertNotifier] Failed after ${maxRetries} attempts: ${lastError.message}`);

    await markAlertNotified(alert._id, false, lastError.message);

    return {
      success: false,
      message: `Failed to send notification: ${lastError.message}`,
      error: lastError.message,
    };
  } catch (error) {
    console.error('[AlertNotifier] Error sending alert notification:', error.message);

    // Mark alert with error (but don't throw - safe error handling)
    if (alert && alert._id) {
      await markAlertNotified(alert._id, false, error.message);
    }

    return {
      success: false,
      message: `Failed to send notification: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Test email configuration
 * 
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
async function testEmailConfiguration() {
  try {
    console.log('[AlertNotifier] Testing email configuration...');

    const transporter = await createTransporter();
    await transporter.verify();

    console.log('[AlertNotifier] Email configuration verified');

    return {
      success: true,
      message: 'Email configuration is valid',
    };
  } catch (error) {
    console.error('[AlertNotifier] Email configuration error:', error.message);

    return {
      success: false,
      message: `Email configuration error: ${error.message}`,
    };
  }
}

/**
 * Helper: Escape HTML special characters
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

module.exports = {
  sendAlertNotification,
  testEmailConfiguration,
};