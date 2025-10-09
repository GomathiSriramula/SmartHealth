const nodemailer = require("nodemailer");

/**
 * Create a transporter based on environment configuration
 * For production, configure SMTP settings in .env
 * For development, uses Ethereal (test) email service
 */
async function createTransporter() {
  // Check if production SMTP settings are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Production configuration
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: use Ethereal test account
    console.log("⚠️  No SMTP configuration found. Using Ethereal test account for development.");
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

/**
 * Send email to a single recipient
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 * @returns {Promise<object>} - Mail info
 */
async function sendEmail(to, subject, text, html = null) {
  try {
    const transporter = await createTransporter();
    const fromEmail = process.env.SMTP_FROM_EMAIL || "noreply@smarthealth.com";
    const fromName = process.env.SMTP_FROM_NAME || "SmartHealth System";

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Log preview URL for Ethereal (development)
    if (info.messageId && !process.env.SMTP_HOST) {
      console.log("📧 Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
}

/**
 * Send email to multiple recipients (BCC for privacy)
 * @param {Array<string>} recipients - Array of email addresses
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 * @returns {Promise<object>} - Mail info
 */
async function sendBulkEmail(recipients, subject, text, html = null) {
  try {
    const transporter = await createTransporter();
    const fromEmail = process.env.SMTP_FROM_EMAIL || "noreply@smarthealth.com";
    const fromName = process.env.SMTP_FROM_NAME || "SmartHealth System";

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      bcc: recipients.join(", "), // Use BCC to hide recipient list
      subject,
      text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Log preview URL for Ethereal (development)
    if (info.messageId && !process.env.SMTP_HOST) {
      console.log("📧 Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
    
    console.log(`✅ Email sent to ${recipients.length} recipients`);
    return info;
  } catch (error) {
    console.error("Error sending bulk email:", error.message);
    throw error;
  }
}

/**
 * Generate HTML email template for prediction notification
 * @param {object} prediction - Prediction data
 * @returns {string} - HTML content
 */
function generatePredictionEmailHTML(prediction) {
  const {
    predictionType = "Health Alert",
    location = "Unknown",
    riskLevel = "Medium",
    predictedDate = new Date().toISOString(),
    details = "A new prediction has been made.",
    recommendations = [],
  } = prediction;

  const riskColor =
    riskLevel.toLowerCase() === "high"
      ? "#dc2626"
      : riskLevel.toLowerCase() === "medium"
      ? "#f59e0b"
      : "#10b981";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartHealth Prediction Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 30px; background-color: #3b82f6; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🏥 SmartHealth Alert</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">New Prediction: ${predictionType}</h2>
                            
                            <div style="background-color: #f9fafb; border-left: 4px solid ${riskColor}; padding: 20px; margin: 20px 0;">
                                <p style="margin: 0 0 10px; color: #4b5563; font-size: 14px; font-weight: bold;">RISK LEVEL</p>
                                <p style="margin: 0; color: ${riskColor}; font-size: 20px; font-weight: bold;">${riskLevel.toUpperCase()}</p>
                            </div>
                            
                            <table style="width: 100%; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">📍 Location:</td>
                                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${location}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">📅 Predicted Date:</td>
                                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${new Date(
                                      predictedDate
                                    ).toLocaleString()}</td>
                                </tr>
                            </table>
                            
                            <div style="margin: 30px 0;">
                                <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px;">Details</h3>
                                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${details}</p>
                            </div>
                            
                            ${
                              recommendations.length > 0
                                ? `
                            <div style="margin: 30px 0;">
                                <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px;">Recommendations</h3>
                                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                                    ${recommendations.map((rec) => `<li style="margin: 8px 0;">${rec}</li>`).join("")}
                                </ul>
                            </div>
                            `
                                : ""
                            }
                            
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="${
                                  process.env.FRONTEND_URL || "http://localhost:5173"
                                }" 
                                   style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                    View Dashboard
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px;">
                                This is an automated notification from SmartHealth System
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} SmartHealth. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
}

/**
 * Generate plain text version of prediction email
 * @param {object} prediction - Prediction data
 * @returns {string} - Plain text content
 */
function generatePredictionEmailText(prediction) {
  const {
    predictionType = "Health Alert",
    location = "Unknown",
    riskLevel = "Medium",
    predictedDate = new Date().toISOString(),
    details = "A new prediction has been made.",
    recommendations = [],
  } = prediction;

  let text = `
SmartHealth Alert - New Prediction
====================================

Prediction Type: ${predictionType}
Risk Level: ${riskLevel.toUpperCase()}
Location: ${location}
Predicted Date: ${new Date(predictedDate).toLocaleString()}

Details:
${details}
`;

  if (recommendations.length > 0) {
    text += `\n\nRecommendations:\n`;
    recommendations.forEach((rec, idx) => {
      text += `${idx + 1}. ${rec}\n`;
    });
  }

  text += `\n\nView your dashboard: ${process.env.FRONTEND_URL || "http://localhost:5173"}`;
  text += `\n\n---\nThis is an automated notification from SmartHealth System\n© ${new Date().getFullYear()} SmartHealth. All rights reserved.`;

  return text;
}

/**
 * Send prediction notification to all registered users with emails
 * @param {object} prediction - Prediction data
 * @returns {Promise<object>} - Result object
 */
async function notifyUsersOfPrediction(prediction) {
  try {
    const { User } = require("../models");
    
    // Get all users with valid email addresses
    const users = await User.find({ email: { $exists: true, $ne: null, $ne: "" } });
    
    if (users.length === 0) {
      console.log("⚠️  No users with email addresses found.");
      return { success: true, message: "No users to notify", count: 0 };
    }

    const emails = users.map((user) => user.email).filter(Boolean);
    
    if (emails.length === 0) {
      console.log("⚠️  No valid email addresses found.");
      return { success: true, message: "No valid emails", count: 0 };
    }

    const subject = `SmartHealth Alert: New ${prediction.predictionType || "Prediction"}`;
    const text = generatePredictionEmailText(prediction);
    const html = generatePredictionEmailHTML(prediction);

    await sendBulkEmail(emails, subject, text, html);

    return {
      success: true,
      message: `Notification sent to ${emails.length} users`,
      count: emails.length,
    };
  } catch (error) {
    console.error("Error notifying users:", error.message);
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendBulkEmail,
  generatePredictionEmailHTML,
  generatePredictionEmailText,
  notifyUsersOfPrediction,
};
