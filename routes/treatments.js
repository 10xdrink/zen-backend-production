const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Treatment = require('../models/Treatment');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all treatments with filtering and search
router.get('/', [
  query('category').optional().isIn(['All', 'Skin', 'Facials', 'Aesthetics', 'Hair', 'Peels', 'Men', 'Wellness']),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('location').optional().isIn(['Jubilee Hills', 'Financial District', 'Kondapur']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('sort').optional().isIn(['name', 'rating', 'popular'])
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
      category = 'All',
      search,
      location,
      limit = 20,
      page = 1,
      sort = 'popular'
    } = req.query;

    let query = { isActive: true };
    let sortOptions = {};

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Location filter
    if (location) {
      query.availableLocations = location;
    }

    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }

    // Sort options
    switch (sort) {
      case 'name':
        sortOptions = { name: 1 };
        break;
      case 'rating':
        sortOptions = { rating: -1, ratingCount: -1 };
        break;
      case 'popular':
      default:
        sortOptions = { isPopular: -1, rating: -1, name: 1 };
        break;
    }

    // Add text score for search results
    if (search) {
      sortOptions = { score: { $meta: 'textScore' }, ...sortOptions };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const treatments = await Treatment.find(query)
      .populate('reviews.user', 'name email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');

    const total = await Treatment.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Treatments retrieved successfully',
      data: {
        treatments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        filters: {
          category,
          search,
          location,
          sort
        }
      }
    });

  } catch (error) {
    console.error('Get treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve treatments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get treatment by ID or slug
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by ID first, then by slug
    let treatment;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a valid ObjectId
      treatment = await Treatment.findById(identifier)
        .populate({
          path: 'reviews.user',
          select: 'name email'
        })
        .populate({
          path: 'reviews.booking',
          select: 'appointmentDate appointmentTime'
        });
    } else {
      // It's a slug
      treatment = await Treatment.findOne({ slug: identifier, isActive: true })
        .populate({
          path: 'reviews.user',
          select: 'name email'
        })
        .populate({
          path: 'reviews.booking',
          select: 'appointmentDate appointmentTime'
        });
    }

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Treatment retrieved successfully',
      data: { treatment }
    });

  } catch (error) {
    console.error('Get treatment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get treatments by category
router.get('/category/:category', [
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('location').optional().isIn(['Jubilee Hills', 'Kokapet', 'Kondapur'])
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

    const { category } = req.params;
    const { limit = 20, location } = req.query;

    const validCategories = ['All', 'Skin', 'Facials', 'Aesthetics', 'Hair', 'Peels', 'Men', 'Wellness'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    let query = { isActive: true };
    
    if (category !== 'All') {
      query.category = category;
    }
    
    if (location) {
      query.availableLocations = location;
    }

    const treatments = await Treatment.find(query)
      .sort({ isPopular: -1, rating: -1, name: 1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.status(200).json({
      success: true,
      message: `${category} treatments retrieved successfully`,
      data: {
        treatments,
        category,
        count: treatments.length
      }
    });

  } catch (error) {
    console.error('Get treatments by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve treatments by category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get popular treatments
router.get('/featured/popular', [
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('location').optional().isIn(['Jubilee Hills', 'Kokapet', 'Kondapur'])
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

    const { limit = 6, location } = req.query;

    let query = { isActive: true, isPopular: true };
    
    if (location) {
      query.availableLocations = location;
    }

    const treatments = await Treatment.find(query)
      .sort({ rating: -1, ratingCount: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Popular treatments retrieved successfully',
      data: {
        treatments,
        count: treatments.length
      }
    });

  } catch (error) {
    console.error('Get popular treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve popular treatments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Search treatments
router.get('/search/:searchTerm', [
  query('category').optional().isIn(['All', 'Skin', 'Facials', 'Aesthetics', 'Hair', 'Peels', 'Men', 'Wellness']),
  query('limit').optional().isInt({ min: 1, max: 50 })
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

    const { searchTerm } = req.params;
    const { category, limit = 20 } = req.query;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters long'
      });
    }

    const treatments = await Treatment.searchTreatments(searchTerm, {
      category,
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: {
        treatments,
        searchTerm,
        category,
        count: treatments.length
      }
    });

  } catch (error) {
    console.error('Search treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new treatment (Admin only)
router.post('/', protect, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Treatment name must be between 2-100 characters'),
  body('category').isIn(['Skin', 'Facials', 'Aesthetics', 'Hair', 'Peels', 'Men', 'Wellness']).withMessage('Invalid category'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10-500 characters'),
  body('fullDescription').trim().isLength({ min: 50, max: 2000 }).withMessage('Full description must be between 50-2000 characters'),
  body('duration').isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
  body('durationDisplay').trim().notEmpty().withMessage('Duration display is required'),
  body('image').isURL().withMessage('Image must be a valid URL'),
  body('benefits').isArray({ min: 1 }).withMessage('At least one benefit is required'),
  body('availableLocations').isArray({ min: 1 }).withMessage('At least one location is required')
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

    // Check if user is admin (you might want to implement role-based access)
    // For now, we'll allow any authenticated user to create treatments

    const treatmentData = req.body;
    const treatment = new Treatment(treatmentData);
    await treatment.save();

    res.status(201).json({
      success: true,
      message: 'Treatment created successfully',
      data: { treatment }
    });

  } catch (error) {
    console.error('Create treatment error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Treatment with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update treatment (Admin only)
router.put('/:id', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('category').optional().isIn(['Skin', 'Facials', 'Aesthetics', 'Hair', 'Peels', 'Men', 'Wellness']),
  body('description').optional().trim().isLength({ min: 10, max: 500 }),
  body('fullDescription').optional().trim().isLength({ min: 50, max: 2000 }),
  body('duration').optional().isInt({ min: 15 }),
  body('image').optional().isURL()
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

    const treatment = await Treatment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Treatment updated successfully',
      data: { treatment }
    });

  } catch (error) {
    console.error('Update treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete treatment (Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Treatment deleted successfully'
    });

  } catch (error) {
    console.error('Delete treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
