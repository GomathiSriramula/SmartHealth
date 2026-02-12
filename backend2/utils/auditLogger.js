const { AuditLog } = require('../models');

/**
 * Log an audit event for critical actions
 * 
 * @param {Object} params - Configuration for the audit log
 * @param {string} params.action - The action type (CREATE_PREDICTION, RESOLVE_ALERT, UPLOAD_CSV)
 * @param {Object} params.req - Express request object (to extract user info and IP)
 * @param {string|null} params.village - Village/location where action was performed (optional)
 * @param {mongoose.ObjectId|null} params.entityId - ID of the entity being acted upon (optional)
 * @param {Object|null} params.metadata - Additional metadata about the action (optional)
 * 
 * @returns {Promise<Object>} The created audit log document
 * 
 * @throws {Error} If audit log creation fails
 */
async function logAudit({ action, req, village = null, entityId = null, metadata = null }) {
  try {
    // Ensure req.user exists and has required fields
    if (!req.user || !req.user.username) {
      console.warn('logAudit: Missing user information in request');
      return null;
    }

    // Determine village from user's adminLocation if available
    let resolvedVillage = village;
    if (!resolvedVillage && req.user.adminLocation && req.user.adminLocation.village) {
      resolvedVillage = req.user.adminLocation.village;
    }

    // Extract IP address from request
    const ipAddress = req.ip ||
                      req.connection.remoteAddress ||
                      req.socket.remoteAddress ||
                      req.connection.socket?.remoteAddress ||
                      null;

    // Create the audit log document
    const auditLog = new AuditLog({
      action,
      username: req.user.username,
      role: req.user.role || 'USER',
      village: resolvedVillage,
      entityId,
      metadata,
      timestamp: new Date(),
      ipAddress,
    });

    // Save to database
    const savedLog = await auditLog.save();
    console.log(`✅ Audit logged: ${action} by ${req.user.username} (${resolvedVillage || 'N/A'})`);

    return savedLog;
  } catch (error) {
    console.error(`❌ Error logging audit for action "${action}":`, error.message);
    // Don't throw - audit logging failure should not break the main operation
    return null;
  }
}

module.exports = { logAudit };
