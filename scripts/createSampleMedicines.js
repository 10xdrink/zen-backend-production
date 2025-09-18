const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zennara', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const sampleMedicines = [
  {
    name: "Paracetamol 500mg",
    category: "Pain Relief",
    description: "Effective pain relief and fever reducer. Suitable for headaches, muscle pain, and general discomfort.",
    price: 25.99,
    stockQuantity: 150,
    inStock: true,
    isActive: true,
    featured: true,
    prescriptionRequired: false,
    manufacturer: "HealthCorp",
    expiryDate: new Date('2025-12-31'),
    dosageForm: "Tablet",
    strength: "500mg",
    packSize: "20 tablets"
  },
  {
    name: "Vitamin D3 1000 IU",
    category: "Vitamins",
    description: "Essential vitamin D3 supplement for bone health and immune system support.",
    price: 45.50,
    stockQuantity: 200,
    inStock: true,
    isActive: true,
    featured: true,
    prescriptionRequired: false,
    manufacturer: "VitaLife",
    expiryDate: new Date('2026-06-30'),
    dosageForm: "Capsule",
    strength: "1000 IU",
    packSize: "60 capsules"
  },
  {
    name: "Antiseptic Cream",
    category: "First Aid",
    description: "Antibacterial cream for cuts, scrapes, and minor wounds. Prevents infection and promotes healing.",
    price: 18.75,
    stockQuantity: 80,
    inStock: true,
    isActive: true,
    featured: false,
    prescriptionRequired: false,
    manufacturer: "MediCare",
    expiryDate: new Date('2025-09-15'),
    dosageForm: "Cream",
    strength: "2%",
    packSize: "30g tube"
  },
  {
    name: "Omega-3 Fish Oil",
    category: "Supplements",
    description: "High-quality omega-3 fatty acids for heart health and brain function support.",
    price: 65.99,
    stockQuantity: 120,
    inStock: true,
    isActive: true,
    featured: true,
    prescriptionRequired: false,
    manufacturer: "OceanHealth",
    expiryDate: new Date('2025-11-20'),
    dosageForm: "Soft Gel",
    strength: "1000mg",
    packSize: "90 soft gels"
  },
  {
    name: "Moisturizing Lotion",
    category: "Skincare",
    description: "Gentle, non-greasy moisturizer for dry and sensitive skin. Suitable for daily use.",
    price: 32.25,
    stockQuantity: 95,
    inStock: true,
    isActive: true,
    featured: false,
    prescriptionRequired: false,
    manufacturer: "SkinCare Plus",
    expiryDate: new Date('2026-03-10'),
    dosageForm: "Lotion",
    strength: "N/A",
    packSize: "200ml bottle"
  },
  {
    name: "Cough Syrup",
    category: "OTC",
    description: "Effective cough suppressant for dry and productive coughs. Cherry flavored.",
    price: 28.50,
    stockQuantity: 60,
    inStock: true,
    isActive: true,
    featured: false,
    prescriptionRequired: false,
    manufacturer: "CoughCare",
    expiryDate: new Date('2025-08-25'),
    dosageForm: "Syrup",
    strength: "15mg/5ml",
    packSize: "120ml bottle"
  }
];

async function createSampleMedicines() {
  try {
    console.log('🔄 Creating sample medicines...');
    
    // Clear existing medicines (optional - remove this line if you want to keep existing data)
    await Medicine.deleteMany({});
    console.log('🗑️ Cleared existing medicines');
    
    // Insert sample medicines
    const createdMedicines = await Medicine.insertMany(sampleMedicines);
    console.log(`✅ Successfully created ${createdMedicines.length} sample medicines`);
    
    // Display created medicines
    createdMedicines.forEach((medicine, index) => {
      console.log(`${index + 1}. ${medicine.name} - ${medicine.category} - ₹${medicine.price}`);
    });
    
    console.log('🎉 Sample medicines creation completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating sample medicines:', error);
    process.exit(1);
  }
}

// Run the script
createSampleMedicines();
