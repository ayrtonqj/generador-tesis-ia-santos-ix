# KIMY — Guía Completa para el Agente de IA

## 📋 Descripción del Proyecto

KIMY es un sistema de revisión inteligente de tesis que usa IA (OpenAI/Groq/Gemini/DeepSeek) para analizar avances de tesis, detectar plagio, validar referencias bibliográficas (CrossRef), y generar actas de revisión en PDF.

**Stack:** Turborepo (npm workspaces) · Next.js 15 (Web) · NestJS 11 (API) · PostgreSQL 16 + pgvector · Prisma 6 · Redis + BullMQ · MinIO/S3 · Expo SDK 54 (Mobile)

---

## 🏗️ Estructura del Proyecto

```
kimy/
├── apps/
│   ├── api/                    # NestJS backend (port 3001)
│   │   └── src/
│   │       ├── advances/       # Gestión de avances de tesis
│   │       ├── ai-analysis/    # Pipeline de IA (análisis, feedback)
│   │       ├── auth/           # JWT, 2FA, login, recovery
│   │       ├── dashboard/      # KPIs y métricas
│   │       ├── fine-tuning/    # Export JSONL + activación de modelos
│   │       ├── notifications/  # Push (Expo) + in-app
│   │       ├── orcid/          # Integración OAuth ORCID
│   │       ├── plagiarism/     # pgvector + Copyleaks
│   │       ├── prisma/         # PrismaService (singleton)
│   │       ├── programs/       # Programas académicos
│   │       ├── references/     # Validación CrossRef
│   │       ├── reports/        # Generación de PDF/HTML
│   │       ├── review/         # Revisión humana
│   │       ├── settings/       # Configuración del sistema
│   │       ├── storage/        # MinIO S3
│   │       ├── templates/      # Plantillas de tesis
│   │       ├── users/          # Gestión de usuarios
│   │       ├── app.module.ts   # 15 módulos + BullModule
│   │       └── main.ts         # Puerto 3001, CORS, Swagger, ValidationPipe
│   ├── mobile/                 # Expo React Native
│   │   └── src/
│   │       ├── screens/auth/   # LoginScreen, TwoFactorScreen
│   │       ├── navigation/     # RootNavigator, AuthStack
│   │       ├── hooks/          # useAuth
│   │       ├── services/       # API calls
│   │       └── constants/
│   └── web/                    # Next.js 15 (port 3000)
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── login/      # Login con modal 2FA
│           │   ├── dashboard/  # advances/, settings/, bulk-review/, etc.
│           │   └── forgot-password/
│           ├── components/     # ReportPreviewModal y otros
│           └── lib/
│               ├── api.ts      # Axios con interceptor 401
│               └── utils.ts
├── packages/
│   ├── ai-engine/              # Pipeline de IA (LangChain + OpenAI SDK + Gemini SDK)
│   │   └── src/
│   │       ├── pipeline/       # analysis.pipeline.ts (todos los providers)
│   │       ├── prompts/        # EVALUATION, REFERENCES, STRUCTURE, DETAILED_FEEDBACK
│   │       └── types.ts        # AnalysisResult, DetailedFeedback, etc.
│   ├── database/               # Prisma schema + seeds
│   │   └── prisma/
│   │       └── schema.prisma   # ~550 líneas, 20+ modelos
│   └── shared-types/           # Interfaces compartidas TypeScript
├── docker-compose.yml          # postgres:5434, redis:6379, minio:9000/9001
├── turbo.json                  # Pipeline de Turborepo
├── .env.example                # Template de variables de entorno
└── README.md                   # Documentación completa (708 líneas)
```

---

## 🚀 Flujo de Desarrollo

### Infraestructura (Docker)
```powershell
docker compose up -d postgres redis minio
```

### Desarrollo nativo (recomendado, evita overhead de bind mounts)
```powershell
# Terminal 1 — API (NestJS, watch mode)
cd apps/api && npm run dev

# Terminal 2 — Web (Next.js)
cd apps/web && npm run dev

# Terminal 3 — Mobile (Expo, opcional)
cd apps/mobile && npx expo start

# Packages — rebuild después de cambios
cd packages/ai-engine && npm run build
```

### Comandos de base de datos
```powershell
# Regenerar cliente Prisma (después de editar schema)
npx prisma generate --schema=packages/database/prisma/schema.prisma

# Sincronizar schema con la BD (después de generate)
npx prisma db push --schema=packages/database/prisma/schema.prisma

# Sembrar datos iniciales
cd packages/database && npx tsx seed.ts
```

**⚠️ IMPORTANTE:** Ambos pasos (`generate` + `db push`) son necesarios después de cada cambio en `schema.prisma`. El error `EPERM: rename query_engine-windows.dll.node` es inofensivo (Windows race condition). Detener el watcher de NestJS y reintentar.

---

## 🔌 Puertos y Servicios

| Servicio      | Puerto | URL                          |
|---------------|--------|------------------------------|
| Web (Next.js) | 3000   | http://localhost:3000        |
| API (NestJS)  | 3001   | http://localhost:3001/api    |
| Swagger Docs  | 3001   | http://localhost:3001/api/docs |
| PostgreSQL    | 5434   | kimy:kimy_secret_2026@localhost:5434/kimy_thesis |
| Redis         | 6379   | localhost                    |
| MinIO API     | 9000   | minioadmin / minioadmin123   |
| MinIO Console | 9001   | http://localhost:9001        |

---

## 🧠 Pipeline de IA (analysis.pipeline.ts)

### Proveedores disponibles
1. **OpenAI** — `gpt-4o` / `gpt-4o-mini` (default)
2. **Groq** — `llama-3.3-70b-versatile` (API compatible con OpenAI)
3. **Gemini** — `gemini-2.0-flash` (SDK nativo de Google)
4. **DeepSeek** — `deepseek-chat` (API compatible con OpenAI)
5. **Claude** — `claude-3-5-sonnet-20241022` (SDK nativo de Anthropic)
6. **Minimax** — `MiniMax-Text-01` (API compatible con OpenAI)

### Cadena de fallback (7 niveles)
Cuando `analyzeAdvance()` se ejecuta:
1. Intenta el proveedor configurado (DB `SystemSettings.aiProvider` o env `AI_PROVIDER`), con pipeline directo para cada provider (Groq, Claude, Minimax, Gemini, DeepSeek, OpenAI)
2. Si falla → DeepSeek (si no fue el primario)
3. Si falla → OpenAI (fallback genérico)
4. Si falla → Groq
5. Si falla → Gemini
6. Si falla → Claude
7. Si falla → Minimax
8. Si TODO falla → **Simulación** (datos mock)

### Detección de simulación
Si `analyzeAdvance()` detecta que NO hay API keys configuradas, salta directamente a `runSimulation()` sin intentar llamar a ningún LLM real.

### Variables de entorno para AI
| Env Var | Provider |
|---------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `GROQ_API_KEY` | Groq (OpenAI-compatible, se pasa como `openaiKey` con baseURL a Groq) |
| `GEMINI_API_KEY` | Gemini (SDK nativo de Google) |
| `DEEPSEEK_API_KEY` | DeepSeek (OpenAI-compatible) |
| `CLAUDE_API_KEY` | Claude (SDK nativo de Anthropic) |
| `MINIMAX_API_KEY` | Minimax (OpenAI-compatible) |
| `AI_PROVIDER` | `openai` \| `groq` \| `gemini` \| `deepseek` \| `claude` \| `minimax` |
| `AI_MODEL` | Modelo específico del provider |

---

## 🛠️ Arquitectura y Convenciones

### Errores HTTP — Regla crítica
| Excepción                     | HTTP | Efecto en Frontend                                      |
|-------------------------------|------|----------------------------------------------------------|
| `BadRequestException`         | 400  | Muestra mensaje de error en pantalla                     |
| `UnauthorizedException`       | 401  | **Cierra sesión automáticamente** (borra cookie, redirige a /login) |
| `ForbiddenException`          | 403  | Muestra error de permisos                                |

**NUNCA usar `UnauthorizedException` en:** `enable2fa`, `verify2fa`, `confirmEnable2fa`, `disable2fa`, ni en ningún endpoint de configuración de usuario. Usar `BadRequestException` en su lugar.

El interceptor en `apps/web/src/lib/api.ts:24` escucha status 401 y ejecuta:
```typescript
Cookies.remove('kimy_token');
Cookies.remove('kimy_user');
window.location.href = '/login';
```

### 2FA — Flujo correcto
1. **`POST /auth/2fa/enable`** → genera secreto TOTP, lo guarda en `temp2faSecrets` Map (TTL 10 min), devuelve QR + `secret.base32`
2. Usuario escanea QR con Google Authenticator (códigos TOTP basados en ese secreto)
3. **`POST /auth/2fa/confirm-enable`** → recupera el MISMO secreto del Map, verifica código contra él, persiste en DB
4. Se generan 8 backup codes (hasheados con bcrypt), se muestran una sola vez
5. Login: si `user.twoFactorSecret` existe, responde con `{ requires2fa: true, tempToken }` (JWT 5 min)
6. **`POST /auth/2fa/authenticate`** con `tempToken` + código → devuelve JWT real

**Archivo clave:** `apps/api/src/auth/auth.service.ts`
- `temp2faSecrets` Map (con limpieza cada 5 min)
- `loginAttempts` Map (rate limit: 5 intentos → bloqueo 15 min)
- `recoveryTokens` Map (para recovery de contraseña)

### Soft-delete de templates
No se eliminan registros físicamente. Se marca `isActive = false`. Esto preserva las evaluaciones existentes que referencia ese template.

### Upload de documentos
- Solo desde **Web** (mobile es read-only)
- Al subir: se encola `ai-analysis` en BullMQ → `analyzeAdvance()` se ejecuta automáticamente
- No hay paso de confirmación (el análisis se dispara inmediatamente)
- Después del análisis: se genera feedback detallado automáticamente + se encolan plagiarism y references

### Feedback detallado
- Se genera automáticamente al finalizar `analyzeAdvance()` (tanto en modo real como simulación)
- También se puede generar manualmente desde la pestaña "Feedback" en la UI
- Se guarda en `aiAnalysis.detailedFeedback` (columna `Json?` en Prisma)
- Se incluye en el acta PDF cuando existe
- En modo simulación: `generateSimulatedDetailedFeedback()` retorna datos mock completos

### Reportes / Acta PDF
**Archivo clave:** `apps/api/src/reports/reports.service.ts`
- `buildReportHTML()` genera el HTML completo del acta
- `generateAdvancePdf()` usa Puppeteer para convertir HTML a PDF (A4)
- Secciones del acta: scores, hallazgos, feedback detallado, revisión humana, plagio, referencias
- Endpoints:
  - `GET /api/reports/advance/:id/html` → HTML preview
  - `GET /api/reports/advance/:id/pdf` → PDF descargable
  - `POST /api/reports/advance/:id/send-email` → envía por correo
  - `POST /api/reports/batch-pdf` → ZIP con PDFs masivos
  - `POST /api/reports/batch-send-email` → emails masivos

### Frontend — Vista previa de reportes
**Componente:** `apps/web/src/components/ReportPreviewModal.tsx`
- Carga HTML via `GET /reports/advance/:id/html`
- Botones: "Descargar PDF", "Enviar por Correo", "Cerrar"
- Usado desde: Bulk Review (original), y páginas de detalle/revisión individual

---

## 🐛 Bugs Corregidos (Historial)

| Bug | Archivo | Fix |
|-----|---------|-----|
| 2FA: código inválido al confirmar | `auth.service.ts` | `confirmEnable2fa()` generaba secreto NUEVO en lugar de usar el de `enable()`. Fix: `temp2faSecrets` Map para persistir secreto entre pasos. |
| 2FA: cerrar sesión al fallar código | `auth.service.ts` | `UnauthorizedException` → `BadRequestException` en endpoints 2FA (evita interceptor 401) |
| Login record no se creaba | `auth.service.ts` | Faltaba `LoginRecord.create()` en `login()` exitoso |
| debugToken expuesto en forgot-password | `auth.service.ts` + UI | Se eliminó `debugToken` y `debugLink` de la respuesta; se quitó UI de inbox simulado |
| Plagiarism mock hardcodeado | `plagiarism.service.ts` | Se eliminó bloque que retornaba 88%/72% fake cuando `alerts.length === 0` |
| Race condition en upload | `advances.service.ts` + `ai-analysis.service.ts` | Upload solo encola AI analysis; plagiarism y references se encolan DESPUÉS en `analyzeAdvance()` |
| GET/POST mismatch en fine-tuning | `fine-tuning/page.tsx` | `api.get` → `api.post` |
| HTTP method + route en notifications | `notifications/page.tsx` | `api.post` → `api.patch`, ruta `read-all` → `mark-all-read` |
| Detailed feedback: error en simulación | `ai-analysis.service.ts` | Faltaba detección de simulación en `generateDetailedFeedback()`. Se agregó `generateSimulatedDetailedFeedback()` |
| Percentajes sin formato en PDF | `reports.service.ts` | Scores sin `.toFixed(2)` en `buildReportHTML()` |
| Feedback no se incluía en PDF | `reports.service.ts` | Faltaba bloque para `analysis.detailedFeedback` en el HTML del acta |
| Feedback no se generaba automáticamente | `ai-analysis.service.ts` | Faltaba llamada a `generateDetailedFeedback()` después de `aIAnalysis.create()` |
| Groq refs: JSON truncado por `llama-3.1-8b-instant` | `analysis.pipeline.ts` | `fastLlm` de Groq usaba `llama-3.1-8b-instant` → JSON malformado. Fix: `llama-3.3-70b-versatile` + `parseRobustJson()` con reparación automática |
| `generateDetailedFeedback()` sin fallback de provider | `ai-analysis.service.ts` | Usaba `this.buildPipeline()` que no replicaba la lógica de fallback. Fix: `buildPipeline()` ahora tiene auto-corrección modelo→provider |
| `buildPipeline()` sin detección de mismatch modelo/proveedor | `ai-analysis.service.ts` | Si DB tenía `aiModel: 'gpt-4o'` con `provider: 'groq'`, fallaba. Fix: `modelToProvider` mapping + auto-corrección en `buildPipeline()` |
| Settings sin validación de API key | `settings.service.ts` | `updateSettings()` guardaba cualquier provider aunque no tuviera API key. Fix: validación contra `getAvailableProviders()` | (15)

| Módulo | Archivo(s) principal(es) | Propósito |
|--------|--------------------------|-----------|
| **Auth** | `auth/` | JWT, 2FA (Google Authenticator), recovery tokens, rate limiting, login records |
| **Users** | `users/` | CRUD, settings, login history, logout all devices |
| **Templates** | `templates/` | CRUD de plantillas, soft-delete, carga de estructura |
| **Advances** | `advances/` | Subida, versionado, status management |
| **AI Analysis** | `ai-analysis/` | Pipeline, simulación, feedback detallado, reanalyze |
| **Review** | `review/` | Revisión humana, notas, pares fine-tuning |
| **Fine-tuning** | `fine-tuning/` | Export JSONL, activación de modelo fine-tuneado |
| **Plagiarism** | `plagiarism/` | pgvector cosine, Copyleaks webhook |
| **References** | `references/` | CrossRef, comparación de metadatos (year + first author) |
| **ORCID** | `orcid/` | OAuth, publicaciones, validación de expertos |
| **Reports** | `reports/` | HTML preview, PDF generation, send email, batch |
| **Dashboard** | `dashboard/` | KPIs, métricas, actividades recientes |
| **Notifications** | `notifications/` | Push (Expo), in-app, mark-read |
| **Storage** | `storage/` | MinIO S3 wrapper |
| **Settings** | `settings/` | Configuración del sistema (provider IA, thresholds) |

---

## 🗄️ Modelos de Prisma (20+)

| Modelo | Campos clave | Relaciones |
|--------|-------------|------------|
| `User` | email, passwordHash, role, twoFactorSecret, twoFactorBackupCodes, preferences (Json), isActive | program, reviews, advances, loginRecords |
| `Program` | name, code | users, advances |
| `ThesisTemplate` | name, version, structure (Json), isActive | advances, chunks |
| `Advance` | title, advanceType, version, fileKey, status, extractedText | student, program, template, aiAnalysis, review, chunks |
| `AIAnalysis` | structureScore, contentScore, formScore, originalityScore, overallScore, gradeConverted, executiveSummary, detailedFeedback (Json), findings | advance |
| `AIFinding` | severity, sectionRef, pageRef, description, correctionSteps, exampleImprovement | aiAnalysis |
| `Review` | status, humanComment, finalGrade | advance, reviewer |
| `PlagiarismReport` | overallScore, source, alerts | advance |
| `ReferenceAnalysis` | totalRefs, verifiedCount, errorCount, source | advance, references |
| `LoginRecord` | ip, userAgent, timestamp | user |
| `SystemSettings` | id ('default'), aiProvider, aiModel, approvalThreshold, ... | — |

---

## ✅ Decisiones Arquitectónicas (no modificar sin consultar)

1. **Soft-delete de templates**: `isActive = false`, nunca `delete`. Preserva integridad referencial de evaluaciones existentes.
2. **Mobile read-only**: Solo visualización. Upload solo desde web.
3. **Análisis IA automático**: Sin paso de confirmación. Al subir documento, se encola el análisis inmediatamente.
4. **Feedback detallado**: Se genera automáticamente después del análisis principal. También disponible manualmente.
5. **Reporte en PDF**: Incluye todas las secciones (scores, hallazgos, feedback, plagio, referencias). No es configurable por el usuario.
6. **2FA sin librería de persistencia**: El secreto temporal se guarda en un Map en memoria (no Redis). TTL de 10 min. La limpieza se hace con `setInterval` cada 5 min.
7. **Rate limiting en memoria**: Los intentos fallidos de login se cuentan en un Map. 5 intentos → bloqueo 15 min. No persiste entre reinicios del servidor.
8. **Gemini SDK nativo**: Bypass de LangChain para Gemini porque la versión de LangChain del proyecto no soporta Gemini 2.0.
9. **CrossRef PARTIAL**: Cuando year o first author no coinciden con el registro de CrossRef, se marca como `PARTIAL` en lugar de `VERIFIED`.
10. **EPERM en Windows**: El error `query_engine-windows.dll.node` es un rename race condition de Windows. Detener watcher de NestJS y reintentar.
11. **`modelToProvider` mapping en `buildPipeline()`**: Si el modelo no coincide con el proveedor (ej: `model: 'gpt-4o'` + `provider: 'groq'`), `buildPipeline()` auto-corrige el proveedor. Esto evita errores 404/401 cuando la DB tiene configuraciones inconsistentes.

---

## 🔐 Roles de Usuario

| Rol | Permisos clave |
|-----|----------------|
| `ADMIN` | Todo el sistema, settings, usuarios |
| `COORDINATOR` | Batch PDF/email, revisar avances, ver dashboard |
| `ADVISOR` | Revisar avances de sus asesorados, feedback humano |
| `STUDENT` | Subir avances, ver resultados, perfil |

**Credenciales de prueba:** Password `Kimy2026!` para todos los roles.

---

## ⚠️ Problemas Comunes y Soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| `EPERM: rename query_engine-windows.dll.node` | Windows race condition | Detener watcher NestJS, ejecutar `prisma generate` de nuevo |
| `Property 'advance' does not exist on type 'PrismaService'` | Cliente Prisma desactualizado | `npx prisma generate --schema=packages/database/prisma/schema.prisma` |
| API no ve nuevos exports de ai-engine | Package no rebuild | `cd packages/ai-engine && npm run build` |
| Error generando feedback detallado | Sin API keys en simulación | Ya corregido con `generateSimulatedDetailedFeedback()` |
| Código 2FA inválido al confirmar | Secreto inconsistente entre enable/confirm | Ya corregido con `temp2faSecrets` Map |
| Se cierra sesión al fallar código 2FA | `UnauthorizedException` en endpoint 2FA | Ya corregido → usar `BadRequestException` |
| Los botones descargan directo sin preview | Falta `ReportPreviewModal` | Ya corregido en detail y review pages |
| Groq refs falla: `Unexpected end of JSON input` | `llama-3.1-8b-instant` trunca JSON de referencias | `cd packages/ai-engine && npm run build` para aplicar fix (usa `llama-3.3-70b-versatile` + `parseRobustJson` reparador) |
| Intentas guardar un provider sin API key en Settings | Bypass de UI (Postman/curl) | `updateSettings()` ahora valida contra `getAvailableProviders()` |

---

## 📁 Archivos Clave por Módulo

### Auth / 2FA
- `apps/api/src/auth/auth.service.ts` — Login, 2FA (enable/verify/confirm/disable/authenticate), rate limiting, recovery tokens
- `apps/api/src/auth/auth.controller.ts` — Endpoints auth
- `apps/web/src/app/login/page.tsx` — Login page con modal 2FA
- `apps/web/src/app/dashboard/settings/page.tsx` — Settings con 2FA section + IA tab
- `apps/mobile/src/screens/auth/TwoFactorScreen.tsx` — 2FA en mobile

### AI Analysis
- `apps/api/src/ai-analysis/ai-analysis.service.ts` — Pipeline orchestration, simulación, feedback detallado
- `packages/ai-engine/src/pipeline/analysis.pipeline.ts` — Providers (OpenAI/Groq/Gemini/DeepSeek), extractText, generateDetailedFeedback
- `packages/ai-engine/src/prompts/` — Todos los prompts del sistema

### Reports
- `apps/api/src/reports/reports.service.ts` — buildReportHTML, generateAdvancePdf, sendAdvanceReportEmail
- `apps/web/src/components/ReportPreviewModal.tsx` — Modal de vista previa

### References
- `apps/api/src/references/references.service.ts` — verifyByDOI, verifyByQuery, compareMetadata

### Plagiarism
- `apps/api/src/plagiarism/plagiarism.service.ts` — pgvector similarity, Copyleaks integration

### Frontend API Client
- `apps/web/src/lib/api.ts` — Axios instance con interceptor 401

### Database
- `packages/database/prisma/schema.prisma` — Schema completo (~550 líneas)
- `packages/database/seed.ts` — Seed data

---

## 📐 Estilo de Código

- **Sin comentarios** en el código a menos que sea estrictamente necesario
- **Importaciones**: `@/` alias para `apps/web/src/` y `apps/api/src/`
- **Componentes React**: Functional components con hooks, `'use client'` cuando usan estado/efectos
- **Iconos**: Usar `lucide-react` exclusivamente, no emojis
- **Interfaces compartidas**: Definir en `packages/shared-types/index.ts`

---

## 🧪 Testing

El proyecto **no tiene infraestructura de testing** (no hay Jest, Vitest, archivos `.spec.ts`, ni comandos de test en package.json). Si necesitas agregar tests, deberás configurar Jest/Vitest desde cero.

---

## 📝 Notas Adicionales

- La API usa **dotenv** y carga `.env` desde la raíz del proyecto (`../../.env` relativo a `apps/api/`)
- BullMQ tiene 3 colas: `ai-analysis`, `plagiarism`, `references`
- El pipeline extrae texto de PDF y DOCX usando `pdf-parse` y `mammoth`
- La búsqueda por similitud (plagio interno) usa la extensión **pgvector** con cosine distance
- El webhook de Copyleaks está configurado pero **no implementado** en el pipeline activo
- Las notificaciones push usan **Expo Push API** desde `apps/mobile/`
