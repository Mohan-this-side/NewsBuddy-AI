# API Key Setup Guide

## Groq API Key Setup

The AI News Reporter requires a valid Groq API key to function. Here's how to set it up:

### Step 1: Get Your Groq API Key

1. Visit [Groq Console](https://console.groq.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (it starts with `gsk_`)

### Step 2: Add API Key to Backend

1. Open `backend/.env` file
2. Add or update the following line:
   ```
   GROQ_API_KEY=gsk_your_actual_api_key_here
   ```
3. Save the file
4. Restart your backend server

### Step 3: Test the API Key

Run the test script:
```bash
cd backend
source venv/bin/activate
python test_groq.py
```

If successful, you should see:
```
✅ SUCCESS! Groq API is working correctly.
```

### Troubleshooting

- **401 Error**: Your API key is invalid or expired. Generate a new one.
- **Rate Limit Error**: You've exceeded the free tier limit (30 requests/minute). Wait a moment and try again.
- **Connection Error**: Check your internet connection and Groq service status.

### Free Tier Limits

- 30 requests per minute
- Sufficient for development and testing
- Upgrade for production use
