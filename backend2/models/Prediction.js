/**
 * ML Prediction Model
 * 
 * Stores water quality predictions with timestamps and model results.
 */

const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  // Input data
  waterQuality: {
    pH: { type: Number, required: true },
    Turbidity: { type: Number, required: true },
    Dissolved_Oxygen: { type: Number, required: true }
  },
  
  // ML Model output
  risk: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  probabilities: {
    LOW: Number,
    MEDIUM: Number,
    HIGH: Number
  },
  
  // Metadata
  location: { type: String },
  source: { type: String }, // 'manual', 'batch'
  
  // Timestamps
  predictedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Index for faster queries
PredictionSchema.index({ predictedAt: -1 });
PredictionSchema.index({ risk: 1 });

// Check if model already exists before creating
let Prediction;
try {
  Prediction = mongoose.model('Prediction');
} catch (error) {
  // Model doesn't exist, create it
  Prediction = mongoose.model('Prediction', PredictionSchema, 'predictions');
}

module.exports = Prediction;
