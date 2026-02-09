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
 * Enhanced for HIGH RISK alerts with more prominent styling
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
    confidence = null,
    modelVersion = null,
  } = prediction;

  const riskLevelLower = riskLevel.toLowerCase();
  const isHighRisk = riskLevelLower === "high";
  
  const riskColor =
    riskLevelLower === "high"
      ? "#dc2626"
      : riskLevelLower === "medium"
      ? "#f59e0b"
      : "#10b981";
      
  const riskBgColor =
    riskLevelLower === "high"
      ? "#fee2e2"
      : riskLevelLower === "medium"
      ? "#fef3c7"
      : "#d1fae5";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartHealth ${isHighRisk ? 'URGENT' : ''} Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); ${isHighRisk ? 'border: 3px solid ' + riskColor + ';' : ''}">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 30px; background-color: ${isHighRisk ? riskColor : '#3b82f6'}; text-align: center;">
                            ${isHighRisk ? '<h1 style="margin: 0 0 10px; color: #ffffff; font-size: 32px;">🚨 URGENT ALERT 🚨</h1>' : ''}
                            <h${isHighRisk ? '2' : '1'} style="margin: 0; color: #ffffff; font-size: ${isHighRisk ? '24px' : '28px'};">🏥 SmartHealth Alert</h${isHighRisk ? '2' : '1'}>
                        </td>
                    </tr>
                    
                    ${isHighRisk ? `
                    <!-- Urgent Banner -->
                    <tr>
                        <td style="padding: 20px 30px; background-color: ${riskBgColor}; border-bottom: 3px solid ${riskColor};">
                            <p style="margin: 0; color: ${riskColor}; font-size: 16px; font-weight: bold; text-align: center;">
                                ⚠️ IMMEDIATE ATTENTION REQUIRED ⚠️
                            </p>
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">${isHighRisk ? '🚨 ' : ''}${predictionType}</h2>
                            
                            <div style="background-color: ${riskBgColor}; border-left: 6px solid ${riskColor}; padding: 20px; margin: 20px 0; ${isHighRisk ? 'box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);' : ''}">
                                <p style="margin: 0 0 10px; color: #4b5563; font-size: 14px; font-weight: bold;">RISK LEVEL</p>
                                <p style="margin: 0; color: ${riskColor}; font-size: ${isHighRisk ? '28px' : '20px'}; font-weight: bold; ${isHighRisk ? 'text-transform: uppercase; letter-spacing: 2px;' : ''}">${riskLevel.toUpperCase()}</p>
                                ${confidence ? `<p style="margin: 10px 0 0; color: #6b7280; font-size: 12px;">Confidence: ${confidence}%</p>` : ''}
                            </div>
                            
                            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px; width: 140px;">📍 Location:</td>
                                    <td style="padding: 12px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${location}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">📅 Predicted Date:</td>
                                    <td style="padding: 12px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${new Date(
                                      predictedDate
                                    ).toLocaleString('en-US', { 
                                      weekday: 'long', 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</td>
                                </tr>
                                ${confidence ? `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">📊 Confidence:</td>
                                    <td style="padding: 12px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${confidence}%</td>
                                </tr>
                                ` : ''}
                                ${modelVersion ? `
                                <tr>
                                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">🤖 Model Version:</td>
                                    <td style="padding: 12px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${modelVersion}</td>
                                </tr>
                                ` : ''}
                            </table>
                            
                            <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                                <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px;">📋 Details</h3>
                                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${details}</p>
                            </div>
                            
                            ${
                              recommendations.length > 0
                                ? `
                            <div style="margin: 30px 0; padding: 20px; background-color: ${isHighRisk ? riskBgColor : '#f0fdf4'}; border-radius: 8px; border: 2px solid ${isHighRisk ? riskColor : '#10b981'};">
                                <h3 style="margin: 0 0 15px; color: ${isHighRisk ? riskColor : '#059669'}; font-size: 18px;">${isHighRisk ? '⚠️' : '✓'} ${isHighRisk ? 'URGENT' : ''} Recommendations</h3>
                                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                                    ${recommendations.map((rec) => `<li style="margin: 10px 0;"><strong>${rec}</strong></li>`).join("")}
                                </ul>
                            </div>
                            `
                                : ""
                            }
                            
                            ${isHighRisk ? `
                            <div style="margin: 30px 0; padding: 15px; background-color: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                                    <strong>⏰ Time Sensitive:</strong> This is a high-risk alert that requires immediate attention. 
                                    Please review the recommendations and take appropriate action as soon as possible.
                                </p>
                            </div>
                            ` : ''}
                            
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="${
                                  process.env.FRONTEND_URL || "http://localhost:5173"
                                }/predictions" 
                                   style="display: inline-block; padding: ${isHighRisk ? '16px 40px' : '12px 30px'}; background-color: ${isHighRisk ? riskColor : '#3b82f6'}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: ${isHighRisk ? '18px' : '16px'}; font-weight: bold; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    ${isHighRisk ? '🔍 View Alert Details' : 'View Dashboard'}
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px;">
                                ${isHighRisk ? '🚨 This is an urgent automated notification from SmartHealth System' : 'This is an automated notification from SmartHealth System'}
                            </p>
                            <p style="margin: 0 0 5px; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} SmartHealth. All rights reserved.
                            </p>
                            <p style="margin: 5px 0 0; color: #9ca3af; font-size: 11px;">
                                You received this email because you are registered in the SmartHealth monitoring system.
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
 * ONLY for HIGH RISK predictions
 * @param {object} prediction - Prediction data
 * @param {boolean} forceNotify - Force notification even if not high risk (default: false)
 * @returns {Promise<object>} - Result object
 */
async function notifyUsersOfPrediction(prediction, forceNotify = false) {
  try {
    const { User } = require("../models");
    
    // 🔑 Only send emails for HIGH RISK predictions (unless forced)
    const isHighRisk = prediction.riskLevel && prediction.riskLevel.toLowerCase() === "high";
    
    if (!isHighRisk && !forceNotify) {
      console.log(`⚠️  Prediction risk level is '${prediction.riskLevel}' - skipping email notification (only HIGH RISK triggers emails)`);
      return { 
        success: true, 
        message: "Notification skipped - not high risk", 
        count: 0,
        riskLevel: prediction.riskLevel 
      };
    }
    
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

    console.log(`🚨 HIGH RISK ALERT: Sending notifications to ${emails.length} users`);

    const subject = `🚨 URGENT: High Risk ${prediction.predictionType || "Health Alert"} Detected`;
    const text = generatePredictionEmailText(prediction);
    const html = generatePredictionEmailHTML(prediction);

    // Retry mechanism for email sending
    let lastError = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await sendBulkEmail(emails, subject, text, html);
        console.log(`✅ Email notifications sent successfully on attempt ${attempt}`);
        
        return {
          success: true,
          message: `High risk notification sent to ${emails.length} users`,
          count: emails.length,
          riskLevel: prediction.riskLevel,
          attempt,
        };
      } catch (error) {
        lastError = error;
        console.error(`❌ Email send attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // All retries failed
    throw new Error(`Failed to send emails after ${maxRetries} attempts: ${lastError.message}`);
    
  } catch (error) {
    console.error("❌ Error notifying users:", error.message);
    throw error;
  }
}

/**
 * Send alert notification to all health officials
 * Triggered when a new alert is created (2+ consecutive HIGH predictions)
 * 
 * @param {object} alert - Alert document from MongoDB
 * @returns {Promise<object>} - Result object with success status
 */
async function notifyAlertCreation(alert) {
  try {
    // Validate alert
    if (!alert || !alert._id || !alert.location) {
      console.log(`📧 [Alert Notification] Invalid alert object, skipping notification`);
      return {
        success: false,
        message: "Invalid alert data",
        count: 0,
      };
    }

    // Check if already notified (prevent duplicates)
    if (alert.notificationSent) {
      console.log(`📧 [Alert Notification] Alert ${alert._id} already notified, skipping`);
      return {
        success: true,
        message: "Alert already notified",
        count: 0,
        alertId: alert._id,
      };
    }

    // Get all health officials/admin users
    const { User } = require("../models");
    const users = await User.find({ email: { $exists: true, $ne: null, $ne: "" } });

    if (users.length === 0) {
      console.log(`📧 [Alert Notification] No users found to notify for alert ${alert._id}`);
      return {
        success: true,
        message: "No users to notify",
        count: 0,
        alertId: alert._id,
      };
    }

    const recipients = users.map((u) => u.email).filter(Boolean);
    if (recipients.length === 0) {
      console.log(`📧 [Alert Notification] No valid email addresses found`);
      return {
        success: true,
        message: "No valid emails",
        count: 0,
        alertId: alert._id,
      };
    }

    // Format alert details
    const timestamp = alert.createdAt
      ? new Date(alert.createdAt).toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString();

    // Build simple email content
    const subject = `🚨 ALERT: Water-Borne Disease OUTBREAK - ${alert.location}`;

    const textBody = `
WATER-BORNE DISEASE OUTBREAK ALERT

Location: ${alert.location}
Risk Level: ${alert.riskLevel || "HIGH"}
Alert ID: ${alert._id}
Detected: ${timestamp}

DETAILS:
${alert.reason || "2 consecutive HIGH risk predictions detected"}

Number of triggering predictions: ${
      alert.triggeringPredictions ? alert.triggeringPredictions.length : 0
    }

RECOMMENDED ACTIONS:
1. Immediately assess the situation in ${alert.location}
2. Test water source for contaminants
3. Alert local health authorities
4. Implement water safety measures
5. Monitor for additional cases
6. Update crisis response team

---
This is an automated alert from SmartHealth System.
Alert Status: ${alert.status}
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; border: 1px solid #e5e7eb; }
    .alert-info { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
    .label { font-weight: bold; color: #374151; margin-top: 15px; }
    .value { color: #6b7280; margin-top: 5px; }
    .recommendations { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .recommendations ol { margin: 10px 0; padding-left: 20px; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 OUTBREAK ALERT 🚨</h1>
      <p style="margin: 10px 0; font-size: 16px;">Water-Borne Disease Risk</p>
    </div>
    
    <div class="content">
      <div class="alert-info">
        <p style="margin: 0; font-weight: bold; color: #dc2626;">IMMEDIATE ATTENTION REQUIRED</p>
        <p style="margin: 10px 0 0; color: #7f1d1d;">2 consecutive HIGH risk predictions detected at this location</p>
      </div>
      
      <div class="label">📍 Location</div>
      <div class="value">${alert.location}</div>
      
      <div class="label">⚠️ Risk Level</div>
      <div class="value" style="color: #dc2626; font-weight: bold; font-size: 18px;">${
        alert.riskLevel || "HIGH"
      }</div>
      
      <div class="label">📅 Detected</div>
      <div class="value">${timestamp}</div>
      
      <div class="label">🔍 Alert ID</div>
      <div class="value">${alert._id}</div>
      
      <div class="label">📊 Triggering Predictions</div>
      <div class="value">${alert.triggeringPredictions ? alert.triggeringPredictions.length : 0}</div>
      
      <div class="recommendations">
        <p style="margin: 0; font-weight: bold; color: #f59e0b;">✓ RECOMMENDED ACTIONS</p>
        <ol style="margin: 10px 0; color: #78350f;">
          <li>Immediately assess the situation in ${alert.location}</li>
          <li>Test water source for contaminants</li>
          <li>Alert local health authorities</li>
          <li>Implement water safety measures</li>
          <li>Monitor for additional cases</li>
          <li>Update crisis response team</li>
        </ol>
      </div>
    </div>
    
    <div class="footer">
      <p style="margin: 0;">This is an automated alert from SmartHealth Water Monitoring System</p>
      <p style="margin: 5px 0 0;">Alert Status: ${alert.status}</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email with retry logic
    console.log(
      `📧 [Alert Notification] Sending alert email for ${alert.location} to ${recipients.length} recipient(s)`
    );

    const transporter = await createTransporter();
    const fromEmail = process.env.SMTP_FROM_EMAIL || "noreply@smarthealth.com";
    const fromName = process.env.SMTP_FROM_NAME || "SmartHealth System";

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      bcc: recipients.join(", "),
      subject,
      text: textBody,
      html: htmlBody,
    };

    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await transporter.sendMail(mailOptions);
        console.log(
          `✅ [Alert Notification] Alert email sent successfully (attempt ${attempt}) to ${recipients.length} recipients`
        );

        return {
          success: true,
          message: `Alert notification sent to ${recipients.length} health officials`,
          count: recipients.length,
          alertId: alert._id,
          attempt,
        };
      } catch (error) {
        lastError = error;
        console.error(
          `❌ [Alert Notification] Attempt ${attempt} failed: ${error.message}`
        );

        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(
            `⏳ [Alert Notification] Retrying in ${waitTime / 1000}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed - log error but don't throw (safety)
    console.error(
      `❌ [Alert Notification] Failed after ${maxRetries} attempts: ${lastError.message}`
    );

    return {
      success: false,
      message: `Failed to send alert notification after ${maxRetries} attempts`,
      count: 0,
      alertId: alert._id,
      error: lastError.message,
    };
  } catch (error) {
    console.error(`❌ [Alert Notification] Error: ${error.message}`);
    return {
      success: false,
      message: `Alert notification error: ${error.message}`,
      count: 0,
      error: error.message,
    };
  }
}

module.exports = {
  sendEmail,
  sendBulkEmail,
  generatePredictionEmailHTML,
  generatePredictionEmailText,
  notifyUsersOfPrediction,
  notifyAlertCreation,
};
