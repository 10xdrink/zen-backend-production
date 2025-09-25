const express = require('express');
const { body, validationResult } = require('express-validator');
const Support = require('../models/Support');
const { protect, adminProtect } = require('../middleware/auth');

const router = express.Router();

// @desc    Submit a support request
// @route   POST /api/support/submit
// @access  Private (User must be logged in)
router.post('/submit', protect, [
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isIn([
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
    ])
    .withMessage('Invalid subject selected'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters'),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('location')
    .isIn(['Jubilee Hills', 'Financial District', 'Kondapur'])
    .withMessage('Valid location is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { subject, message, name, email, phone, location } = req.body;

    // Create support request
    const supportRequest = new Support({
      user: req.user.id,
      name,
      email,
      phone: phone || '',
      location,
      subject,
      message,
      submittedAt: new Date()
    });

    // Set priority based on subject
    if (['Technical Support', 'Complaint'].includes(subject)) {
      supportRequest.priority = 'high';
    } else if (['Appointment Booking', 'Appointment Rescheduling', 'Appointment Cancellation'].includes(subject)) {
      supportRequest.priority = 'medium';
    } else {
      supportRequest.priority = 'low';
    }

    await supportRequest.save();

    // Populate user information for response
    await supportRequest.populate('user', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully. We will get back to you within 24 hours.',
      data: {
        supportRequest: {
          id: supportRequest._id,
          subject: supportRequest.subject,
          status: supportRequest.status,
          priority: supportRequest.priority,
          submittedAt: supportRequest.submittedAt,
          formattedSubmissionDate: supportRequest.formattedSubmissionDate
        }
      }
    });

  } catch (error) {
    console.error('Support request submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit support request. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get user's support requests
// @route   GET /api/support/my-requests
// @access  Private
router.get('/my-requests', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status;
    const subject = req.query.subject;

    // Build query
    let query = { user: req.user.id };
    if (status) query.status = status;
    if (subject) query.subject = subject;

    const supportRequests = await Support.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'fullName email');

    const total = await Support.countDocuments(query);

    res.json({
      success: true,
      message: 'Support requests retrieved successfully',
      data: {
        supportRequests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRequests: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get support requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve support requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get single support request
// @route   GET /api/support/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const supportRequest = await Support.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('assignedTo', 'fullName email');

    if (!supportRequest) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found'
      });
    }

    res.json({
      success: true,
      message: 'Support request retrieved successfully',
      data: { supportRequest }
    });

  } catch (error) {
    console.error('Get support request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve support request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============= ADMIN ROUTES =============

// @desc    Get all support requests (Admin only)
// @route   GET /api/support/admin/all
// @access  Private/Admin
router.get('/admin/all', adminProtect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const status = req.query.status;
    const subject = req.query.subject;
    const location = req.query.location;
    const priority = req.query.priority;
    const search = req.query.search;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (subject) query.subject = subject;
    if (location) query.location = location;
    if (priority) query.priority = priority;
    
    // Search in name, email, or message
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const supportRequests = await Support.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName email phoneNumber')
      .populate('assignedTo', 'fullName email');

    const total = await Support.countDocuments(query);

    res.json({
      success: true,
      message: 'Support requests retrieved successfully',
      data: {
        supportRequests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRequests: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Admin get support requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve support requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Update support request status (Admin only)
// @route   PUT /api/support/admin/:id/status
// @access  Private/Admin
router.put('/admin/:id/status', adminProtect, [
  body('status')
    .isIn(['open', 'in-progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('adminResponse')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin response must be less than 1000 characters')
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

    const { status, adminResponse } = req.body;

    const supportRequest = await Support.findById(req.params.id);
    if (!supportRequest) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found'
      });
    }

    // Update status
    supportRequest.status = status;
    if (adminResponse) {
      supportRequest.adminResponse = adminResponse;
    }
    
    // Set resolved date if status is resolved
    if (status === 'resolved' && !supportRequest.resolvedAt) {
      supportRequest.resolvedAt = new Date();
    }

    // Assign to current admin if status is in-progress
    if (status === 'in-progress' && !supportRequest.assignedTo) {
      supportRequest.assignedTo = req.user.id;
    }

    await supportRequest.save();

    // Populate for response
    await supportRequest.populate('user', 'fullName email');
    await supportRequest.populate('assignedTo', 'fullName email');

    res.json({
      success: true,
      message: 'Support request updated successfully',
      data: { supportRequest }
    });

  } catch (error) {
    console.error('Update support request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update support request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Assign support request to admin (Admin only)
// @route   PUT /api/support/admin/:id/assign
// @access  Private/Admin
router.put('/admin/:id/assign', adminProtect, [
  body('assignedTo')
    .notEmpty()
    .withMessage('Admin ID is required')
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

    const supportRequest = await Support.findById(req.params.id);
    if (!supportRequest) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found'
      });
    }

    await supportRequest.assignTo(req.body.assignedTo);
    await supportRequest.populate('assignedTo', 'fullName email');

    res.json({
      success: true,
      message: 'Support request assigned successfully',
      data: { supportRequest }
    });

  } catch (error) {
    console.error('Assign support request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign support request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get support statistics (Admin only)
// @route   GET /api/support/admin/stats
// @access  Private/Admin
router.get('/admin/stats', adminProtect, async (req, res) => {
  try {
    const stats = await Support.getSupportStats();
    
    // Get recent requests (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRequests = await Support.countDocuments({
      submittedAt: { $gte: sevenDaysAgo }
    });

    // Get average response time for resolved requests
    const resolvedRequests = await Support.find({
      status: 'resolved',
      resolvedAt: { $exists: true }
    });

    let avgResponseTime = 0;
    if (resolvedRequests.length > 0) {
      const totalResponseTime = resolvedRequests.reduce((sum, request) => {
        return sum + (request.responseTime || 0);
      }, 0);
      avgResponseTime = Math.round(totalResponseTime / resolvedRequests.length);
    }

    res.json({
      success: true,
      message: 'Support statistics retrieved successfully',
      data: {
        ...stats,
        recentRequests,
        avgResponseTimeHours: avgResponseTime
      }
    });

  } catch (error) {
    console.error('Get support stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve support statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
