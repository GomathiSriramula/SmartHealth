const express = require("express");
const router = express.Router();
const { notifyUsersOfPrediction } = require("../utils/mailer");
const { Prediction } = require("../models");
const { checkForAlerts } = require("../services/alertChecker");
const { notifyAlertCreation } = require("../utils/mailer");

/**
 * POST /predictions
 * Create a new prediction and notify all registered users
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
router.post("/predictions", async (req, res) => {
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
    const prediction = new Prediction({
      predictionType,
      location: location || "Unknown",
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

    // Check for alerts if this is a HIGH risk
    let alertResult = null;
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
        
        if (alertResult && alertResult.action === 'created' && alertResult.alert) {
          console.log(`🚨 [Alert] CREATED: ${alertResult.message}`);
          
          // Send notification
          try {
            const notifyResult = await notifyAlertCreation(alertResult.alert);
            console.log(`📧 [Alert] Notification sent: ${notifyResult.message}`);
          } catch (notifyError) {
            console.error(`⚠️  [Alert] Notification failed (non-blocking): ${notifyError.message}`);
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

    // Send email notifications to all users
    try {
      const result = await notifyUsersOfPrediction(prediction);
      console.log(`📧 Email notification result:`, result);

      return res.status(201).json({
        message: "Prediction created and notifications sent",
        prediction: {
          id: prediction._id,
          predictionType: prediction.predictionType,
          riskLevel: prediction.riskLevel,
          location: prediction.location,
          predictedDate: prediction.predictedDate,
        },
        notification: result,
        alert: alertResult ? {
          action: alertResult.action,
          message: alertResult.message,
          alertId: alertResult.alert ? alertResult.alert._id : null,
        } : null,
      });
    } catch (emailError) {
      console.error("Failed to send email notifications:", emailError.message);
      // Still return success for prediction creation
      return res.status(201).json({
        message: "Prediction created but email notification failed",
        prediction: {
          id: prediction._id,
          predictionType: prediction.predictionType,
          riskLevel: prediction.riskLevel,
          location: prediction.location,
          predictedDate: prediction.predictedDate,
        },
        notification: {
          success: false,
          error: emailError.message,
        },
        alert: alertResult ? {
          action: alertResult.action,
          message: alertResult.message,
          alertId: alertResult.alert ? alertResult.alert._id : null,
        } : null,
      });
    }
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
router.get("/predictions", async (req, res) => {
  try {
    const { riskLevel, limit = 50, skip = 0, sort = "newest" } = req.query;

    const query = {};
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
 * GET /predictions/:id
 * Get a specific prediction by ID
 */
router.get("/predictions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findById(id);

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
router.post("/predictions/:id/notify", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findById(id);

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
router.delete("/predictions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const prediction = await Prediction.findByIdAndDelete(id);

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
 * GET /analytics
 * Get comprehensive analytics data for predictions
 * Includes risk level distribution, trends over time, location hotspots, etc.
 */
router.get("/analytics", async (req, res) => {
  try {
    const { timeRange = "30" } = req.query; // Default to last 30 days
    
    // Calculate date range
    const daysAgo = parseInt(timeRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    // Get all predictions within the time range
    const predictions = await Prediction.find({
      predictedDate: { $gte: startDate }
    }).sort({ predictedDate: -1 });
    
    const allPredictions = await Prediction.find({});
    
    // Risk Level Distribution
    const riskDistribution = {
      high: predictions.filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'high').length,
      medium: predictions.filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'medium').length,
      low: predictions.filter(p => p.riskLevel && p.riskLevel.toLowerCase() === 'low').length,
    };
    
    // Total counts
    const totalPredictions = allPredictions.length;
    const recentPredictions = predictions.length;
    
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
    
    // Time series data (predictions per day)
    const timeSeriesData = [];
    const dailyData = {};
    
    predictions.forEach(p => {
      const date = new Date(p.predictedDate).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { date, high: 0, medium: 0, low: 0, total: 0 };
      }
      const risk = (p.riskLevel || 'low').toLowerCase();
      dailyData[date][risk]++;
      dailyData[date].total++;
    });
    
    // Fill in missing dates with zeros
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { date: dateStr, high: 0, medium: 0, low: 0, total: 0 };
      }
    }
    
    // Sort by date
    const sortedDates = Object.keys(dailyData).sort();
    sortedDates.forEach(date => {
      timeSeriesData.push(dailyData[date]);
    });
    
    // Location hotspots (top 10 locations)
    const locationCounts = {};
    predictions.forEach(p => {
      if (p.location) {
        locationCounts[p.location] = (locationCounts[p.location] || 0) + 1;
      }
    });
    
    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }));
    
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
    
    return res.json({
      summary: {
        totalPredictions,
        recentPredictions,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        timeRange: `Last ${daysAgo} days`,
        lastUpdated: new Date().toISOString()
      },
      riskDistribution,
      predictionTypes,
      timeSeriesData,
      topLocations,
      recentHighRisk,
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
