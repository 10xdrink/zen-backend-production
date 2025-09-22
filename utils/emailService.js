const AWS = require('aws-sdk');

// Configure AWS SES
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

// Send OTP email using AWS SES
const sendOTPEmail = async (email, otp, fullName) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Zennara OTP Verification</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #156450; margin-bottom: 20px;">Hello ${fullName}!</h2>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Thank you for choosing Zennara! To complete your verification, please use the following OTP code:
          </p>
          
          <div style="background: #f8fffe; border: 2px solid #156450; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <h3 style="color: #156450; margin: 0 0 10px 0;">Your Verification Code</h3>
            <div style="font-size: 32px; font-weight: bold; color: #156450; letter-spacing: 8px; font-family: monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
            <strong>Important:</strong> This code will expire in 10 minutes for your security.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
            If you didn't request this code, please ignore this email or contact our support team.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
            <p style="font-size: 12px; color: #999; margin: 0;">
              This is an automated message from Zennara Beauty Services.<br>
              Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      Hello ${fullName}!
      
      Your Zennara verification code is: ${otp}
      
      This code will expire in 10 minutes.
      
      If you didn't request this code, please ignore this email.
      
      Thank you for choosing Zennara!
    `;

    const params = {
      Source: process.env.FROM_EMAIL,
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: 'Zennara - Your Verification Code',
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Charset: 'UTF-8',
            Data: textBody
          }
        }
      }
    };

    const result = await ses.sendEmail(params).promise();
    console.log('OTP email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES email sending error:', error);
    throw new Error('Failed to send OTP email via AWS SES');
  }
};

// Send welcome email using AWS SES
const sendWelcomeEmail = async (email, fullName) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Zennara</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #156450; margin-bottom: 20px;">Welcome ${fullName}!</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Congratulations! Your Zennara account has been successfully created. We're excited to be part of your beauty transformation journey.
          </p>
          
          <div style="background: #f8fffe; border-left: 4px solid #156450; padding: 20px; margin: 30px 0;">
            <h3 style="color: #156450; margin: 0 0 15px 0;">What's Next?</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Explore our premium beauty treatments</li>
              <li style="margin-bottom: 8px;">Book your first appointment</li>
              <li style="margin-bottom: 8px;">Browse our pharmacy for beauty products</li>
              <li style="margin-bottom: 8px;">Manage your appointments easily</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
            If you have any questions or need assistance, our support team is here to help you every step of the way.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
            <p style="font-size: 12px; color: #999; margin: 0;">
              Thank you for choosing Zennara Beauty Services.<br>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Welcome to Zennara - Your Beauty Journey Begins!'
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('Welcome email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES welcome email sending error:', error);
    throw new Error('Failed to send welcome email via AWS SES');
  }
};

// Send checkout OTP email for check-in functionality
const sendCheckoutOTPEmail = async (email, otp, booking) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Zennara Check-in Successful</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #156450; margin-bottom: 20px;">Check-in Successful!</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Dear ${booking.personalDetails.fullName}, you have successfully checked in for your appointment.
          </p>
          
          <div style="background: #f8fffe; border: 1px solid #156450; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #156450; margin: 0 0 15px 0;">Appointment Details</h3>
            <p style="margin: 5px 0;"><strong>Treatment:</strong> ${booking.treatmentDetails.name}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(booking.appointmentDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${booking.appointmentTime}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${booking.location}</p>
            <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
          </div>
          
          <div style="background: #156450; color: white; padding: 25px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h3 style="color: white; margin: 0 0 15px 0;">Your Checkout OTP</h3>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 6px; font-family: monospace; margin: 15px 0;">
              ${otp}
            </div>
            <p style="font-size: 14px; margin: 15px 0 0 0; opacity: 0.9;">
              Please provide this OTP to our staff when your treatment is complete
            </p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>Important Security Notice:</strong><br>
              • Keep this OTP secure and confidential<br>
              • Only share it with Zennara staff for checkout<br>
              • This OTP is valid only for this appointment session<br>
              • If you have any concerns, contact our reception immediately
            </p>
          </div>
          
          <p style="font-size: 16px; color: #156450; text-align: center; margin-top: 30px;">
            Enjoy your treatment experience at Zennara!
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Zennara Clinic | ${booking.location}<br>
            Phone: +91-9999999999 | Email: info@zennara.com<br>
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Check-in Successful - Checkout OTP | Zennara Wellness'
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('Checkout OTP email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES checkout OTP email sending error:', error);
    throw new Error('Failed to send checkout OTP email via AWS SES');
  }
};

// Send appointment booking confirmation email
const sendBookingConfirmationEmail = async (email, booking) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmed - Zennara</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #10B981; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 24px;">✓</span>
            </div>
            <h2 style="color: #156450; margin: 0;">Appointment Confirmed!</h2>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Dear ${booking.personalDetails.fullName}, your appointment has been successfully booked.
          </p>
          
          <div style="background: #f8fffe; border: 1px solid #156450; border-radius: 8px; padding: 25px; margin: 30px 0;">
            <h3 style="color: #156450; margin: 0 0 20px 0; text-align: center;">Appointment Details</h3>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Treatment:</span>
                <span>${booking.treatmentDetails.name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Date:</span>
                <span>${new Date(booking.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Time:</span>
                <span>${booking.appointmentTime}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Location:</span>
                <span>${booking.location}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Total Amount:</span>
                <span style="color: #156450; font-weight: bold;">₹${booking.totalAmount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="font-weight: 600;">Booking Reference:</span>
                <span style="color: #156450; font-weight: bold;">${booking.bookingReference}</span>
              </div>
            </div>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #856404; margin: 0 0 15px 0;">Important Reminders:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li style="margin-bottom: 8px;">Please arrive 15 minutes before your appointment time</li>
              <li style="margin-bottom: 8px;">Check-in will be available 15 minutes before your appointment</li>
              <li style="margin-bottom: 8px;">Bring a valid ID for verification</li>
              <li style="margin-bottom: 8px;">You can reschedule or cancel up to 2 hours before your appointment</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 16px; color: #156450; margin-bottom: 20px;">
              We look forward to serving you at Zennara!
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Zennara Clinic | ${booking.location}<br>
            Phone: +91-9999999999 | Email: info@zennara.com<br>
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `Appointment Confirmed - ${booking.treatmentDetails.name} | Zennara`
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('Booking confirmation email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES booking confirmation email sending error:', error);
    throw new Error('Failed to send booking confirmation email via AWS SES');
  }
};

// Send 12-hour reminder email
const send12HourReminderEmail = async (email, booking) => {
  try {
    // Calculate timing for dynamic messaging
    const now = new Date();
    const appointmentDateTime = new Date(booking.appointmentDate);
    const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);
    const daysUntilAppointment = Math.ceil(hoursUntilAppointment / 24);
    
    // Determine the appropriate timing message
    let timingMessage, headerTitle, sectionTitle;
    if (daysUntilAppointment <= 1) {
      timingMessage = "this is a friendly reminder about your appointment tomorrow.";
      headerTitle = "Appointment Tomorrow!";
      sectionTitle = "Tomorrow's Appointment";
    } else if (daysUntilAppointment === 2) {
      timingMessage = "this is a friendly reminder about your appointment in 2 days.";
      headerTitle = "Appointment in 2 Days!";
      sectionTitle = "Upcoming Appointment";
    } else {
      timingMessage = `this is a friendly reminder about your appointment on ${appointmentDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
      headerTitle = "Appointment Reminder!";
      sectionTitle = "Your Appointment";
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Reminder | Zennara</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #3B82F6; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 24px;">🕐</span>
            </div>
            <h2 style="color: #156450; margin: 0;">${headerTitle}</h2>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 30px; text-align: center;">
            Dear ${booking.personalDetails.fullName}, ${timingMessage}
          </p>
          
          <div style="background: #eff6ff; border: 1px solid #3B82F6; border-radius: 8px; padding: 25px; margin: 30px 0;">
            <h3 style="color: #1E40AF; margin: 0 0 20px 0; text-align: center;">${sectionTitle}</h3>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe;">
                <span style="font-weight: 600;">Treatment:</span>
                <span>${booking.treatmentDetails.name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe;">
                <span style="font-weight: 600;">Time:</span>
                <span style="color: #1E40AF; font-weight: bold;">${booking.appointmentTime}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe;">
                <span style="font-weight: 600;">Location:</span>
                <span>${booking.location}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="font-weight: 600;">Booking Reference:</span>
                <span style="color: #1E40AF; font-weight: bold;">${booking.bookingReference}</span>
              </div>
            </div>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #92400e; margin: 0 0 15px 0;">Preparation Tips:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 8px;">Get a good night's sleep</li>
              <li style="margin-bottom: 8px;">Stay hydrated</li>
              <li style="margin-bottom: 8px;">Avoid heavy meals 2 hours before treatment</li>
              <li style="margin-bottom: 8px;">Arrive 15 minutes early for check-in</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #6B7280; margin-bottom: 20px;">
              Need to reschedule? You can do so up to 2 hours before your appointment time.
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Zennara Clinic | ${booking.location}<br>
            Phone: +91-9999999999 | Email: info@zennara.com<br>
            This is an automated reminder. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `Reminder: Your appointment on ${appointmentDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${booking.appointmentTime} | Zennara`
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('12-hour reminder email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES 12-hour reminder email sending error:', error);
    throw new Error('Failed to send 12-hour reminder email via AWS SES');
  }
};

// Send 1-hour reminder email
const send1HourReminderEmail = async (email, booking) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment in 1 Hour | Zennara</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #EF4444; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 24px;">⏰</span>
            </div>
            <h2 style="color: #156450; margin: 0;">Appointment in 1 Hour!</h2>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 30px; text-align: center;">
            Dear ${booking.personalDetails.fullName}, your appointment is starting soon. Time to get ready!
          </p>
          
          <div style="background: #fef2f2; border: 1px solid #EF4444; border-radius: 8px; padding: 25px; margin: 30px 0;">
            <h3 style="color: #DC2626; margin: 0 0 20px 0; text-align: center;">Starting Soon</h3>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Treatment:</span>
                <span>${booking.treatmentDetails.name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Time:</span>
                <span style="color: #DC2626; font-weight: bold;">${booking.appointmentTime}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Location:</span>
                <span>${booking.location}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="font-weight: 600;">Booking Reference:</span>
                <span style="color: #DC2626; font-weight: bold;">${booking.bookingReference}</span>
              </div>
            </div>
          </div>
          
          <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #15803d; margin: 0 0 15px 0;">Final Checklist:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #15803d;">
              <li style="margin-bottom: 8px;">✓ Leave now to arrive 15 minutes early</li>
              <li style="margin-bottom: 8px;">✓ Bring your ID for verification</li>
              <li style="margin-bottom: 8px;">✓ Check-in will be available when you arrive</li>
              <li style="margin-bottom: 8px;">✓ Contact us if you're running late</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 16px; color: #156450; margin-bottom: 20px;">
              See you soon at Zennara!
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Zennara Clinic | ${booking.location}<br>
            Phone: +91-9999999999 | Email: info@zennara.com<br>
            This is an automated reminder. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `URGENT: Your appointment starts in 1 hour at ${booking.appointmentTime} | Zennara`
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('1-hour reminder email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES 1-hour reminder email sending error:', error);
    throw new Error('Failed to send 1-hour reminder email via AWS SES');
  }
};

// Send appointment cancelled email
const sendAppointmentCancelledEmail = async (email, booking) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Cancelled | Zennara</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #EF4444; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 24px;">✕</span>
            </div>
            <h2 style="color: #DC2626; margin: 0;">Appointment Cancelled</h2>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 30px; text-align: center;">
            Dear ${booking.personalDetails.fullName}, your appointment has been successfully cancelled.
          </p>
          
          <div style="background: #fef2f2; border: 1px solid #EF4444; border-radius: 8px; padding: 25px; margin: 30px 0;">
            <h3 style="color: #DC2626; margin: 0 0 20px 0; text-align: center;">Cancelled Appointment Details</h3>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Treatment:</span>
                <span>${booking.treatmentDetails.name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Date:</span>
                <span>${new Date(booking.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Time:</span>
                <span>${booking.appointmentTime}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <span style="font-weight: 600;">Location:</span>
                <span>${booking.location}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="font-weight: 600;">Booking Reference:</span>
                <span style="color: #DC2626; font-weight: bold;">${booking.bookingReference}</span>
              </div>
            </div>
          </div>
          
          <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #15803d; margin: 0 0 15px 0;">What's Next?</h4>
            <ul style="margin: 0; padding-left: 20px; color: #15803d;">
              <li style="margin-bottom: 8px;">Your slot is now available for other customers</li>
              <li style="margin-bottom: 8px;">You can book a new appointment anytime</li>
              <li style="margin-bottom: 8px;">No cancellation charges applied</li>
              <li style="margin-bottom: 8px;">Contact us if you need any assistance</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 16px; color: #156450; margin-bottom: 20px;">
              We hope to serve you again soon at Zennara!
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Zennara Clinic | ${booking.location}<br>
            Phone: +91-9999999999 | Email: info@zennara.com<br>
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `Appointment Cancelled - ${booking.treatmentDetails.name} | Zennara`
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('Appointment cancelled email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES appointment cancelled email sending error:', error);
    throw new Error('Failed to send appointment cancelled email via AWS SES');
  }
};

// Send appointment rescheduled email
const sendAppointmentRescheduledEmail = async (email, oldBooking, newBooking) => {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Rescheduled | Zennara</title>
      </head>
      <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4ade80, #156450, #065f46); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">ZENNARA</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Your Beauty Transformation Journey</p>
        </div>
        
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #F59E0B; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 24px;">🔄</span>
            </div>
            <h2 style="color: #156450; margin: 0;">Appointment Rescheduled!</h2>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 30px; text-align: center;">
            Dear ${newBooking.personalDetails.fullName}, your appointment has been successfully rescheduled.
          </p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
            <!-- Previous Appointment -->
            <div style="background: #fef2f2; border: 1px solid #EF4444; border-radius: 8px; padding: 20px;">
              <h3 style="color: #DC2626; margin: 0 0 15px 0; text-align: center;">Previous</h3>
              <div style="font-size: 14px; color: #7f1d1d;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(oldBooking.appointmentDate).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${oldBooking.appointmentTime}</p>
              </div>
            </div>
            
            <!-- New Appointment -->
            <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px;">
              <h3 style="color: #15803d; margin: 0 0 15px 0; text-align: center;">New</h3>
              <div style="font-size: 14px; color: #14532d;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(newBooking.appointmentDate).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${newBooking.appointmentTime}</p>
              </div>
            </div>
          </div>
          
          <div style="background: #f8fffe; border: 1px solid #156450; border-radius: 8px; padding: 25px; margin: 30px 0;">
            <h3 style="color: #156450; margin: 0 0 20px 0; text-align: center;">Updated Appointment Details</h3>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Treatment:</span>
                <span>${newBooking.treatmentDetails.name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">New Date:</span>
                <span style="color: #156450; font-weight: bold;">${new Date(newBooking.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">New Time:</span>
                <span style="color: #156450; font-weight: bold;">${newBooking.appointmentTime}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600;">Location:</span>
                <span>${newBooking.location}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="font-weight: 600;">Booking Reference:</span>
                <span style="color: #156450; font-weight: bold;">${newBooking.bookingReference}</span>
              </div>
            </div>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #856404; margin: 0 0 15px 0;">Important Reminders:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li style="margin-bottom: 8px;">Please arrive 15 minutes before your new appointment time</li>
              <li style="margin-bottom: 8px;">Check-in will be available 15 minutes before your appointment</li>
              <li style="margin-bottom: 8px;">Bring a valid ID for verification</li>
              <li style="margin-bottom: 8px;">You can reschedule again up to 2 hours before your appointment</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 16px; color: #156450; margin-bottom: 20px;">
              We look forward to serving you at your new appointment time!
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Zennara Clinic | ${newBooking.location}<br>
            Phone: +91-9999999999 | Email: info@zennara.com<br>
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const params = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `Appointment Rescheduled - New time: ${newBooking.appointmentTime} | Zennara`
        }
      },
      Source: process.env.FROM_EMAIL,
      ReplyToAddresses: [process.env.FROM_EMAIL]
    };

    const result = await ses.sendEmail(params).promise();
    console.log('Appointment rescheduled email sent successfully via AWS SES:', result.MessageId);
    return result;

  } catch (error) {
    console.error('AWS SES appointment rescheduled email sending error:', error);
    throw new Error('Failed to send appointment rescheduled email via AWS SES');
  }
};

// Send admin OTP email
const sendAdminOTPEmail = async (email, otp) => {
  const params = {
    Source: process.env.FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Zennara Admin - Login OTP',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Admin Login OTP</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #156450 0%, #1a7a5e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Zennara Admin</h1>
                <p style="color: #e8f5f0; margin: 10px 0 0 0; font-size: 16px;">Admin Panel Access</p>
              </div>
              
              <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #156450; margin-bottom: 20px; font-size: 24px;">Admin Login OTP</h2>
                
                <p style="font-size: 16px; margin-bottom: 25px;">
                  Your One-Time Password (OTP) for admin panel access:
                </p>
                
                <div style="background: #f8f9fa; border: 2px solid #156450; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                  <span style="font-size: 32px; font-weight: bold; color: #156450; letter-spacing: 3px;">${otp}</span>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                  <strong>Important:</strong> This OTP is valid for 5 minutes only and can only be used once.
                </p>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #856404;">
                    <strong>Security Notice:</strong> If you didn't request this OTP, please ignore this email. Never share your OTP with anyone.
                  </p>
                </div>
                
                <hr style="border: none; height: 1px; background: #eee; margin: 30px 0;">
                
                <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                  This is an automated message from Zennara Admin System.<br>
                  Please do not reply to this email.
                </p>
              </div>
            </body>
            </html>
          `,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log('Admin OTP email sent successfully:', result.MessageId);
    return result;
  } catch (error) {
    console.error('Error sending admin OTP email:', error);
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendOTPEmail,
  sendCheckoutOTPEmail,
  sendBookingConfirmationEmail,
  sendAppointmentCancelledEmail,
  sendAppointmentRescheduledEmail,
  sendAdminOTPEmail,
  send12HourReminderEmail,
  send1HourReminderEmail
};
