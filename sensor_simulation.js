#!/usr/bin/env node

/**
 * STEP 6: IoT Water Quality Sensor Simulation
 * 
 * Simulates realistic water quality sensor readings and sends them
 * to the SmartHealth backend API every 30-60 seconds.
 * 
 * Usage: node sensor_simulation.js [sensor_count] [interval_ms]
 * Example: node sensor_simulation.js 3 45000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = 'http://127.0.0.1:5000';
const DEFAULT_SENSORS = 2;
const DEFAULT_INTERVAL_MS = 45000; // 45 seconds
const LOG_FILE = path.join(__dirname, 'sensor_simulation.log');

// Sensor locations for realistic simulation
const SENSOR_LOCATIONS = [
  { name: 'Water Treatment Plant A', lat: 40.7128, lng: -74.0060 },
  { name: 'Water Treatment Plant B', lat: 40.7580, lng: -73.9855 },
  { name: 'Downtown Water Station', lat: 40.7489, lng: -73.9680 },
  { name: 'River Monitoring Station', lat: 40.7614, lng: -73.9776 },
  { name: 'District Water Intake', lat: 40.7505, lng: -73.9972 },
];

// Test tokens - use the first one by default
let AUTH_TOKEN = null;

/**
 * Generate realistic water quality reading
 * Normal ranges: pH 6.5-8.5, Turbidity 0-10 NTU
 */
function generateWaterQualityReading(sensorId) {
  // Simulate natural variation with occasional anomalies
  const isAnomaly = Math.random() < 0.15; // 15% of readings are anomalies
  
  let pH, turbidity;
  
  if (isAnomaly) {
    // Anomalies: extreme values that trigger alerts
    pH = Math.random() < 0.5 
      ? (Math.random() * 2 + 5.5)    // Very low pH (5.5-7.5)
      : (Math.random() * 1.5 + 8.5); // Very high pH (8.5-10)
    turbidity = Math.random() * 15 + 5; // High turbidity (5-20 NTU)
  } else {
    // Normal readings
    pH = Math.random() * 2 + 6.8;      // 6.8-8.8 (mostly normal)
    turbidity = Math.random() * 5 + 1;  // 1-6 NTU (normal)
  }
  
  // Conductivity (mg/L) - typically 200-1000
  const conductivity = Math.random() * 500 + 300;
  
  return {
    sensor_id: sensorId,
    reading_at: new Date().toISOString(),
    pH: parseFloat(pH.toFixed(2)),
    turbidity: parseFloat(turbidity.toFixed(2)),
    conductivity: parseFloat(conductivity.toFixed(0)),
  };
}

/**
 * Log reading to file and console
 */
function logReading(sensorId, data, status, response) {
  const timestamp = new Date().toISOString();
  const logEntry = status === 'success'
    ? `[${timestamp}] ✅ SENT: ${sensorId} | pH=${data.pH} | Turbidity=${data.turbidity} NTU | Location: ${data.location}`
    : `[${timestamp}] ❌ FAILED: ${sensorId} | Error: ${response}`;
  
  console.log(logEntry);
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
  } catch (err) {
    console.error('Error writing to log file:', err.message);
  }
}

/**
 * Send sensor reading to backend API
 */
function sendSensorReading(sensorId, location, token) {
  return new Promise((resolve, reject) => {
    const reading = generateWaterQualityReading(sensorId);
    
    // Add location to reading
    reading.location = location.name;
    reading.lat = location.lat;
    reading.lng = location.lng;
    
    const postData = JSON.stringify(reading);
    
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/sensor',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`,
      },
      timeout: 10000,
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          logReading(sensorId, { ...reading, location: location.name }, 'success', responseData);
          resolve({ success: true, data: reading });
        } else {
          const error = `HTTP ${res.statusCode}: ${responseData}`;
          logReading(sensorId, reading, 'error', error);
          reject(new Error(error));
        }
      });
    });
    
    req.on('error', (err) => {
      logReading(sensorId, reading, 'error', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.abort();
      const error = 'Request timeout';
      logReading(sensorId, reading, 'error', error);
      reject(new Error(error));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Authenticate with backend to get a token
 */
async function authenticate() {
  return new Promise((resolve, reject) => {
    const email = `sensor_simulator_${Date.now()}@smarthealth.local`;
    const password = 'SensorSimulator@2026';
    const username = `sensor_sim_${Date.now()}`;
    
    const postData = JSON.stringify({
      username: username,
      email: email,
      password: password,
    });
    
    const registerOptions = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };
    
    const req = http.request(registerOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(responseData);
            console.log(`✅ Registered as: ${email}`);
            
            // Now login to get token
            const loginData = JSON.stringify({ email, password });
            const loginOptions = {
              hostname: '127.0.0.1',
              port: 5000,
              path: '/auth/login',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginData),
              },
              timeout: 10000,
            };
            
            const loginReq = http.request(loginOptions, (loginRes) => {
              let loginResponseData = '';
              
              loginRes.on('data', (chunk) => {
                loginResponseData += chunk;
              });
              
              loginRes.on('end', () => {
                if (loginRes.statusCode === 200) {
                  try {
                    const loginResponse = JSON.parse(loginResponseData);
                    console.log(`✅ Authenticated. Token received.`);
                    resolve(loginResponse.token);
                  } catch (err) {
                    reject(new Error('Failed to parse login response: ' + err.message));
                  }
                } else {
                  reject(new Error(`Login failed: HTTP ${loginRes.statusCode}`));
                }
              });
            });
            
            loginReq.on('error', reject);
            loginReq.on('timeout', () => {
              loginReq.abort();
              reject(new Error('Login timeout'));
            });
            
            loginReq.write(loginData);
            loginReq.end();
          } catch (err) {
            reject(new Error('Failed to parse register response: ' + err.message));
          }
        } else {
          // Might already exist, try login directly
          console.log(`ℹ️  User may already exist, attempting login...`);
          
          const loginData = JSON.stringify({ email, password });
          const loginOptions = {
            hostname: '127.0.0.1',
            port: 5000,
            path: '/auth/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(loginData),
            },
            timeout: 10000,
          };
          
          const loginReq = http.request(loginOptions, (loginRes) => {
            let loginResponseData = '';
            
            loginRes.on('data', (chunk) => {
              loginResponseData += chunk;
            });
            
            loginRes.on('end', () => {
              if (loginRes.statusCode === 200) {
                try {
                  const loginResponse = JSON.parse(loginResponseData);
                  console.log(`✅ Authenticated. Token received.`);
                  resolve(loginResponse.token);
                } catch (err) {
                  reject(new Error('Failed to parse login response: ' + err.message));
                }
              } else {
                reject(new Error(`Authentication failed: HTTP ${loginRes.statusCode} - ${responseData}`));
              }
            });
          });
          
          loginReq.on('error', reject);
          loginReq.on('timeout', () => {
            loginReq.abort();
            reject(new Error('Login timeout'));
          });
          
          loginReq.write(loginData);
          loginReq.end();
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Registration timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Start sensor simulation
 */
async function startSimulation() {
  console.log('\n' + '='.repeat(80));
  console.log('STEP 6: IoT WATER QUALITY SENSOR SIMULATION');
  console.log('='.repeat(80) + '\n');
  
  // Parse command line arguments
  const numSensors = parseInt(process.argv[2]) || DEFAULT_SENSORS;
  const intervalMs = parseInt(process.argv[3]) || DEFAULT_INTERVAL_MS;
  
  console.log(`📊 Sensor Configuration:`);
  console.log(`   • Number of sensors: ${numSensors}`);
  console.log(`   • Readings interval: ${intervalMs / 1000} seconds`);
  console.log(`   • Log file: ${LOG_FILE}`);
  console.log(`   • Backend URL: ${BACKEND_URL}\n`);
  
  // Authenticate
  console.log('🔐 Authenticating with backend...');
  try {
    AUTH_TOKEN = await authenticate();
  } catch (err) {
    console.error('\n❌ Authentication failed:', err.message);
    console.error('   Make sure backend is running: cd backend2 && npm start');
    process.exit(1);
  }
  
  // Create sensor instances
  const sensors = [];
  for (let i = 1; i <= numSensors; i++) {
    const location = SENSOR_LOCATIONS[(i - 1) % SENSOR_LOCATIONS.length];
    sensors.push({
      id: `sensor-${String(i).padStart(3, '0')}`,
      location: location,
    });
  }
  
  console.log(`\n📍 Sensors configured:`);
  sensors.forEach((sensor, idx) => {
    console.log(`   ${idx + 1}. ${sensor.id} → ${sensor.location.name}`);
  });
  
  console.log(`\n⏳ Simulation starting... (Ctrl+C to stop)\n`);
  
  // Clear log file
  try {
    fs.writeFileSync(LOG_FILE, '');
  } catch (err) {
    console.error('Warning: Could not clear log file:', err.message);
  }
  
  // Send initial readings
  console.log('📡 Sending initial readings...\n');
  for (const sensor of sensors) {
    try {
      await sendSensorReading(sensor.id, sensor.location, AUTH_TOKEN);
    } catch (err) {
      // Non-blocking: log error but continue
    }
  }
  
  // Schedule periodic readings
  console.log(`\n✅ Simulation active. Next readings in ~${intervalMs / 1000}s.\n`);
  
  let readingCount = numSensors;
  
  setInterval(() => {
    sensors.forEach(async (sensor) => {
      try {
        await sendSensorReading(sensor.id, sensor.location, AUTH_TOKEN);
        readingCount++;
      } catch (err) {
        // Non-blocking: log and continue
        console.error(`⚠️  Send failed for ${sensor.id}: ${err.message}`);
      }
    });
  }, intervalMs);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n' + '='.repeat(80));
    console.log('SIMULATION STOPPED');
    console.log('='.repeat(80));
    console.log(`Total readings sent: ${readingCount}`);
    console.log(`Log file: ${LOG_FILE}`);
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  });
}

// Start the simulation
startSimulation().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
