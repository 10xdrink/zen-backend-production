const mongoose = require('mongoose');
require('dotenv').config();

async function fixDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop the problematic phone index
    try {
      await db.collection('users').dropIndex('phone_1');
      console.log('Dropped phone_1 index');
    } catch (error) {
      console.log('phone_1 index does not exist or already dropped');
    }

    try {
      await db.collection('users').dropIndex('phoneNumber_1');
      console.log('Dropped phoneNumber_1 index');
    } catch (error) {
      console.log('phoneNumber_1 index does not exist or already dropped');
    }

    // Clear all existing users to start fresh
    const result = await db.collection('users').deleteMany({});
    console.log(`Deleted ${result.deletedCount} existing users`);

    // Create the correct sparse unique index for phoneNumber
    await db.collection('users').createIndex(
      { phoneNumber: 1 }, 
      { unique: true, sparse: true }
    );
    console.log('Created new sparse unique index for phoneNumber');

    console.log('Database fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing database:', error);
    process.exit(1);
  }
}

fixDatabase();
