# Zennara Backend API

A Node.js backend API for the Zennara Beauty Application with authentication, user management, and OTP verification.

## Features

- **User Authentication**: Email-based registration and login with OTP verification
- **JWT Token Management**: Secure token-based authentication
- **Email Service**: Automated OTP and welcome emails with beautiful HTML templates
- **User Profile Management**: Complete CRUD operations for user profiles
- **Security**: Rate limiting, CORS, helmet security headers
- **Validation**: Comprehensive input validation with express-validator
- **Database**: MongoDB with Mongoose ODM

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud)
- Gmail account for email service

### Installation

1. **Clone and navigate to backend directory:**
   ```bash
   cd zennara-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/zennara
   JWT_SECRET=your_super_secret_jwt_key_here
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_gmail_app_password
   PORT=5000
   ```

4. **Start the server:**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication Routes (`/api/auth`)

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "fullName": "John Doe",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "gender": "Male",
  "location": "Jubilee Hills"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "1234",
  "type": "register"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Resend OTP
```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "type": "email"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <jwt_token>
```

### User Routes (`/api/user`)

#### Update Profile
```http
PUT /api/user/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "fullName": "Updated Name",
  "phoneNumber": "+0987654321",
  "location": "Kokapet"
}
```

#### Deactivate Account
```http
DELETE /api/user/account
Authorization: Bearer <jwt_token>
```

## Authentication Flow

1. **Registration:**
   - User submits registration data
   - System validates input and checks for existing users
   - OTP is generated and sent via email
   - User verifies OTP to complete registration
   - JWT token is issued upon successful verification

2. **Login:**
   - User submits email address
   - System sends OTP to registered email
   - User verifies OTP
   - JWT token is issued upon successful verification

3. **Protected Routes:**
   - Include `Authorization: Bearer <token>` header
   - Token is validated on each request
   - User information is attached to request object

## Database Schema

### User Model
```javascript
{
  email: String (required, unique),
  fullName: String (required),
  phoneNumber: String (required),
  dateOfBirth: Date (required),
  gender: String (enum: ['Male', 'Female', 'Other']),
  location: String (enum: ['Jubilee Hills', 'Kokapet', 'Kondapur']),
  profilePhoto: String (optional),
  isEmailVerified: Boolean (default: false),
  isPhoneVerified: Boolean (default: false),
  role: String (enum: ['user', 'admin'], default: 'user'),
  isActive: Boolean (default: true),
  lastLogin: Date,
  emailOTP: {
    code: String,
    expiresAt: Date,
    attempts: Number
  },
  phoneOTP: {
    code: String,
    expiresAt: Date,
    attempts: Number
  }
}
```

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for frontend domains
- **Helmet**: Security headers
- **JWT**: Secure token-based authentication
- **Input Validation**: Comprehensive validation for all inputs
- **OTP Security**: 4-digit codes with expiration and attempt limits

## Email Templates

Beautiful HTML email templates included for:
- OTP verification emails
- Welcome emails
- Responsive design with Zennara branding

## Error Handling

Comprehensive error handling with:
- Validation errors
- Authentication errors
- Database errors
- Email service errors
- Rate limiting errors

## Development

### Available Scripts
- `npm start`: Start production server
- `npm run dev`: Start development server with nodemon
- `npm test`: Run tests (Jest)

### Project Structure
```
zennara-backend/
├── models/
│   └── User.js
├── routes/
│   ├── auth.js
│   └── user.js
├── middleware/
│   └── auth.js
├── utils/
│   └── emailService.js
├── server.js
├── package.json
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/zennara` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRE` | JWT expiration time | `7d` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | Email username | Required |
| `EMAIL_PASS` | Email password/app password | Required |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `OTP_EXPIRE_MINUTES` | OTP expiration time | `10` |

## Frontend Integration

To integrate with your React Native app, update your API calls to use:
- Base URL: `http://localhost:5000/api` (development)
- Include JWT token in Authorization header for protected routes
- Handle OTP flow as per the authentication endpoints

## Support

For issues and questions, please check the API responses for detailed error messages and status codes.
