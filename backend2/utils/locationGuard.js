/**
 * Location-based access control middleware
 * 
 * Enforces location restrictions based on user role:
 * - ADMIN: Restricted to assigned village
 * - OPERATOR: No location restrictions (district-level access)
 * - USER: No location restrictions
 * 
 * Should be applied AFTER authMiddleware
 * 
 * Usage:
 * // Basic usage - reads from req.body.location or req.body.village
 * router.post('/endpoint', authMiddleware, locationGuard(), handler);
 * 
 * // Custom location extraction (for CSV or complex payloads)
 * router.post('/csv-upload', authMiddleware, locationGuard({
 *   getLocationFromData: (req) => req.csvRow.village
 * }), handler);
 * 
 * // Pass location explicitly for each request
 * // Inside handler: req.locationGuardContext = { requestedLocation: ... }
 */

const locationGuard = (options = {}) => {
  return (req, res, next) => {
    // Skip if no user (shouldn't happen after authMiddleware, but be safe)
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = req.user.role || 'USER';
    const adminLocation = req.user.adminLocation;

    // USER and OPERATOR roles have no location restrictions
    if (userRole === 'USER' || userRole === 'OPERATOR') {
      return next();
    }

    // ADMIN role: enforce location restrictions
    if (userRole === 'ADMIN') {
      // Validate that admin has location assigned
      if (!adminLocation || !adminLocation.village) {
        return res.status(500).json({ 
          error: "Admin location not configured",
          detail: "Admin user is missing location assignment"
        });
      }

      // Extract location from request using custom function or default
      let requestLocation = null;
      
      if (options.getLocationFromData && typeof options.getLocationFromData === 'function') {
        // Use custom extraction function (for CSV data, complex payloads, etc.)
        try {
          requestLocation = options.getLocationFromData(req);
        } catch (e) {
          return res.status(400).json({ 
            error: "Failed to extract location from request",
            detail: e.message
          });
        }
      } else {
        // Default: check req.body.location or req.body.village
        requestLocation = req.body.location || req.body.village;
      }

      // Validate that location was provided
      if (!requestLocation) {
        return res.status(400).json({ 
          error: "Location not provided",
          detail: "Request must include 'location' or 'village' field"
        });
      }

      // Case-insensitive comparison for village validation
      const adminVillage = adminLocation.village.toLowerCase().trim();
      const submitLocation = requestLocation.toString().toLowerCase().trim();

      // Reject if admin's village doesn't match request location
      if (adminVillage !== submitLocation) {
        return res.status(403).json({
          error: "Unauthorized location",
          detail: `Admin is assigned to village '${adminLocation.village}' but requested location '${requestLocation}'`,
          allowedVillage: adminLocation.village
        });
      }
    }

    // Allow request to proceed
    next();
  };
};

module.exports = locationGuard;
