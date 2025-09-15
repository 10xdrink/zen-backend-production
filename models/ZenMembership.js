const mongoose = require('mongoose');

const zenMembershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  membershipType: {
    type: String,
    enum: ['standard', 'zen'],
    default: 'standard'
  },
  subscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 2999
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet'],
    default: 'card'
  },
  transactionId: {
    type: String
  },
  benefits: {
    discountPercentage: {
      type: Number,
      default: 20
    },
    freeDelivery: {
      type: Boolean,
      default: true
    },
    prioritySupport: {
      type: Boolean,
      default: true
    },
    exclusiveOffers: {
      type: Boolean,
      default: true
    },
    freeConsultations: {
      type: Number,
      default: 5
    }
  },
  autoRenewal: {
    type: Boolean,
    default: false
  },
  renewalDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  purchaseHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    amount: Number,
    transactionId: String,
    paymentMethod: String,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
zenMembershipSchema.index({ userId: 1 });
zenMembershipSchema.index({ status: 1 });
zenMembershipSchema.index({ endDate: 1 });

// Virtual for checking if membership is currently valid (lifetime membership)
zenMembershipSchema.virtual('isCurrentlyActive').get(function() {
  return this.isActive && this.status === 'active';
});

// Method to calculate savings
zenMembershipSchema.methods.calculateSavings = function(originalAmount) {
  if (this.isCurrentlyActive) {
    return originalAmount * (this.benefits.discountPercentage / 100);
  }
  return 0;
};

// Method to activate lifetime membership
zenMembershipSchema.methods.activateLifetimeMembership = function() {
  this.isActive = true;
  this.status = 'active';
  this.endDate = null; // Lifetime membership has no end date
  return this.save();
};

// Static method to get membership pricing
zenMembershipSchema.statics.getPricing = function() {
  return {
    lifetime: {
      price: 2999,
      duration: 'Lifetime',
      savings: '20% on all orders + Free delivery + Priority support'
    }
  };
};

module.exports = mongoose.model('ZenMembership', zenMembershipSchema);
