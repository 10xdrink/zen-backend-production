const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
require('dotenv').config();

const medicines = [
  {
    name: 'Vitamin C Serum',
    category: 'Skincare',
    description: 'Brightening and anti-aging serum for radiant skin with 20% Vitamin C',
    image: 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg',
    price: 899,
    originalPrice: 1199,
    discount: 25,
    inStock: true,
    stockQuantity: 50,
    manufacturer: 'Zennara Skincare',
    dosage: 'Apply 2-3 drops on clean face twice daily',
    usage: 'For brightening skin tone and reducing dark spots. Use sunscreen during day.',
    sideEffects: 'May cause mild irritation in sensitive skin',
    contraindications: 'Avoid if allergic to Vitamin C',
    activeIngredients: [
      { name: 'L-Ascorbic Acid', quantity: '20%' },
      { name: 'Hyaluronic Acid', quantity: '2%' }
    ],
    rating: 4.5,
    ratingCount: 128,
    prescriptionRequired: false,
    featured: true,
    location: 'All',
    tags: ['skincare', 'vitamin-c', 'anti-aging', 'brightening']
  },
  {
    name: 'Paracetamol 500mg',
    category: 'Pain Relief',
    description: 'Fast-acting pain relief and fever reducer tablets',
    image: 'https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg',
    price: 45,
    originalPrice: 45,
    discount: 0,
    inStock: true,
    stockQuantity: 200,
    manufacturer: 'Zennara Pharma',
    dosage: 'Take 1-2 tablets every 4-6 hours as needed',
    usage: 'For relief of mild to moderate pain and fever. Do not exceed 8 tablets in 24 hours.',
    sideEffects: 'Rare: nausea, skin rash',
    contraindications: 'Severe liver disease, alcohol dependence',
    activeIngredients: [
      { name: 'Paracetamol', quantity: '500mg' }
    ],
    rating: 4.2,
    ratingCount: 89,
    prescriptionRequired: false,
    featured: true,
    location: 'All',
    tags: ['pain-relief', 'fever', 'headache', 'otc']
  },
  {
    name: 'Multivitamin Tablets',
    category: 'Vitamins',
    description: 'Complete daily nutrition supplement with essential vitamins and minerals',
    image: 'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg',
    price: 299,
    originalPrice: 399,
    discount: 25,
    inStock: true,
    stockQuantity: 75,
    manufacturer: 'Zennara Nutrition',
    dosage: 'Take 1 tablet daily after breakfast',
    usage: 'Daily nutritional supplement to fill dietary gaps and boost immunity.',
    sideEffects: 'May cause stomach upset if taken on empty stomach',
    contraindications: 'Hypervitaminosis, kidney stones',
    activeIngredients: [
      { name: 'Vitamin A', quantity: '800mcg' },
      { name: 'Vitamin C', quantity: '60mg' },
      { name: 'Vitamin D3', quantity: '400IU' },
      { name: 'B-Complex', quantity: 'Various' }
    ],
    rating: 4.3,
    ratingCount: 156,
    prescriptionRequired: false,
    featured: true,
    location: 'All',
    tags: ['vitamins', 'nutrition', 'immunity', 'daily-supplement']
  },
  {
    name: 'Omega 3 Fish Oil',
    category: 'Supplements',
    description: 'Premium heart and brain health supplement with EPA and DHA',
    image: 'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg',
    price: 599,
    originalPrice: 799,
    discount: 25,
    inStock: false,
    stockQuantity: 0,
    manufacturer: 'Zennara Wellness',
    dosage: 'Take 1-2 capsules daily with meals',
    usage: 'Supports heart health, brain function, and reduces inflammation.',
    sideEffects: 'Fishy aftertaste, mild stomach upset',
    contraindications: 'Blood thinning medications, fish allergy',
    activeIngredients: [
      { name: 'EPA', quantity: '180mg' },
      { name: 'DHA', quantity: '120mg' }
    ],
    rating: 4.6,
    ratingCount: 203,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['omega-3', 'heart-health', 'brain-health', 'fish-oil']
  },
  {
    name: 'Antiseptic Cream',
    category: 'First Aid',
    description: 'Advanced wound care and infection prevention cream',
    image: 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg',
    price: 129,
    originalPrice: 149,
    discount: 13,
    inStock: true,
    stockQuantity: 40,
    manufacturer: 'Zennara Care',
    dosage: 'Apply thin layer on affected area 2-3 times daily',
    usage: 'For minor cuts, wounds, and skin infections. Clean area before application.',
    sideEffects: 'Mild burning sensation, skin irritation',
    contraindications: 'Deep wounds, severe burns',
    activeIngredients: [
      { name: 'Povidone Iodine', quantity: '5%' },
      { name: 'Neomycin', quantity: '0.5%' }
    ],
    rating: 4.4,
    ratingCount: 67,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['antiseptic', 'wound-care', 'first-aid', 'topical']
  },
  {
    name: 'Probiotic Capsules',
    category: 'Supplements',
    description: 'Advanced digestive health support with 10 billion CFU',
    image: 'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg',
    price: 449,
    originalPrice: 649,
    discount: 31,
    inStock: true,
    stockQuantity: 30,
    manufacturer: 'Zennara Bio',
    dosage: 'Take 1 capsule daily on empty stomach',
    usage: 'Supports digestive health, immunity, and gut microbiome balance.',
    sideEffects: 'Initial bloating, gas (temporary)',
    contraindications: 'Immunocompromised patients, severe illness',
    activeIngredients: [
      { name: 'Lactobacillus acidophilus', quantity: '5 billion CFU' },
      { name: 'Bifidobacterium bifidum', quantity: '3 billion CFU' },
      { name: 'Lactobacillus rhamnosus', quantity: '2 billion CFU' }
    ],
    rating: 4.7,
    ratingCount: 92,
    prescriptionRequired: false,
    featured: true,
    location: 'All',
    tags: ['probiotics', 'digestive-health', 'gut-health', 'immunity']
  },
  {
    name: 'Ibuprofen 400mg',
    category: 'Pain Relief',
    description: 'Anti-inflammatory pain reliever for muscle and joint pain',
    image: 'https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg',
    price: 89,
    originalPrice: 89,
    discount: 0,
    inStock: true,
    stockQuantity: 150,
    manufacturer: 'Zennara Pharma',
    dosage: 'Take 1 tablet every 6-8 hours with food',
    usage: 'For inflammation, muscle pain, headaches, and fever. Maximum 3 tablets per day.',
    sideEffects: 'Stomach upset, dizziness, heartburn',
    contraindications: 'Stomach ulcers, kidney disease, heart problems',
    activeIngredients: [
      { name: 'Ibuprofen', quantity: '400mg' }
    ],
    rating: 4.1,
    ratingCount: 76,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['pain-relief', 'anti-inflammatory', 'muscle-pain', 'otc']
  },
  {
    name: 'Hyaluronic Acid Serum',
    category: 'Skincare',
    description: 'Intensive hydrating serum for plump, moisturized skin',
    image: 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg',
    price: 699,
    originalPrice: 899,
    discount: 22,
    inStock: true,
    stockQuantity: 25,
    manufacturer: 'Zennara Skincare',
    dosage: 'Apply 2-3 drops on damp skin twice daily',
    usage: 'For intense hydration and plumping effect. Use before moisturizer.',
    sideEffects: 'Rare: mild irritation',
    contraindications: 'Known allergy to hyaluronic acid',
    activeIngredients: [
      { name: 'Hyaluronic Acid', quantity: '2%' },
      { name: 'Sodium Hyaluronate', quantity: '1%' }
    ],
    rating: 4.8,
    ratingCount: 145,
    prescriptionRequired: false,
    featured: true,
    location: 'All',
    tags: ['skincare', 'hydration', 'anti-aging', 'serum']
  },
  {
    name: 'Zinc Tablets 50mg',
    category: 'Vitamins',
    description: 'Essential mineral supplement for immunity and wound healing',
    image: 'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg',
    price: 199,
    originalPrice: 249,
    discount: 20,
    inStock: true,
    stockQuantity: 60,
    manufacturer: 'Zennara Nutrition',
    dosage: 'Take 1 tablet daily with food',
    usage: 'Supports immune function, wound healing, and protein synthesis.',
    sideEffects: 'Nausea, stomach upset if taken on empty stomach',
    contraindications: 'Copper deficiency, certain antibiotics',
    activeIngredients: [
      { name: 'Zinc Gluconate', quantity: '50mg' }
    ],
    rating: 4.2,
    ratingCount: 88,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['zinc', 'immunity', 'mineral', 'wound-healing']
  },
  {
    name: 'Hand Sanitizer 500ml',
    category: 'Personal Care',
    description: '70% alcohol-based hand sanitizer with moisturizers',
    image: 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg',
    price: 149,
    originalPrice: 179,
    discount: 17,
    inStock: true,
    stockQuantity: 100,
    manufacturer: 'Zennara Care',
    dosage: 'Apply small amount and rub hands until dry',
    usage: 'For hand hygiene when soap and water are not available.',
    sideEffects: 'Skin dryness with frequent use',
    contraindications: 'Open wounds on hands, alcohol sensitivity',
    activeIngredients: [
      { name: 'Ethyl Alcohol', quantity: '70%' },
      { name: 'Glycerin', quantity: '2%' }
    ],
    rating: 4.0,
    ratingCount: 234,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['sanitizer', 'hygiene', 'alcohol-based', 'personal-care']
  },
  {
    name: 'Calcium + Vitamin D3',
    category: 'Vitamins',
    description: 'Bone health supplement with calcium carbonate and vitamin D3',
    image: 'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg',
    price: 349,
    originalPrice: 399,
    discount: 13,
    inStock: true,
    stockQuantity: 45,
    manufacturer: 'Zennara Nutrition',
    dosage: 'Take 1-2 tablets daily with meals',
    usage: 'Supports bone health, muscle function, and calcium absorption.',
    sideEffects: 'Constipation, stomach upset',
    contraindications: 'Kidney stones, hypercalcemia',
    activeIngredients: [
      { name: 'Calcium Carbonate', quantity: '500mg' },
      { name: 'Vitamin D3', quantity: '400IU' }
    ],
    rating: 4.3,
    ratingCount: 112,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['calcium', 'vitamin-d3', 'bone-health', 'supplement']
  },
  {
    name: 'Cough Syrup Sugar-Free',
    category: 'Pain Relief',
    description: 'Effective cough suppressant and expectorant syrup',
    image: 'https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg',
    price: 125,
    originalPrice: 145,
    discount: 14,
    inStock: true,
    stockQuantity: 80,
    manufacturer: 'Zennara Pharma',
    dosage: 'Adults: 10ml every 4-6 hours. Children: 5ml every 6 hours',
    usage: 'For dry and productive cough. Helps loosen mucus and suppress cough reflex.',
    sideEffects: 'Drowsiness, dizziness, nausea',
    contraindications: 'Children under 2 years, severe respiratory depression',
    activeIngredients: [
      { name: 'Dextromethorphan', quantity: '15mg/10ml' },
      { name: 'Guaifenesin', quantity: '100mg/10ml' }
    ],
    rating: 4.1,
    ratingCount: 67,
    prescriptionRequired: false,
    featured: false,
    location: 'All',
    tags: ['cough-syrup', 'cough-suppressant', 'expectorant', 'sugar-free']
  }
];

async function seedMedicines() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URI || 'mongodb://localhost:27017/zennara');
    console.log('Connected to MongoDB');

    // Clear existing medicines
    await Medicine.deleteMany({});
    console.log('Cleared existing medicines');

    // Insert new medicines
    const insertedMedicines = await Medicine.insertMany(medicines);
    console.log(`Inserted ${insertedMedicines.length} medicines`);

    // Create text indexes
    try {
      await Medicine.collection.createIndex({
        name: 'text',
        description: 'text',
        manufacturer: 'text',
        'activeIngredients.name': 'text',
        tags: 'text'
      });
      console.log('Created text indexes');
    } catch (indexError) {
      // If index already exists with different options, just log it
      console.log('Text index already exists, skipping creation');
    }

    console.log('Medicine seeding completed successfully!');
    
    // Display summary
    const categories = await Medicine.getCategories();
    console.log('\nCategories available:', categories);
    
    const featuredCount = await Medicine.countDocuments({ featured: true });
    console.log(`Featured medicines: ${featuredCount}`);
    
    const inStockCount = await Medicine.countDocuments({ inStock: true });
    console.log(`In stock medicines: ${inStockCount}`);

  } catch (error) {
    console.error('Error seeding medicines:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeding function
if (require.main === module) {
  seedMedicines();
}

module.exports = seedMedicines;
