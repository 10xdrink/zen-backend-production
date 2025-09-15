const mongoose = require('mongoose');
require('dotenv').config();

async function clearDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop the entire treatments collection to clear all indexes
    try {
      await mongoose.connection.db.dropCollection('treatments');
      console.log('🗑️ Dropped treatments collection');
    } catch (error) {
      if (error.message.includes('ns not found')) {
        console.log('ℹ️ Treatments collection does not exist');
      } else {
        throw error;
      }
    }

    console.log('✅ Database cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the clearing function
clearDatabase();
