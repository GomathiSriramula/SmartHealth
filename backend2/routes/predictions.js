const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { notifyUsersOfPrediction } = require("../utils/mailer");
const { Prediction, CaseReport } = require("../models");
const { checkForAlerts } = require("../services/alertChecker");
const { notifyAlertCreation } = require("../utils/mailer");
const { authMiddleware, requireRole, buildDistrictFilter, getUserDistrict } = require("../utils/auth");
const locationGuard = require("../utils/locationGuard");
const { logAudit } = require("../utils/auditLogger");

/**
 * Format a Date as YYYY-MM-DD using LOCAL time (not UTC).
 * Using toISOString().split('T')[0] shifts the date to UTC, which can bucket
 * a report submitted late at night into the previous day on the chart.
 */
function toLocalDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Location strings come from free-form operator input ("Peddapalli",
 * "peddapalli", " Peddapalli ", etc.) and were previously grouped by exact
 * string match, so the same district could show up as several separate
 * "Top Affected Locations" entries differing only in case/whitespace.
 *
 * normalizeLocationKey() gives a case/whitespace-insensitive grouping key.
 * titleCaseLocation() gives a consistent display label for that group,
 * regardless of which casing happened to be typed in first.
 */
function normalizeLocationKey(location) {
  return typeof location === "string" ? location.trim().toLowerCase() : "";
}

function titleCaseLocation(location) {
  return location
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Some older prediction records were created with a "Coordinates: (undefined,
// undefined)" placeholder location (see reports.js) when a report had
// neither a district nor valid lat/lng. That string isn't a real place —
// exclude it from location aggregates rather than showing it as a hotspot.
function isPlaceholderLocation(location) {
  return /^coordinates:\s*\(\s*undefined\s*,\s*undefined\s*\)$/i.test(location.trim());
}

/**
 * Adds one occurrence of `rawLocation` into an aggregation map keyed by its
 * normalized form, tracking a display label. Skips empty/placeholder values.
 * `bucketMap` entries look like: { label: string, ...extra }
 */
function addToLocationBucket(bucketMap, rawLocation, onCreate, onExisting) {
  if (typeof rawLocation !== "string") return;
  const trimmed = rawLocation.trim();
  if (!trimmed || isPlaceholderLocation(trimmed)) return;

  const key = normalizeLocationKey(trimmed);
  if (!bucketMap[key]) {
    bucketMap[key] = onCreate(titleCaseLocation(trimmed));
  } else if (onExisting) {
    onExisting(bucketMap[key]);
  }
  return bucketMap[key];
}

/**
 * POST /predictions
 * Create a new prediction and notify all registered users
 * 
 * SECURITY NOTE (Academic Project Design):
 * - This endpoint is intentionally secured with authentication and role-based location validation.
 * - ADMIN users are restricted to their assigned village location.
 * - USER and OPERATOR roles have no location restrictions.
 * - Email notifications trigger automatically for HIGH risk predictions.
 * - This design choice was made to keep the system simple and safe for an academic monitoring project.
 * 
 * Request body:
 * {
 *   "predictionType": "Disease Outbreak",
 *   "location": "Downtown Area",
 *   "riskLevel": "high",
 *   "details": "Predicted cholera outbreak based on water quality data",
 *   "recommendations": ["Boil water before drinking", "Seek medical attention if symptoms appear"],
 *   "lat": 40.7128,
 *   "lng": -74.0060,
 *   "modelVersion": "v1.0",
 *   "confidence": 85
 * }
 */
router.post("/predictions", authMiddleware, locationGuard(), async (req, res) => {
  try {
    const {
      predictionType,
      location,
      riskLevel,
      details,
      recommendations,
      lat,
      lng,
      modelVersion,
      confidence,
    } = req.body;

    // Validation
    if (!predictionType || !riskLevel || !details) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["predictionType", "riskLevel", "details"],
      });
    }

    // Create prediction document
    const operatorDistrict = getUserDistrict(req.user);
    const prediction = new Prediction({
      predictionType,
      location: location || operatorDistrict || "Unknown",
      riskLevel: riskLevel.toLowerCase(),
      details,
      recommendations: recommendations || [],
      lat,
      lng,
      modelVersion,
      confidence,
      predictedDate: new Date(),
    });

    await prediction.save();
    console.log(`✅ Prediction saved: ${prediction._id}`);
    console.log(`🔍 DEBUG: riskLevel="${prediction.riskLevel}", type=${typeof prediction.riskLevel}`);

    // Log audit event for CREATE_PREDICTION action
    await logAudit({
      action: 'CREATE_PREDICTION',
      req,
      village: prediction.location,
      entityId: prediction._id,
      metadata: {
        predictionType: prediction.predictionType,
        riskLevel: prediction.riskLevel,
        location: prediction.location,
        confidence: prediction.confidence,
      },
    });

    // Check for alerts if this is a HIGH risk
    let alertResult = null;
    let alertNotifyResult = null;
    if (prediction.riskLevel && prediction.riskLevel.toLowerCase() === 'high') {
      console.log(`✓ Condition met: riskLevel is HIGH, checking for alerts...`);
      try {
        // Convert prediction format for alert checker
        // Alert checker expects: risk, predictedAt, waterQuality
        const predictionForAlert = {
          ...prediction.toObject(),
          risk: prediction.riskLevel, // Convert riskLevel to risk
          predictedAt: prediction.predictedDate, // Convert predictedDate to predictedAt
        };

        console.log(`📡 Calling checkForAlerts with location="${predictionForAlert.location}"...`);
        alertResult = await checkForAlerts(predictionForAlert);
        console.log(`📡 checkForAlerts returned:`, alertResult);

        // Email is sent HERE ONLY — via notifyAlertCreation — when a brand
        // new alert is created. notifyUsersOfPrediction() used to also fire
        // for this same case, and both functions resolve to the exact same
        // admin/operator recipient list (getAutomaticAlertRecipients), so
        // every new alert was sending two separate emails to the same
        // people. This route now sends exactly one.
        if (alertResult && alertResult.action === 'created' && alertResult.alert) {
          console.log(`🚨 [Alert] CREATED: ${alertResult.message}`);

          try {
            alertNotifyResult = await notifyAlertCreation(alertResult.alert);
            console.log(`📧 [Alert] Notification sent: ${alertNotifyResult.message}`);
          } catch (notifyError) {
            console.error(`⚠️  [Alert] Notification failed (non-blocking): ${notifyError.message}`);
            alertNotifyResult = { success: false, error: notifyError.message };
          }
        } else if (alertResult && alertResult.action === 'resolved' && alertResult.alert) {
          console.log(`✅ [Alert] RESOLVED: ${alertResult.message}`);
        } else if (alertResult) {
          console.log(`ℹ️  [Alert] ${alertResult.message}`);
        }
      } catch (alertError) {
        console.error(`⚠️  [Alert] Check failed (non-blocking): ${alertError.message}`);
        console.error(alertError);
      }
    } else {
      console.log(`⊘ Skipping alert check: riskLevel="${prediction.riskLevel}"`);
    }

    // Build the notification field for the response. No separate email call
    // here — alertNotifyResult (if any) already reflects the one email sent
    // above via notifyAlertCreation when action === 'created'.
    const shouldHaveNotified = !!(alertResult && alertResult.action === 'created');
    const notification = shouldHaveNotified
      ? (alertNotifyResult || { success: false, skipped: true, reason: 'Alert notification did not run' })
      : {
        success: false,
        skipped: true,
        reason: !alertResult
          ? 'Not a HIGH risk prediction — no alert check performed'
          : `Alert not newly created (action: "${alertResult.action}") — no duplicate email sent`,
      };

    return res.status(201).json({
      message: shouldHaveNotified
        ? "Prediction created and alert notification sent"
        : "Prediction created (no new alert — notification skipped)",
      prediction: {
        id: prediction._id,
        predictionType: prediction.predictionType,
        riskLevel: prediction.riskLevel,
        location: prediction.location,
        predictedDate: prediction.predictedDate,
      },
      notification,
      alert: alertResult ? {
        action: alertResult.action,
        message: alertResult.message,
        alertId: alertResult.alert ? alertResult.alert._id : null,
      } : null,
    });
  } catch (error) {
    console.error("Error creating prediction:", error.message);
    return res.status(500).json({
      error: "Failed to create prediction",
      detail: error.message,
    });
  }
});

/**
 * GET /predictions
 * Get all predictions with optional filtering and pagination
 * 
 * Query parameters:
 * - riskLevel: filter by risk level (low, medium, high)
 * - limit: number of results (default: 50)
 * - skip: number of results to skip (default: 0)
 * - sort: sort order (newest or oldest, default: newest)
 */
router.get("/predictions", authMiddleware, async (req, res) => {
  try {
    const { riskLevel, limit = 50, skip = 0, sort = "newest" } = req.query;

    const query = buildDistrictFilter(req.user);
    if (riskLevel) {
      query.riskLevel = riskLevel.toLowerCase();
    }

    const sortOrder = sort === "oldest" ? 1 : -1;

    const predictions = await Prediction.find(query)
      .sort({ predictedDate: sortOrder })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Prediction.countDocuments(query);

    return res.json({
      predictions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        returned: predictions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching predictions:", error.message);
    return res.status(500).json({
      error: "Failed to fetch predictions",
      detail: error.message,
    });
  }
});

/**
 * GET /predictions/landing-stats
 * Public endpoint for landing page statistics
 * Returns overall health monitoring statistics based on recent predictions
 */
router.get("/predictions/landing-stats", async (req, res) => {
  try {
    // Get predictions from last 30 days for landing page stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPredictions = await Prediction.find({
      predictedDate: { $gte: thirtyDaysAgo }
    });

    // If no predictions, return default values
    if (recentPredictions.length === 0) {
      return res.json({
        healthyAreas: 87,
        atRisk: 10,
        alertZones: 3,
        totalMonitored: recentPredictions.length
      });
    }

    // Calculate risk distribution
    const highRisk = recentPredictions.filter(p =>
      p.riskLevel && p.riskLevel.toLowerCase() === 'high'
    ).length;

    const mediumRisk = recentPredictions.filter(p =>
      p.riskLevel && p.riskLevel.toLowerCase() === 'medium'
    ).length;

    const lowRisk = recentPredictions.filter(p =>
      p.riskLevel && p.riskLevel.toLowerCase() === 'low'
    ).length;

    const total = recentPredictions.length;

    // Calculate percentages
    const alertZones = Math.round((highRisk / total) * 100);
    const atRisk = Math.round((mediumRisk / total) * 100);
    const healthyAreas = 100 - alertZones - atRisk;

    return res.json({
      healthyAreas: healthyAreas >= 0 ? healthyAreas : 0,
      atRisk,
      alertZones,
      totalMonitored: total
    });

  } catch (error) {
    console.error("Error fetching landing stats:", error.message);
    // Return default values on error
    return res.json({
      healthyAreas: 87,
      atRisk: 10,
      alertZones: 3,
      totalMonitored: 0
    });
  }
});

/**
 * GET /predictions/:id
 * Get a specific prediction by ID
 */
router.delete("/predictions/orphaned", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    // Two ways a prediction can be linked to a case report:
    //  1. Top-level `relatedReportId` — set by POST /predictions and (after
    //     the uploads.js fix) new CSV-bulk predictions.
    //  2. `metadata.caseReportId` — the ONLY link legacy CSV-bulk predictions
    //     have (uploads.js used to forget to set relatedReportId). Kept here
    //     so predictions created before that fix can still be detected.
    const predictionsWithReport = await Prediction.find({
      $or: [
        { relatedReportId: { $ne: null } },
        { 'metadata.caseReportId': { $ne: null } },
      ],
    }).select('_id relatedReportId metadata.caseReportId');

    if (predictionsWithReport.length === 0) {
      return res.json({ success: true, message: 'No predictions are linked to a report', deleted: 0 });
    }

    const getLinkedReportId = (p) => p.relatedReportId || p.metadata?.caseReportId || null;

    const reportIds = predictionsWithReport
      .map(getLinkedReportId)
      .filter(Boolean);
    const existingReports = await CaseReport.find({ _id: { $in: reportIds } }).select('_id');
    const existingReportIds = new Set(existingReports.map((r) => r._id.toString()));

    const orphanedIds = predictionsWithReport
      .filter((p) => {
        const linkedId = getLinkedReportId(p);
        return linkedId && !existingReportIds.has(linkedId.toString());
      })
      .map((p) => p._id);

    if (orphanedIds.length === 0) {
      return res.json({ success: true, message: 'No orphaned predictions found', deleted: 0 });
    }

    // Resolve (not hard-delete) any alerts those orphaned predictions
    // triggered — same audit-preserving approach used by DELETE /reports/:id.
    const Alert = require("../models/Alert");
    const alertUpdateResult = await Alert.updateMany(
      { "triggeringPredictions.predictionId": { $in: orphanedIds }, status: "active" },
      { status: "resolved", resolvedAt: new Date(), resolvedReason: "Related report no longer exists" }
    );

    const deleteResult = await Prediction.deleteMany({ _id: { $in: orphanedIds } });

    await logAudit({
      action: 'CLEANUP_ORPHANED_PREDICTIONS',
      req,
      metadata: {
        deletedCount: deleteResult.deletedCount,
        resolvedAlerts: alertUpdateResult.modifiedCount,
      },
    });

    console.log(`🧹 Cleaned up ${deleteResult.deletedCount} orphaned prediction(s) by ${req.user.username}`);

    return res.json({
      success: true,
      message: `Removed ${deleteResult.deletedCount} orphaned prediction(s)`,
      deleted: deleteResult.deletedCount,
      resolvedAlerts: alertUpdateResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error cleaning up orphaned predictions:", error.message);
    return res.status(500).json({
      error: "Failed to clean up orphaned predictions",
      detail: error.message,
    });
  }
});

/**
 * DELETE /predictions/untracked
 * Maintenance endpoint (ADMIN only).
 *
 * Unlike /predictions/orphaned (which removes predictions whose
 * relatedReportId/metadata.caseReportId points at a report that was
 * deleted), this removes predictions that never had EITHER field set in
 * the first place — legacy records (typically from an older CSV bulk-
 * upload path) with no way to trace them back to a report at all. These
 * don't show up in /predictions/orphaned's results because that endpoint
 * can only act on predictions it can prove are broken links; these have
 * no link to check.
 *
 * This is intentionally a separate, explicitly-named action rather than
 * folded into /orphaned, since a prediction with no link field COULD also
 * be a legitimate manual entry created directly via POST /predictions.
 * Only run this if you've confirmed the untracked predictions really are
 * leftover junk (e.g. all your case reports are gone but predictions
 * remain).
 */
router.delete("/predictions/untracked", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const untracked = await Prediction.find({
      relatedReportId: null,
      'metadata.caseReportId': null,
    }).select('_id');

    if (untracked.length === 0) {
      return res.json({ success: true, message: 'No untracked predictions found', deleted: 0 });
    }

    const untrackedIds = untracked.map((p) => p._id);

    // Resolve (not hard-delete) any alerts these untracked predictions
    // triggered — same audit-preserving approach used by /predictions/orphaned.
    const Alert = require("../models/Alert");
    const alertUpdateResult = await Alert.updateMany(
      { "triggeringPredictions.predictionId": { $in: untrackedIds }, status: "active" },
      { status: "resolved", resolvedAt: new Date(), resolvedReason: "Untracked prediction removed (no linked report)" }
    );

    const deleteResult = await Prediction.deleteMany({ _id: { $in: untrackedIds } });

    await logAudit({
      action: 'CLEANUP_UNTRACKED_PREDICTIONS',
      req,
      metadata: {
        deletedCount: deleteResult.deletedCount,
        resolvedAlerts: alertUpdateResult.modifiedCount,
      },
    });

    console.log(`🧹 Cleaned up ${deleteResult.deletedCount} untracked prediction(s) by ${req.user.username}`);

    return res.json({
      success: true,
      message: `Removed ${deleteResult.deletedCount} untracked prediction(s)`,
      deleted: deleteResult.deletedCount,
      resolvedAlerts: alertUpdateResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error cleaning up untracked predictions:", error.message);
    return res.status(500).json({
      error: "Failed to clean up untracked predictions",
      detail: error.message,
    });
  }
});

router.get("/predictions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findOne({ _id: id, ...buildDistrictFilter(req.user) });

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    return res.json(prediction);
  } catch (error) {
    console.error("Error fetching prediction:", error.message);
    return res.status(500).json({
      error: "Failed to fetch prediction",
      detail: error.message,
    });
  }
});

/**
 * POST /predictions/:id/notify
 * Resend email notification for a specific prediction
 */
router.post("/predictions/:id/notify", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findOne({ _id: id, ...buildDistrictFilter(req.user) });

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    const result = await notifyUsersOfPrediction(prediction);

    return res.json({
      message: "Notification sent",
      prediction: {
        id: prediction._id,
        predictionType: prediction.predictionType,
        riskLevel: prediction.riskLevel,
      },
      notification: result,
    });
  } catch (error) {
    console.error("Error sending notification:", error.message);
    return res.status(500).json({
      error: "Failed to send notification",
      detail: error.message,
    });
  }
});

/**
 * DELETE /predictions/:id
 * Delete a specific prediction
 */
router.delete("/predictions/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findOneAndDelete({ _id: id, ...buildDistrictFilter(req.user) });

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    return res.json({
      message: "Prediction deleted successfully",
      prediction: {
        id: prediction._id,
        predictionType: prediction.predictionType,
      },
    });
  } catch (error) {
    console.error("Error deleting prediction:", error.message);
    return res.status(500).json({
      error: "Failed to delete prediction",
      detail: error.message,
    });
  }
});

/**
 * DELETE /predictions/orphaned
 * Maintenance endpoint (ADMIN only).
 *
 * Normal deletes via DELETE /reports/:id already cascade-delete any
 * predictions linked to that report. This endpoint exists for the case
 * where case reports were removed some other way (direct DB access, a
 * migration, a manual Mongo shell command, etc.) and left behind
 * "orphaned" predictions — predictions whose relatedReportId no longer
 * points to an existing CaseReport. Those orphans keep showing up in
 * /analytics (Risk Assessments, High Risk Cases, Top Affected Locations)
 * even though the underlying case report is gone.
 *
 * Predictions created directly via POST /predictions (relatedReportId is
 * null) are NOT touched — those were never tied to a case report in the
 * first place, so they aren't "orphaned".
 */


/**
 * GET /analytics
 * Get comprehensive analytics data for predictions
 * Includes risk level distribution, trends over time, location hotspots, etc.
 */
router.get("/analytics", authMiddleware, async (req, res) => {
  try {
    const { timeRange = "30" } = req.query; // Default to last 30 days

    // Calculate date range
    const daysAgo = parseInt(timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Get all predictions within the time range
    const districtFilter = buildDistrictFilter(req.user);

    const predictions = await Prediction.find({
      ...districtFilter,
      predictedDate: { $gte: startDate }
    }).sort({ predictedDate: -1 });

    const allPredictions = await Prediction.find(districtFilter);

    // Get case reports from admins
    const caseReports = await CaseReport.find({
      ...districtFilter,
      reported_at: { $gte: startDate }
    }).sort({ reported_at: -1 });

    const allCaseReports = await CaseReport.find(districtFilter);

    // Risk Level Distribution
    const riskDistribution = {
      high: predictions.filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'high').length,
      medium: predictions.filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'medium').length,
      low: predictions.filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'low').length,
    };

    // Total counts
    const totalPredictions = allPredictions.length;
    const recentPredictions = predictions.length;
    const totalCaseReports = allCaseReports.length;

    // Average confidence
    const predictionsWithConfidence = predictions.filter(p => p.confidence);
    const averageConfidence = predictionsWithConfidence.length > 0
      ? predictionsWithConfidence.reduce((sum, p) => sum + p.confidence, 0) / predictionsWithConfidence.length
      : 0;

    // Predictions by type
    const predictionTypes = {};
    predictions.forEach(p => {
      const type = p.predictionType || 'Unknown';
      predictionTypes[type] = (predictionTypes[type] || 0) + 1;
    });

    // Symptoms distribution from case reports
    const symptomsDistribution = {};
    caseReports.forEach(report => {
      if (report.symptoms && Array.isArray(report.symptoms)) {
        report.symptoms.forEach(symptom => {
          symptomsDistribution[symptom] = (symptomsDistribution[symptom] || 0) + 1;
        });
      }
    });

    // Top 10 symptoms
    const topSymptoms = Object.entries(symptomsDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symptom, count]) => ({ symptom, count }));

    // Demographics from case reports
    const ageGroups = {
      '0-18': 0,
      '19-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0,
      'Unknown': 0
    };

    const genderDistribution = { M: 0, F: 0, O: 0 };

    caseReports.forEach(report => {
      // Age groups — only bucket valid, non-negative numeric ages.
      // Missing/invalid patient_age used to fall through to '65+' by accident
      // (undefined <= 18/35/50/65 all evaluate to false), silently skewing
      // the Age Distribution chart. Now it goes to an explicit 'Unknown' bucket.
      const age = Number(report.patient_age);
      if (Number.isFinite(age) && age >= 0) {
        if (age <= 18) ageGroups['0-18']++;
        else if (age <= 35) ageGroups['19-35']++;
        else if (age <= 50) ageGroups['36-50']++;
        else if (age <= 65) ageGroups['51-65']++;
        else ageGroups['65+']++;
      } else {
        ageGroups['Unknown']++;
      }

      // Gender
      if (report.sex) {
        genderDistribution[report.sex] = (genderDistribution[report.sex] || 0) + 1;
      }
    });

    // Reporter types
    const reporterTypes = {};
    caseReports.forEach(report => {
      const type = report.reporter_type || 'Unknown';
      reporterTypes[type] = (reporterTypes[type] || 0) + 1;
    });

    // Time series data (predictions and case reports per day)
    const timeSeriesData = [];
    const dailyData = {};

    predictions.forEach(p => {
      // Use local time, not UTC, so a report made late at night doesn't get
      // bucketed onto the previous day's bar in the chart.
      const date = toLocalDateString(p.predictedDate);
      if (!dailyData[date]) {
        dailyData[date] = { date, high: 0, medium: 0, low: 0, total: 0, caseReports: 0 };
      }
      const risk = (p.riskLevel || 'low').toLowerCase();
      dailyData[date][risk]++;
      dailyData[date].total++;
    });

    caseReports.forEach(report => {
      const date = toLocalDateString(report.reported_at);
      if (!dailyData[date]) {
        dailyData[date] = { date, high: 0, medium: 0, low: 0, total: 0, caseReports: 0 };
      }
      dailyData[date].caseReports++;
    });

    // Fill in missing dates with zeros
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = toLocalDateString(date);
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { date: dateStr, high: 0, medium: 0, low: 0, total: 0, caseReports: 0 };
      }
    }

    // Sort by date
    const sortedDates = Object.keys(dailyData).sort();
    sortedDates.forEach(date => {
      timeSeriesData.push(dailyData[date]);
    });

    // Location hotspots from both predictions and case reports.
    // Grouped by a normalized (trimmed, lowercased) key so "Peddapalli" and
    // "peddapalli" count as the SAME place instead of two separate rows.
    const locationCounts = {};

    predictions.forEach((p) => {
      addToLocationBucket(
        locationCounts,
        p.location,
        (label) => ({ label, count: 1 }),
        (entry) => { entry.count += 1; }
      );
    });

    caseReports.forEach((report) => {
      addToLocationBucket(
        locationCounts,
        report.location,
        (label) => ({ label, count: 1 }),
        (entry) => { entry.count += 1; }
      );
    });

    const topLocations = Object.values(locationCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ label, count }) => ({ location: label, count }));

    // Geographic clusters from case reports
    const geoClusters = caseReports
      .filter(r => r.lat && r.lng)
      .map(r => ({
        lat: r.lat,
        lng: r.lng,
        location: r.location || 'Unknown',
        symptoms: r.symptoms || []
      }));

    // Recent high-risk predictions
    const recentHighRisk = predictions
      .filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'high')
      .slice(0, 5)
      .map(p => ({
        id: p._id,
        type: p.predictionType,
        location: p.location,
        confidence: p.confidence,
        date: p.predictedDate,
        details: p.details
      }));

    // Recent individual case reports
    const recentCaseReports = caseReports
      .slice(0, 10)
      .map(report => ({
        id: report._id,
        reporter_type: report.reporter_type,
        reporter_id: report.reporter_id,
        patient_age: report.patient_age,
        sex: report.sex,
        location: report.location || 'Unknown',
        lat: report.lat,
        lng: report.lng,
        symptoms: report.symptoms || [],
        reported_at: report.reported_at,
        created_at: report.created_at
      }));

    // Confidence distribution
    const confidenceRanges = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    };

    predictionsWithConfidence.forEach(p => {
      const conf = p.confidence;
      if (conf <= 20) confidenceRanges['0-20']++;
      else if (conf <= 40) confidenceRanges['21-40']++;
      else if (conf <= 60) confidenceRanges['41-60']++;
      else if (conf <= 80) confidenceRanges['61-80']++;
      else confidenceRanges['81-100']++;
    });

    // Model versions usage
    const modelVersions = {};
    predictions.forEach(p => {
      if (p.modelVersion) {
        modelVersions[p.modelVersion] = (modelVersions[p.modelVersion] || 0) + 1;
      }
    });

    // Per-district risk summary — location name + a coarse Critical/Moderate
    // label only. This is the ONLY case-level signal sent to restricted
    // (USER role) clients; it deliberately carries no patient data, exact
    // coordinates, confidence scores, or free-text case details.
    // Grouped the same case/whitespace-insensitive way as topLocations above,
    // so "Peddapalli" and "peddapalli" collapse into one district row.
    const locationRiskMap = {};
    predictions.forEach((p) => {
      const risk = (p.riskLevel || 'low').toLowerCase();
      addToLocationBucket(
        locationRiskMap,
        p.location,
        (label) => ({ label, risk: risk === 'high' ? 'critical' : 'moderate' }),
        (entry) => { if (risk === 'high') entry.risk = 'critical'; }
      );
    });
    caseReports.forEach((r) => {
      addToLocationBucket(
        locationRiskMap,
        r.location,
        (label) => ({ label, risk: 'moderate' })
        // no onExisting: a plain case report never downgrades an existing
        // 'critical' entry back to 'moderate'
      );
    });
    const districtRiskSummary = Object.values(locationRiskMap).map(({ label, risk }) => ({
      location: label,
      riskLevel: risk === 'critical' ? 'Critical' : 'Moderate'
    }));

    // USER role gets aggregate/chart data (counts, distributions, trends —
    // nothing tied to an individual) but never the per-case detail arrays.
    const isRestrictedUser = (req.user?.role || 'USER') === 'USER';

    return res.json({
      summary: {
        totalPredictions,
        recentPredictions,
        totalCaseReports,
        recentCaseReports: recentCaseReports.length,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        timeRange: `Last ${daysAgo} days`,
        lastUpdated: new Date().toISOString()
      },
      riskDistribution,
      predictionTypes,
      symptomsDistribution: topSymptoms,
      demographics: {
        ageGroups,
        genderDistribution
      },
      reporterTypes,
      timeSeriesData,
      topLocations,
      geoClusters: isRestrictedUser ? [] : geoClusters,
      recentHighRisk: isRestrictedUser ? [] : recentHighRisk,
      recentCaseReportsList: isRestrictedUser ? [] : recentCaseReports,
      districtRiskSummary,
      confidenceDistribution: confidenceRanges,
      modelVersions
    });

  } catch (error) {
    console.error("Error fetching analytics:", error.message);
    return res.status(500).json({
      error: "Failed to fetch analytics",
      detail: error.message,
    });
  }
});

module.exports = router;