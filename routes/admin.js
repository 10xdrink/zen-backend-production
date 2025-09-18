const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { sendAdminOTPEmail } = require('../utils/emailService');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const ZenMembership = require('../models/ZenMembership');
const Booking = require('../models/Booking');
const MedicineOrder = require('../models/MedicineOrder');
const Medicine = require('../models/Medicine');

const router = express.Router();

// In-memory storage for admin OTPs (in production, use Redis or database)
const adminOTPs = new Map();

// Admin login - send OTP to admin email
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());

    // Check if the provided email matches any of the admin emails
    if (!adminEmails.includes(email.toLowerCase())) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access. Invalid admin email.'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (5 minutes)
    adminOTPs.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0
    });

    // Send OTP email
    await sendAdminOTPEmail(email, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent to admin email successfully',
      data: {
        email,
        expiresIn: 300 // 5 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin OTP verification
router.post('/verify-otp', [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, otp } = req.body;
    const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());

    // Check if the provided email matches any of the admin emails
    if (!adminEmails.includes(email.toLowerCase())) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access. Invalid admin email.'
      });
    }

    const storedOTPData = adminOTPs.get(email);

    if (!storedOTPData) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found. Please request a new OTP.'
      });
    }

    // Check if OTP has expired
    if (Date.now() > storedOTPData.expiresAt) {
      adminOTPs.delete(email);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check attempt limit
    if (storedOTPData.attempts >= 3) {
      adminOTPs.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (storedOTPData.otp !== otp) {
      storedOTPData.attempts += 1;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        attemptsRemaining: 3 - storedOTPData.attempts
      });
    }

    // OTP verified successfully, generate JWT token
    const token = jwt.sign(
      { 
        email: email,
        role: 'admin',
        type: 'admin_access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Clear OTP from memory
    adminOTPs.delete(email);

    res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      data: {
        token,
        admin: {
          email: email,
          role: 'admin'
        },
        expiresIn: 86400 // 24 hours in seconds
      }
    });

  } catch (error) {
    console.error('Admin OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Resend OTP
router.post('/resend-otp', [
  body('email').isEmail().withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());

    // Check if the provided email matches any of the admin emails
    if (!adminEmails.includes(email.toLowerCase())) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access. Invalid admin email.'
      });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store new OTP with expiration (5 minutes)
    adminOTPs.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0
    });

    // Send OTP email
    await sendAdminOTPEmail(email, otp);

    res.status(200).json({
      success: true,
      message: 'New OTP sent to admin email successfully',
      data: {
        email,
        expiresIn: 300 // 5 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Admin resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin middleware to protect admin routes
const adminProtect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin' || decoded.type !== 'admin_access') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
    if (!adminEmails.includes(decoded.email.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Invalid admin credentials.'
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.'
    });
  }
};

// Test protected admin route
router.get('/dashboard', adminProtect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin dashboard access granted',
    data: {
      admin: req.admin,
      timestamp: new Date().toISOString()
    }
  });
});

// ==================== CUSTOMER MANAGEMENT ROUTES ====================

// Get all customers with pagination and filters
router.get('/customers', adminProtect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      planType = '',
      isActive = '',
      location = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (planType) filter.planType = planType;
    if (isActive !== '') filter.isActive = isActive === 'true';
    if (location) filter.location = location;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [customers, totalCount] = await Promise.all([
      User.find(filter)
        .select('-emailOTP -phoneOTP -__v')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    // Fix planType and calculate accurate total spent for each customer
    const fixedCustomers = await Promise.all(customers.map(async (customer) => {
      let updatedCustomer = { ...customer };
      
      // Check ZenMembership collection for accurate membership status
      const zenMembership = await ZenMembership.findOne({ 
        userId: customer._id,
        isActive: true,
        status: 'active'
      });
      
      // Debug logging for specific users
      if (customer.email === 'hoppingheights3@gmail.com') {
        console.log('Hopping customer data:', {
          planType: customer.planType,
          hasZenMembership: customer.hasZenMembership,
          zenMembershipPurchaseDate: customer.zenMembershipPurchaseDate,
          zenMembershipRecord: zenMembership ? 'Found active membership' : 'No active membership'
        });
      }
      
      // Determine correct plan type based on ZenMembership collection
      if (zenMembership) {
        updatedCustomer.planType = 'zen_member';
        updatedCustomer.hasZenMembership = true;
        console.log(`Fixed planType for ${customer.fullName}: zen_member (from ZenMembership collection)`);
      } else if (customer.hasZenMembership && customer.planType === 'standard') {
        // Fallback: use User model data if ZenMembership record not found
        updatedCustomer.planType = 'zen_member';
        console.log(`Fixed planType for ${customer.fullName}: zen_member (from User model)`);
      }
      
      // Calculate accurate total spent from completed bookings and delivered orders
      const [completedBookings, deliveredOrders] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              user: customer._id,
              status: 'completed',
              paymentStatus: 'paid'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalAmount' }
            }
          }
        ]),
        MedicineOrder.aggregate([
          {
            $match: {
              userId: customer._id,
              orderStatus: 'delivered'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$orderSummary.totalAmount' }
            }
          }
        ])
      ]);

      const bookingsTotal = completedBookings.length > 0 ? completedBookings[0].total : 0;
      const ordersTotal = deliveredOrders.length > 0 ? deliveredOrders[0].total : 0;
      updatedCustomer.totalSpent = bookingsTotal + ordersTotal;
      
      return updatedCustomer;
    }));

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      data: {
        customers: fixedCustomers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get customer statistics
router.get('/customers/stats', adminProtect, async (req, res) => {
  try {
    // Get basic user stats
    const userStats = await User.getUserStats();
    
    // Get accurate zen membership count from ZenMembership collection
    const activeZenMemberships = await ZenMembership.countDocuments({
      isActive: true,
      status: 'active'
    });
    
    // Get total users count
    const totalUsers = await User.countDocuments({});
    
    // Calculate standard users (total - zen members)
    const standardUsers = totalUsers - activeZenMemberships;
    
    // Get active users count
    const activeUsers = await User.countDocuments({ isActive: true });
    
    // Get verified users count
    const verifiedUsers = await User.countDocuments({
      isEmailVerified: true,
      isPhoneVerified: true
    });
    
    // Get additional stats
    const [recentCustomers, topSpenders] = await Promise.all([
      User.find({ isActive: true })
        .select('fullName email planType createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      User.find({ totalSpent: { $gt: 0 } })
        .select('fullName email totalSpent planType')
        .sort({ totalSpent: -1 })
        .limit(5)
        .lean()
    ]);

    // Create accurate overview stats
    const overview = {
      totalUsers,
      standardUsers: Math.max(0, standardUsers), // Ensure non-negative
      zenMembers: activeZenMemberships,
      activeUsers,
      verifiedUsers
    };

    console.log('Customer statistics calculated:', overview);

    res.status(200).json({
      success: true,
      message: 'Customer statistics retrieved successfully',
      data: {
        overview,
        recentCustomers,
        topSpenders
      }
    });

  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single customer details
router.get('/customers/:id', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findById(id)
      .select('-emailOTP -phoneOTP -__v')
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's bookings and orders
    const [bookings, medicineOrders, zenMembership] = await Promise.all([
      Booking.find({ userId: id })
        .populate('treatmentId', 'name price')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      MedicineOrder.find({ userId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      ZenMembership.findOne({ userId: id }).lean()
    ]);

    res.status(200).json({
      success: true,
      message: 'Customer details retrieved successfully',
      data: {
        customer,
        bookings,
        medicineOrders,
        zenMembership,
        planDetails: {
          planType: customer.planType,
          hasZenMembership: customer.hasZenMembership,
          zenMembershipPurchaseDate: customer.zenMembershipPurchaseDate,
          isLifetimeMember: customer.hasZenMembership && !customer.zenMembershipExpiryDate
        }
      }
    });

  } catch (error) {
    console.error('Get customer details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new customer (admin only)
router.post('/customers', [
  adminProtect,
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('fullName').trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2 and 50 characters'),
  body('phoneNumber').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please provide a valid phone number'),
  body('dateOfBirth').isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
  body('location').isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']).withMessage('Location must be one of the available locations'),
  body('planType').optional().isIn(['standard', 'zen_member']).withMessage('Plan type must be standard or zen_member')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      email,
      fullName,
      phoneNumber,
      dateOfBirth,
      gender,
      location,
      planType = 'standard'
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone number already exists'
      });
    }

    // Create new user
    const newUser = new User({
      email,
      fullName,
      phoneNumber,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      location,
      planType,
      registrationSource: 'admin_created',
      isEmailVerified: true, // Admin created users are considered verified
      isPhoneVerified: true,
      hasZenMembership: planType === 'zen_member',
      zenMembershipPurchaseDate: planType === 'zen_member' ? new Date() : null
    });

    await newUser.save();

    // If zen member, create membership record
    if (planType === 'zen_member') {
      const zenMembership = new ZenMembership({
        userId: newUser._id,
        membershipType: 'zen',
        isActive: true,
        status: 'active',
        transactionId: `ADMIN_${Date.now()}`,
        paymentMethod: 'admin_created'
      });
      await zenMembership.save();
    }

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        customer: {
          _id: newUser._id,
          email: newUser.email,
          fullName: newUser.fullName,
          phoneNumber: newUser.phoneNumber,
          planType: newUser.planType,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update customer details
router.put('/customers/:id', [
  adminProtect,
  body('email').optional().isEmail().withMessage('Please provide a valid email address'),
  body('fullName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2 and 50 characters'),
  body('phoneNumber').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please provide a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
  body('location').optional().isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']).withMessage('Location must be one of the available locations'),
  body('planType').optional().isIn(['standard', 'zen_member']).withMessage('Plan type must be standard or zen_member'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check for duplicate email/phone if being updated
    if (updateData.email || updateData.phoneNumber) {
      const duplicateQuery = {
        _id: { $ne: id },
        $or: []
      };
      
      if (updateData.email) duplicateQuery.$or.push({ email: updateData.email });
      if (updateData.phoneNumber) duplicateQuery.$or.push({ phoneNumber: updateData.phoneNumber });
      
      const existingUser = await User.findOne(duplicateQuery);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone number already exists'
        });
      }
    }

    // Handle plan type change
    if (updateData.planType && updateData.planType !== customer.planType) {
      if (updateData.planType === 'zen_member') {
        updateData.hasZenMembership = true;
        updateData.zenMembershipPurchaseDate = new Date();
        
        // Create or update zen membership
        let zenMembership = await ZenMembership.findOne({ userId: id });
        if (!zenMembership) {
          zenMembership = new ZenMembership({
            userId: id,
            membershipType: 'zen',
            isActive: true,
            status: 'active',
            transactionId: `ADMIN_UPGRADE_${Date.now()}`,
            paymentMethod: 'admin_created'
          });
          await zenMembership.save();
        } else {
          zenMembership.isActive = true;
          zenMembership.status = 'active';
          await zenMembership.save();
        }
      } else {
        updateData.hasZenMembership = false;
        updateData.zenMembershipPurchaseDate = null;
        
        // Deactivate zen membership
        await ZenMembership.findOneAndUpdate(
          { userId: id },
          { isActive: false, status: 'cancelled' }
        );
      }
    }

    const updatedCustomer = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-emailOTP -phoneOTP -__v');

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        customer: updatedCustomer
      }
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Toggle customer active status
router.patch('/customers/:id/toggle-status', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    customer.isActive = !customer.isActive;
    await customer.save();

    res.status(200).json({
      success: true,
      message: `Customer ${customer.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        customerId: id,
        isActive: customer.isActive
      }
    });

  } catch (error) {
    console.error('Toggle customer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle customer status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upgrade customer to Zen membership
router.post('/customers/:id/upgrade-zen', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionId } = req.body;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (customer.hasZenMembership) {
      return res.status(400).json({
        success: false,
        message: 'Customer already has Zen membership'
      });
    }

    // Upgrade to zen membership
    await customer.upgradeToZenMembership(transactionId || `ADMIN_UPGRADE_${Date.now()}`);

    // Create or update zen membership record
    let zenMembership = await ZenMembership.findOne({ userId: id });
    if (!zenMembership) {
      zenMembership = new ZenMembership({
        userId: id,
        membershipType: 'zen',
        isActive: true,
        status: 'active',
        transactionId: transactionId || `ADMIN_UPGRADE_${Date.now()}`,
        paymentMethod: 'admin_created'
      });
      await zenMembership.save();
    } else {
      await zenMembership.activateLifetimeMembership();
    }

    res.status(200).json({
      success: true,
      message: 'Customer upgraded to Zen membership successfully',
      data: {
        customerId: id,
        planType: 'zen_member',
        hasZenMembership: true,
        zenMembershipPurchaseDate: customer.zenMembershipPurchaseDate
      }
    });

  } catch (error) {
    console.error('Upgrade customer to zen error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade customer to Zen membership',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete customer (hard delete - completely remove)
router.delete('/customers/:id', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Hard delete - completely remove user and related data
    await Promise.all([
      // Delete user
      User.findByIdAndDelete(id),
      // Delete zen membership if exists
      ZenMembership.findOneAndDelete({ userId: id }),
      // Delete all bookings
      Booking.deleteMany({ user: id }),
      // Delete all medicine orders
      MedicineOrder.deleteMany({ userId: id })
    ]);

    res.status(200).json({
      success: true,
      message: 'Customer and all related data deleted successfully',
      data: {
        customerId: id,
        deleted: true
      }
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get customer activity/history
router.get('/customers/:id/activity', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all customer activities
    const [bookings, medicineOrders] = await Promise.all([
      Booking.find({ userId: id })
        .populate('treatmentId', 'name price duration')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MedicineOrder.find({ userId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()
    ]);

    // Combine and sort activities
    const activities = [
      ...bookings.map(booking => ({
        type: 'booking',
        id: booking._id,
        date: booking.createdAt,
        status: booking.status,
        amount: booking.totalAmount,
        details: {
          treatment: booking.treatmentId?.name,
          appointmentDate: booking.appointmentDate,
          timeSlot: booking.timeSlot
        }
      })),
      ...medicineOrders.map(order => ({
        type: 'medicine_order',
        id: order._id,
        date: order.createdAt,
        status: order.status,
        amount: order.totalAmount,
        details: {
          itemCount: order.items?.length || 0,
          deliveryAddress: order.deliveryAddress?.fullAddress
        }
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      message: 'Customer activity retrieved successfully',
      data: {
        activities: activities.slice(0, parseInt(limit)),
        totalActivities: activities.length,
        customer: {
          _id: customer._id,
          fullName: customer.fullName,
          email: customer.email,
          planType: customer.planType,
          totalBookings: customer.totalBookings,
          totalSpent: customer.totalSpent,
          lastBookingDate: customer.lastBookingDate
        }
      }
    });

  } catch (error) {
    console.error('Get customer activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== PHARMACY/MEDICINE MANAGEMENT ROUTES ====================

// Get all medicines with admin filters and pagination
router.get('/medicines', adminProtect, async (req, res) => {
  try {
    const {
      search,
      category,
      inStock,
      isActive,
      featured,
      page = 1,
      limit = 20,
      sort = 'createdAt'
    } = req.query;

    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (inStock !== undefined) {
      query.inStock = inStock === 'true';
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'name':
        sortObj = { name: 1 };
        break;
      case 'price_low':
        sortObj = { price: 1 };
        break;
      case 'price_high':
        sortObj = { price: -1 };
        break;
      case 'stock':
        sortObj = { stockQuantity: -1 };
        break;
      case 'rating':
        sortObj = { rating: -1, ratingCount: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    const [medicines, totalCount] = await Promise.all([
      Medicine.find(query)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean(),
      Medicine.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        medicines,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicines',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get medicine statistics for admin dashboard
router.get('/medicines/stats', adminProtect, async (req, res) => {
  try {
    const stats = await Medicine.aggregate([
      {
        $group: {
          _id: null,
          totalMedicines: { $sum: 1 },
          activeMedicines: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          inStockMedicines: {
            $sum: { $cond: ['$inStock', 1, 0] }
          },
          outOfStockMedicines: {
            $sum: { $cond: [{ $eq: ['$inStock', false] }, 1, 0] }
          },
          featuredMedicines: {
            $sum: { $cond: ['$featured', 1, 0] }
          },
          totalStockValue: {
            $sum: { $multiply: ['$price', '$stockQuantity'] }
          },
          averagePrice: { $avg: '$price' },
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    // Get category breakdown
    const categoryStats = await Medicine.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$stockQuantity' },
          averagePrice: { $avg: '$price' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalMedicines: 0,
          activeMedicines: 0,
          inStockMedicines: 0,
          outOfStockMedicines: 0,
          featuredMedicines: 0,
          totalStockValue: 0,
          averagePrice: 0,
          averageRating: 0
        },
        categoryBreakdown: categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching medicine stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicine statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single medicine details
router.get('/medicines/:id', adminProtect, async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate('reviews.userId', 'fullName email');

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      data: { medicine }
    });
  } catch (error) {
    console.error('Error fetching medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new medicine
router.post('/medicines', [
  adminProtect,
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Medicine name must be between 2 and 100 characters'),
  body('category').isIn(['Pain Relief', 'Skincare', 'Vitamins', 'Supplements', 'First Aid', 'Personal Care', 'Prescription', 'OTC']).withMessage('Invalid category'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('originalPrice').isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
  body('stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('manufacturer').trim().isLength({ min: 2, max: 100 }).withMessage('Manufacturer must be between 2 and 100 characters'),
  body('dosage').trim().isLength({ min: 1, max: 100 }).withMessage('Dosage is required'),
  body('usage').trim().isLength({ min: 10, max: 500 }).withMessage('Usage instructions must be between 10 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Calculate discount if originalPrice is provided
    const medicineData = { ...req.body };
    if (medicineData.originalPrice && medicineData.price < medicineData.originalPrice) {
      medicineData.discount = Math.round(((medicineData.originalPrice - medicineData.price) / medicineData.originalPrice) * 100);
    }

    const medicine = new Medicine(medicineData);
    await medicine.save();

    res.status(201).json({
      success: true,
      message: 'Medicine created successfully',
      data: { medicine }
    });
  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update medicine
router.put('/medicines/:id', [
  adminProtect,
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Medicine name must be between 2 and 100 characters'),
  body('category').optional().isIn(['Pain Relief', 'Skincare', 'Vitamins', 'Supplements', 'First Aid', 'Personal Care', 'Prescription', 'OTC']).withMessage('Invalid category'),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('manufacturer').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Manufacturer must be between 2 and 100 characters'),
  body('dosage').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Dosage is required'),
  body('usage').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Usage instructions must be between 10 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    // Calculate discount if originalPrice and price are provided
    if (updateData.originalPrice && updateData.price && updateData.price < updateData.originalPrice) {
      updateData.discount = Math.round(((updateData.originalPrice - updateData.price) / updateData.originalPrice) * 100);
    }

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: { medicine }
    });
  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Toggle medicine active status
router.patch('/medicines/:id/toggle-status', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findById(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    medicine.isActive = !medicine.isActive;
    await medicine.save();

    res.json({
      success: true,
      message: `Medicine ${medicine.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { 
        medicine: {
          _id: medicine._id,
          name: medicine.name,
          isActive: medicine.isActive
        }
      }
    });
  } catch (error) {
    console.error('Error toggling medicine status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle medicine status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update medicine stock
router.patch('/medicines/:id/stock', [
  adminProtect,
  body('stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('inStock').optional().isBoolean().withMessage('inStock must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { stockQuantity, inStock } = req.body;

    const updateData = { stockQuantity };
    if (inStock !== undefined) {
      updateData.inStock = inStock;
    } else {
      // Auto-set inStock based on quantity
      updateData.inStock = stockQuantity > 0;
    }

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine stock updated successfully',
      data: { 
        medicine: {
          _id: medicine._id,
          name: medicine.name,
          stockQuantity: medicine.stockQuantity,
          inStock: medicine.inStock
        }
      }
    });
  } catch (error) {
    console.error('Error updating medicine stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medicine stock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete medicine (soft delete)
router.delete('/medicines/:id', adminProtect, async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all medicine orders with admin filters and pagination
router.get('/medicine-orders', adminProtect, async (req, res) => {
  try {
    const {
      status,
      userId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = 'createdAt'
    } = req.query;

    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (status && status !== 'All') {
      query.orderStatus = status;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      case 'amount_high':
        sortObj = { 'orderSummary.totalAmount': -1 };
        break;
      case 'amount_low':
        sortObj = { 'orderSummary.totalAmount': 1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // Handle search functionality
    let orderQuery = MedicineOrder.find(query);
    
    if (search && search.trim() !== '') {
      // Search in populated user fields and order ID
      orderQuery = orderQuery.populate('userId', 'fullName email phoneNumber')
        .populate('medicines.medicineId', 'name price image');
      
      const searchRegex = new RegExp(search.trim(), 'i');
      
      // First get all orders, then filter by search
      const allOrders = await orderQuery.lean();
      const filteredOrders = allOrders.filter(order => {
        return (
          order._id.toString().includes(search.trim()) ||
          (order.userId && (
            order.userId.fullName?.match(searchRegex) ||
            order.userId.email?.match(searchRegex) ||
            order.userId.phoneNumber?.match(searchRegex)
          )) ||
          order.orderStatus?.match(searchRegex)
        );
      });
      
      const totalCount = filteredOrders.length;
      const orders = filteredOrders
        .sort((a, b) => {
          if (sortObj.createdAt === -1) return new Date(b.createdAt) - new Date(a.createdAt);
          if (sortObj.createdAt === 1) return new Date(a.createdAt) - new Date(b.createdAt);
          if (sortObj['orderSummary.totalAmount'] === -1) return b.orderSummary?.totalAmount - a.orderSummary?.totalAmount;
          if (sortObj['orderSummary.totalAmount'] === 1) return a.orderSummary?.totalAmount - b.orderSummary?.totalAmount;
          return 0;
        })
        .slice(skip, skip + parseInt(limit));
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    }

    const [orders, totalCount] = await Promise.all([
      orderQuery
        .populate('userId', 'fullName email phoneNumber')
        .populate('medicines.medicineId', 'name price image')
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean(),
      MedicineOrder.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching medicine orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicine orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get medicine order statistics
router.get('/medicine-orders/stats', adminProtect, async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: stats[0] || {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0
      }
    });
  } catch (error) {
    console.error('Error fetching medicine order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicine order statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update medicine order status
router.patch('/medicine-orders/:id/status', [
  adminProtect,
  body('status').isIn(['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'returned']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const order = await MedicineOrder.findByIdAndUpdate(
      id,
      { orderStatus: status },
      { new: true }
    ).populate('userId', 'fullName email phoneNumber');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Medicine order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
