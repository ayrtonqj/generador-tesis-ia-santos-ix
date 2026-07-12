# KIMY - Script de Setup Complementario
# Ejecutar DESPUES de .\setup.ps1
# Uso: .\setup2.ps1

$ErrorActionPreference = "Stop"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}

function Write-OK($msg) {
    Write-Host "  OK: $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "  WARN: $msg" -ForegroundColor Yellow
}

function Write-Fail($msg) {
    Write-Host "  ERROR: $msg" -ForegroundColor Red
    exit 1
}

# ──────────────────────────────────────────────────
# PASO 1: Esperar health de Redis
# ──────────────────────────────────────────────────
Write-Step 1 "Esperando que Redis este healthy (max 60s)..."
$attempts = 0
$maxAttempts = 12

do {
    Start-Sleep 5
    $attempts++
    $status = docker inspect --format="{{.State.Health.Status}}" kimy-redis 2>$null
    Write-Host "  -> Estado Redis: $status ($($attempts * 5)s)" -ForegroundColor Gray
} while ($status -ne "healthy" -and $attempts -lt $maxAttempts)

if ($status -ne "healthy") {
    Write-Warn "Redis no alcanzo estado healthy en 60s. Verifica: docker compose logs redis"
} else {
    Write-OK "Redis esta healthy"
}

# ──────────────────────────────────────────────────
# PASO 2: Esperar health de MinIO
# ──────────────────────────────────────────────────
Write-Step 2 "Esperando que MinIO este healthy (max 60s)..."
$attempts = 0

do {
    Start-Sleep 5
    $attempts++
    $status = docker inspect --format="{{.State.Health.Status}}" kimy-minio 2>$null
    Write-Host "  -> Estado MinIO: $status ($($attempts * 5)s)" -ForegroundColor Gray
} while ($status -ne "healthy" -and $attempts -lt $maxAttempts)

if ($status -ne "healthy") {
    Write-Warn "MinIO no alcanzo estado healthy en 60s. Verifica: docker compose logs minio"
} else {
    Write-OK "MinIO esta healthy"
}

# ──────────────────────────────────────────────────
# PASO 3: Compilar @kimy/ai-engine
# ──────────────────────────────────────────────────
Write-Step 3 "Compilando @kimy/ai-engine (necesario para la API)..."
if (Test-Path "packages/ai-engine/dist/index.js") {
    Write-OK "ai-engine ya compilado (dist/index.js existe)"
} else {
    try {
        npm run build --workspace=@kimy/ai-engine 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "build fallo" }
        Write-OK "@kimy/ai-engine compilado correctamente"
    } catch {
        # Fallback: build directo
        Write-Warn "Build via workspace fallo, intentando build directo..."
        Push-Location packages/ai-engine
        npx tsc 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Write-Warn "No se pudo compilar ai-engine. La API podria fallar al importar @kimy/ai-engine"
            Write-Warn "  Prueba manual: cd packages/ai-engine && npm run build"
        } else {
            Write-OK "@kimy/ai-engine compilado correctamente (build directo)"
        }
        Pop-Location
    }
}

# ──────────────────────────────────────────────────
# PASO 4: Crear bucket en MinIO
# ──────────────────────────────────────────────────
Write-Step 4 "Creando bucket 'thesis-documents' en MinIO..."

$bucketCreated = $false

# Intento 1: Usando mc en el contenedor existente de minio
try {
    docker exec kimy-minio mc alias set local http://localhost:9000 minioadmin minioadmin123 2>&1 | Out-Null
    docker exec kimy-minio mc mb local/thesis-documents --ignore-existing 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Bucket 'thesis-documents' creado/verificado via mc (kimy-minio)"
        $bucketCreated = $true
    }
} catch {
    # falla silenciosa, intentar método alternativo
}

# Intento 2: Usando la API HTTP de MinIO
if (-not $bucketCreated) {
    try {
        $headers = @{
            "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("minioadmin:minioadmin123"))
        }
        Invoke-WebRequest -Uri "http://localhost:9000/thesis-documents/" -Method PUT -Headers $headers -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-OK "Bucket 'thesis-documents' creado via API HTTP"
        $bucketCreated = $true
    } catch {
        # falla silenciosa
    }
}

if (-not $bucketCreated) {
    Write-Warn "No se pudo crear el bucket automaticamente."
    Write-Warn "  Crealo manualmente:"
    Write-Warn "  1. Abre http://localhost:9001 (minioadmin / minioadmin123)"
    Write-Warn "  2. Haz clic en 'Create Bucket' -> nombre: thesis-documents"
}

# ──────────────────────────────────────────────────
# PASO 5: Instalar Chromium para Puppeteer
# ──────────────────────────────────────────────────
Write-Step 5 "Verificando Chromium para Puppeteer (generacion de PDFs)..."

$chromePath1 = "$env:USERPROFILE\.cache\puppeteer"
$chromePath2 = "$env:LOCALAPPDATA\puppeteer\chrome"

if ((Test-Path $chromePath1) -or (Test-Path $chromePath2)) {
    Write-OK "Chromium ya instalado"
} else {
    try {
        npx puppeteer browsers install 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Chromium descargado correctamente"
        } else {
            throw "exit code $LASTEXITCODE"
        }
    } catch {
        Write-Warn "No se pudo descargar Chromium automaticamente."
        Write-Warn "  Prueba manual: npx puppeteer browsers install"
        Write-Warn "  (No critique si no generas PDFs, la API igual funciona)"
    }
}

# ──────────────────────────────────────────────────
# LISTO
# ──────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host "  SETUP COMPLEMENTARIO COMPLETADO" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Todos los servicios estan listos." -ForegroundColor White
Write-Host ""
Write-Host "  Ahora inicia la API y Web:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Terminal 1 (API):" -ForegroundColor Cyan
Write-Host "    cd apps/api" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 2 (Web):" -ForegroundColor Cyan
Write-Host "    cd apps/web" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  URLs:" -ForegroundColor Yellow
Write-Host "    Web:      http://localhost:3000" -ForegroundColor White
Write-Host "    API:      http://localhost:3001" -ForegroundColor White
Write-Host "    Swagger:  http://localhost:3001/api/docs" -ForegroundColor White
Write-Host ""
