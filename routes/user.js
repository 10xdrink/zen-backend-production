const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Booking = require('../models/Booking');
const MedicineOrder = require('../models/MedicineOrder');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Update user profile
router.put('/profile', protect, [
  body('fullName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2-50 characters'),
  body('phoneNumber').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please provide a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
  body('location').optional().isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']).withMessage('Please select a valid location')
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

    const userId = req.user.userId;
    const updateData = req.body;

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-emailOTP -phoneOTP');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete user account
router.delete('/account', protect, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user stats (appointments, orders, savings)
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's bookings
    const bookings = await Booking.find({ user: userId });
    const appointmentCount = bookings.length;
    
    // Get user's medicine orders
    const orders = await MedicineOrder.find({ userId: userId });
    const orderCount = orders.length;
    
    // Calculate total savings
    let totalSavings = 0;
    
    // Get user to check membership status
    const user = await User.findById(userId);
    const hasZenMembership = user && user.hasZenMembership;
    
    // Calculate savings from bookings (20% discount for Zen members)
    if (hasZenMembership) {
      bookings.forEach(booking => {
        if (booking.totalAmount) {
          totalSavings += booking.totalAmount * 0.2;
        }
      });
    }
    
    // Add savings from medicine orders
    orders.forEach(order => {
      if (order.orderSummary && order.orderSummary.zenDiscount) {
        totalSavings += order.orderSummary.zenDiscount;
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        appointmentCount,
        orderCount,
        totalSavings: Math.round(totalSavings)
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
