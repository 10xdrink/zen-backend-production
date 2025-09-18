const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function syncZenMembership() {
  try {
    console.log('Starting Zen membership synchronization...');
    
    // Find users who have Zen membership but planType is still 'standard'
    const usersToUpdate = await User.find({
      hasZenMembership: true,
      planType: 'standard'
    });

    console.log(`Found ${usersToUpdate.length} users with Zen membership but incorrect planType`);

    if (usersToUpdate.length === 0) {
      console.log('No users need synchronization');
      return;
    }

    // Update planType for these users
    const updateResult = await User.updateMany(
      {
        hasZenMembership: true,
        planType: 'standard'
      },
      {
        $set: {
          planType: 'zen_member'
        }
      }
    );

    console.log(`Successfully updated ${updateResult.modifiedCount} users`);
    
    // Log the updated users
    const updatedUsers = await User.find({
      hasZenMembership: true,
      planType: 'zen_member'
    }).select('fullName email planType hasZenMembership');

    console.log('Updated users:');
    updatedUsers.forEach(user => {
      console.log(`- ${user.fullName} (${user.email}): planType=${user.planType}, hasZenMembership=${user.hasZenMembership}`);
    });

  } catch (error) {
    console.error('Error syncing Zen membership:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the sync
syncZenMembership();
