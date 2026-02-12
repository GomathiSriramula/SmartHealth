/**
 * Debug script to check case reports, predictions, and alerts
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { CaseReport, Prediction, AuditLog } = require('./models');
const Alert = require('./models/Alert');

// Copy the analyzeReportRisk logic from uploads.js
function analyzeReportRisk(report) {
  const symptoms = Array.isArray(report.symptoms) ? report.symptoms : [];
  
  const highRiskSymptoms = [
    'severe diarrhea', 'diarrhea', 'bloody stool', 'bloody diarrhea',
    'dehydration', 'severe dehydration', 'cholera', 'typhoid',
    'dysentery', 'hepatitis', 'severe vomiting', 'high fever with diarrhea'
  ];
  
  const mediumRiskSymptoms = [
    'nausea', 'vomiting', 'stomach cramps', 'abdominal pain',
    'mild fever', 'fatigue', 'weakness', 'headache', 'loss of appetite'
  ];
  
  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());
  
  const highRiskMatches = normalizedSymptoms.filter(s => 
    highRiskSymptoms.some(hrs => s.includes(hrs) || hrs.includes(s))
  ).length;
  
  const mediumRiskMatches = normalizedSymptoms.filter(s => 
    mediumRiskSymptoms.some(mrs => s.includes(mrs) || mrs.includes(s))
  ).length;
  
  let riskLevel = 'low';
  let confidence = 50;
  
  if (highRiskMatches >= 2) {
    riskLevel = 'high';
    confidence = Math.min(85 + (highRiskMatches * 5), 98);
  } else if (highRiskMatches === 1) {
    riskLevel = 'high';
    confidence = 75 + (mediumRiskMatches * 3);
  } else if (mediumRiskMatches >= 3) {
    riskLevel = 'medium';
    confidence = 65 + (mediumRiskMatches * 2);
  } else if (mediumRiskMatches >= 1) {
    riskLevel = 'low';
    confidence = 50 + (mediumRiskMatches * 5);
  }
  
  return { riskLevel, confidence, highRiskMatches, mediumRiskMatches, normalizedSymptoms };
}

async function debugData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_health';
    console.log(`🔌 Connecting to MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get case reports
    const caseReports = await CaseReport.find().sort({ created_at: -1 }).limit(10);
    console.log(`📋 Case Reports (last 10):`);
    console.log(`Count: ${await CaseReport.countDocuments()}`);
    caseReports.forEach((cr, i) => {
      const analysis = analyzeReportRisk(cr);
      console.log(`  ${i + 1}. Risk: ${analysis.riskLevel.toUpperCase()} | Symptoms: ${cr.symptoms.join(', ')} | Loc: (${cr.lat}, ${cr.lng}) | Age: ${cr.patient_age}`);
      if (analysis.riskLevel === 'high') {
        console.log(`      ✓ High-risk matches: ${analysis.highRiskMatches} | Medium matches: ${analysis.mediumRiskMatches}`);
      }
    });
    console.log('');

    // Get predictions
    const predictions = await Prediction.find().sort({ created_at: -1 }).limit(15);
    console.log(`🔮 Predictions (last 15):`);
    console.log(`Count: ${await Prediction.countDocuments()}`);
    predictions.forEach((pred, i) => {
      console.log(`  ${i + 1}. Type: ${pred.predictionType} | Risk: ${pred.riskLevel.toUpperCase()} | Location: ${pred.location}`);
    });
    console.log('');

    // Get alerts
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(10);
    console.log(`🚨 Alerts:`);
    console.log(`Total: ${await Alert.countDocuments()} | Active: ${await Alert.countDocuments({ status: 'active' })} | Resolved: ${await Alert.countDocuments({ status: 'resolved' })}`);
    alerts.forEach((alert, i) => {
      const pred1 = alert.triggeringPredictions[0];
      const pred2 = alert.triggeringPredictions[1];
      console.log(`  ${i + 1}. Location: "${alert.location}" | Status: ${alert.status} | Predictions: ${alert.triggeringPredictions.length}`);
      console.log(`      Created: ${alert.createdAt}`);
      if (pred1) console.log(`      Pred 1 ID: ${pred1.predictionId}`);
      if (pred2) console.log(`      Pred 2 ID: ${pred2.predictionId}`);
    });
    console.log('');

    // Get audit logs
    const auditLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(10);
    console.log(`📔 Audit Logs (last 10):`);
    console.log(`Total: ${await AuditLog.countDocuments()}`);
    auditLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. Action: ${log.action} | User: ${log.username} | Time: ${log.timestamp}`);
      if (log.metadata) {
        console.log(`      Metadata: ${JSON.stringify(log.metadata).substring(0, 100)}...`);
      }
    });
    console.log('');

    // Analyze predictions by location
    console.log(`📊 Predictions by Location:`);
    const predsByLocation = {};
    predictions.forEach(pred => {
      const loc = pred.location || 'Unknown';
      if (!predsByLocation[loc]) {
        predsByLocation[loc] = [];
      }
      predsByLocation[loc].push(pred);
    });
    
    Object.entries(predsByLocation).slice(0, 10).forEach(([loc, preds]) => {
      const highRiskCount = preds.filter(p => p.riskLevel.toLowerCase() === 'high').length;
      console.log(`  "${loc}": ${preds.length} predictions (${highRiskCount} HIGH)`);
    });

    console.log('\n✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugData();
