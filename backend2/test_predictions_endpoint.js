// Quick test to check predictions endpoint
const fetch = require('node-fetch');

async function testPredictions() {
  try {
    console.log('🔍 Testing Predictions Endpoint...\n');
    
    const response = await fetch('http://localhost:5000/predictions');
    const data = await response.json();
    
    console.log('✅ Response Status:', response.status);
    console.log('📊 Total Predictions:', data.pagination?.total || data.predictions?.length);
    console.log('\n📋 Predictions:');
    
    if (data.predictions && data.predictions.length > 0) {
      data.predictions.slice(0, 3).forEach((pred, idx) => {
        console.log(`\n${idx + 1}. Prediction ID: ${pred._id}`);
        console.log(`   Type: ${pred.predictionType}`);
        console.log(`   Risk Level: ${pred.riskLevel}`);
        console.log(`   Location: ${pred.location || 'N/A'}`);
        console.log(`   Confidence: ${pred.confidence ? pred.confidence + '%' : 'N/A'}`);
        console.log(`   Date: ${new Date(pred.predictedDate).toLocaleString()}`);
        console.log(`   Details: ${pred.details.substring(0, 80)}...`);
        if (pred.recommendations) {
          console.log(`   Recommendations: ${pred.recommendations.length} items`);
        }
      });
      
      if (data.predictions.length > 3) {
        console.log(`\n... and ${data.predictions.length - 3} more predictions`);
      }
    } else {
      console.log('   No predictions found');
    }
    
    console.log('\n✨ Test Complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPredictions();
