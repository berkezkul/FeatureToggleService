# Zebra Electronics Feature Toggle Service

Multi-tenant Feature Toggle Service - Node.js + TypeScript + PostgreSQL + Redis

## 📋 Proje Hakkında

Bu proje, Zebra Engineering tarafından talep edilen ve birden çok kiracının (tenant) özellik açma/kapama (feature toggle) durumlarını ölçeklenebilir ve güvenli bir şekilde yönetmesine olanak tanıyan **Basitleştirilmiş Özellik Açma/Kapama Servisi**'dir.

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12
- Redis >= 6

### Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Environment değişkenlerini ayarlayın:
```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

3. Veritabanını oluşturun ve migration'ları çalıştırın:
```bash
npm run migrate:latest
```

4. Geliştirme modunda çalıştırın:
```bash
npm run dev
```

5. Production build:
```bash
npm run build
npm start
```

## 📁 Proje Yapısı

```
src/
├── config/          # Konfigürasyon dosyaları
├── controllers/     # API controller'ları
├── services/        # İş mantığı servisleri
├── models/          # Veritabanı modelleri
├── middleware/      # Express middleware'leri
├── routes/          # API route tanımları
├── utils/           # Yardımcı fonksiyonlar
├── types/           # TypeScript tip tanımları
└── app.ts           # Ana uygulama dosyası
```

## 🧪 Test

```bash
# Tüm testleri çalıştır
npm test

# Watch modu
npm run test:watch

# Coverage raporu
npm run test:coverage
```

## 📝 Migration

```bash
# Yeni migration oluştur
npm run migrate:make migration_name

# Migration'ları uygula
npm run migrate:latest

# Migration'ı geri al
npm run migrate:rollback
```

## 📚 API Dokümantasyonu

API dokümantasyonu Swagger UI ile sağlanmaktadır:

```bash
# Swagger UI'ya erişim
http://localhost:3000/api-docs

# Swagger JSON
http://localhost:3000/api-docs/json
```

## 🐳 Docker Deployment

### Quick Start

```bash
# Production deployment
docker-compose up -d

# Development deployment
docker-compose -f docker-compose.dev.yml up -d
```

Detaylı deployment bilgileri için [DEPLOYMENT.md](./DEPLOYMENT.md) dosyasına bakın.

## 📊 Monitoring

### Health Check
```bash
GET /health
```

### Metrics (Prometheus)
```bash
GET /metrics          # Prometheus format
GET /metrics/json     # JSON format
```

### API Documentation
```bash
GET /api-docs         # Swagger UI
```

## 🚀 Hızlı Başlangıç

Detaylı adım adım rehber için [QUICK_START.md](./QUICK_START.md) dosyasına bakın.

**Hızlı Test:**
```powershell
# PowerShell test script'i
.\test-api.ps1
```

## 🗺️ Yol Haritası

Detaylı yol haritası için [ROADMAP.md](./ROADMAP.md) dosyasına bakın.

## 📄 Lisans

ISC
