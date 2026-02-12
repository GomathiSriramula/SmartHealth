/**
 * Check admin user's assigned location
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./models');

async function checkAdminLocation() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_health';
    console.log(`🔌 Connecting to MongoDB...\n`);
    
    await mongoose.connect(mongoUri);

    // Get all ADMIN users
    const admins = await User.find({ role: 'ADMIN' });
    
    console.log(`👥 ADMIN Users:\n`);
    if (admins.length === 0) {
      console.log('❌ No ADMIN users found!\n');
    } else {
      admins.forEach((admin, i) => {
        console.log(`${i + 1}. Username: ${admin.username}`);
        console.log(`   Email: ${admin.email}`);
        if (admin.adminLocation) {
          console.log(`   🗺️  Assigned Location:`);
          console.log(`      State: ${admin.adminLocation.state}`);
          console.log(`      District: ${admin.adminLocation.district}`);
          console.log(`      Village: ${admin.adminLocation.village}`);
        } else {
          console.log(`   ⚠️  No location assigned!`);
        }
        console.log('');
      });
    }

    // Get all USER and OPERATOR users
    const otherUsers = await User.find({ role: { $in: ['USER', 'OPERATOR'] } });
    console.log(`📋 Other Users:\n`);
    console.log(`USER/OPERATOR count: ${otherUsers.length}\n`);

    console.log(`✅ Check complete`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAdminLocation();
