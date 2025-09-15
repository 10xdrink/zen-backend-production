const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters'],
    maxlength: [50, 'Full name cannot exceed 50 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['Male', 'Female', 'Other']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    enum: ['Jubilee Hills', 'Kokapet', 'Kondapur']
  },
  profilePhoto: {
    type: String,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // OTP related fields
  emailOTP: {
    code: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  phoneOTP: {
    code: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  // Saved addresses for delivery
  savedAddresses: [{
    label: {
      type: String,
      required: true,
      trim: true
    },
    fullAddress: {
      type: String,
      required: true,
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.emailOTP;
      delete ret.phoneOTP;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for better query performance
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ 'emailOTP.expiresAt': 1 }, { expireAfterSeconds: 0 });
userSchema.index({ 'phoneOTP.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to hash password if it exists
userSchema.pre('save', async function(next) {
  // Only run if password is modified (for future password implementation)
  if (!this.isModified('password')) return next();
  
  // Hash password with cost of 12
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  next();
});

// Instance method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to generate OTP
userSchema.methods.generateOTP = function(type = 'email') {
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
  const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRE_MINUTES) || 10) * 60 * 1000);
  
  if (type === 'email') {
    this.emailOTP = {
      code: otp,
      expiresAt: expiresAt,
      attempts: 0
    };
  } else if (type === 'phone') {
    this.phoneOTP = {
      code: otp,
      expiresAt: expiresAt,
      attempts: 0
    };
  }
  
  return otp;
};

// Instance method to verify OTP
userSchema.methods.verifyOTP = function(candidateOTP, type = 'email') {
  const otpData = type === 'email' ? this.emailOTP : this.phoneOTP;
  
  if (!otpData || !otpData.code) {
    return { success: false, message: 'No OTP found' };
  }
  
  if (otpData.expiresAt < new Date()) {
    return { success: false, message: 'OTP has expired' };
  }
  
  if (otpData.attempts >= 3) {
    return { success: false, message: 'Too many attempts. Please request a new OTP' };
  }
  
  if (otpData.code !== candidateOTP) {
    otpData.attempts += 1;
    return { success: false, message: 'Invalid OTP' };
  }
  
  // OTP is valid
  if (type === 'email') {
    this.isEmailVerified = true;
    this.emailOTP = undefined;
  } else if (type === 'phone') {
    this.isPhoneVerified = true;
    this.phoneOTP = undefined;
  }
  
  return { success: true, message: 'OTP verified successfully' };
};

// Static method to find user by email or phone
userSchema.statics.findByEmailOrPhone = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier },
      { phoneNumber: identifier }
    ]
  });
};

module.exports = mongoose.model('User', userSchema);
