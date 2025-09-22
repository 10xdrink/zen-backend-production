const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Treatment name is required'],
    trim: true,
    maxlength: [100, 'Treatment name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Treatment category is required'],
    enum: ['Skin', 'Facials', 'Aesthetics', 'Hair', 'Peels', 'Men', 'Wellness'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Treatment description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  fullDescription: {
    type: String,
    required: [true, 'Full treatment description is required'],
    trim: true,
    maxlength: [2000, 'Full description cannot exceed 2000 characters']
  },
  duration: {
    type: Number, // Duration in minutes
    required: [true, 'Treatment duration is required'],
    min: [15, 'Duration must be at least 15 minutes']
  },
  durationDisplay: {
    type: String,
    required: [true, 'Duration display format is required']
  },
  image: {
    type: String,
    required: [true, 'Treatment image URL is required'],
    trim: true
  },
  beforeAfterImages: [{
    type: String,
    trim: true
  }],
  benefits: [{
    type: String,
    trim: true,
    maxlength: [200, 'Benefit description cannot exceed 200 characters']
  }],
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5']
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: [0, 'Rating count cannot be negative']
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review comment cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  availableLocations: [{
    type: String,
    enum: ['Jubilee Hills', 'Financial District', 'Kondapur']
  }],
  // SEO and metadata
  slug: {
    type: String,
    trim: true,
    lowercase: true
  },
  metaTitle: String,
  metaDescription: String,
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
treatmentSchema.index({ category: 1, isActive: 1 });
treatmentSchema.index({ name: 'text', description: 'text', fullDescription: 'text' });
treatmentSchema.index({ price: 1 });
treatmentSchema.index({ rating: -1 });
treatmentSchema.index({ slug: 1 }, { unique: true, sparse: true });
treatmentSchema.index({ isPopular: -1, rating: -1 });

// Pre-save middleware to generate slug
treatmentSchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    if (this.name) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }
  }
  next();
});

// Virtual for average rating calculation
treatmentSchema.virtual('averageRating').get(function() {
  return this.ratingCount > 0 ? Math.round((this.rating / this.ratingCount) * 10) / 10 : 0;
});

// Static method to get treatments by category
treatmentSchema.statics.getByCategory = function(category, options = {}) {
  const query = { isActive: true };
  
  if (category && category !== 'All') {
    query.category = category;
  }
  
  return this.find(query)
    .sort(options.sort || { isPopular: -1, rating: -1, name: 1 })
    .limit(options.limit || 0)
    .select(options.select || '');
};

// Static method to search treatments
treatmentSchema.statics.searchTreatments = function(searchTerm, options = {}) {
  const query = {
    isActive: true,
    $text: { $search: searchTerm }
  };
  
  if (options.category && options.category !== 'All') {
    query.category = options.category;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, rating: -1 })
    .limit(options.limit || 20);
};

// Instance method to add review and update rating
treatmentSchema.methods.addReview = function(userId, bookingId, rating, comment = '') {
  // Check if user already reviewed this treatment for this booking
  const existingReviewIndex = this.reviews.findIndex(
    review => review.user.toString() === userId.toString() && 
              review.booking.toString() === bookingId.toString()
  );

  if (existingReviewIndex !== -1) {
    // Update existing review
    const oldRating = this.reviews[existingReviewIndex].rating;
    this.reviews[existingReviewIndex].rating = rating;
    this.reviews[existingReviewIndex].comment = comment;
    this.reviews[existingReviewIndex].createdAt = new Date();
    
    // Recalculate average rating
    this.recalculateRating();
  } else {
    // Add new review
    this.reviews.push({
      user: userId,
      booking: bookingId,
      rating: rating,
      comment: comment
    });
    
    // Update rating and count
    this.rating = ((this.rating * this.ratingCount) + rating) / (this.ratingCount + 1);
    this.ratingCount += 1;
  }
  
  return this.save();
};

// Instance method to recalculate rating from all reviews
treatmentSchema.methods.recalculateRating = function() {
  if (this.reviews.length === 0) {
    this.rating = 0;
    this.ratingCount = 0;
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = totalRating / this.reviews.length;
    this.ratingCount = this.reviews.length;
  }
  return this;
};

// Instance method to update rating (legacy support)
treatmentSchema.methods.updateRating = function(newRating) {
  this.rating = ((this.rating * this.ratingCount) + newRating) / (this.ratingCount + 1);
  this.ratingCount += 1;
  return this.save();
};

module.exports = mongoose.model('Treatment', treatmentSchema);
