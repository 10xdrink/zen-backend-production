const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // User information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  
  // Personal details (can be different from user profile)
  personalDetails: {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true
    }
  },

  // Treatment information
  treatment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Treatment',
    required: [true, 'Treatment is required']
  },
  treatmentDetails: {
    name: String,
    category: String,
    price: Number,
    priceDisplay: String,
    duration: Number,
    durationDisplay: String
  },

  // Location and scheduling
  location: {
    type: String,
    required: [true, 'Location is required'],
    enum: ['Jubilee Hills', 'Kokapet', 'Kondapur']
  },
  appointmentDate: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  appointmentTime: {
    type: String,
    required: [true, 'Appointment time is required']
  },
  
  // Booking status
  status: {
    type: String,
    enum: ['confirmed', 'in-progress', 'completed', 'cancelled', 'rescheduled', 'no-show'],
    default: 'confirmed'
  },
  
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet'],
    default: 'cash'
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required']
  },
  paymentUpdatedAt: Date,
  fullyProcessed: {
    type: Boolean,
    default: false
  },
  
  // Additional information
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // Booking reference
  bookingReference: {
    type: String,
    unique: true,
    required: true
  },
  
  // Cancellation/Rescheduling
  cancellationReason: String,
  cancelledAt: Date,
  rescheduledFrom: {
    date: Date,
    time: String
  },
  rescheduledAt: Date,
  rescheduleCount: {
    type: Number,
    default: 0
  },
  noShowMarkedAt: Date,
  
  // Rating and feedback (after completion)
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  ratingComment: {
    type: String,
    maxlength: [500, 'Rating comment cannot exceed 500 characters']
  },
  feedback: {
    type: String,
    maxlength: [1000, 'Feedback cannot exceed 1000 characters']
  },
  feedbackDate: Date,
  
  // Staff assignment (for future use)
  assignedStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  
  // Check-in/Check-out functionality
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkInTime: Date,
  checkoutOTP: String,
  checkedOut: {
    type: Boolean,
    default: false
  },
  checkOutTime: Date,
  adminCheckout: String, // Admin ID who performed checkout
  canCheckOut: {
    type: Boolean,
    default: false
  },
  checkOutEligibleTime: Date, // Time when checkout becomes available (20 min after check-in)
  
  // Prescription and medical records
  prescription: {
    attachments: [{
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: String // Admin ID who uploaded
    }],
    notes: String,
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String
    }]
  },
  
  // Reminders
  remindersSent: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'push']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
bookingSchema.index({ user: 1, appointmentDate: -1 });
bookingSchema.index({ treatment: 1, appointmentDate: 1 });
bookingSchema.index({ status: 1, appointmentDate: 1 });
bookingSchema.index({ location: 1, appointmentDate: 1 });
bookingSchema.index({ paymentStatus: 1 });

// Pre-save middleware to generate booking reference
bookingSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate booking reference: ZEN + YYYYMMDD + random 4 digits
    const date = new Date();
    const dateStr = date.getFullYear().toString() + 
                   (date.getMonth() + 1).toString().padStart(2, '0') + 
                   date.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.bookingReference = `ZEN${dateStr}${randomNum}`;
  }
  next();
});

// Virtual for formatted appointment date and time
bookingSchema.virtual('formattedAppointment').get(function() {
  const date = new Date(this.appointmentDate);
  const dateStr = date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  return `${dateStr} at ${this.appointmentTime}`;
});

// Virtual for booking age
bookingSchema.virtual('bookingAge').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Static method to get user bookings
bookingSchema.statics.getUserBookings = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.upcoming) {
    query.appointmentDate = { $gte: new Date() };
  }
  
  return this.find(query)
    .populate('treatment', 'name category image price priceDisplay duration durationDisplay')
    .sort(options.sort || { appointmentDate: -1 })
    .limit(options.limit || 0);
};

// Static method to get bookings by date range
bookingSchema.statics.getBookingsByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    appointmentDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (options.location) {
    query.location = options.location;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('user', 'fullName email phoneNumber')
    .populate('treatment', 'name category duration')
    .sort({ appointmentDate: 1, appointmentTime: 1 });
};

// Instance method to cancel booking
bookingSchema.methods.cancelBooking = function(reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return this.save();
};

// Instance method to reschedule booking
bookingSchema.methods.rescheduleBooking = function(newDate, newTime) {
  // Check if already rescheduled once
  if (this.rescheduleCount >= 1) {
    throw new Error('Appointment can only be rescheduled once');
  }
  
  this.rescheduledFrom = {
    date: this.appointmentDate,
    time: this.appointmentTime
  };
  this.appointmentDate = new Date(newDate);
  this.appointmentTime = newTime;
  this.status = 'rescheduled';
  this.rescheduledAt = new Date();
  this.rescheduleCount = (this.rescheduleCount || 0) + 1;
  return this.save();
};

// Instance method to complete booking
bookingSchema.methods.completeBooking = function() {
  this.status = 'completed';
  return this.save();
};

// Instance method to mark as no-show
bookingSchema.methods.markAsNoShow = function() {
  this.status = 'no-show';
  this.noShowMarkedAt = new Date();
  return this.save();
};

// Static method to find and mark no-show appointments
bookingSchema.statics.markNoShowAppointments = function() {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes after appointment time
  
  return this.updateMany(
    {
      status: 'confirmed',
      appointmentDate: { $lt: cutoffTime },
      checkedIn: { $ne: true }
    },
    {
      $set: {
        status: 'no-show',
        noShowMarkedAt: now
      }
    }
  );
};

// Instance method to add rating and feedback
bookingSchema.methods.addFeedback = function(rating, feedback) {
  this.rating = rating;
  this.feedback = feedback;
  this.feedbackDate = new Date();
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema);
