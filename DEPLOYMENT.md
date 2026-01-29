# GitHub Pages Deployment Guide

## Overview

This guide explains how to deploy Push Master to GitHub Pages (frontend) and a separate backend hosting service.

## Architecture

```
┌─────────────────────────────┐
│   GitHub Pages              │
│   (Static Frontend)         │
│   - HTML, CSS, JS           │
│   - Images, Manifest        │
└──────────┬──────────────────┘
           │
           │ API Calls
           ▼
┌─────────────────────────────┐
│   Backend Hosting           │
│   (Vercel/Railway/Heroku)   │
│   - Node.js Server          │
│   - Express API             │
│   - Pusher Beams            │
└──────────┬──────────────────┘
           │
           │ Push API
           ▼
┌─────────────────────────────┐
│   Pusher Beams              │
│   (Push Notifications)      │
└─────────────────────────────┘
```

## Step 1: Deploy Backend

### Option A: Vercel (Recommended)

1. **Install Vercel CLI**:

    ```bash
    npm install -g vercel
    ```

2. **Create `vercel.json`** in project root:

    ```json
    {
        "version": 2,
        "builds": [
            {
                "src": "server.js",
                "use": "@vercel/node"
            }
        ],
        "routes": [
            {
                "src": "/(.*)",
                "dest": "server.js"
            }
        ]
    }
    ```

3. **Deploy**:

    ```bash
    vercel
    ```

4. **Set Environment Variables** in Vercel Dashboard:
    - `PUSHER_INSTANCE_ID`
    - `PUSHER_SECRET_KEY`
    - `ALLOWED_ORIGINS=https://josealvarezdev.github.io,http://localhost:3000`

5. **Note your deployment URL**: e.g., `https://push-master.vercel.app`

### Option B: Railway

1. **Install Railway CLI**:

    ```bash
    npm install -g @railway/cli
    ```

2. **Login and deploy**:

    ```bash
    railway login
    railway init
    railway up
    ```

3. **Set environment variables**:
    ```bash
    railway variables set PUSHER_INSTANCE_ID=your_id
    railway variables set PUSHER_SECRET_KEY=your_key
    railway variables set ALLOWED_ORIGINS=https://josealvarezdev.github.io,http://localhost:3000
    ```

### Option C: Heroku

1. **Create Heroku app**:

    ```bash
    heroku create push-master-api
    ```

2. **Set environment variables**:

    ```bash
    heroku config:set PUSHER_INSTANCE_ID=your_id
    heroku config:set PUSHER_SECRET_KEY=your_key
    heroku config:set ALLOWED_ORIGINS=https://josealvarezdev.github.io,http://localhost:3000
    ```

3. **Deploy**:
    ```bash
    git push heroku main
    ```

## Step 2: Update Frontend for Production

### Create `public/config.js`:

```javascript
// Configuration for different environments
const CONFIG = {
    API_BASE_URL:
        window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://your-backend-url.vercel.app', // Replace with your backend URL
};
```

### Update `public/index.html`:

Add before `app.js`:

```html
<script src="config.js"></script>
<script src="app.js"></script>
```

### Update `public/app.js`:

Replace all API calls to use `CONFIG.API_BASE_URL`:

```javascript
// Before:
const response = await fetch('/api/config');

// After:
const response = await fetch(`${CONFIG.API_BASE_URL}/api/config`);
```

Update all endpoints:

- `/api/config` → `${CONFIG.API_BASE_URL}/api/config`
- `/api/send` → `${CONFIG.API_BASE_URL}/api/send`
- `/api/history` → `${CONFIG.API_BASE_URL}/api/history`
- `/api/history/${id}` → `${CONFIG.API_BASE_URL}/api/history/${id}`

## Step 3: Deploy to GitHub Pages

### Method 1: GitHub Actions (Automated)

1. **Create `.github/workflows/deploy.yml`**:

```yaml
name: Deploy to GitHub Pages

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2

            - name: Deploy to GitHub Pages
              uses: peaceiris/actions-gh-pages@v3
              with:
                  github_token: ${{ secrets.GITHUB_TOKEN }}
                  publish_dir: ./public
```

2. **Push to GitHub**:

    ```bash
    git add .
    git commit -m "Deploy to GitHub Pages"
    git push origin main
    ```

3. **Enable GitHub Pages**:
    - Go to repository Settings → Pages
    - Source: `gh-pages` branch
    - Save

### Method 2: Manual Deployment

1. **Create `gh-pages` branch**:

    ```bash
    git checkout -b gh-pages
    ```

2. **Copy public files to root**:

    ```bash
    cp -r public/* .
    git add .
    git commit -m "Deploy to GitHub Pages"
    git push origin gh-pages
    ```

3. **Enable GitHub Pages**:
    - Go to repository Settings → Pages
    - Source: `gh-pages` branch, root folder
    - Save

## Step 4: Update URLs in Code

### Update `public/sitemap.xml`:

Change all URLs from localhost to production:

```xml
<loc>https://josealvarezdev.github.io/Push-Master/</loc>
```

### Update `public/robots.txt`:

```
Sitemap: https://josealvarezdev.github.io/Push-Master/sitemap.xml
```

### Update Meta Tags:

In all HTML files, ensure URLs are correct:

```html
<link rel="canonical" href="https://josealvarezdev.github.io/Push-Master/" />
<meta property="og:url" content="https://josealvarezdev.github.io/Push-Master/" />
```

## Step 5: Test Deployment

### Backend Health Check:

```bash
curl https://your-backend-url.vercel.app/health
```

Expected response:

```json
{
    "status": "ok",
    "timestamp": "2026-01-29T...",
    "pusherConfigured": true
}
```

### Frontend Check:

1. Visit `https://josealvarezdev.github.io/Push-Master/`
2. Open browser console
3. Check for CORS errors
4. Try sending a test notification

### SEO Check:

- Visit `https://josealvarezdev.github.io/Push-Master/robots.txt`
- Visit `https://josealvarezdev.github.io/Push-Master/sitemap.xml`
- Visit `https://josealvarezdev.github.io/Push-Master/llm.txt`

## Step 6: Submit to Search Engines

### Google Search Console:

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://josealvarezdev.github.io/Push-Master/`
3. Verify ownership
4. Submit sitemap: `https://josealvarezdev.github.io/Push-Master/sitemap.xml`

### Bing Webmaster Tools:

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Add site
3. Submit sitemap

## Troubleshooting

### CORS Errors:

- Verify `ALLOWED_ORIGINS` includes GitHub Pages URL
- Check backend logs for CORS rejections

### API Not Found:

- Verify `CONFIG.API_BASE_URL` is correct
- Check backend is deployed and running

### Pusher Beams Not Working:

- Verify environment variables are set in backend
- Check browser console for errors
- Verify instance ID is correct

### Images Not Loading:

- Ensure all image paths are relative or use full URLs
- Check `manifest.json` icon paths

## Monitoring

### Backend Monitoring:

- Use backend platform's built-in monitoring (Vercel Analytics, Railway Metrics)
- Set up uptime monitoring (UptimeRobot, Pingdom)

### Frontend Monitoring:

- Google Analytics
- GitHub Pages traffic stats

## Maintenance

### Updating the Application:

1. **Update code locally**
2. **Test locally**:
    ```bash
    npm start
    ```
3. **Deploy backend**:
    ```bash
    vercel --prod
    ```
4. **Deploy frontend**:
    ```bash
    git push origin main  # If using GitHub Actions
    ```

### Environment Variables:

- Never commit `.env` file
- Update production variables in hosting platform dashboard
- Keep `.env.example` updated for documentation

## Security Checklist

- [ ] Backend deployed with HTTPS
- [ ] Environment variables set in production
- [ ] CORS configured with production URLs
- [ ] Rate limiting enabled
- [ ] Security headers configured (HSTS, CSP, etc.)
- [ ] `.env` file in `.gitignore`
- [ ] API keys not exposed in frontend code

## Performance Optimization

### Frontend:

- Minify CSS/JS (optional, GitHub Pages serves as-is)
- Optimize images (compress logo.png)
- Enable browser caching

### Backend:

- Enable compression middleware
- Add caching for history endpoint
- Monitor response times

## Cost Estimate

### Free Tier Limits:

- **GitHub Pages**: Free, unlimited for public repos
- **Vercel**: 100GB bandwidth/month, 100 serverless function invocations/day
- **Railway**: $5 credit/month
- **Heroku**: Free tier (with limitations)

For most use cases, the free tiers are sufficient.

## Next Steps

1. Deploy backend to chosen platform
2. Update `config.js` with backend URL
3. Deploy frontend to GitHub Pages
4. Test all functionality
5. Submit sitemap to search engines
6. Monitor for errors
7. Celebrate! 🎉
