# Deployment Guide

This guide covers deploying the Emergency Response System to various platforms.

## Prerequisites

Before deploying, ensure you have:
- Supabase project configured with all tables and storage buckets
- Environment variables set up
- Application tested locally
- Git repository initialized

## Environment Variables

Required environment variables for production:

```env
VITE_SUPABASE_URL=your-production-supabase-url
VITE_SUPABASE_ANON_KEY=your-production-supabase-anon-key
```

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides the easiest deployment experience with automatic HTTPS and CI/CD.

#### Steps:

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```
   Follow the prompts to configure your project.

4. **Add Environment Variables:**
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add your Supabase credentials

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

#### Vercel Configuration (Optional)

Create `vercel.json` in project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

### Option 2: Netlify

Netlify offers free hosting with continuous deployment from Git.

#### Steps:

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

3. **Or deploy via Git:**
   - Push your code to GitHub/GitLab/Bitbucket
   - Connect your repository in Netlify dashboard
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Add environment variables in Netlify dashboard

#### Netlify Configuration (Optional)

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  VITE_SUPABASE_URL = "@supabase_url"
  VITE_SUPABASE_ANON_KEY = "@supabase_anon_key"
```

### Option 3: GitHub Pages

Free static hosting from GitHub.

#### Steps:

1. **Update `vite.config.mjs`:**
   ```js
   export default defineConfig({
     base: '/emergency-response-system/',
     // ... other config
   })
   ```

2. **Build the application:**
   ```bash
   npm run build
   ```

3. **Deploy using GitHub Actions:**
   Create `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ main ]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: 18
         - run: npm ci
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

4. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages / root

### Option 4: AWS S3 + CloudFront

For enterprise-level deployment.

#### Steps:

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Upload to S3:**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

3. **Configure CloudFront:**
   - Create CloudFront distribution
   - Origin: S3 bucket
   - Default cache behavior: redirect to index.html
   - Add custom error pages for SPA routing

4. **Set up CI/CD:**
   Use AWS CodePipeline or GitHub Actions for automated deployments.

### Option 5: Docker Deployment

For containerized deployments.

#### Steps:

1. **Create `Dockerfile`:**
   ```dockerfile
   FROM node:18-alpine as builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create `nginx.conf`:**
   ```nginx
   server {
     listen 80;
     server_name localhost;
     root /usr/share/nginx/html;
     index index.html;

     location / {
       try_files $uri $uri/ /index.html;
     }
   }
   ```

3. **Build and run:**
   ```bash
   docker build -t emergency-response-system .
   docker run -p 80:80 emergency-response-system
   ```

4. **Deploy to container registry:**
   ```bash
   docker tag emergency-response-system your-registry/emergency-response-system
   docker push your-registry/emergency-response-system
   ```

## Post-Deployment Checklist

- [ ] Verify the application loads correctly
- [ ] Test authentication flow
- [ ] Test all user role workflows
- [ ] Verify Supabase connection
- [ ] Test file uploads (if using storage)
- [ ] Check responsive design on mobile
- [ ] Verify HTTPS is enabled
- [ ] Set up monitoring/error tracking
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline

## Domain Configuration

### Custom Domain with Vercel:
1. Go to project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

### Custom Domain with Netlify:
1. Go to Domain Settings
2. Add custom domain
3. Update DNS records
4. Enable automatic HTTPS

### Custom Domain with CloudFront:
1. Add alternate domain name in CloudFront distribution
2. Create SSL certificate in AWS Certificate Manager
3. Update DNS records
4. Wait for certificate validation

## Monitoring and Logging

### Vercel Analytics:
- Built-in analytics dashboard
- Real-time performance metrics
- Error tracking

### Netlify Analytics:
- Add Netlify Analytics script
- Monitor page views and performance

### Custom Monitoring:
- Integrate Sentry for error tracking
- Use Google Analytics for user analytics
- Set up uptime monitoring (Pingdom, UptimeRobot)

## Security Considerations

1. **Environment Variables:**
   - Never commit `.env` files
   - Use platform-specific secret management
   - Rotate keys regularly

2. **Supabase Security:**
   - Enable Row Level Security (RLS)
   - Use service role key only server-side
   - Regular security audits

3. **HTTPS:**
   - Always use HTTPS in production
   - Enable HSTS headers
   - Use secure cookie flags

4. **CORS:**
   - Configure allowed origins in Supabase
   - Restrict to your domain only

## Backup Strategy

### Database Backups:
- Enable Supabase automated backups
- Schedule regular point-in-time recovery
- Export data periodically

### Code Backups:
- Use Git for version control
- Regular commits to main branch
- Tag releases

## Scaling Considerations

### When to Scale:
- High traffic (>1000 concurrent users)
- Slow response times
- Database connection limits

### Scaling Options:
1. **Database:** Upgrade Supabase plan
2. **CDN:** Use CloudFront or Cloudflare
3. **Load Balancing:** Multiple instances behind load balancer
4. **Caching:** Implement Redis for session caching

## Troubleshooting

### Build Errors:
- Check Node.js version (requires v18+)
- Clear node_modules and reinstall
- Verify all dependencies are installed

### Runtime Errors:
- Check browser console for errors
- Verify environment variables are set
- Check Supabase connection

### Deployment Issues:
- Check build logs
- Verify file permissions
- Ensure all files are uploaded

## Cost Estimation

### Free Tier Options:
- Vercel: Free for hobby projects
- Netlify: Free tier available
- GitHub Pages: Completely free
- Supabase: Free tier (500MB database, 1GB storage)

### Paid Tier (if needed):
- Vercel Pro: $20/month
- Netlify Pro: $19/month
- Supabase Pro: $25/month

## Support

For deployment issues:
- Check platform documentation
- Review build logs
- Contact platform support
- Check GitHub issues

---

**Last Updated:** September 28, 2026
