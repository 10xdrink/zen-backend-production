const mongoose = require('mongoose');
const MedicineOrder = require('../models/MedicineOrder');
const User = require('../models/User');
const Medicine = require('../models/Medicine');

// Load environment variables
require('dotenv').config();

async function testOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zennara');
    console.log('Connected to MongoDB');

    // Check existing orders
    const orders = await MedicineOrder.find()
      .populate('userId', 'fullName email phoneNumber')
      .populate('medicines.medicineId', 'name price')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`\nFound ${orders.length} medicine orders:`);
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order ID: ${order._id}`);
      console.log(`   Order Number: ${order.orderNumber}`);
      console.log(`   Status: ${order.orderStatus}`);
      console.log(`   Customer: ${order.userId?.fullName || order.customerDetails?.fullName || 'Unknown'}`);
      console.log(`   Phone: ${order.userId?.phoneNumber || order.customerDetails?.mobileNumber || 'N/A'}`);
      console.log(`   Items: ${order.medicines?.length || 0}`);
      console.log(`   Total Amount: ₹${order.orderSummary?.totalAmount || 0}`);
      console.log(`   Payment Status: ${order.paymentDetails?.status || 'pending'}`);
      console.log(`   Created: ${order.createdAt}`);
    });

    // If no orders exist, create a sample order
    if (orders.length === 0) {
      console.log('\nNo orders found. Creating a sample order...');
      
      // Find a user
      const user = await User.findOne();
      if (!user) {
        console.log('No users found. Please create a user first.');
        return;
      }

      // Find a medicine
      const medicine = await Medicine.findOne();
      if (!medicine) {
        console.log('No medicines found. Please create medicines first.');
        return;
      }

      // Create sample order
      const sampleOrder = new MedicineOrder({
        userId: user._id,
        medicines: [{
          medicineId: medicine._id,
          name: medicine.name,
          price: medicine.price,
          quantity: 2,
          totalPrice: medicine.price * 2
        }],
        customerDetails: {
          fullName: user.fullName,
          mobileNumber: user.phoneNumber,
          email: user.email
        },
        deliveryAddress: {
          fullAddress: '123 Test Street, Test City',
          landmark: 'Near Test Mall',
          pincode: '500001',
          city: 'Hyderabad',
          state: 'Telangana',
          addressLabel: 'Home'
        },
        orderSummary: {
          subtotal: medicine.price * 2,
          deliveryCharges: 50,
          zenDiscount: user.hasZenMembership ? 20 : 0,
          totalAmount: (medicine.price * 2) + 50 - (user.hasZenMembership ? 20 : 0)
        },
        paymentDetails: {
          method: 'COD',
          status: 'pending'
        },
        orderStatus: 'placed',
        hasZenMembership: user.hasZenMembership || false,
        location: user.location || 'Jubilee Hills',
        notes: 'Sample order for testing'
      });

      await sampleOrder.save();
      console.log(`Sample order created: ${sampleOrder.orderNumber}`);
    }

    // Test the aggregation for stats
    console.log('\nTesting order statistics...');
    const stats = await MedicineOrder.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$orderStatus', ['placed', 'confirmed']] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'preparing'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'out_for_delivery'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$orderSummary.totalAmount' },
          averageOrderValue: { $avg: '$orderSummary.totalAmount' }
        }
      }
    ]);

    console.log('Order Statistics:', stats[0] || 'No stats available');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testOrders();
