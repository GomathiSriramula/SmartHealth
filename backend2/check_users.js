const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_health';

async function checkUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    const users = await User.find({}, { username: 1, email: 1, _id: 0 }).limit(10);
    
    console.log('📊 Users in database:');
    console.log('='.repeat(50));
    users.forEach((user, i) => {
      console.log(`${i+1}. Username: "${user.username}"  Email: "${user.email}"`);
    });
    console.log('='.repeat(50));
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();
