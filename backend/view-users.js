const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hostelcare')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ Connection error:', err);
    process.exit(1);
  });

// Import User model
const User = require('./models/User');

async function getAllUsers() {
  try {
    const users = await User.find({}).select('-__v'); // Exclude __v field
    
    console.log('\n=== ALL USERS IN DATABASE ===\n');
    console.log(`Total Users: ${users.length}\n`);
    
    users.forEach((user, index) => {
      console.log(`--- User ${index + 1} ---`);
      console.log(`ID: ${user._id}`);
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Password Hash: ${user.password.substring(0, 30)}...`);
      console.log(`Created: ${user.createdAt}`);
      console.log('');
    });
    
    console.log('⚠️  Note: Passwords are bcrypt hashed for security.');
    console.log('   You cannot recover plain text passwords from these hashes.\n');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

getAllUsers();
