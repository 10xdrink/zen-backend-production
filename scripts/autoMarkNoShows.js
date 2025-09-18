const mongoose = require('mongoose');
const Booking = require('../models/Booking');
require('dotenv').config();

// Script to automatically mark no-show appointments
// This can be run as a cron job every 15-30 minutes

async function autoMarkNoShows() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Mark no-show appointments
    const result = await Booking.markNoShowAppointments();
    
    console.log(`✅ Auto no-show check completed at ${new Date().toISOString()}`);
    console.log(`📊 Marked ${result.modifiedCount} appointments as no-show`);
    
    if (result.modifiedCount > 0) {
      console.log(`🚨 ${result.modifiedCount} appointments were marked as no-show for not checking in within 1 hour of appointment time`);
    }

    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in auto mark no-shows:', error);
    process.exit(1);
  }
}

// Run the script
autoMarkNoShows();
