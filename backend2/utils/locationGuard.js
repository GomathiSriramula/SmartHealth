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

const locationGuard = (options = {}) => {
  return (req, res, next) => {
    // Skip if no user (shouldn't happen after authMiddleware, but be safe)
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // All authenticated roles are allowed through.
    next();
  };
};

module.exports = locationGuard;
