# Deployment Guide - Casbah POS System

This guide will help you deploy your Casbah POS system with the frontend on Vercel/Netlify and backend on Lovable Cloud.

## Architecture

- **Frontend**: Vercel or Netlify (your choice)
- **Backend**: Lovable Cloud (already configured)
- **Database**: Lovable Cloud Supabase
- **Auth & Storage**: Lovable Cloud

## Step 1: Export to GitHub

1. Click the **GitHub icon** in the top-right corner of Lovable
2. Click **Connect to GitHub**
3. Authorize the Lovable GitHub App
4. Select your GitHub account/organization
5. Click **Create Repository**

Your code will be automatically pushed to GitHub with continuous sync.

## Step 2: Deploy to Vercel (Option A)

### Quick Deploy

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import your GitHub repository
4. Vercel will auto-detect it as a Vite project
5. Add environment variables (see below)
6. Click **Deploy**

### Environment Variables for Vercel

Add these in the Vercel dashboard under **Settings → Environment Variables**:

```
VITE_SUPABASE_URL=https://blwvzsjwwhpgzyxvclfv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd3Z6c2p3d2hwZ3p5eHZjbGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjQ1MjksImV4cCI6MjA3OTg0MDUyOX0.D8Q00RlzXfvuUoqBh_MbcODH3alGe9X3XCcD2wGaQ3E
VITE_SUPABASE_PROJECT_ID=blwvzsjwwhpgzyxvclfv
```

## Step 3: Deploy to Netlify (Option B)

### Quick Deploy

1. Go to [netlify.com](https://netlify.com)
2. Click **Add new site → Import an existing project**
3. Connect to GitHub and select your repository
4. Netlify will auto-detect the build settings
5. Add environment variables (see below)
6. Click **Deploy site**

### Environment Variables for Netlify

Add these in the Netlify dashboard under **Site settings → Environment variables**:

```
VITE_SUPABASE_URL=https://blwvzsjwwhpgzyxvclfv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd3Z6c2p3d2hwZ3p5eHZjbGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjQ1MjksImV4cCI6MjA3OTg0MDUyOX0.D8Q00RlzXfvuUoqBh_MbcODH3alGe9X3XCcD2wGaQ3E
VITE_SUPABASE_PROJECT_ID=blwvzsjwwhpgzyxvclfv
```

## Step 4: Verify Deployment

After deployment:

1. Visit your new URL (e.g., `your-app.vercel.app` or `your-app.netlify.app`)
2. Test the PWA install functionality
3. Test authentication and database operations
4. Verify offline capabilities

## Step 5: Share with Client

Once deployed, you can:

1. **Share the URL** - Client can access immediately and install as PWA
2. **Custom Domain** - Add your own domain in Vercel/Netlify settings
3. **Access Backend** - Backend is managed through Lovable Cloud

## Continuous Deployment

Both Vercel and Netlify will automatically redeploy when you:
- Make changes in Lovable (syncs to GitHub → triggers deploy)
- Push changes directly to GitHub

## PWA Installation

Your client can install the app on any device:

### Desktop (Chrome, Edge, Brave)
1. Visit the deployed URL
2. Look for install icon in address bar
3. Click "Install"

### Mobile (iOS Safari)
1. Visit the deployed URL
2. Tap Share button
3. Tap "Add to Home Screen"

### Mobile (Android Chrome)
1. Visit the deployed URL
2. Tap the menu (⋮)
3. Tap "Install app" or "Add to Home Screen"

## Support

- **Frontend Issues**: Check Vercel/Netlify build logs
- **Backend Issues**: Contact through Lovable
- **Database**: Managed through Lovable Cloud

## Configuration Files

This project includes:
- `vercel.json` - Vercel configuration
- `netlify.toml` - Netlify configuration
- `.env.example` - Environment variables template

Both platforms will work automatically with these configurations.
