# GoatCounter Setup Guide

## What I've Implemented

✅ **GoatCounter Integration**: Added privacy-first analytics to all tools
✅ **Same UI Design**: Kept the exact same counter appearance
✅ **Real Data**: Replaced fake numbers with actual GoatCounter API calls
✅ **Graceful Fallback**: Hides visitor stats if GoatCounter unavailable
✅ **Privacy-First**: No cookies, no personal data collection

## Setup Steps

### 1. Create GoatCounter Account
1. Go to [goatcounter.com](https://www.goatcounter.com)
2. Sign up for free account
3. Choose site code: `pruthvishetty` (or whatever you prefer)
4. Your tracking will be at: `https://pruthvishetty.goatcounter.com`

### 2. Update Configuration
In `js/privacy-counter.js`, update line 85:
```javascript
const siteCode = 'pruthvishetty'; // Replace with your actual site code
```

### 3. Get API Token (Optional - for visitor counts)
1. Go to GoatCounter Settings → API
2. Create new API token
3. Update line 91 in `privacy-counter.js`:
```javascript
'Authorization': 'Bearer YOUR_ACTUAL_TOKEN'
```

### 4. Update Tracking URLs
All tools already have the GoatCounter script with:
```html
<script data-goatcounter="https://pruthvishetty.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

Update the URL to match your chosen site code.

## What Users Will See

### With GoatCounter Working:
```
👋 Welcome back! Hope you found it useful
Your 2nd time using JSONViz
🛡️ Privacy-first since 2025
1,234 people used this
89 this month
```

### Without GoatCounter (Setting Up):
```
👋 Welcome back! Hope you found it useful
Your 2nd time using JSONViz
🛡️ Privacy-first since 2025
Soon global visitors
ℹ️ Setting up analytics...
```

## Privacy Features

✅ **No Cookies**: GoatCounter doesn't use cookies
✅ **No Personal Data**: Only counts page views
✅ **GDPR Compliant**: Respects privacy regulations
✅ **Open Source**: Transparent code
✅ **Lightweight**: < 3KB tracking script

## Current Status

- **Personal Counters**: ✅ Working (client-side localStorage)
- **Privacy Badges**: ✅ Working 
- **GoatCounter Tracking**: ⏳ Needs your setup
- **Visitor Stats Display**: ⏳ Will work after setup

## Testing

1. Set up GoatCounter account
2. Update site code in the files
3. Deploy to GitHub Pages
4. Visit your tools - they'll start tracking
5. Check GoatCounter dashboard for real stats
6. Visitor counts will appear in tools after API setup

The UI design remains exactly the same - users won't notice any visual changes, but now the numbers will be real!
