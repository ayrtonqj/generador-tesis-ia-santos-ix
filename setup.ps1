# KIMY - Script de Setup Completo
# Uso: .\setup.ps1

$ErrorActionPreference = "Stop"

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}

function Write-OK($msg) {
    Write-Host "  OK: $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "  ERROR: $msg" -ForegroundColor Red
    exit 1
}

# PASO 1: Variables de entorno
Write-Step 1 "Configurando variables de entorno..."

if (-Not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-OK ".env creado desde .env.example"
} else {
    Write-OK ".env ya existe"
}

Copy-Item -Path ".env" -Destination "packages/database/.env" -Force
Write-OK "packages/database/.env sincronizado"

# PASO 2: Levantar infraestructura (PostgreSQL, Redis, MinIO)
Write-Step 2 "Levantando infraestructura (PostgreSQL, Redis, MinIO)..."
docker compose up -d postgres redis minio
if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up -d fallo" }
Write-OK "Infraestructura iniciada"

# PASO 3: Esperar que Postgres este HEALTHY
Write-Step 3 "Esperando que PostgreSQL este listo (max 60s)..."
$attempts = 0
$maxAttempts = 12

do {
    Start-Sleep 5
    $attempts++
    $status = docker inspect --format="{{.State.Health.Status}}" kimy-postgres 2>$null
    Write-Host "  -> Estado Postgres: $status ($($attempts * 5)s)" -ForegroundColor Gray
} while ($status -ne "healthy" -and $attempts -lt $maxAttempts)

if ($status -ne "healthy") {
    Write-Fail "PostgreSQL no alcanzo estado healthy en 60 segundos. Revisa: docker compose logs postgres"
}
Write-OK "PostgreSQL esta healthy y listo"

# PASO 4: Instalar dependencias
Write-Step 4 "Instalando dependencias del monorepo..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install fallo" }
Write-OK "Dependencias instaladas"

# PASO 5: Generar cliente Prisma (host Windows - para autocompletado)
Write-Step 5 "Generando cliente Prisma para Windows..."
npm run db:generate
if ($LASTEXITCODE -ne 0) { Write-Fail "npm run db:generate fallo" }
Write-OK "Cliente Prisma generado"

# PASO 6: Sincronizar esquema con la base de datos
Write-Step 6 "Sincronizando esquema de base de datos (db:push)..."
npm run db:push
if ($LASTEXITCODE -ne 0) { Write-Fail "npm run db:push fallo. Verifica que Docker este corriendo y el puerto 5434 este libre" }
Write-OK "Esquema sincronizado con PostgreSQL"

# PASO 7: Sembrar datos de prueba
Write-Step 7 "Sembrando base de datos con usuarios de prueba..."
npm run db:seed
if ($LASTEXITCODE -ne 0) { Write-Fail "npm run db:seed fallo" }
Write-OK "Base de datos sembrada"

# LISTO
Write-Host ""
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host "  INFRAESTRUCTURA LISTA" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  PostgreSQL, Redis y MinIO estan corriendo en Docker." -ForegroundColor White
Write-Host ""
Write-Host "  Para iniciar, abre las siguientes terminales:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Terminal 1 (API):" -ForegroundColor Cyan
Write-Host "    npm run dev --workspace=@kimy/api" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 2 (Web):" -ForegroundColor Cyan
Write-Host "    npm run dev --workspace=@kimy/web" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 3 (App Móvil - opcional):" -ForegroundColor Cyan
Write-Host "    cd apps/mobile" -ForegroundColor White
Write-Host "    npx expo start" -ForegroundColor White
Write-Host ""
Write-Host "  URLs cuando esten corriendo:" -ForegroundColor Yellow
Write-Host "    Web:      http://localhost:3000" -ForegroundColor White
Write-Host "    API:      http://localhost:3001" -ForegroundColor White
Write-Host "    Swagger:  http://localhost:3001/api/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Credenciales de prueba (password: Kimy2026!):" -ForegroundColor Yellow
Write-Host "    Admin:        admin@kimy.edu" -ForegroundColor Gray
Write-Host "    Coordinador:  coordinador@kimy.edu" -ForegroundColor Gray
Write-Host "    Asesor:       asesor1@kimy.edu" -ForegroundColor Gray
Write-Host "    Estudiante:   estudiante1@kimy.edu" -ForegroundColor Gray
Write-Host ""
