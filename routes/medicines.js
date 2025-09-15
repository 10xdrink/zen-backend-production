const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const { protect: auth } = require('../middleware/auth');

// Get all medicines with filtering and search
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      location,
      prescriptionRequired,
      featured,
      page = 1,
      limit = 20,
      sort = 'rating'
    } = req.query;

    const skip = (page - 1) * limit;
    
    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price_low':
        sortObj = { price: 1 };
        break;
      case 'price_high':
        sortObj = { price: -1 };
        break;
      case 'rating':
        sortObj = { rating: -1, ratingCount: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'name':
        sortObj = { name: 1 };
        break;
      default:
        sortObj = { rating: -1 };
    }

    const options = {
      category,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      inStock: inStock ? inStock === 'true' : undefined,
      location,
      prescriptionRequired: prescriptionRequired ? prescriptionRequired === 'true' : undefined,
      featured: featured ? featured === 'true' : undefined,
      limit: parseInt(limit),
      skip: parseInt(skip),
      sort: sortObj
    };

    const medicines = await Medicine.searchMedicines(search, options);
    const totalCount = await Medicine.countDocuments({
      isActive: true,
      ...(category && category !== 'All' ? { category } : {}),
      ...(inStock !== undefined ? { inStock: inStock === 'true' } : {}),
      ...(location ? { $or: [{ location }, { location: 'All' }] } : {}),
      ...(search ? { $text: { $search: search } } : {})
    });

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
      error: error.message
    });
  }
});

// Get medicine categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Medicine.getCategories();
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get featured medicines
router.get('/featured', async (req, res) => {
  try {
    const { location, limit = 10 } = req.query;
    
    const query = { 
      featured: true, 
      isActive: true, 
      inStock: true 
    };
    
    if (location) {
      query.$or = [
        { location: location },
        { location: 'All' }
      ];
    }

    const medicines = await Medicine.find(query)
      .sort({ rating: -1, ratingCount: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: { medicines }
    });
  } catch (error) {
    console.error('Error fetching featured medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured medicines',
      error: error.message
    });
  }
});

// Get medicine by ID
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate('reviews.userId', 'fullName');

    if (!medicine || !medicine.isActive) {
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
      error: error.message
    });
  }
});

// Search medicines by name/description
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { 
      category, 
      location, 
      limit = 20, 
      page = 1 
    } = req.query;

    const skip = (page - 1) * limit;

    const options = {
      category,
      location,
      limit: parseInt(limit),
      skip: parseInt(skip),
      sort: { score: { $meta: 'textScore' }, rating: -1 }
    };

    const medicines = await Medicine.searchMedicines(query, options);

    res.json({
      success: true,
      data: { 
        medicines,
        searchTerm: query,
        count: medicines.length
      }
    });
  } catch (error) {
    console.error('Error searching medicines:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search medicines',
      error: error.message
    });
  }
});

// Get medicines by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { 
      location, 
      limit = 20, 
      page = 1,
      sort = 'rating'
    } = req.query;

    const skip = (page - 1) * limit;

    let sortObj = {};
    switch (sort) {
      case 'price_low':
        sortObj = { price: 1 };
        break;
      case 'price_high':
        sortObj = { price: -1 };
        break;
      case 'rating':
        sortObj = { rating: -1, ratingCount: -1 };
        break;
      default:
        sortObj = { rating: -1 };
    }

    const query = { 
      category, 
      isActive: true 
    };
    
    if (location) {
      query.$or = [
        { location: location },
        { location: 'All' }
      ];
    }

    const medicines = await Medicine.find(query)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const totalCount = await Medicine.countDocuments(query);

    res.json({
      success: true,
      data: { 
        medicines,
        category,
        count: totalCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching medicines by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicines by category',
      error: error.message
    });
  }
});

// Add review to medicine (requires authentication)
router.post('/:id/review', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const medicineId = req.params.id;
    const userId = req.user.id;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine || !medicine.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Add review
    medicine.addReview(userId, rating, comment);
    await medicine.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        rating: medicine.rating,
        ratingCount: medicine.ratingCount
      }
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
});

// Check medicine availability
router.post('/:id/check-availability', async (req, res) => {
  try {
    const { quantity = 1 } = req.body;
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine || !medicine.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    const isAvailable = medicine.isAvailable(quantity);

    res.json({
      success: true,
      data: {
        available: isAvailable,
        inStock: medicine.inStock,
        stockQuantity: medicine.stockQuantity,
        requestedQuantity: quantity
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: error.message
    });
  }
});

// ADMIN ROUTES (require admin authentication)

// Create new medicine (admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin (you'll need to implement admin check)
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }

    const medicine = new Medicine(req.body);
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
      error: error.message
    });
  }
});

// Update medicine (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }

    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
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
      error: error.message
    });
  }
});

// Delete medicine (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }

    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
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
      error: error.message
    });
  }
});

module.exports = router;
