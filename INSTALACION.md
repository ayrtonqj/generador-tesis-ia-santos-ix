# Instalación de KIMY — Desde Cero

> Sistema de Revisión Inteligente de Tesis
> Stack: Turborepo · Next.js 15 · NestJS 11 · PostgreSQL 16 + pgvector · Redis · MinIO

---

## Requisitos del Sistema

| Requisito | Versión Mínima | Cómo verificar |
|-----------|---------------|----------------|
| **Windows** | 10/11 Pro (WSL2) | `wsl --status` |
| **Docker Desktop** | 4.x | `docker --version` |
| **Node.js** | 20.x | `node --version` |
| **npm** | 10.x | `npm --version` |
| **Git** | Cualquiera | `git --version` |
| **PowerShell** | 5.1+ | `$PSVersionTable.PSVersion` |

> **⚠️ Nota para Windows:** El proyecto está optimizado para desarrollo nativo en Windows (no WSL). Docker Desktop solo se usa para PostgreSQL, Redis y MinIO. La API y Web corren directamente en Node.js local.

---

## Paso 1 — Clonar el Repositorio

```powershell
git clone <url-del-repositorio> kimy
cd kimy
```

---

## Paso 2 — Configurar Variables de Entorno

El script `setup.ps1` copia `.env.example` → `.env` automáticamente, pero puedes hacerlo manualmente:

```powershell
Copy-Item ".env.example" ".env"
```

Edita `.env` si necesitas cambiar puertos, credenciales de base de datos, o agregar API keys de IA:

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | API key de OpenAI (GPT-4o) | Sí (o DeepSeek/Gemini/Groq) |
| `DEEPSEEK_API_KEY` | API key de DeepSeek | Opcional (fallback) |
| `GEMINI_API_KEY` | API key de Gemini | Opcional (fallback) |
| `JWT_SECRET` | Secreto para firmar JWT | Sí (ya tiene valor por defecto) |
| `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` | Servidor de correo | Solo si envías actas por email |

---

## Paso 3 — Ejecutar Setup Completo

### 3a. Script original (infraestructura + dependencias + base de datos)

```powershell
.\setup.ps1
```

Este script:
1. Copia `.env` → `packages/database/.env`
2. Levanta PostgreSQL, Redis y MinIO con Docker
3. Espera que PostgreSQL esté healthy
4. Instala dependencias npm del monorepo
5. Genera el cliente Prisma
6. Sincroniza el esquema con la BD
7. Siembra datos de prueba (usuarios, programas)

### 3b. Script complementario (build + bucket + Puppeteer)

```powershell
.\setup2.ps1
```

Este script complementario:
1. Espera que Redis y MinIO estén healthy
2. Compila `@kimy/ai-engine` (necesario para la API)
3. Crea el bucket `thesis-documents` en MinIO
4. Descarga Chromium para Puppeteer (generación de PDFs)

> **¿Por qué dos scripts?** `setup.ps1` es el original y se deja intacto. `setup2.ps1` contiene los pasos que faltaban y se ejecuta después.

---

## Paso 4 — Iniciar la API

```powershell
# Terminal 1
cd apps/api
npm run dev
```

La API arrancará en `http://localhost:3001`.
- Swagger docs: `http://localhost:3001/api/docs`
- Health check: `http://localhost:3001/api/health`

> **⚠️ Error EPERM:** Si ves `EPERM: rename query_engine-windows.dll.node`, es un falso positivo de Windows. Detén el watcher (`Ctrl+C`) y ejecuta de nuevo.

---

## Paso 5 — Iniciar el Frontend Web

```powershell
# Terminal 2
cd apps/web
npm run dev
```

La web arrancará en `http://localhost:3000`.

---

## Paso 6 (Opcional) — App Móvil

```powershell
# Terminal 3
cd apps/mobile
npx expo start
```

Escanea el QR con Expo Go en tu celular. Asegúrate que el celular esté en la misma red Wi-Fi que el PC.

Si la API no responde desde el celular, edita `apps/mobile/app.json` y cambia `API_URL` por la IP local de tu PC:

```json
"API_URL": "http://192.168.x.x:3001"
```

---

## Credenciales de Prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `ayrton@kimy.edu` | `Kimy2026!` |
| Administrador | `admin@kimy.edu` | `Kimy2026!` |
| Coordinador | `coordinador@kimy.edu` | `Kimy2026!` |
| Asesor | `asesor1@kimy.edu` | `Kimy2026!` |
| Asesor | `asesor2@kimy.edu` | `Kimy2026!` |
| Estudiante | `estudiante1@kimy.edu` | `Kimy2026!` |
| Estudiante | `estudiante2@kimy.edu` | `Kimy2026!` |
| Estudiante | `estudiante3@kimy.edu` | `Kimy2026!` |

---

## Puertos y Servicios

| Servicio | Puerto | URL |
|----------|--------|-----|
| Web (Next.js) | 3000 | http://localhost:3000 |
| API (NestJS) | 3001 | http://localhost:3001 |
| Swagger Docs | 3001 | http://localhost:3001/api/docs |
| PostgreSQL | 5434 | localhost:5434 (kimy / kimy_secret_2026) |
| Redis | 6379 | localhost |
| MinIO API | 9000 | minioadmin / minioadmin123 |
| MinIO Console | 9001 | http://localhost:9001 |

---

## Troubleshooting

### Error: `EPERM: rename query_engine-windows.dll.node`

**Causa:** Race condition de Windows al generar el cliente Prisma.
**Solución:** Detén el watcher de NestJS, ejecuta de nuevo:
```powershell
npx prisma generate --schema=packages/database/prisma/schema.prisma
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

### Error: `PrismaClientValidationError: Invalid value for argument status`

**Causa:** El frontend envió `status=all` que no es un valor válido del enum.
**Solución:** Ya corregido en el backend (filtra `all` antes de pasar a Prisma).

### Error: `connect ECONNREFUSED 127.0.0.1:5434`

**Causa:** PostgreSQL no está corriendo.
**Solución:**
```powershell
docker compose up -d postgres
docker compose logs postgres
```

### Error: `Bucket not found: thesis-documents`

**Causa:** MinIO no tiene el bucket creado.
**Solución:** Ejecuta `setup2.ps1` o créalo manualmente en http://localhost:9001.

### Error: 401 al iniciar sesión pero las credenciales son correctas

**Causa:** Posible problema con JWT_SECRET o base de datos no sincronizada.
**Solución:**
```powershell
npm run db:push --workspace=packages/database
npm run db:seed --workspace=packages/database
```

### La web carga pero la API devuelve 404

**Causa:** `NEXT_PUBLIC_API_URL` apunta a puerto incorrecto.
**Solución:** Verifica en `.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Puppeteer falla al generar PDF

**Causa:** Chromium no está instalado.
**Solución:**
```powershell
npx puppeteer browsers install
```
O usa `.\setup2.ps1` que lo instala automáticamente.

---

## Reconstruir desde Cero (Reset Total)

```powershell
docker compose down -v        # Elimina volúmenes (BD, Redis, MinIO)
docker compose up -d postgres redis minio
.\setup.ps1
.\setup2.ps1
```
