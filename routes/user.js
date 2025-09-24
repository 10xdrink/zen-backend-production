const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Booking = require('../models/Booking');
const MedicineOrder = require('../models/MedicineOrder');
const { protect } = require('../middleware/auth');
const { upload, deleteImage } = require('../config/cloudinary');

const router = express.Router();

// Upload profile picture
router.post('/profile-picture', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const userId = req.user.userId;
    
    // Get current user to check if they have an existing profile picture
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile picture from Cloudinary if it exists
    if (currentUser.profilePhoto) {
      try {
        // Extract public_id from the Cloudinary URL
        const urlParts = currentUser.profilePhoto.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];
        const fullPublicId = `zennara/profile-pictures/${publicId}`;
        
        await deleteImage(fullPublicId);
      } catch (deleteError) {
        console.error('Error deleting old profile picture:', deleteError);
        // Continue with upload even if deletion fails
      }
    }

    // Update user with new profile picture URL
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: req.file.path },
      { new: true, runValidators: true }
    ).select('-emailOTP -phoneOTP');

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        user: updatedUser,
        profilePictureUrl: req.file.path
      }
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    
    // If there was an error and a file was uploaded, try to delete it
    if (req.file && req.file.public_id) {
      try {
        await deleteImage(req.file.public_id);
      } catch (deleteError) {
        console.error('Error cleaning up uploaded file:', deleteError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete profile picture
router.delete('/profile-picture', protect, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!currentUser.profilePhoto) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Delete from Cloudinary
    try {
      const urlParts = currentUser.profilePhoto.split('/');
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = publicIdWithExtension.split('.')[0];
      const fullPublicId = `zennara/profile-pictures/${publicId}`;
      
      await deleteImage(fullPublicId);
    } catch (deleteError) {
      console.error('Error deleting profile picture from Cloudinary:', deleteError);
    }

    // Update user to remove profile picture
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: null },
      { new: true, runValidators: true }
    ).select('-emailOTP -phoneOTP');

    res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user profile
router.put('/profile', protect, [
  body('fullName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2-50 characters'),
  body('phoneNumber').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please provide a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
  body('location').optional().isIn(['Jubilee Hills', 'Financial District', 'Kondapur']).withMessage('Please select a valid location')
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
