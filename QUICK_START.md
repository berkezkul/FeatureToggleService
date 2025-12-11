# 🚀 Hızlı Başlangıç Rehberi

## 📋 Gereksinimler

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12 (veya Docker)
- Redis >= 6 (veya Docker)

---

## 🐳 Yöntem 1: Docker ile (Önerilen - En Kolay)

### Adım 1: Projeyi Klonlayın veya Klasöre Gidin

```bash
cd D:\Projelerim\ZebraElectronicsFeatureToggleService
```

### Adım 2: Environment Dosyasını Oluşturun

```bash
# .env.example dosyasını .env olarak kopyalayın
copy .env.example .env
```

Veya PowerShell'de:
```powershell
Copy-Item .env.example .env
```

### Adım 3: Docker Compose ile Başlatın

```bash
# Tüm servisleri başlat (PostgreSQL, Redis, App)
docker-compose up -d

# Logları izle
docker-compose logs -f app
```

### Adım 4: Migration'ları Çalıştırma

```bash
# Container içinde migration çalıştır
docker exec -it feature-toggle-app npm run migrate:latest
```

### Adım 5: Servislerin Durumunu Kontrol Etme

```bash
# Health check
curl http://localhost:3000/health

# Veya PowerShell'de
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -ExpandProperty Content
```

**Beklenen Çıktı:**
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

### Adım 6: API Dokümantasyonuna Erişme

Tarayıcıda açın:
```
http://localhost:3000/api-docs
```

---

## 💻 Yöntem 2: Local Development (Manuel)

### Adım 1: PostgreSQL ve Redis'i Başlatma

**PostgreSQL:**
```bash
# Windows (PostgreSQL servis olarak çalışıyorsa)
# Servis zaten çalışıyor olmalı

# Veya Docker ile sadece PostgreSQL
docker run -d --name postgres-dev -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=feature_toggle_db -p 5432:5432 postgres:15-alpine
```

**Redis:**
```bash
# Docker ile Redis
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
```

### Adım 2: Bağımlılıkları Yükleme

```bash
npm install
```

### Adım 3: Environment Dosyasını Ayarlama

`.env` dosyasını oluşturun:

```bash
# .env dosyası içeriği
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=feature_toggle_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=24h

API_KEY_SECRET=dev-api-key-secret-change-in-production

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_BURST=20

CACHE_TTL_SECONDS=300
CACHE_PREFIX=feature_toggle

LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### Adım 4: Veritabanını Oluşturma

```bash
# PostgreSQL'de veritabanını oluştur (eğer yoksa)
psql -U postgres -c "CREATE DATABASE feature_toggle_db;"
```

### Adım 5: Migration'ları Çalıştırın

```bash
npm run migrate:latest
```

### Adım 6: Uygulamayı Başlatın

**Development Mode (Hot Reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

**Beklenen Çıktı:**
```
Server is running on port 3000
```

---

## 🔌 API'lere Erişim Örnekleri

### 1. Health Check

```bash
# cURL
curl http://localhost:3000/health

# PowerShell
Invoke-RestMethod -Uri http://localhost:3000/health -Method Get
```

### 2. JWT Token Alma (Login)

```bash
# cURL
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"123e4567-e89b-12d3-a456-426614174000\",\"tenantId\":\"123e4567-e89b-12d3-a456-426614174001\"}"

# PowerShell
$body = @{
    userId = "123e4567-e89b-12d3-a456-426614174000"
    tenantId = "123e4567-e89b-12d3-a456-426614174001"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $body -ContentType "application/json"
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

**Token'ı değişkene kaydedin:**
```bash
# Bash/Linux/Mac
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"123e4567-e89b-12d3-a456-426614174000","tenantId":"123e4567-e89b-12d3-a456-426614174001"}' \
  | jq -r '.data.accessToken')

# PowerShell
$response = Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $body -ContentType "application/json"
$TOKEN = $response.data.accessToken
```

### 3. Feature Flags Listesi

```bash
# cURL
curl -X GET "http://localhost:3000/api/v1/features?tenant=123e4567-e89b-12d3-a456-426614174001&env=dev" \
  -H "Authorization: Bearer $TOKEN"

# PowerShell
$headers = @{
    Authorization = "Bearer $TOKEN"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/features?tenant=123e4567-e89b-12d3-a456-426614174001&env=dev" -Method Get -Headers $headers
```

### 4. Feature Flag Oluşturma/Güncelleme

```bash
# cURL
curl -X POST http://localhost:3000/api/v1/features \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "123e4567-e89b-12d3-a456-426614174001",
    "feature_id": "123e4567-e89b-12d3-a456-426614174002",
    "env": "dev",
    "enabled": true,
    "strategy_type": "boolean"
  }'

# PowerShell
$featureBody = @{
    tenant_id = "123e4567-e89b-12d3-a456-426614174001"
    feature_id = "123e4567-e89b-12d3-a456-426614174002"
    env = "dev"
    enabled = $true
    strategy_type = "boolean"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/features -Method Post -Body $featureBody -ContentType "application/json" -Headers $headers
```

### 5. Feature Flag Silme

```bash
# cURL
curl -X DELETE "http://localhost:3000/api/v1/features/123e4567-e89b-12d3-a456-426614174003" \
  -H "Authorization: Bearer $TOKEN"

# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/features/123e4567-e89b-12d3-a456-426614174003" -Method Delete -Headers $headers
```

### 6. Audit Logs

```bash
# cURL
curl -X GET "http://localhost:3000/api/v1/audit-logs?tenant=123e4567-e89b-12d3-a456-426614174001&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/audit-logs?tenant=123e4567-e89b-12d3-a456-426614174001&page=1&limit=10" -Method Get -Headers $headers
```

### 7. Environment Promotion

```bash
# cURL
curl -X POST http://localhost:3000/api/v1/promote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "123e4567-e89b-12d3-a456-426614174001",
    "source_env": "dev",
    "target_env": "staging",
    "dry_run": true
  }'

# PowerShell
$promoteBody = @{
    tenant_id = "123e4567-e89b-12d3-a456-426614174001"
    source_env = "dev"
    target_env = "staging"
    dry_run = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/v1/promote -Method Post -Body $promoteBody -ContentType "application/json" -Headers $headers
```

### 8. Metrics

```bash
# Prometheus format
curl -X GET "http://localhost:3000/metrics" \
  -H "Authorization: Bearer $TOKEN"

# JSON format
curl -X GET "http://localhost:3000/metrics/json" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🧪 Test Senaryosu (Tam Akış)

### 1. Token Alın

```bash
# PowerShell
$loginBody = @{
    userId = "user-123"
    tenantId = "tenant-123"
    email = "test@example.com"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $loginBody -ContentType "application/json"
$TOKEN = $loginResponse.data.accessToken
Write-Host "Token: $TOKEN"
```

### 2. Feature Flag Oluşturun

```bash
# PowerShell
$headers = @{ Authorization = "Bearer $TOKEN" }

$createBody = @{
    tenant_id = "tenant-123"
    feature_id = "feature-123"
    env = "dev"
    enabled = $true
    strategy_type = "boolean"
} | ConvertTo-Json

$createResponse = Invoke-RestMethod -Uri http://localhost:3000/api/v1/features -Method Post -Body $createBody -ContentType "application/json" -Headers $headers
Write-Host "Created: $($createResponse | ConvertTo-Json -Depth 5)"
```

### 3. Feature Flags Listesini Alın

```bash
# PowerShell
$listResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/features?tenant=tenant-123&env=dev" -Method Get -Headers $headers
Write-Host "Feature Flags: $($listResponse | ConvertTo-Json -Depth 5)"
```

### 4. Audit Logs'u Kontrol Edin

```bash
# PowerShell
$auditResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/audit-logs?tenant=tenant-123" -Method Get -Headers $headers
Write-Host "Audit Logs: $($auditResponse | ConvertTo-Json -Depth 5)"
```

---

## 🛠️ Troubleshooting

### Port Zaten Kullanılıyor

```bash
# Port'u değiştirin (.env dosyasında)
PORT=3001

# Veya kullanan process'i bulun ve durdurun
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Bağlantı Hatası

```bash
# PostgreSQL'in çalıştığını kontrol edin
# Windows
Get-Service postgresql*

# Docker
docker ps | grep postgres
```

### Redis Bağlantı Hatası

```bash
# Redis'in çalıştığını kontrol edin
# Docker
docker ps | grep redis

# Test
redis-cli ping
# Veya Docker içinde
docker exec -it feature-toggle-redis redis-cli ping
```

### Migration Hataları

```bash
# Migration'ları sıfırlayın (DİKKAT: Veri kaybı olur!)
npm run migrate:rollback

# Tekrar çalıştırın
npm run migrate:latest
```

---

## 📚 Daha Fazla Bilgi

- **API Dokümantasyonu:** http://localhost:3000/api-docs
- **Deployment Rehberi:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Production Checklist:** [PRODUCTION_READY.md](./PRODUCTION_READY.md)

---

## 🎯 Hızlı Test Script'i (PowerShell)

Aşağıdaki script'i `test-api.ps1` olarak kaydedip çalıştırabilirsiniz:

```powershell
# test-api.ps1
$baseUrl = "http://localhost:3000"

Write-Host "1. Health Check..." -ForegroundColor Green
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
Write-Host ($health | ConvertTo-Json -Depth 3)

Write-Host "`n2. Login..." -ForegroundColor Green
$loginBody = @{
    userId = "user-123"
    tenantId = "tenant-123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$TOKEN = $loginResponse.data.accessToken
Write-Host "Token alındı: $($TOKEN.Substring(0, 20))..."

$headers = @{ Authorization = "Bearer $TOKEN" }

Write-Host "`n3. Feature Flags Listesi..." -ForegroundColor Green
$features = Invoke-RestMethod -Uri "$baseUrl/api/v1/features?tenant=tenant-123&env=dev" -Method Get -Headers $headers
Write-Host ($features | ConvertTo-Json -Depth 3)

Write-Host "`n✅ Test tamamlandı!" -ForegroundColor Green
```

Çalıştırma:
```powershell
.\test-api.ps1
```

