const express = require('express');
const router = express.Router();
const MedicineOrder = require('../models/MedicineOrder');
const Medicine = require('../models/Medicine');
const { protect: auth } = require('../middleware/auth');

// Create new medicine order
router.post('/', auth, async (req, res) => {
  try {
    const {
      medicines,
      customerDetails,
      deliveryAddress,
      paymentMethod,
      location,
      hasZenMembership = false,
      notes,
      totalAmount: frontendTotalAmount
    } = req.body;

    // Validate required fields
    if (!medicines || !medicines.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one medicine is required'
      });
    }

    if (!customerDetails || !customerDetails.fullName || !customerDetails.mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Customer details are required'
      });
    }

    if (!deliveryAddress || !deliveryAddress.fullAddress) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'Location is required'
      });
    }

    // Validate medicines and calculate totals
    let subtotal = 0;
    const orderMedicines = [];

    for (const item of medicines) {
      const medicine = await Medicine.findById(item.medicineId);
      
      if (!medicine || !medicine.isActive) {
        return res.status(400).json({
          success: false,
          message: `Medicine with ID ${item.medicineId} not found`
        });
      }

      if (!medicine.isAvailable(item.quantity)) {
        return res.status(400).json({
          success: false,
          message: `${medicine.name} is not available in requested quantity`
        });
      }

      const price = hasZenMembership ? medicine.zenPrice : medicine.discountedPrice;
      const totalPrice = price * item.quantity;

      orderMedicines.push({
        medicineId: medicine._id,
        name: medicine.name,
        price: price,
        quantity: item.quantity,
        totalPrice: totalPrice
      });

      subtotal += totalPrice;
    }

    // Use frontend total amount if provided, otherwise calculate backend total
    let totalAmount, deliveryCharges, zenDiscount;
    
    if (frontendTotalAmount) {
      // Use frontend calculated total amount
      totalAmount = frontendTotalAmount;
      // Calculate individual components for display purposes
      deliveryCharges = (hasZenMembership || subtotal >= 500) ? 0 : 100;
      zenDiscount = hasZenMembership ? Math.round(subtotal * 0.1) : 0;
    } else {
      // Fallback to backend calculation
      deliveryCharges = (hasZenMembership || subtotal >= 500) ? 0 : 100;
      zenDiscount = hasZenMembership ? Math.round(subtotal * 0.1) : 0;
      totalAmount = subtotal + deliveryCharges - zenDiscount;
    }

    // Generate order number
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const orderNumber = `ZEN${timestamp}${random}`;

    // Create order
    const order = new MedicineOrder({
      orderNumber,
      userId: req.user.userId,
      medicines: orderMedicines,
      customerDetails,
      deliveryAddress,
      orderSummary: {
        subtotal,
        deliveryCharges,
        zenDiscount,
        totalAmount
      },
      paymentDetails: {
        method: paymentMethod.toLowerCase() === 'cod' ? 'COD' : paymentMethod.toLowerCase(),
        status: 'pending'
      },
      hasZenMembership,
      location,
      notes,
      deliveryDetails: {}
    });

    // Calculate estimated delivery date
    order.calculateEstimatedDelivery();

    await order.save();

    // Update medicine stock quantities
    for (const item of medicines) {
      await Medicine.findByIdAndUpdate(
        item.medicineId,
        { $inc: { stockQuantity: -item.quantity } }
      );
    }

    // Populate order for response
    await order.populate('medicines.medicineId', 'name image category');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Error creating medicine order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// Get user's medicine orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10
    } = req.query;

    const skip = (page - 1) * limit;

    const options = {
      status,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    const orders = await MedicineOrder.getUserOrders(req.user.userId, options);
    const totalCount = await MedicineOrder.countDocuments({ 
      userId: req.user.userId,
      ...(status ? { orderStatus: status } : {})
    });

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Get order by ID
router.get('/:orderId', auth, async (req, res) => {
  try {
    const order = await MedicineOrder.findById(req.params.orderId)
      .populate('medicines.medicineId', 'name image category')
      .populate('userId', 'fullName phoneNumber email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.userId._id.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { order }
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// Update order status
router.patch('/:orderId/status', auth, async (req, res) => {
  try {
    const { status, note } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const order = await MedicineOrder.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check permissions (user can only cancel their own orders)
    if (!req.user.isAdmin && order.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Users can only cancel orders that are not yet delivered
    if (!req.user.isAdmin && status === 'cancelled' && 
        !['placed', 'confirmed', 'preparing'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order at this stage'
      });
    }

    // Update status
    order.updateStatus(status, note, req.user.fullName || 'User');
    
    if (status === 'cancelled') {
      order.cancellationReason = note;
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Cancel order
router.patch('/:orderId/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await MedicineOrder.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order can be cancelled
    if (!['placed', 'confirmed', 'preparing'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order at this stage'
      });
    }

    // Update order status to cancelled
    order.updateStatus('cancelled', reason || 'Cancelled by user', req.user.fullName);
    order.cancellationReason = reason;
    await order.save();

    // Restore medicine stock quantities
    for (const item of order.medicines) {
      await Medicine.findByIdAndUpdate(
        item.medicineId,
        { $inc: { stockQuantity: item.quantity } }
      );
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
});

// Add rating and feedback to order
router.patch('/:orderId/rating', auth, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const order = await MedicineOrder.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order is delivered
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate delivered orders'
      });
    }

    // Add rating
    order.addRating(rating, feedback);
    await order.save();

    res.json({
      success: true,
      message: 'Rating added successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add rating',
      error: error.message
    });
  }
});

// Track order
router.get('/:orderId/track', auth, async (req, res) => {
  try {
    const order = await MedicineOrder.findById(req.params.orderId)
      .select('userId orderNumber orderStatus statusHistory deliveryDetails createdAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.userId && order.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        currentStatus: order.orderStatus,
        statusHistory: order.statusHistory,
        deliveryDetails: order.deliveryDetails,
        orderDate: order.createdAt
      }
    });

  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order',
      error: error.message
    });
  }
});

// ADMIN ROUTES

// Get all orders (admin only)
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }

    const {
      status,
      location,
      page = 1,
      limit = 20,
      startDate,
      endDate
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (status) query.orderStatus = status;
    if (location) query.location = location;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await MedicineOrder.find(query)
      .populate('userId', 'fullName phoneNumber email')
      .populate('medicines.medicineId', 'name image category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const totalCount = await MedicineOrder.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Get order analytics (admin only)
router.get('/analytics/summary', auth, async (req, res) => {
  try {
    // Check if user is admin
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: 'Admin access required' });
    // }

    const { startDate, endDate, location } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = await MedicineOrder.getOrderAnalytics(start, end, location);

    res.json({
      success: true,
      data: { analytics }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

module.exports = router;
