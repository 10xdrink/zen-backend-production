const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Pain Relief', 'Skincare', 'Vitamins', 'Supplements', 'First Aid', 'Personal Care', 'Prescription', 'OTC'],
    index: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  inStock: {
    type: Boolean,
    default: true,
    index: true
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  manufacturer: {
    type: String,
    required: true
  },
  dosage: {
    type: String,
    required: true
  },
  usage: {
    type: String,
    required: true
  },
  sideEffects: {
    type: String,
    default: ''
  },
  contraindications: {
    type: String,
    default: ''
  },
  activeIngredients: [{
    name: String,
    quantity: String
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: 0
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  prescriptionRequired: {
    type: Boolean,
    default: false
  },
  ageRestriction: {
    minAge: {
      type: Number,
      default: 0
    },
    maxAge: {
      type: Number,
      default: 120
    }
  },
  tags: [String],
  featured: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    enum: ['Jubilee Hills', 'Kokapet', 'Kondapur', 'All'],
    default: 'All'
  },
  expiryDate: {
    type: Date
  },
  batchNumber: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
medicineSchema.index({ name: 'text', description: 'text', manufacturer: 'text' });
medicineSchema.index({ category: 1, inStock: 1 });
medicineSchema.index({ price: 1 });
medicineSchema.index({ rating: -1 });
medicineSchema.index({ featured: 1, isActive: 1 });

// Virtual for discounted price
medicineSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return Math.round(this.price * (1 - this.discount / 100));
  }
  return this.price;
});

// Virtual for Zen membership price (10% additional discount)
medicineSchema.virtual('zenPrice').get(function() {
  const basePrice = this.discount > 0 ? this.discountedPrice : this.price;
  return Math.round(basePrice * 0.9);
});

// Method to update rating
medicineSchema.methods.updateRating = function() {
  if (this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = totalRating / this.reviews.length;
    this.ratingCount = this.reviews.length;
  } else {
    this.rating = 0;
    this.ratingCount = 0;
  }
};

// Method to add review
medicineSchema.methods.addReview = function(userId, rating, comment) {
  // Remove existing review from same user
  this.reviews = this.reviews.filter(review => !review.userId.equals(userId));
  
  // Add new review
  this.reviews.push({
    userId,
    rating,
    comment,
    createdAt: new Date()
  });
  
  // Update rating
  this.updateRating();
};

// Method to check availability
medicineSchema.methods.isAvailable = function(quantity = 1) {
  return this.inStock && this.isActive && this.stockQuantity >= quantity;
};

// Static method to get categories
medicineSchema.statics.getCategories = function() {
  return this.distinct('category', { isActive: true });
};

// Static method to search medicines
medicineSchema.statics.searchMedicines = function(searchTerm, options = {}) {
  const {
    category,
    minPrice,
    maxPrice,
    inStock,
    location,
    prescriptionRequired,
    featured,
    limit = 20,
    skip = 0,
    sort = { rating: -1 }
  } = options;

  const query = { isActive: true };

  // Text search
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  // Category filter
  if (category && category !== 'All') {
    query.category = category;
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = minPrice;
    if (maxPrice !== undefined) query.price.$lte = maxPrice;
  }

  // Stock filter
  if (inStock !== undefined) {
    query.inStock = inStock;
  }

  // Location filter
  if (location) {
    query.$or = [
      { location: location },
      { location: 'All' }
    ];
  }

  // Prescription filter
  if (prescriptionRequired !== undefined) {
    query.prescriptionRequired = prescriptionRequired;
  }

  // Featured filter
  if (featured !== undefined) {
    query.featured = featured;
  }

  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .populate('reviews.userId', 'fullName');
};

module.exports = mongoose.model('Medicine', medicineSchema);
