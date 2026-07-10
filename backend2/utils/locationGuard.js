/**
 * Location-based access control middleware
 * 
 * Legacy location guard.
 * The updated auth flow no longer enforces village-based restrictions here.
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

const { operatorMatchesDistrict } = require("./auth");

const locationGuard = (options = {}) => {
  return (req, res, next) => {
    // Skip if no user (shouldn't happen after authMiddleware, but be safe)
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role !== "OPERATOR") {
      return next();
    }

    const requestedLocation = typeof options.getLocationFromData === "function"
      ? options.getLocationFromData(req)
      : req.body?.location || req.body?.district || req.body?.village || req.query?.location || req.params?.location || "";

    if (!requestedLocation) {
      return next();
    }

    if (!operatorMatchesDistrict(req.user, requestedLocation)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Operators can only access records for their assigned district",
      });
    }

    next();
  };
};

module.exports = locationGuard;
