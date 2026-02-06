# SmartHealth Testing & Stability Guide

## Overview

This guide covers testing, validation, monitoring, and troubleshooting for the SmartHealth system.

## Test Suite Overview

### 1. Integration Tests (`test_integration.py`)

Comprehensive end-to-end tests covering:
- Service health checks
- ML service functionality
- Backend API endpoints
- Alert system
- Complete workflows

**Run Tests:**
```bash
python test_integration.py
```

**Expected Output:**
```
==================================================
SmartHealth End-to-End Integration Tests
Started: 2024-XX-XX HH:MM:SS
==================================================

Phase 1: Service Health Checks
✓ ML Service Health Check
✓ Backend Health Check
...
[Results Summary]
Tests Run: 25
Passed: 25
Failed: 0
```

### 2. IoT Sensor Simulator (`ml_model/sensor_simulator.py`)

Simulates real-world water quality sensors with:
- Configurable update intervals
- Multiple locations with realistic baselines
- Anomaly injection (10% probability)
- Real predictions via backend API

**Run Simulator:**
```bash
# Run forever
python ml_model/sensor_simulator.py

# Run for 5 minutes
python ml_model/sensor_simulator.py --duration 300

# Generate 50 readings then stop
python ml_model/sensor_simulator.py --max-readings 50

# Custom backend URL
python ml_model/sensor_simulator.py --backend-url http://192.168.1.100:5000

# Faster updates (every 5 seconds)
python ml_model/sensor_simulator.py --interval 5
```

**Example Output:**
```
================================================================================
SmartHealth IoT Sensor Simulator
================================================================================
Backend URL: http://localhost:5000
Update Interval: 10s
Locations: 5
================================================================================

✓ Main Treatment Plant    pH: 7.20 Turbidity: 2.30 O2: 8.40 → LOW (92%)
✓ Secondary Plant         pH: 6.95 Turbidity: 3.10 O2: 7.95 → LOW (88%)
✓ Distribution Zone A     pH: 7.35 Turbidity: 2.40 O2: 7.85 → LOW (85%)
✓ Distribution Zone B     pH: 7.05 Turbidity: 8.50 O2: 3.20 → HIGH (78%) [ANOMALY]
✓ Monitoring Point X      pH: 6.85 Turbidity: 4.20 O2: 7.10 → MEDIUM (71%)
[12:30:45] Waiting 10s until next update...
```

## Performance & Stability Tests

### Load Testing

**Single Prediction Throughput:**
```bash
# Generate 100 predictions in sequence
python test_integration.py  # Will show latency for each request
```

**Expected Baseline:**
- Single prediction: 100-300ms
- Batch (100 items): 500-800ms
- Alert check: 50-150ms

### Database Performance

**Monitor MongoDB Connection:**
```bash
# Connect to MongoDB and check collections
mongo smart_health
db.ml_predictions.count()
db.ml_alerts.count()
db.ml_predictions.find().limit(1)
```

**Check Indexes:**
```javascript
db.ml_predictions.getIndexes()
db.ml_alerts.getIndexes()
```

## Monitoring & Debugging

### Service Status Commands

**Check all services running:**
```bash
# Windows: Check if processes are running
tasklist | findstr "python node"

# Linux/Mac
ps aux | grep -E "python|node"

# Check port availability
netstat -ano | findstr ":5000 :5001"
```

**Health Check Endpoints:**
```bash
# Flask ML Service
curl http://localhost:5001/health

# Backend API (any endpoint works)
curl http://localhost:5000/ml-predictions

# Database connectivity
curl http://localhost:5000/alerts/stats
```

### Log Files

**ML Service Logs:**
- Flask stdout (visible in terminal)
- Check for: "Loading model", "Listening on port 5001"

**Backend Logs:**
- Express morgan HTTP logs (verbose)
- Check for: "POST /ml-predictions/predict 201"

**Integration Test Logs:**
- Printed to stdout with color-coded results

### Common Issues & Solutions

#### Issue: "Connection refused" on port 5000/5001

**Cause:** Services not running

**Solution:**
```bash
# Verify services are running
tasklist | findstr "python node"

# If not running, start them
cd backend2 && npm start
cd ml_model && python ml_service.py
```

#### Issue: ML Service returns 503 error

**Cause:** Model file not found

**Solution:**
```bash
cd ml_model
python ml_pipeline.py  # Train the model
# Check for models/ directory with model.joblib
```

#### Issue: Predictions not saved to database

**Cause:** MongoDB not connected

**Solution:**
```bash
# Check MongoDB is running
# If local:
mongod

# Test connection:
mongo smart_health
```

#### Issue: "Port already in use"

**Cause:** Previous process still running

**Solution - Windows:**
```bash
# Find process on port 5000
netstat -ano | findstr ":5000"
# Kill it (replace PID)
taskkill /PID <PID> /F

# Or restart system
```

**Solution - Linux/Mac:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

## Stress Testing

### Generate High Volume Predictions

```bash
# Create test script to send 1000 predictions rapidly
python -c "
import requests
import random
import time

url = 'http://localhost:5000/ml-predictions/predict'
start = time.time()

for i in range(100):
    data = {
        'pH': 7 + random.gauss(0, 0.5),
        'Turbidity': 3 + random.gauss(0, 2),
        'Dissolved_Oxygen': 8 + random.gauss(0, 1),
        'location': f'Test {i % 5}'
    }
    requests.post(url, json=data, timeout=10)
    print(f'Sent {i+1}/100')

elapsed = time.time() - start
print(f'Time: {elapsed:.1f}s, Rate: {100/elapsed:.1f} req/s')
"
```

### Batch Stress Test

```bash
# Send 500 items in one batch
python -c "
import requests
import random

url = 'http://localhost:5000/ml-predictions/batch'
data = {
    'predictions': [
        {
            'pH': 7 + random.gauss(0, 0.5),
            'Turbidity': 3 + random.gauss(0, 2),
            'Dissolved_Oxygen': 8 + random.gauss(0, 1),
        }
        for _ in range(500)
    ]
}
r = requests.post(url, json=data, timeout=30)
print(r.json())
"
```

## Validation Checklist

### Pre-Deployment Checklist

- [ ] ML model trains successfully (`python ml_model/ml_pipeline.py`)
- [ ] Flask service starts without errors
- [ ] Backend connects to MongoDB
- [ ] Single prediction works (`POST /ml-predictions/predict`)
- [ ] Batch prediction works (`POST /ml-predictions/batch`)
- [ ] Alerts are created for consecutive HIGH predictions
- [ ] Email notifications send (check logs)
- [ ] Frontend displays predictions correctly
- [ ] Dashboard shows active alerts
- [ ] All tests pass (`python test_integration.py`)

### Post-Deployment Checks

- [ ] Services restart successfully after reboot
- [ ] Predictions persist across backend restarts
- [ ] Alerts properly escalate and email
- [ ] Sensor simulator runs continuously without errors
- [ ] Dashboard auto-refreshes predictions
- [ ] Performance is acceptable under load

## Continuous Monitoring

### Recommended Monitoring Setup

**Check every hour:**
1. Service health (health endpoints)
2. Recent predictions (last prediction time)
3. Active alerts (count and severity)
4. Error rates (from logs)

**Check every day:**
1. Database size and growth
2. ML model performance metrics
3. Alert resolution rate
4. System uptime

**Weekly review:**
1. Prediction accuracy vs actual outcomes
2. False positive rate (alerts that shouldn't have happened)
3. System performance trends
4. User feedback

### Metrics to Track

**Prediction Metrics:**
- Average confidence score
- Distribution by risk level
- Processing latency
- Batch size distribution

**Alert Metrics:**
- Alerts created per day
- Time to resolution
- Escalation rate (1→2→3+ consecutive)
- False positive rate

**System Metrics:**
- API response times
- Error rate (5xx responses)
- Database query times
- Service uptime

## Scaling Considerations

### When to Scale Up

**Vertical Scaling (bigger server):**
- Response times consistently > 500ms
- CPU usage > 80%
- Memory usage > 80%
- Database queries slow

**Horizontal Scaling (multiple servers):**
- Need redundancy
- Load > 100 predictions/minute
- Want geographic distribution

### Optimization Tips

1. **Database Indexes:**
   - Ensure indexes on predictedDate, location, riskLevel
   - Check query plans with explain()

2. **Caching:**
   - Cache model info (/info endpoint)
   - Cache feature importance
   - Cache recent stats

3. **Batch Processing:**
   - Use /batch endpoint for > 10 items
   - Reduces overhead compared to individual requests

4. **Connection Pooling:**
   - MongoDB connection pool size
   - HTTP keep-alive for requests

## Emergency Procedures

### Service Goes Down

**Step 1: Restart services (order matters)**
```bash
# Terminal 1: Restart ML service
cd ml_model && python ml_service.py

# Terminal 2: Restart Backend (after ML is up)
cd backend2 && npm start

# Step 3: Verify with health checks
curl http://localhost:5001/health
curl http://localhost:5000/alerts/stats
```

**Step 2: Check logs for errors**
- Look for connection errors
- Check for disk space issues
- Verify credentials

**Step 3: Database recovery**
- Check MongoDB is accessible
- Verify collections exist
- Check data integrity

### Data Recovery

**If alerts are lost:**
```javascript
// Check alert collection
db.ml_alerts.count()
db.ml_alerts.find({status: "active"}).count()
```

**If predictions are lost:**
```javascript
// Rebuild stats
db.ml_predictions.aggregate([
  {$match: {predictedDate: {$gte: new Date(ISODate() - 86400000)}}},
  {$group: {_id: "$riskLevel", count: {$sum: 1}}}
])
```

## Performance Baselines

**Typical Response Times (ms):**
- ML Service /health: 10-20
- ML Service /predict: 100-200
- Backend /predict: 150-300
- /alerts/active: 50-100
- /ml-predictions: 100-150

**Typical Throughput:**
- ML Service: 10-20 predictions/second
- Backend: 20-30 requests/second
- Database: 100+ queries/second

**Typical Resource Usage:**
- Flask service: 50-100 MB RAM
- Node backend: 100-200 MB RAM
- MongoDB: 500 MB - 2 GB (depends on data)
- Total: ~1-2 GB for full stack

## Advanced Debugging

### Enable Debug Logging

**Backend:**
```javascript
// Add to index.js
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path}`, req.body);
  next();
});
```

**ML Service:**
```python
# Add to ml_service.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Database Profiling

```javascript
// Enable profiling in MongoDB
db.setProfilingLevel(1)

// View slow queries
db.system.profile.find({millis: {$gt: 100}}).sort({ts: -1}).pretty()
```

### Request Tracing

```bash
# Log all HTTP traffic with curl
curl -v -H "X-Debug: true" http://localhost:5000/ml-predictions
```

## Support & Documentation

**For specific errors:**
1. Check logs in service directories
2. Run integration tests to isolate issue
3. Check API response status codes
4. Review data in MongoDB

**Useful Commands:**
```bash
# Test connectivity
curl http://localhost:5001/health
curl http://localhost:5000/alerts/stats

# View recent data
curl http://localhost:5000/ml-predictions?limit=5

# Check system resources
# Windows
tasklist
netstat -ano

# Linux/Mac
top
lsof -i :5000
```

---

**Last Updated:** 2024
**Version:** 1.0 (Production Testing)
