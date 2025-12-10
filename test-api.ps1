# Feature Toggle Service API Test Script
# PowerShell script to test all API endpoints

$baseUrl = "http://localhost:3000"
$tenantId = "tenant-$(New-Guid)"
$userId = "user-$(New-Guid)"
$featureId = "feature-$(New-Guid)"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Feature Toggle Service API Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Health Check
Write-Host "1. Health Check..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "   ✅ Status: $($health.status)" -ForegroundColor Green
    Write-Host "   ✅ Database: $($health.checks.database)" -ForegroundColor Green
    Write-Host "   ✅ Redis: $($health.checks.redis)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Login
Write-Host "2. Login (Get JWT Token)..." -ForegroundColor Green
try {
    $loginBody = @{
        userId = $userId
        tenantId = $tenantId
        email = "test@example.com"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $TOKEN = $loginResponse.data.accessToken
    Write-Host "   ✅ Token alındı" -ForegroundColor Green
    Write-Host "   Token (ilk 30 karakter): $($TOKEN.Substring(0, 30))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{ Authorization = "Bearer $TOKEN" }

Write-Host ""

# 3. Create Feature Flag
Write-Host "3. Create Feature Flag..." -ForegroundColor Green
try {
    $createBody = @{
        tenant_id = $tenantId
        feature_id = $featureId
        env = "dev"
        enabled = $true
        strategy_type = "boolean"
    } | ConvertTo-Json

    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/features" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers
    Write-Host "   ✅ Feature flag oluşturuldu" -ForegroundColor Green
    Write-Host "   ID: $($createResponse.data.id)" -ForegroundColor Gray
    Write-Host "   Enabled: $($createResponse.data.enabled)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Feature flag creation failed: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# 4. List Feature Flags
Write-Host "4. List Feature Flags..." -ForegroundColor Green
try {
    $listResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/features?tenant=$tenantId&env=dev" -Method Get -Headers $headers
    Write-Host "   ✅ Feature flags listelendi" -ForegroundColor Green
    Write-Host "   Toplam: $($listResponse.data.pagination.total)" -ForegroundColor Gray
    Write-Host "   Sayfa: $($listResponse.data.pagination.page)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ List feature flags failed: $_" -ForegroundColor Red
}

Write-Host ""

# 5. Get Audit Logs
Write-Host "5. Get Audit Logs..." -ForegroundColor Green
try {
    $auditResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/audit-logs?tenant=$tenantId&page=1&limit=5" -Method Get -Headers $headers
    Write-Host "   ✅ Audit logs listelendi" -ForegroundColor Green
    Write-Host "   Toplam: $($auditResponse.data.pagination.total)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Get audit logs failed: $_" -ForegroundColor Red
}

Write-Host ""

# 6. Create Feature with Percentage Strategy
Write-Host "6. Create Feature Flag (Percentage Strategy)..." -ForegroundColor Green
try {
    $percentageFeatureId = "feature-$(New-Guid)"
    $percentageBody = @{
        tenant_id = $tenantId
        feature_id = $percentageFeatureId
        env = "dev"
        enabled = $true
        strategy_type = "percentage"
        strategy_config = @{
            percentage = @{
                percentage = 50
            }
        }
    } | ConvertTo-Json -Depth 5

    $percentageResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/features" -Method Post -Body $percentageBody -ContentType "application/json" -Headers $headers
    Write-Host "   ✅ Percentage strategy feature flag oluşturuldu" -ForegroundColor Green
    Write-Host "   Strategy: $($percentageResponse.data.strategy_type)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Percentage strategy creation failed: $_" -ForegroundColor Red
}

Write-Host ""

# 7. Test with User ID (Strategy Evaluation)
Write-Host "7. Feature Flags with User ID (Strategy Evaluation)..." -ForegroundColor Green
try {
    $testUserId = "test-user-123"
    $evalResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/features?tenant=$tenantId&env=dev&userId=$testUserId" -Method Get -Headers $headers
    Write-Host "   ✅ Strategy evaluation yapıldı" -ForegroundColor Green
    if ($evalResponse.data.data.Count -gt 0) {
        $firstFlag = $evalResponse.data.data[0]
        if ($firstFlag.evaluated) {
            Write-Host "   Evaluated: $($firstFlag.evaluated.enabled)" -ForegroundColor Gray
            Write-Host "   Reason: $($firstFlag.evaluated.reason)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Strategy evaluation failed: $_" -ForegroundColor Red
}

Write-Host ""

# 8. Environment Promotion (Dry Run)
Write-Host "8. Environment Promotion (Dry Run)..." -ForegroundColor Green
try {
    $promoteBody = @{
        tenant_id = $tenantId
        source_env = "dev"
        target_env = "staging"
        dry_run = $true
    } | ConvertTo-Json

    $promoteResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/promote" -Method Post -Body $promoteBody -ContentType "application/json" -Headers $headers
    Write-Host "   ✅ Promotion dry-run tamamlandı" -ForegroundColor Green
    Write-Host "   Will promote: $($promoteResponse.data.promoted)" -ForegroundColor Gray
    Write-Host "   Conflicts: $($promoteResponse.data.conflicts.Count)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Promotion failed: $_" -ForegroundColor Red
}

Write-Host ""

# 9. Get Metrics
Write-Host "9. Get Metrics..." -ForegroundColor Green
try {
    $metricsResponse = Invoke-RestMethod -Uri "$baseUrl/metrics/json" -Method Get -Headers $headers
    Write-Host "   ✅ Metrics alındı" -ForegroundColor Green
    Write-Host "   Metrics sayısı: $($metricsResponse.Count)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Get metrics failed: $_" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Özeti" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tenant ID: $tenantId" -ForegroundColor Yellow
Write-Host "User ID: $userId" -ForegroundColor Yellow
Write-Host "Feature ID: $featureId" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Tüm testler tamamlandı!" -ForegroundColor Green
Write-Host ""
Write-Host "API Dokümantasyonu: $baseUrl/api-docs" -ForegroundColor Cyan

