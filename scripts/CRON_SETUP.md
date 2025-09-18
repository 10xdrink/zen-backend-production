# Cron Job Setup for Auto No-Show Marking

## Overview
This guide explains how to set up automatic no-show marking for appointments where users don't check in within 1 hour of their appointment time.

## Setup Options

### Option 1: Using Node.js Script (Recommended for development)

1. **Run the script manually:**
   ```bash
   node scripts/autoMarkNoShows.js
   ```

2. **Set up a cron job to run every 15 minutes:**
   ```bash
   # Edit crontab
   crontab -e
   
   # Add this line to run every 15 minutes
   */15 * * * * cd /path/to/zennara-backend && node scripts/autoMarkNoShows.js >> logs/no-show-cron.log 2>&1
   ```

### Option 2: Using HTTP Endpoint (Recommended for production)

1. **Set up environment variable for API key security:**
   ```bash
   # Add to your .env file
   CRON_API_KEY=your-secure-random-api-key-here
   ```

2. **Set up a cron job to call the HTTP endpoint:**
   ```bash
   # Edit crontab
   crontab -e
   
   # Add this line to run every 15 minutes
   */15 * * * * curl -X POST -H "x-api-key: your-secure-random-api-key-here" https://your-domain.com/api/bookings/auto-mark-no-shows >> logs/no-show-cron.log 2>&1
   ```

### Option 3: Using External Cron Services (Recommended for cloud deployments)

Services like:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **AWS CloudWatch Events**
- **Google Cloud Scheduler**

Set them to call:
```
POST https://your-domain.com/api/bookings/auto-mark-no-shows
Headers: x-api-key: your-secure-random-api-key-here
```

## How It Works

1. **Check-in Window**: Users can check in from 15 minutes before to 1 hour after their appointment time
2. **No-Show Logic**: If a user doesn't check in within 1 hour of their appointment time, the appointment is automatically marked as "no-show"
3. **Frequency**: The cron job should run every 15-30 minutes to ensure timely marking of no-shows

## Monitoring

- Check the logs to see how many appointments are being marked as no-show
- Monitor the endpoint response for any errors
- Set up alerts if the cron job fails

## Testing

To test the no-show functionality:

1. Create a test appointment in the past (more than 1 hour ago)
2. Ensure the appointment status is 'confirmed' and checkedIn is false
3. Run the script or call the endpoint
4. Verify the appointment is marked as 'no-show'

## Environment Variables Required

```env
MONGODB_URI=your-mongodb-connection-string
CRON_API_KEY=your-secure-random-api-key-here  # Only for HTTP endpoint option
```
