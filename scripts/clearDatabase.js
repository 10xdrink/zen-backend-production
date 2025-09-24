const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Booking = require('../models/Booking');
const MedicineOrder = require('../models/MedicineOrder');

async function clearDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🗑️ Starting database cleanup...');
    
    // Clear Users collection
    console.log('🧹 Clearing Users collection...');
    const usersDeleted = await User.deleteMany({});
    console.log(`✅ Deleted ${usersDeleted.deletedCount} users`);

    // Clear Bookings collection
    console.log('🧹 Clearing Bookings collection...');
    const bookingsDeleted = await Booking.deleteMany({});
    console.log(`✅ Deleted ${bookingsDeleted.deletedCount} bookings`);

    // Clear Medicine Orders collection
    console.log('🧹 Clearing Medicine Orders collection...');
    const ordersDeleted = await MedicineOrder.deleteMany({});
    console.log(`✅ Deleted ${ordersDeleted.deletedCount} medicine orders`);

    // Verify collections are empty
    console.log('🔍 Verifying collections are empty...');
    const userCount = await User.countDocuments();
    const bookingCount = await Booking.countDocuments();
    const orderCount = await MedicineOrder.countDocuments();

    console.log(`📊 Final counts:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Bookings: ${bookingCount}`);
    console.log(`   Orders: ${orderCount}`);

    if (userCount === 0 && bookingCount === 0 && orderCount === 0) {
      console.log('🎉 Database successfully cleared! All collections are now empty.');
    } else {
      console.log('⚠️ Some documents may still remain. Please check manually.');
    }

    console.log('✅ Database cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will permanently delete ALL data from:');
console.log('   - Users collection');
console.log('   - Bookings collection');
console.log('   - Medicine Orders collection');
console.log('');
console.log('🚨 This action cannot be undone!');
console.log('');

// Check if running with --confirm flag
if (process.argv.includes('--confirm')) {
  clearDatabase();
} else {
  console.log('To proceed, run this script with the --confirm flag:');
  console.log('node scripts/clearDatabase.js --confirm');
  process.exit(0);
}
