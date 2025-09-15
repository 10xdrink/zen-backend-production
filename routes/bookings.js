const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Treatment = require('../models/Treatment');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { 
  sendCheckoutOTPEmail, 
  sendBookingConfirmationEmail,
  sendAppointmentCancelledEmail,
  sendAppointmentRescheduledEmail,
  send12HourReminderEmail,
  send1HourReminderEmail
} = require('../utils/emailService');

const router = express.Router();

// Get user bookings
router.get('/my-bookings', protect, [
  query('status').optional().isIn(['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'rescheduled']),
  query('upcoming').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('page').optional().isInt({ min: 1 })
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
      status,
      upcoming,
      limit = 20,
      page = 1
    } = req.query;

    const options = {
      status,
      upcoming: upcoming === 'true',
      limit: parseInt(limit),
      sort: { appointmentDate: -1 }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { user: req.user.userId };
    
    if (status) {
      query.status = status;
    }
    
    if (upcoming === 'true') {
      query.appointmentDate = { $gte: new Date() };
    }

    const bookings = await Booking.find(query)
      .populate('treatment', 'name category image price priceDisplay duration durationDisplay')
      .sort({ appointmentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get booking by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('treatment', 'name category image price priceDisplay duration durationDisplay fullDescription benefits')
      .populate('user', 'fullName email phoneNumber');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if the booking belongs to the current user
    if (booking.user._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if checkout is eligible (20 minutes after check-in)
    let canCheckOut = false;
    let minutesUntilCheckout = 0;
    
    if (booking.checkedIn && !booking.checkedOut) {
      const now = new Date();
      const checkOutEligibleTime = booking.checkOutEligibleTime || new Date(booking.checkInTime.getTime() + 20 * 60 * 1000);
      
      if (now >= checkOutEligibleTime) {
        canCheckOut = true;
        // Update the booking to reflect checkout eligibility
        booking.canCheckOut = true;
        await booking.save();
      } else {
        minutesUntilCheckout = Math.ceil((checkOutEligibleTime - now) / (1000 * 60));
      }
    }

    // Add checkout eligibility to response
    const bookingData = booking.toObject();
    bookingData.canCheckOut = canCheckOut;
    bookingData.minutesUntilCheckout = minutesUntilCheckout;

    res.status(200).json({
      success: true,
      message: 'Booking retrieved successfully',
      data: { booking: bookingData }
    });

  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new booking
router.post('/', protect, [
  body('treatmentId').isMongoId().withMessage('Valid treatment ID is required'),
  body('personalDetails.fullName').trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2-50 characters'),
  body('personalDetails.mobileNumber').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please provide a valid mobile number'),
  body('personalDetails.email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('location').isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']).withMessage('Please select a valid location'),
  body('appointmentDate').isISO8601().withMessage('Please provide a valid appointment date'),
  body('appointmentTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Please provide a valid appointment time (HH:MM format)'),
  body('specialRequests').optional().isLength({ max: 500 }).withMessage('Special requests cannot exceed 500 characters'),
  body('paymentMethod').optional().isIn(['cash', 'card', 'upi', 'wallet']).withMessage('Please provide a valid payment method')
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
      treatmentId,
      personalDetails,
      location,
      appointmentDate,
      appointmentTime,
      specialRequests,
      paymentMethod
    } = req.body;

    // Verify treatment exists and is active
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment || !treatment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found or not available'
      });
    }

    // Check if treatment is available at the selected location
    if (!treatment.availableLocations.includes(location)) {
      return res.status(400).json({
        success: false,
        message: 'Treatment is not available at the selected location'
      });
    }

    // Check if appointment date and time is in the future (using IST timezone)
    const currentISTTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    // Parse appointment date and time
    const [datePart, timePart] = [appointmentDate, appointmentTime];
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create appointment datetime in IST
    const appointmentDateTime = new Date(year, month - 1, day, hour, minute);
    
    // Debug logging
    console.log('Appointment Date Validation:');
    console.log('- Received appointmentDate:', appointmentDate);
    console.log('- Received appointmentTime:', appointmentTime);
    console.log('- Parsed appointmentDateTime:', appointmentDateTime);
    console.log('- Current IST Time:', currentISTTime);
    console.log('- Is appointment in future?', appointmentDateTime > currentISTTime);
    
    if (appointmentDateTime <= currentISTTime) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date and time must be in the future'
      });
    }

    // Generate booking reference: ZEN + YYYYMMDD + random 4 digits (using IST)
    const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = istDate.getFullYear().toString() + 
                   (istDate.getMonth() + 1).toString().padStart(2, '0') + 
                   istDate.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `ZEN${dateStr}${randomNum}`;

    // Create booking
    const booking = new Booking({
      user: req.user.userId,
      personalDetails,
      treatment: treatmentId,
      treatmentDetails: {
        name: treatment.name,
        category: treatment.category,
        price: treatment.price,
        priceDisplay: treatment.priceDisplay,
        duration: treatment.duration,
        durationDisplay: treatment.durationDisplay
      },
      location,
      appointmentDate: appointmentDateTime,
      appointmentTime,
      totalAmount: treatment.price,
      specialRequests,
      status: 'confirmed',
      paymentMethod: paymentMethod || 'cash',
      bookingReference: bookingReference
    });

    await booking.save();

    // Populate the booking with treatment details for response
    await booking.populate('treatment', 'name category image price priceDisplay duration durationDisplay');

    // Send booking confirmation email (non-blocking if it fails)
    try {
      await sendBookingConfirmationEmail(booking.personalDetails.email, booking);
      console.log(`Booking confirmation email sent to ${booking.personalDetails.email}: ${booking.bookingReference}`);
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update booking status
router.patch('/:id/status', protect, [
  body('status').isIn(['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'rescheduled']).withMessage('Invalid status'),
  body('cancellationReason').optional().isLength({ min: 5, max: 500 }).withMessage('Cancellation reason must be between 5-500 characters')
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
    const { status, cancellationReason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if the booking belongs to the current user
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Handle cancellation
    if (status === 'cancelled') {
      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
      }
      await booking.cancelBooking(cancellationReason);

      // Send cancellation email (best-effort)
      try {
        await sendAppointmentCancelledEmail(booking.personalDetails.email, booking);
        console.log(`Cancellation email sent to ${booking.personalDetails.email} for ${booking.bookingReference}`);
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
        // Do not block status update on email failure
      }
    } else {
      booking.status = status;
      await booking.save();
    }

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      data: { booking }
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reschedule booking
router.patch('/:id/reschedule', protect, [
  body('appointmentDate').isISO8601().withMessage('Please provide a valid appointment date'),
  body('appointmentTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Please provide a valid appointment time (HH:MM format)')
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
    const { appointmentDate, appointmentTime } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if the booking belongs to the current user
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if new appointment date is in the future
    const newAppointmentDateTime = new Date(appointmentDate);
    if (newAppointmentDateTime < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'New appointment date must be in the future'
      });
    }

    // Check if booking can be rescheduled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule completed or cancelled bookings'
      });
    }

    // Check reschedule limit
    if (booking.rescheduleCount >= 1) {
      return res.status(400).json({
        success: false,
        message: 'Appointment can only be rescheduled once'
      });
    }

    // Capture old booking details for email
    const oldBooking = booking.toObject();

    await booking.rescheduleBooking(appointmentDate, appointmentTime);

    // Send reschedule email (best-effort)
    try {
      await sendAppointmentRescheduledEmail(booking.personalDetails.email, oldBooking, booking);
      console.log(`Reschedule email sent to ${booking.personalDetails.email} for ${booking.bookingReference}`);
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
      // Do not block response on email failure
    }

    res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add rating and feedback
router.patch('/:id/feedback', protect, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().isLength({ min: 10, max: 1000 }).withMessage('Feedback must be between 10-1000 characters')
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
    const { rating, feedback } = req.body;

    const booking = await Booking.findById(id).populate('treatment');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if the booking belongs to the current user
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate completed bookings'
      });
    }

    // Allow rating updates - remove the check that prevents editing existing ratings

    await booking.addFeedback(rating, feedback);

    // Update treatment rating and add review
    if (booking.treatment) {
      await booking.treatment.addReview(req.user.userId, booking._id, rating, feedback || '');
    }

    res.status(200).json({
      success: true,
      message: 'Feedback added successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get availability for multiple dates (calendar view)
router.get('/availability/calendar/:year/:month', [
  query('location').isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']).withMessage('Please select a valid location'),
  query('treatmentId').optional().isMongoId().withMessage('Valid treatment ID is required')
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

    const { year, month } = req.params;
    const { location, treatmentId } = req.query;

    // Validate year and month
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (yearNum < 2024 || yearNum > 2030 || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month'
      });
    }

    // Get start and end of month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all bookings for the month
    const monthBookings = await Booking.find({
      appointmentDate: {
        $gte: startDate,
        $lte: endDate
      },
      location,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    }).select('appointmentDate appointmentTime treatmentDetails.duration');

    // Generate time slots for reference (1-hour intervals from 10 AM to 7 PM)
    const timeSlots = [];
    for (let hour = 10; hour <= 19; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      timeSlots.push(timeString);
    }

    // Process each day of the month
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const availability = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(yearNum, monthNum - 1, day);
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Skip past dates
      if (currentDate < today) {
        availability[dateString] = {
          isPast: true,
          isAvailable: false,
          availableSlots: 0,
          totalSlots: timeSlots.length,
          fullyBooked: false
        };
        continue;
      }

      // Get bookings for this specific day
      const dayBookings = monthBookings.filter(booking => {
        const bookingDate = new Date(booking.appointmentDate);
        return bookingDate.getDate() === day;
      });

      const bookedTimes = dayBookings.map(booking => booking.appointmentTime);
      const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));
      const fullyBooked = availableSlots.length === 0;

      availability[dateString] = {
        isPast: false,
        isAvailable: !fullyBooked,
        availableSlots: availableSlots.length,
        totalSlots: timeSlots.length,
        fullyBooked,
        bookedSlots: bookedTimes.length
      };
    }

    res.status(200).json({
      success: true,
      message: 'Monthly availability retrieved successfully',
      data: {
        year: yearNum,
        month: monthNum,
        location,
        availability,
        totalDays: daysInMonth
      }
    });

  } catch (error) {
    console.error('Get monthly availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monthly availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get available time slots for a specific date and location
router.get('/availability/:date', [
  query('location').isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']).withMessage('Please select a valid location'),
  query('treatmentId').optional().isMongoId().withMessage('Valid treatment ID is required')
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

    const { date } = req.params;
    const { location, treatmentId } = req.query;

    // Validate date format
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Check if date is in the past (but allow today)
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    
    if (appointmentDate < todayStart) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check availability for past dates'
      });
    }

    // Get existing bookings for the date and location
    const existingBookings = await Booking.find({
      appointmentDate: {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lt: new Date(appointmentDate.setHours(23, 59, 59, 999))
      },
      location,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    }).select('appointmentTime treatmentDetails.duration');

    // Generate available time slots (10 AM to 7 PM, 1-hour intervals)
    const timeSlots = [];
    for (let hour = 10; hour <= 19; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      timeSlots.push(timeString);
    }

    // Check if this is today's date
    const isToday = appointmentDate.toDateString() === today.toDateString();
    const currentHour = today.getHours();
    const currentMinutes = today.getMinutes();

    // Create detailed slot information
    const slotDetails = timeSlots.map(slot => {
      const isBooked = existingBookings.some(booking => booking.appointmentTime === slot);
      
      // For today's date, check if the time slot has already passed
      let isPastTime = false;
      if (isToday) {
        const slotHour = parseInt(slot.split(':')[0]);
        // Consider a slot as past if it's the current hour or earlier
        // Add 1 hour buffer for booking preparation
        isPastTime = slotHour <= (currentHour + 1);
      }
      
      const isAvailable = !isBooked && !isPastTime;
      
      return {
        time: slot,
        isAvailable: isAvailable,
        isBooked: isBooked,
        isPastTime: isPastTime
      };
    });

    const bookedTimes = existingBookings.map(booking => booking.appointmentTime);
    const availableSlots = slotDetails.filter(slot => slot.isAvailable).map(slot => slot.time);

    res.status(200).json({
      success: true,
      message: 'Available time slots retrieved successfully',
      data: {
        date,
        location,
        availableSlots,
        bookedSlots: bookedTimes,
        slotDetails,
        totalSlots: timeSlots.length,
        availableCount: availableSlots.length,
        fullyBooked: availableSlots.length === 0
      }
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Cancel booking
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save();

    // Send cancellation email (best-effort)
    try {
      await sendAppointmentCancelledEmail(booking.personalDetails.email, booking);
      console.log(`Cancellation email sent to ${booking.personalDetails.email} for ${booking.bookingReference}`);
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
      // Do not block response on email failure
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rate booking
router.put('/:id/rate', protect, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
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
    const { rating, comment } = req.body;
    
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed bookings can be rated'
      });
    }

    // Update booking with rating
    booking.rating = rating;
    booking.ratingComment = comment;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Rate booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Download appointment slip
router.get('/:id/slip', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('treatment', 'name category image price priceDisplay duration durationDisplay');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate appointment slip data
    const appointmentSlip = {
      bookingReference: booking.bookingReference,
      patientName: booking.personalDetails.fullName,
      mobileNumber: booking.personalDetails.mobileNumber,
      email: booking.personalDetails.email,
      treatmentName: booking.treatmentDetails.name,
      treatmentCategory: booking.treatmentDetails.category,
      appointmentDate: booking.appointmentDate.toISOString().split('T')[0],
      appointmentTime: booking.appointmentTime,
      location: booking.location,
      totalAmount: booking.totalAmount,
      status: booking.status,
      bookedAt: booking.createdAt,
      specialRequests: booking.specialRequests || 'None',
      paymentMethod: booking.paymentMethod,
      clinicInfo: {
        name: 'Zennara Wellness Center',
        address: `${booking.location}, India`,
        phone: '+91-9999999999',
        email: 'info@zennara.com',
        website: 'www.zennara.com'
      }
    };

    res.json({
      success: true,
      data: { appointmentSlip }
    });

  } catch (error) {
    console.error('Download appointment slip error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate appointment slip',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check-in endpoint
router.post('/:id/checkin', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if appointment is today and within check-in window (15 minutes before to 1 hour after)
    const now = new Date();
    const appointmentDateTime = new Date(`${booking.appointmentDate.toISOString().split('T')[0]}T${booking.appointmentTime}`);
    const checkInStart = new Date(appointmentDateTime.getTime() - 15 * 60 * 1000);
    const checkInEnd = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000); // 1 hour after appointment time

    if (now < checkInStart || now > checkInEnd) {
      return res.status(400).json({
        success: false,
        message: 'Check-in is only available 15 minutes before to 1 hour after your appointment time'
      });
    }

    // Check if already checked in
    if (booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for this appointment'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update booking with check-in info
    const checkInTime = new Date();
    booking.checkedIn = true;
    booking.checkInTime = checkInTime;
    booking.checkoutOTP = otp;
    booking.status = 'in-progress';
    
    // Set checkout eligible time (20 minutes after check-in)
    booking.checkOutEligibleTime = new Date(checkInTime.getTime() + 20 * 60 * 1000);
    booking.canCheckOut = false; // Will be enabled after 20 minutes
    
    await booking.save();

    // Send OTP email
    try {
      await sendCheckoutOTPEmail(booking.personalDetails.email, otp, booking);
      console.log(`Check-in OTP sent to ${booking.personalDetails.email}: ${otp}`);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Continue with check-in even if email fails
    }

    res.json({
      success: true,
      message: 'Check-in successful! OTP sent to your email.',
      data: {
        checkedIn: true,
        checkInTime: booking.checkInTime,
        checkOutEligibleTime: booking.checkOutEligibleTime,
        canCheckOut: booking.canCheckOut,
        checkoutOtp: otp,
        otpSent: true
      }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// User checkout endpoint (after 20 minutes)
router.post('/:id/user-checkout', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if user is checked in
    if (!booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'You must check in first'
      });
    }

    // Check if already checked out
    if (booking.checkedOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out'
      });
    }

    // Check if 20 minutes have passed since check-in
    const now = new Date();
    const checkOutEligibleTime = booking.checkOutEligibleTime || new Date(booking.checkInTime.getTime() + 20 * 60 * 1000);
    
    if (now < checkOutEligibleTime) {
      const minutesLeft = Math.ceil((checkOutEligibleTime - now) / (1000 * 60));
      return res.status(400).json({
        success: false,
        message: `Please wait ${minutesLeft} more minute(s) before checking out`,
        data: {
          canCheckOut: false,
          checkOutEligibleTime: checkOutEligibleTime,
          minutesRemaining: minutesLeft
        }
      });
    }

    // Update booking with checkout info
    booking.checkedOut = true;
    booking.checkOutTime = new Date();
    booking.status = 'completed';
    booking.canCheckOut = true;
    
    // Clear the OTP for security
    booking.checkoutOTP = undefined;
    
    await booking.save();

    res.json({
      success: true,
      message: 'Successfully checked out! Your appointment is now complete.',
      data: {
        checkedOut: true,
        checkOutTime: booking.checkOutTime,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('User checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to checkout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin checkout endpoint with OTP verification
router.post('/:id/checkout', protect, [
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('adminId').notEmpty().withMessage('Admin ID is required')
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

    const { otp, adminId } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is checked in
    if (!booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Patient has not checked in yet'
      });
    }

    // Check if already checked out
    if (booking.checkedOut) {
      return res.status(400).json({
        success: false,
        message: 'Patient has already been checked out'
      });
    }

    // Verify OTP
    if (booking.checkoutOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please check the OTP sent to patient email.'
      });
    }

    // Update booking with checkout info
    booking.checkedOut = true;
    booking.checkOutTime = new Date();
    booking.status = 'completed';
    booking.adminCheckout = adminId;
    
    // Clear the OTP for security
    booking.checkoutOTP = undefined;
    
    await booking.save();

    res.json({
      success: true,
      message: 'Patient checked out successfully!',
      data: {
        checkedOut: true,
        checkOutTime: booking.checkOutTime,
        completedBy: adminId,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to checkout patient',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all bookings for admin (for admin panel)
router.get('/admin/all-bookings', protect, [
  query('status').optional().isIn(['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'rescheduled']),
  query('location').optional().isIn(['Jubilee Hills', 'Kokapet', 'Kondapur']),
  query('date').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    // Note: In a real app, you'd check if the user is an admin
    // For now, we'll allow any authenticated user to access this
    
    const {
      status,
      location,
      date,
      limit = 50,
      page = 1
    } = req.query;

    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (location) {
      query.location = location;
    }
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.appointmentDate = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('user', 'fullName email phoneNumber')
      .populate('treatment', 'name category duration')
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: bookings.length,
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('Get admin bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get prescription for completed appointment
router.get('/:id/prescription', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if appointment is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Prescription is only available for completed appointments'
      });
    }

    // Check if prescription exists
    if (!booking.prescription || (!booking.prescription.attachments?.length && !booking.prescription.notes && !booking.prescription.medications?.length)) {
      return res.status(404).json({
        success: false,
        message: 'No prescription available for this appointment'
      });
    }

    res.json({
      success: true,
      message: 'Prescription retrieved successfully',
      data: {
        prescription: booking.prescription,
        appointmentDetails: {
          bookingReference: booking.bookingReference,
          treatmentName: booking.treatmentDetails.name,
          appointmentDate: booking.appointmentDate,
          appointmentTime: booking.appointmentTime,
          location: booking.location
        }
      }
    });

  } catch (error) {
    console.error('Get prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve prescription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete cancelled appointment endpoint
router.delete('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking is cancelled
    if (booking.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Only cancelled appointments can be deleted'
      });
    }

    // Delete the booking
    await Booking.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Cancelled appointment deleted successfully'
    });

  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mark no-show appointments (can be called by a cron job or admin)
router.post('/mark-no-shows', protect, async (req, res) => {
  try {
    const result = await Booking.markNoShowAppointments();
    
    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} appointments as no-show`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark no-shows error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark no-show appointments',
      error: error.message
    });
  }
});

// Admin-specific endpoints for appointment management

// Get all bookings for admin (with filters and pagination)
router.get('/admin/all', async (req, res) => {
  try {
    const {
      status,
      location,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      search
    } = req.query;

    // Build query
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (location && location !== 'all') {
      query.location = location;
    }
    
    if (startDate || endDate) {
      query.appointmentDate = {};
      if (startDate) {
        query.appointmentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.appointmentDate.$lte = new Date(endDate);
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { 'personalDetails.fullName': { $regex: search, $options: 'i' } },
        { 'personalDetails.mobileNumber': { $regex: search, $options: 'i' } },
        { 'personalDetails.email': { $regex: search, $options: 'i' } },
        { bookingReference: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('treatment', 'name category image price priceDisplay duration durationDisplay')
      .populate('user', 'fullName email phoneNumber')
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    // Get statistics
    const stats = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Admin get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin update booking status
router.patch('/admin/:id/status', [
  body('status').isIn(['confirmed', 'in-progress', 'completed', 'cancelled', 'rescheduled', 'no-show']).withMessage('Invalid status'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),
  body('cancellationReason').optional().isLength({ min: 5, max: 500 }).withMessage('Cancellation reason must be between 5-500 characters')
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
    const { status, notes, cancellationReason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Handle different status updates
    if (status === 'cancelled') {
      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
      }
      await booking.cancelBooking(cancellationReason);
    } else if (status === 'no-show') {
      await booking.markAsNoShow();
    } else if (status === 'completed') {
      await booking.completeBooking();
    } else {
      booking.status = status;
      if (notes) {
        booking.notes = notes;
      }
      await booking.save();
    }

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      data: { booking }
    });

  } catch (error) {
    console.error('Admin update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin bulk operations
router.patch('/admin/bulk-update', [
  body('bookingIds').isArray({ min: 1 }).withMessage('At least one booking ID is required'),
  body('action').isIn(['cancel', 'confirm', 'reschedule', 'no-show']).withMessage('Invalid action'),
  body('data').optional().isObject()
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

    const { bookingIds, action, data } = req.body;
    const results = [];

    for (const bookingId of bookingIds) {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          results.push({ bookingId, success: false, message: 'Booking not found' });
          continue;
        }

        switch (action) {
          case 'cancel':
            await booking.cancelBooking(data?.cancellationReason || 'Cancelled by admin');
            break;
          case 'confirm':
            booking.status = 'confirmed';
            await booking.save();
            break;
          case 'no-show':
            await booking.markAsNoShow();
            break;
          case 'reschedule':
            // Check if booking can be rescheduled
            if (['completed', 'cancelled', 'no-show'].includes(booking.status)) {
              results.push({ bookingId, success: false, message: `Cannot reschedule ${booking.status} appointments` });
              continue;
            }
            
            // Check reschedule limit
            if (booking.rescheduleCount >= 1) {
              results.push({ bookingId, success: false, message: 'Appointment can only be rescheduled once' });
              continue;
            }
            
            if (data?.appointmentDate && data?.appointmentTime) {
              await booking.rescheduleBooking(data.appointmentDate, data.appointmentTime);
            } else {
              results.push({ bookingId, success: false, message: 'Date and time required for reschedule' });
              continue;
            }
            break;
        }

        results.push({ bookingId, success: true, message: `${action} successful` });
      } catch (error) {
        results.push({ bookingId, success: false, message: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bulk operation completed',
      data: { results }
    });

  } catch (error) {
    console.error('Admin bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk operation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin dashboard statistics
router.get('/admin/dashboard-stats', async (req, res) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));
    
    const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Today's appointments
    const todayAppointments = await Booking.countDocuments({
      appointmentDate: { $gte: todayStart, $lte: todayEnd }
    });

    // This week's appointments
    const weekAppointments = await Booking.countDocuments({
      appointmentDate: { $gte: thisWeekStart, $lte: todayEnd }
    });

    // This month's appointments
    const monthAppointments = await Booking.countDocuments({
      appointmentDate: { $gte: thisMonthStart, $lte: todayEnd }
    });

    // Status breakdown
    const statusStats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Revenue stats (this month)
    const revenueStats = await Booking.aggregate([
      {
        $match: {
          appointmentDate: { $gte: thisMonthStart, $lte: todayEnd },
          status: { $in: ['completed', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Popular treatments
    const popularTreatments = await Booking.aggregate([
      {
        $match: {
          appointmentDate: { $gte: thisMonthStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: '$treatmentDetails.name',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        appointments: {
          today: todayAppointments,
          week: weekAppointments,
          month: monthAppointments
        },
        statusBreakdown: statusStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          appointments: revenueStats[0]?.count || 0
        },
        popularTreatments
      }
    });

  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin update payment status
router.patch('/admin/:id/payment', [
  body('paymentStatus').isIn(['pending', 'paid', 'partial', 'refunded']).withMessage('Invalid payment status')
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
    const { paymentStatus } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update payment status
    booking.paymentStatus = paymentStatus;
    booking.paymentUpdatedAt = new Date();
    
    // If marking as paid and booking is completed, we can consider it fully processed
    if (paymentStatus === 'paid' && booking.status === 'completed') {
      booking.fullyProcessed = true;
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      data: { booking }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Send appointment reminders (admin endpoint)
router.post('/admin/send-reminders', [
  body('bookingIds').isArray({ min: 1 }).withMessage('At least one booking ID is required'),
  body('type').isIn(['sms', 'email', 'both']).withMessage('Invalid reminder type')
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

    const { bookingIds, type } = req.body;
    const results = [];

    for (const bookingId of bookingIds) {
      try {
        const booking = await Booking.findById(bookingId)
          .populate('treatment', 'name category');

        if (!booking) {
          results.push({ bookingId, success: false, message: 'Booking not found' });
          continue;
        }

        // Send actual reminder emails
        if (type === 'email' || type === 'both') {
          try {
            // Determine which reminder type to send based on appointment timing
            const now = new Date();
            const appointmentDateTime = new Date(booking.appointmentDate);
            const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

            if (hoursUntilAppointment <= 1 && hoursUntilAppointment > 0) {
              await send1HourReminderEmail(booking.personalDetails.email, booking);
            } else if (hoursUntilAppointment <= 12 && hoursUntilAppointment > 1) {
              await send12HourReminderEmail(booking.personalDetails.email, booking);
            } else {
              // Default to 12-hour reminder for future appointments
              await send12HourReminderEmail(booking.personalDetails.email, booking);
            }

            console.log(`Reminder email sent to ${booking.personalDetails.email} for booking ${booking.bookingReference}`);
          } catch (emailError) {
            console.error('Failed to send reminder email:', emailError);
            results.push({ bookingId, success: false, message: 'Failed to send reminder email' });
            continue;
          }
        }

        // Mark the reminder as sent in the database
        booking.remindersSent = booking.remindersSent || [];
        booking.remindersSent.push({
          type: type === 'both' ? 'email' : type,
          sentAt: new Date(),
          status: 'sent'
        });

        if (type === 'both') {
          booking.remindersSent.push({
            type: 'sms',
            sentAt: new Date(),
            status: 'sent'
          });
        }

        await booking.save();
        results.push({ bookingId, success: true, message: 'Reminder sent successfully' });

      } catch (error) {
        results.push({ bookingId, success: false, message: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Reminders sent',
      data: { results }
    });

  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Send appointment reminders (simplified endpoint for admin panel)
router.post('/send-reminders', async (req, res) => {
  try {
    const { bookingIds } = req.body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one booking ID is required'
      });
    }

    const results = [];

    for (const bookingId of bookingIds) {
      try {
        const booking = await Booking.findById(bookingId)
          .populate('treatment', 'name category');

        if (!booking) {
          results.push({ 
            bookingId, 
            success: false, 
            message: 'Booking not found' 
          });
          continue;
        }

        // Send reminder email
        try {
          // Determine which reminder type to send based on appointment timing
          const now = new Date();
          const appointmentDateTime = new Date(booking.appointmentDate);
          const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

          if (hoursUntilAppointment <= 1 && hoursUntilAppointment > 0) {
            await send1HourReminderEmail(booking.personalDetails.email, booking);
          } else {
            await send12HourReminderEmail(booking.personalDetails.email, booking);
          }

          console.log(`Reminder email sent to ${booking.personalDetails.email} for booking ${booking.bookingReference}`);
          
          // Mark the reminder as sent
          booking.remindersSent = booking.remindersSent || [];
          booking.remindersSent.push({
            type: 'email',
            sentAt: new Date(),
            status: 'sent'
          });
          
          await booking.save();
          
          results.push({ 
            bookingId, 
            success: true, 
            message: 'Reminder sent successfully' 
          });

        } catch (emailError) {
          console.error('Failed to send reminder email:', emailError);
          results.push({ 
            bookingId, 
            success: false, 
            message: 'Failed to send reminder email: ' + emailError.message 
          });
        }

      } catch (error) {
        console.error('Error processing booking:', error);
        results.push({ 
          bookingId, 
          success: false, 
          message: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    res.status(200).json({
      success: true,
      message: `Sent ${successCount} out of ${totalCount} reminders`,
      data: { results }
    });

  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
