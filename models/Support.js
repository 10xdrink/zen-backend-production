const mongoose = require('mongoose');

const supportSchema = new mongoose.Schema({
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    required: true,
    enum: ['Jubilee Hills', 'Financial District', 'Kondapur']
  },
  
  // Support Request Details
  subject: {
    type: String,
    required: true,
    enum: [
      'General Inquiry',
      'Appointment Booking',
      'Appointment Rescheduling', 
      'Appointment Cancellation',
      'Treatment Information',
      'Zen Membership',
      'Billing & Payments',
      'Technical Support',
      'Feedback & Suggestions',
      'Complaint',
      'Other'
    ]
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  
  // Status and Priority
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Admin Response
  adminResponse: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin user who is handling this request
  },
  resolvedAt: {
    type: Date
  },
  
  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
supportSchema.index({ user: 1, status: 1 });
supportSchema.index({ subject: 1, status: 1 });
supportSchema.index({ location: 1, status: 1 });
supportSchema.index({ submittedAt: -1 });

// Update the updatedAt field before saving
supportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get support statistics
supportSchema.statics.getSupportStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const subjectStats = await this.aggregate([
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const locationStats = await this.aggregate([
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 }
        }
      }
    ]);
    
    return {
      statusStats: stats,
      subjectStats: subjectStats,
      locationStats: locationStats,
      totalRequests: await this.countDocuments()
    };
  } catch (error) {
    throw error;
  }
};

// Instance method to mark as resolved
supportSchema.methods.markAsResolved = function(adminResponse) {
  this.status = 'resolved';
  this.adminResponse = adminResponse;
  this.resolvedAt = new Date();
  return this.save();
};

// Instance method to assign to admin
supportSchema.methods.assignTo = function(adminId) {
  this.assignedTo = adminId;
  this.status = 'in-progress';
  return this.save();
};

// Virtual for formatted submission date
supportSchema.virtual('formattedSubmissionDate').get(function() {
  return this.submittedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for response time (if resolved)
supportSchema.virtual('responseTime').get(function() {
  if (this.resolvedAt && this.submittedAt) {
    const diffInMs = this.resolvedAt - this.submittedAt;
    const diffInHours = Math.round(diffInMs / (1000 * 60 * 60));
    return diffInHours;
  }
  return null;
});

// Ensure virtual fields are serialized
supportSchema.set('toJSON', { virtuals: true });
supportSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Support', supportSchema);
