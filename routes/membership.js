const express = require('express');
const router = express.Router();
const ZenMembership = require('../models/ZenMembership');
const User = require('../models/User');
const { protect: auth } = require('../middleware/auth');

// Get membership pricing
router.get('/pricing', async (req, res) => {
  try {
    const pricing = ZenMembership.getPricing();
    
    // Add dynamic pricing with current offers
    const dynamicPricing = {
      ...pricing,
      currentOffer: {
        discount: 0,
        validUntil: null,
        originalPrice: 2999,
        discountedPrice: 2999
      },
      benefits: [
        '20% discount on all medicines',
        'Free delivery on all orders',
        'Priority customer support',
        '5 free doctor consultations',
        'Exclusive member-only offers',
        'Early access to new treatments'
      ]
    };

    res.json({
      success: true,
      data: dynamicPricing
    });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing information'
    });
  }
});

// Get user's membership status
router.get('/status', auth, async (req, res) => {
  try {
    const membership = await ZenMembership.findOne({ userId: req.user.userId });
    
    if (!membership) {
      return res.json({
        success: true,
        data: {
          hasZenMembership: false,
          membershipType: 'standard',
          status: 'none'
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasZenMembership: membership.isCurrentlyActive,
        membershipType: membership.membershipType,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
        benefits: membership.benefits,
        autoRenewal: membership.autoRenewal,
        daysRemaining: membership.endDate ? Math.ceil((membership.endDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching membership status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch membership status'
    });
  }
});

// Purchase membership
router.post('/purchase', auth, async (req, res) => {
  try {
    const { paymentMethod, transactionId, membershipType = 'lifetime' } = req.body;

    if (!paymentMethod || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method and transaction ID are required'
      });
    }

    // Check if user already has active membership
    let membership = await ZenMembership.findOne({ userId: req.user.userId });
    
    if (membership && membership.isCurrentlyActive) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active Zen Membership'
      });
    }

    const pricing = ZenMembership.getPricing();
    const selectedPlan = pricing.lifetime;
    
    if (membership) {
      // Activate existing membership record
      await membership.activateLifetimeMembership();
      
      // Add to purchase history
      membership.purchaseHistory.push({
        amount: selectedPlan.price,
        transactionId,
        paymentMethod,
        status: 'success'
      });
      
      await membership.save();
    } else {
      // Create new lifetime membership
      membership = new ZenMembership({
        userId: req.user.userId,
        membershipType: 'zen',
        startDate: new Date(),
        endDate: null, // Lifetime membership
        isActive: true,
        status: 'active',
        price: selectedPlan.price,
        paymentMethod,
        transactionId,
        purchaseHistory: [{
          amount: selectedPlan.price,
          transactionId,
          paymentMethod,
          status: 'success'
        }]
      });
      
      await membership.save();
    }

    // Update user's membership status
    await User.findByIdAndUpdate(req.user.userId, {
      hasZenMembership: true,
      membershipType: 'zen'
    });

    // TODO: Send confirmation email (email service not implemented yet)
    console.log(`Zen Membership purchased successfully for user ${req.userDoc.fullName} (${req.userDoc.email})`);
    console.log(`Transaction ID: ${transactionId}, Amount: ₹${selectedPlan.price}`);

    res.json({
      success: true,
      message: 'Zen Membership purchased successfully! Welcome to the Zen family.',
      data: {
        membershipId: membership._id,
        startDate: membership.startDate,
        endDate: membership.endDate,
        benefits: membership.benefits,
        isLifetime: true
      }
    });
  } catch (error) {
    console.error('Error purchasing membership:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to purchase membership'
    });
  }
});

// Cancel membership
router.post('/cancel', auth, async (req, res) => {
  try {
    const membership = await ZenMembership.findOne({ userId: req.user.userId });
    
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    membership.status = 'cancelled';
    membership.isActive = false;
    membership.autoRenewal = false;
    await membership.save();

    // Update user's membership status
    await User.findByIdAndUpdate(req.user.userId, {
      hasZenMembership: false,
      membershipType: 'standard'
    });

    res.json({
      success: true,
      message: 'Membership cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling membership:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel membership'
    });
  }
});

// Toggle auto-renewal
router.post('/auto-renewal', auth, async (req, res) => {
  try {
    const { autoRenewal } = req.body;
    
    const membership = await ZenMembership.findOne({ userId: req.user.userId });
    
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No membership found'
      });
    }

    membership.autoRenewal = autoRenewal;
    if (autoRenewal) {
      membership.renewalDate = new Date(membership.endDate);
    }
    
    await membership.save();

    res.json({
      success: true,
      message: `Auto-renewal ${autoRenewal ? 'enabled' : 'disabled'} successfully`,
      data: {
        autoRenewal: membership.autoRenewal,
        renewalDate: membership.renewalDate
      }
    });
  } catch (error) {
    console.error('Error updating auto-renewal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update auto-renewal setting'
    });
  }
});

// Get membership benefits and savings
router.get('/benefits', auth, async (req, res) => {
  try {
    const membership = await ZenMembership.findOne({ userId: req.user.userId });
    
    const benefits = {
      hasZenMembership: membership?.isCurrentlyActive || false,
      discountPercentage: membership?.benefits?.discountPercentage || 0,
      freeDelivery: membership?.benefits?.freeDelivery || false,
      prioritySupport: membership?.benefits?.prioritySupport || false,
      exclusiveOffers: membership?.benefits?.exclusiveOffers || false,
      freeConsultations: membership?.benefits?.freeConsultations || 0,
      totalSavings: 0 // This would be calculated based on user's order history
    };

    res.json({
      success: true,
      data: benefits
    });
  } catch (error) {
    console.error('Error fetching benefits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch membership benefits'
    });
  }
});

module.exports = router;
