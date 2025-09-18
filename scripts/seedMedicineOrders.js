const mongoose = require('mongoose');
const MedicineOrder = require('../models/MedicineOrder');
const Medicine = require('../models/Medicine');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zennara', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const seedMedicineOrders = async () => {
  try {
    console.log('Starting to seed medicine orders...');

    // Get some existing medicines and users
    const medicines = await Medicine.find({ isActive: true }).limit(10);
    const users = await User.find({ isActive: true }).limit(5);

    if (medicines.length === 0) {
      console.log('No medicines found. Please seed medicines first.');
      return;
    }

    if (users.length === 0) {
      console.log('No users found. Please create some users first.');
      return;
    }

    // Clear existing orders
    await MedicineOrder.deleteMany({});
    console.log('Cleared existing medicine orders');

    const sampleOrders = [];
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

    for (let i = 0; i < 20; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items per order
      const orderItems = [];
      let totalAmount = 0;

      for (let j = 0; j < numItems; j++) {
        const randomMedicine = medicines[Math.floor(Math.random() * medicines.length)];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
        const itemTotal = randomMedicine.price * quantity;
        
        orderItems.push({
          medicineId: randomMedicine._id,
          quantity: quantity,
          price: randomMedicine.price,
          total: itemTotal
        });
        
        totalAmount += itemTotal;
      }

      const order = {
        userId: randomUser._id,
        items: orderItems,
        totalAmount: totalAmount,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
        deliveryAddress: {
          street: `${Math.floor(Math.random() * 999) + 1} Sample Street`,
          city: ['Hyderabad', 'Bangalore', 'Mumbai', 'Delhi'][Math.floor(Math.random() * 4)],
          state: ['Telangana', 'Karnataka', 'Maharashtra', 'Delhi'][Math.floor(Math.random() * 4)],
          zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
          country: 'India'
        },
        prescriptionRequired: Math.random() > 0.5,
        prescriptionUploaded: Math.random() > 0.3,
        notes: i % 3 === 0 ? `Sample order notes ${i + 1}` : '',
        trackingNumber: Math.random() > 0.5 ? `TRK${Date.now()}${i}` : null,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random date within last 30 days
        updatedAt: new Date()
      };

      sampleOrders.push(order);
    }

    // Insert sample orders
    const insertedOrders = await MedicineOrder.insertMany(sampleOrders);
    console.log(`Successfully created ${insertedOrders.length} sample medicine orders`);

    // Display summary
    const orderStats = await MedicineOrder.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    console.log('\nOrder Statistics:');
    orderStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count} orders, Total: ₹${stat.totalAmount.toFixed(2)}`);
    });

  } catch (error) {
    console.error('Error seeding medicine orders:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedMedicineOrders();
