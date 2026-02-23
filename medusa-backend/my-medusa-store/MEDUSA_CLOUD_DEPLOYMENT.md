# Medusa Cloud Deployment Checklist

## Pre-deployment Steps

### 1. Environment Variables Setup
Ensure all required environment variables are configured in Medusa Cloud:

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional but recommended)
- `STORE_CORS` - Frontend domain URLs (comma-separated)
- `ADMIN_CORS` - Admin panel domain URLs (comma-separated) 
- `AUTH_CORS` - Authentication domain URLs (comma-separated)
- `JWT_SECRET` - Secret for JWT tokens (use strong random string)
- `COOKIE_SECRET` - Secret for cookies (use strong random string)
- `STRIPE_API_KEY` - Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `NODE_ENV` - Set to "production"

### 2. Build Configuration
- ✅ Dockerfile updated to use multi-stage build
- ✅ Proper Node.js version (20.20.0-slim)
- ✅ Build dependencies installed during build stage
- ✅ Production dependencies-only in final image

### 3. Security Configuration
- ✅ Non-root user in Docker container
- ✅ Proper CORS configuration
- ✅ Environment variables for secrets

### 4. Health Checks
- ✅ Docker healthcheck configured
- ✅ Medusa health endpoint available at `/health`

## Deployment Process

1. **Push Code to Repository**
   - Ensure all changes are committed and pushed
   - Verify Dockerfile and package.json are up to date

2. **Configure Environment Variables**
   - Set all required environment variables in Medusa Cloud dashboard
   - Use strong, unique secrets for JWT_SECRET and COOKIE_SECRET

3. **Database Setup**
   - Ensure PostgreSQL database is provisioned
   - Database URL should be accessible from Medusa Cloud

4. **Deploy**
   - Trigger deployment in Medusa Cloud
   - Monitor build logs for any errors
   - Verify deployment health check

5. **Post-Deployment Verification**
   - Test API endpoints
   - Verify admin panel access
   - Test Stripe webhook functionality (if configured)
   - Run any necessary migrations or seeding

## Troubleshooting Common Issues

### Build Fails with "Missing Dependencies"
- Check if all dev dependencies are available during build stage
- Verify package.json has all necessary dependencies

### Runtime Environment Variable Errors
- Ensure all required environment variables are set in cloud platform
- Check variable names match exactly (case-sensitive)

### Database Connection Issues
- Verify DATABASE_URL format and credentials
- Ensure database is accessible from deployment platform
- Check if database allows connections from external IPs

### CORS Issues
- Verify STORE_CORS, ADMIN_CORS, and AUTH_CORS are properly set
- Include both HTTP and HTTPS variants if needed
- Add comma-separated multiple domains if required

## Useful Commands for Local Testing

```bash
# Build Docker image locally
docker build -t my-medusa-store .

# Run container locally with environment file
docker run --env-file .env -p 9000:9000 my-medusa-store

# Check container health
docker inspect --format='{{.State.Health.Status}}' container-id
```