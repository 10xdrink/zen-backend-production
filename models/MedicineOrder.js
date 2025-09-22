const mongoose = require('mongoose');

const medicineOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  medicines: [{
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true
    },
    name: String,
    price: Number,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    totalPrice: Number
  }],
  customerDetails: {
    fullName: {
      type: String,
      required: true
    },
    mobileNumber: {
      type: String,
      required: true
    },
    email: String
  },
  deliveryAddress: {
    fullAddress: {
      type: String,
      required: true
    },
    landmark: String,
    pincode: String,
    city: String,
    state: String,
    addressLabel: String // Home, Office, etc.
  },
  orderSummary: {
    subtotal: {
      type: Number,
      required: true
    },
    deliveryCharges: {
      type: Number,
      default: 50
    },
    zenDiscount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    }
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['COD', 'cod', 'upi', 'card', 'wallet'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number
  },
  orderStatus: {
    type: String,
    enum: ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    default: 'placed',
    index: true
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: String
  }],
  deliveryDetails: {
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    deliveryPartner: String,
    trackingNumber: String,
    deliveryInstructions: String
  },
  prescriptionDetails: {
    required: {
      type: Boolean,
      default: false
    },
    uploaded: {
      type: Boolean,
      default: false
    },
    prescriptionImages: [String],
    verifiedBy: String,
    verifiedAt: Date
  },
  hasZenMembership: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    enum: ['Jubilee Hills', 'Financial District', 'Kondapur'],
    required: true
  },
  notes: String,
  cancellationReason: String,
  cancelledAt: Date,
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: String,
  ratedAt: Date
}, {
  timestamps: true
});

// Indexes for better query performance
medicineOrderSchema.index({ userId: 1, createdAt: -1 });
medicineOrderSchema.index({ orderStatus: 1, createdAt: -1 });
medicineOrderSchema.index({ 'paymentDetails.status': 1 });
medicineOrderSchema.index({ location: 1, orderStatus: 1 });

// Pre-save middleware to generate order number
medicineOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `ZEN${timestamp}${random}`;
  }
  
  // Ensure userId is set if not provided
  if (this.isNew && !this.userId && this.constructor.currentUserId) {
    this.userId = this.constructor.currentUserId;
  }
  
  next();
});

// Pre-save middleware to update status history
medicineOrderSchema.pre('save', function(next) {
  if (this.isModified('orderStatus')) {
    this.statusHistory.push({
      status: this.orderStatus,
      timestamp: new Date(),
      note: `Order status updated to ${this.orderStatus}`
    });
  }
  next();
});

// Virtual for order age in days
medicineOrderSchema.virtual('orderAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for delivery status
medicineOrderSchema.virtual('deliveryStatus').get(function() {
  const now = new Date();
  const estimatedDelivery = this.deliveryDetails.estimatedDeliveryDate;
  
  if (this.orderStatus === 'delivered') {
    return 'delivered';
  } else if (this.orderStatus === 'cancelled') {
    return 'cancelled';
  } else if (estimatedDelivery && now > estimatedDelivery) {
    return 'delayed';
  } else {
    return 'on_time';
  }
});

// Method to update order status
medicineOrderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = 'system') {
  this.orderStatus = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Order status updated to ${newStatus}`,
    updatedBy
  });

  // Set specific timestamps based on status
  if (newStatus === 'delivered') {
    this.deliveryDetails.actualDeliveryDate = new Date();
    this.paymentDetails.status = 'completed';
    this.paymentDetails.paidAt = new Date();
  } else if (newStatus === 'cancelled') {
    this.cancelledAt = new Date();
  }
};

// Method to calculate estimated delivery date
medicineOrderSchema.methods.calculateEstimatedDelivery = function() {
  const orderDate = this.createdAt || new Date();
  const deliveryDays = this.hasZenMembership ? 1 : 2; // Zen members get faster delivery
  
  const estimatedDate = new Date(orderDate);
  estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
  
  // Ensure deliveryDetails object exists
  if (!this.deliveryDetails) {
    this.deliveryDetails = {};
  }
  
  this.deliveryDetails.estimatedDeliveryDate = estimatedDate;
  return estimatedDate;
};

// Method to add rating and feedback
medicineOrderSchema.methods.addRating = function(rating, feedback) {
  this.rating = rating;
  this.feedback = feedback;
  this.ratedAt = new Date();
};

// Static method to get user orders
medicineOrderSchema.statics.getUserOrders = function(userId, options = {}) {
  const {
    status,
    limit = 20,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  const query = { userId };
  
  if (status) {
    query.orderStatus = status;
  }

  return this.find(query)
    .populate('medicines.medicineId', 'name image category')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to get orders by status
medicineOrderSchema.statics.getOrdersByStatus = function(status, location = null) {
  const query = { orderStatus: status };
  
  if (location) {
    query.location = location;
  }

  return this.find(query)
    .populate('userId', 'fullName phoneNumber email')
    .populate('medicines.medicineId', 'name image category')
    .sort({ createdAt: -1 });
};

// Static method to get order analytics
medicineOrderSchema.statics.getOrderAnalytics = function(startDate, endDate, location = null) {
  const matchQuery = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (location) {
    matchQuery.location = location;
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$orderSummary.totalAmount' },
        avgAmount: { $avg: '$orderSummary.totalAmount' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

module.exports = mongoose.model('MedicineOrder', medicineOrderSchema);
