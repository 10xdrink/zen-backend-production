const mongoose = require('mongoose');
const Treatment = require('./models/Treatment');
require('dotenv').config();

// Treatment data based on frontend implementation
const treatmentsData = [
  {
    name: 'HydraFacial',
    category: 'Facials',
    description: 'Deep cleansing and hydrating facial treatment',
    fullDescription: 'HydraFacial is a non-invasive, multi-step treatment that combines the benefits of next-level hydradermabrasion, a chemical peel, automated painless extractions (no pinching!) and a special delivery of Antioxidants, Hyaluronic Acid and Peptides. It does all of this in one quick treatment that delivers real results without downtime or irritation.',
    price: 3500,
    priceDisplay: '₹3,500',
    duration: 60,
    durationDisplay: '60 mins',
    image: 'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg',
      'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg'
    ],
    benefits: [
      'Improves skin texture and tone',
      'Reduces fine lines and wrinkles',
      'Minimizes enlarged pores',
      'Increases skin hydration',
      'Removes blackheads and impurities'
    ],
    rating: 4.8,
    ratingCount: 342,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['hydrating', 'anti-aging', 'deep-cleansing', 'non-invasive']
  },
  {
    name: 'Botox Treatment',
    category: 'Aesthetics',
    description: 'Anti-aging injectable treatment',
    fullDescription: 'Botox is a purified protein that temporarily relaxes facial muscles to smooth out wrinkles and fine lines. It\'s most commonly used to treat crow\'s feet, forehead lines, and frown lines between the eyebrows.',
    price: 8000,
    priceDisplay: '₹8,000',
    duration: 30,
    durationDisplay: '30 mins',
    image: 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg',
      'https://images.pexels.com/photos/3985254/pexels-photo-3985254.jpeg'
    ],
    benefits: [
      'Reduces wrinkles and fine lines',
      'Prevents new wrinkles from forming',
      'Quick and minimally invasive',
      'Results last 3-6 months',
      'No downtime required'
    ],
    rating: 4.9,
    ratingCount: 189,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['anti-aging', 'injectable', 'wrinkle-reduction', 'botox']
  },
  {
    name: 'Chemical Peel',
    category: 'Peels',
    description: 'Exfoliating treatment for smoother skin',
    fullDescription: 'Chemical peels use a chemical solution to remove the damaged outer layers of skin. This treatment helps improve the appearance of fine lines, acne scars, uneven skin tone, and sun damage.',
    price: 2500,
    priceDisplay: '₹2,500',
    duration: 45,
    durationDisplay: '45 mins',
    image: 'https://images.pexels.com/photos/3985254/pexels-photo-3985254.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3985254/pexels-photo-3985254.jpeg',
      'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg'
    ],
    benefits: [
      'Improves skin texture and tone',
      'Reduces acne scars',
      'Minimizes sun damage',
      'Evens out skin pigmentation',
      'Stimulates collagen production'
    ],
    rating: 4.7,
    ratingCount: 256,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['exfoliating', 'acne-treatment', 'skin-renewal', 'chemical-peel']
  },
  {
    name: 'Hair Transplant Consultation',
    category: 'Hair',
    description: 'Professional hair restoration consultation',
    fullDescription: 'Comprehensive consultation with our hair restoration specialists to assess your hair loss pattern, discuss treatment options, and create a personalized hair restoration plan.',
    price: 1000,
    priceDisplay: '₹1,000',
    duration: 30,
    durationDisplay: '30 mins',
    image: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg',
      'https://images.pexels.com/photos/3985327/pexels-photo-3985327.jpeg'
    ],
    benefits: [
      'Professional hair loss assessment',
      'Personalized treatment plan',
      'Expert consultation',
      'Treatment options discussion',
      'Cost-effective initial step'
    ],
    rating: 4.6,
    ratingCount: 124,
    isActive: true,
    isPopular: false,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['hair-restoration', 'consultation', 'hair-loss', 'assessment']
  },
  {
    name: 'Acne Treatment',
    category: 'Skin',
    description: 'Specialized treatment for acne-prone skin',
    fullDescription: 'Comprehensive acne treatment program that includes deep cleansing, extraction, anti-bacterial treatment, and customized skincare regimen to control breakouts and prevent future acne.',
    price: 4000,
    priceDisplay: '₹4,000',
    duration: 75,
    durationDisplay: '75 mins',
    image: 'https://images.pexels.com/photos/3985327/pexels-photo-3985327.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3985327/pexels-photo-3985327.jpeg',
      'https://images.pexels.com/photos/3992656/pexels-photo-3992656.jpeg'
    ],
    benefits: [
      'Reduces active acne breakouts',
      'Prevents future acne formation',
      'Minimizes acne scarring',
      'Controls oil production',
      'Improves overall skin health'
    ],
    rating: 4.5,
    ratingCount: 218,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['acne-treatment', 'skin-care', 'oil-control', 'breakout-control']
  },
  {
    name: 'Men\'s Grooming Package',
    category: 'Men',
    description: 'Complete grooming package for men',
    fullDescription: 'Comprehensive grooming package designed specifically for men, including facial cleansing, beard grooming, eyebrow shaping, and skincare consultation tailored to men\'s skin needs.',
    price: 3000,
    priceDisplay: '₹3,000',
    duration: 90,
    durationDisplay: '90 mins',
    image: 'https://images.pexels.com/photos/3992656/pexels-photo-3992656.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3992656/pexels-photo-3992656.jpeg',
      'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg'
    ],
    benefits: [
      'Complete facial grooming',
      'Professional beard styling',
      'Eyebrow shaping and trimming',
      'Customized skincare routine',
      'Relaxing spa experience'
    ],
    rating: 4.4,
    ratingCount: 156,
    isActive: true,
    isPopular: false,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['mens-grooming', 'beard-care', 'facial', 'skincare']
  },
  // Additional treatments to match frontend categories
  {
    name: 'Classic Facial',
    category: 'Facials',
    description: 'Traditional facial treatment for all skin types',
    fullDescription: 'A classic facial treatment that includes cleansing, exfoliation, steam, extractions, and a customized mask to leave your skin refreshed and glowing.',
    price: 2000,
    priceDisplay: '₹2,000',
    duration: 60,
    durationDisplay: '60 mins',
    image: 'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg'
    ],
    benefits: [
      'Deep cleansing and purification',
      'Removes dead skin cells',
      'Improves skin texture',
      'Relaxing and rejuvenating',
      'Suitable for all skin types'
    ],
    rating: 4.3,
    ratingCount: 89,
    isActive: true,
    isPopular: false,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['classic-facial', 'cleansing', 'relaxing', 'all-skin-types']
  },
  {
    name: 'PRP Hair Treatment',
    category: 'Hair',
    description: 'Platelet-rich plasma therapy for hair growth',
    fullDescription: 'PRP (Platelet-Rich Plasma) therapy uses your own blood platelets to stimulate hair growth and improve hair thickness. This natural treatment is effective for both men and women experiencing hair loss.',
    price: 6000,
    priceDisplay: '₹6,000',
    duration: 90,
    durationDisplay: '90 mins',
    image: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg'
    ],
    benefits: [
      'Stimulates natural hair growth',
      'Improves hair thickness and density',
      'Uses your own blood platelets',
      'Minimal side effects',
      'Suitable for both men and women'
    ],
    rating: 4.6,
    ratingCount: 78,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['prp-therapy', 'hair-growth', 'natural-treatment', 'hair-loss']
  },
  {
    name: 'Stress Relief Therapy',
    category: 'Wellness',
    description: 'Relaxing therapy to reduce stress and tension',
    fullDescription: 'A comprehensive stress relief therapy combining aromatherapy, gentle massage, and relaxation techniques to help you unwind and rejuvenate both body and mind.',
    price: 3500,
    priceDisplay: '₹3,500',
    duration: 75,
    durationDisplay: '75 mins',
    image: 'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg'
    ],
    benefits: [
      'Reduces stress and anxiety',
      'Promotes deep relaxation',
      'Improves mental well-being',
      'Relieves muscle tension',
      'Enhances overall mood'
    ],
    rating: 4.7,
    ratingCount: 134,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['stress-relief', 'relaxation', 'wellness', 'aromatherapy']
  },
  {
    name: 'Laser Hair Removal',
    category: 'Aesthetics',
    description: 'Permanent hair reduction using laser technology',
    fullDescription: 'Advanced laser hair removal treatment that targets hair follicles to provide long-lasting hair reduction. Safe and effective for all skin types.',
    price: 5000,
    priceDisplay: '₹5,000',
    duration: 45,
    durationDisplay: '45 mins',
    image: 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg',
    beforeAfterImages: [
      'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg'
    ],
    benefits: [
      'Long-lasting hair reduction',
      'Precise and targeted treatment',
      'Suitable for all skin types',
      'Minimal discomfort',
      'No ingrown hairs'
    ],
    rating: 4.5,
    ratingCount: 167,
    isActive: true,
    isPopular: true,
    availableLocations: ['Jubilee Hills', 'Kokapet', 'Kondapur'],
    tags: ['laser-hair-removal', 'permanent', 'hair-reduction', 'aesthetics']
  }
];

async function seedTreatments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing treatments
    await Treatment.deleteMany({});
    console.log('🗑️ Cleared existing treatments');

    // Insert new treatments
    const treatments = await Treatment.insertMany(treatmentsData);
    console.log(`✅ Successfully seeded ${treatments.length} treatments`);

    // Display seeded treatments
    console.log('\n📋 Seeded Treatments:');
    treatments.forEach((treatment, index) => {
      console.log(`${index + 1}. ${treatment.name} (${treatment.category}) - ${treatment.priceDisplay}`);
    });

    console.log('\n🎉 Treatment seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding treatments:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seeding function
seedTreatments();
