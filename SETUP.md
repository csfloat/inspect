# CS2 Float API Setup Guide

This is your own float checking API based on the CSFloat inspect library.

## Requirements

1. **Steam Account(s) with CS2/CS:GO**
   - You need at least 1 Steam account that owns CS2
   - Recommended: 2-3 accounts for better performance
   - Accounts should have 2FA enabled

2. **Server/Hosting**
   - VPS with Node.js 14+
   - 1GB RAM minimum (2GB recommended)
   - Stable internet connection

## Setup Steps

### 1. Configure Steam Accounts

Edit `config.js` and add your Steam credentials:

```javascript
'logins': [
    {
        'user': 'your_steam_username',
        'pass': 'your_steam_password',
        // For 2FA: either email token or shared_secret from mobile authenticator
        'auth': 'your_2fa_token_or_shared_secret'
    }
],
```

### 2. First Run (Local Testing)

```bash
# Install dependencies (already done)
npm install

# Start the API server
node index.js
```

The API will be available at `http://localhost:3002`

### 3. Test the API

```bash
# Test with a CS2 inspect link
curl "http://localhost:3002/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A698323590D7935523998312483177"
```

### 4. Deploy to Production

#### Option A: Deploy to your existing server
- Upload this folder to your server
- Install Node.js and dependencies
- Run with PM2 or similar process manager
- Set up reverse proxy (nginx) to handle HTTPS

#### Option B: Use a service like Railway, Heroku, etc.
- Push this code to a Git repository  
- Deploy using your preferred platform
- Set environment variables for production

## Production Configuration

### Environment Variables
```
NODE_ENV=production
PORT=3002
TRUST_PROXY=true  # If behind reverse proxy
```

### PM2 Configuration
```bash
# Install PM2
npm install -g pm2

# Start the API
pm2 start index.js --name "cs2-float-api"

# Save PM2 configuration
pm2 save
pm2 startup
```

### Nginx Reverse Proxy
```nginx
server {
    listen 443 ssl;
    server_name cs2floatchecker.com;
    
    location /api/ {
        proxy_pass http://localhost:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Your website files
    location / {
        # Serve your static website
    }
}
```

## Important Notes

1. **Steam Account Security**: Keep your Steam credentials secure
2. **Rate Limits**: Each account can check ~1 float per second
3. **Monitoring**: Set up monitoring for the API health
4. **Backups**: Consider database backups if using PostgreSQL
5. **Updates**: Keep the library updated for Steam protocol changes

## Troubleshooting

### Common Issues:
- **Login failures**: Check Steam credentials and 2FA
- **API timeouts**: Adjust `request_ttl` in config
- **Rate limits**: Add more Steam accounts or increase delays
- **CORS errors**: Check `allowed_origins` in config

### Logs:
The API logs all activities. Check for:
- Steam login status
- Request processing times
- Error messages

## Architecture

```
Extension → cs2floatchecker.com/api → Your API Server → Steam Servers
```

Your API server:
1. Receives inspect links from extension
2. Logs into Steam with bot accounts
3. Requests float data from Steam
4. Returns structured JSON response

This gives you complete control over the float checking service!