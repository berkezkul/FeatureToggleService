# 🚀 Production Deployment Guide

## 📋 Production-Ready Checklist

### ✅ Tamamlanan Özellikler

- [x] Multi-tenant architecture
- [x] RESTful API with pagination
- [x] JWT & API Key authentication
- [x] Tenant-based authorization
- [x] Redis rate limiting
- [x] Redis caching with TTL
- [x] Feature flag strategies (Boolean, Percentage, User Targeting)
- [x] Audit logging
- [x] Environment promotion
- [x] Enhanced error handling
- [x] Request ID tracking
- [x] Prometheus metrics
- [x] Comprehensive testing
- [x] Production-ready logging
- [x] Docker & Docker Compose
- [x] Swagger API documentation
- [x] Enhanced health checks

## 🐳 Docker Deployment

### Quick Start with Docker Compose

```bash
# Production deployment
docker-compose up -d

# Development deployment
docker-compose -f docker-compose.dev.yml up -d
```

### Manual Docker Build

```bash
# Build image
docker build -t feature-toggle-service:latest .

# Run container
docker run -d \
  --name feature-toggle-app \
  -p 3000:3000 \
  --env-file .env \
  feature-toggle-service:latest
```

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=feature_toggle_db
DB_USER=postgres
DB_PASSWORD=<strong-password>
DB_SSL=false

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_DB=0

# JWT (CRITICAL: Change in production!)
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=24h

# API Key (CRITICAL: Change in production!)
API_KEY_SECRET=<generate-strong-secret>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_BURST=20

# Cache
CACHE_TTL_SECONDS=300
CACHE_PREFIX=feature_toggle

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### Generate Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate API key secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📊 Database Migration

### Production Migration Process

1. **Backup Database**
```bash
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Run Migrations**
```bash
# In Docker container
docker exec -it feature-toggle-app npm run migrate:latest

# Or locally
NODE_ENV=production npm run migrate:latest
```

3. **Verify Migration**
```bash
# Check migration status
docker exec -it feature-toggle-app npm run migrate:status
```

## 🔍 Health Checks

### Health Check Endpoint

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-10T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### Monitoring Endpoints

- `/health` - Application health
- `/metrics` - Prometheus metrics (requires auth)
- `/metrics/json` - JSON metrics (requires auth)
- `/api-docs` - Swagger UI documentation

## 🔐 Security Best Practices

### 1. Secrets Management
- ✅ Never commit secrets to git
- ✅ Use environment variables
- ✅ Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- ✅ Rotate secrets regularly

### 2. Database Security
- ✅ Use strong passwords
- ✅ Enable SSL in production (`DB_SSL=true`)
- ✅ Use connection pooling
- ✅ Limit database user permissions

### 3. Redis Security
- ✅ Use password authentication
- ✅ Enable Redis AUTH
- ✅ Use SSL/TLS if available
- ✅ Restrict network access

### 4. API Security
- ✅ Always use HTTPS in production
- ✅ Implement rate limiting
- ✅ Validate all inputs
- ✅ Use JWT with short expiration
- ✅ Implement API key rotation

## 📈 Monitoring & Observability

### Metrics Collection

Prometheus metrics available at `/metrics`:
- HTTP request counts and durations
- Feature flag operations
- Cache hit/miss rates
- Authentication failures
- Rate limit exceeded
- Error rates
- Database query durations

### Logging

- Structured JSON logs
- Request ID correlation
- Log rotation (10MB max, 5 files)
- Separate error logs
- Environment metadata

### Recommended Monitoring Stack

1. **Prometheus** - Metrics collection
2. **Grafana** - Visualization
3. **ELK Stack** - Log aggregation
4. **AlertManager** - Alerting

## 🚀 Deployment Strategies

### Blue-Green Deployment

1. Deploy new version to green environment
2. Run health checks
3. Switch traffic to green
4. Keep blue as backup

### Rolling Update

1. Update containers one by one
2. Health check each container
3. Continue until all updated

### Canary Deployment

1. Deploy to small percentage of traffic
2. Monitor metrics and errors
3. Gradually increase traffic
4. Full rollout if successful

## 📝 Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Secrets generated and secured
- [ ] Database migrations tested
- [ ] Health checks passing
- [ ] Metrics endpoint accessible
- [ ] Logging configured
- [ ] Rate limiting configured
- [ ] SSL/TLS certificates configured
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured
- [ ] Documentation updated

## 🔄 Post-Deployment

1. **Verify Health**
```bash
curl https://your-domain.com/health
```

2. **Check Metrics**
```bash
curl -H "Authorization: Bearer <token>" https://your-domain.com/metrics/json
```

3. **Monitor Logs**
```bash
docker logs -f feature-toggle-app
```

4. **Test API**
```bash
# Get token
curl -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"...","tenantId":"..."}'

# Test endpoint
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/v1/features?tenant=<id>&env=dev
```

## 🆘 Troubleshooting

### Database Connection Issues
- Check database is running
- Verify connection string
- Check network connectivity
- Review database logs

### Redis Connection Issues
- Check Redis is running
- Verify password
- Check network connectivity
- Review Redis logs

### High Error Rates
- Check application logs
- Review error metrics
- Check database performance
- Review rate limiting

### Performance Issues
- Check cache hit rates
- Review database query performance
- Check Redis performance
- Review request duration metrics

## 📞 Support

For issues or questions:
1. Check logs: `docker logs feature-toggle-app`
2. Check health: `GET /health`
3. Check metrics: `GET /metrics/json`
4. Review documentation: `GET /api-docs`

