const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { sendAdminOTPEmail } = require('../utils/emailService');
const { protect } = require('../middleware/auth');

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

module.exports = router;
