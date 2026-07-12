# Documentación General del Sistema — KIMY

Este documento consolida la documentación técnica completa del **Sistema de Revisión Inteligente de Tesis (KIMY)**, desarrollado como parte del Proyecto de Tesis de Ingeniería de Sistemas en la **Universidad Nacional de Trujillo (UNT)**, Ciclo 2026-I.

> **Autores:** QUIÑONES JARA + ANGELDONES MENDOZA — UNT 2026

---

## 📋 1. Descripción del Proyecto y Objetivos

### 1.1 Objetivo General

Implementar un sistema web inteligente para la gestión, revisión y evaluación automatizada de avances de tesis universitarias, utilizando Inteligencia Artificial Multi-Proveedor, procesamiento semántico con embeddings vectoriales y un pipeline de mejora continua mediante fine-tuning, con el fin de reducir los tiempos de revisión y mejorar la calidad del feedback entregado a los estudiantes.

### 1.2 Hipótesis de Investigación

> "La implementación del sistema KIMY, que integra análisis de IA multi-proveedor con feedback estructurado y mecanismos de mejora continua (fine-tuning), reduce significativamente el tiempo promedio de revisión de avances de tesis y mejora la concordancia entre evaluaciones automatizadas y evaluaciones humanas, respecto a los procesos manuales actuales."

### 1.3 Objetivos Específicos

- **OE1 (Análisis IA):** Diseñar e implementar un pipeline de análisis automatizado multi-proveedor (OpenAI, Groq, Gemini, DeepSeek, Claude, MiniMax) para evaluar avances de tesis en cuatro dimensiones: estructura, contenido, forma y originalidad.
- **OE2 (Retroalimentación):** Generar hallazgos con instrucciones de corrección detalladas, ejemplos de mejora y clasificación por severidad (Crítico, Mayor, Menor, Sugerencia).
- **OE3 (Plagio y Citas):** Implementar detección de similitud semántica interna con pgvector e integración con CrossRef API para validación de citas bibliográficas.
- **OE4 (Fine-tuning):** Establecer un ciclo de mejora continua que recolecte correcciones de asesores humanos para entrenar modelos fine-tuneados específicos para evaluación académica.
- **OE5 (Generador IA):** Desarrollar un generador de contenido académico a partir de documentos patrón institucionales, con exportación en formatos PDF y DOCX con formato institucional.
- **OE6 (App Móvil):** Proveer a los estudiantes una aplicación móvil (Expo SDK 54) para consultar resultados, historial de notas, hallazgos IA y recibir notificaciones push en tiempo real.

### 1.4 Limitaciones

1. **Dependencia de API externas:** La calidad del análisis depende de la disponibilidad de al menos un proveedor IA (el sistema tiene modo simulación como último recurso).
2. **Infraestructura local:** El despliegue inicial es local/on-premise mediante Docker. La migración a nube requiere ajustes de configuración.
3. **Push notifications:** Las notificaciones push reales requieren dispositivo físico y EAS (Expo Application Services) para producción.

---

## 🛠️ 2. Arquitectura General y Stack Tecnológico

El sistema adopta una arquitectura de monorepo con tres aplicaciones independientes interconectadas:

```
┌──────────────────────────────────────────────────────────┐
│                    Turborepo (Monorepo)                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Next.js 15  │  │  NestJS 11   │  │   Expo SDK 54  │  │
│  │  Web (3000)  │  │  API (3001)  │  │   App Móvil    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                   │           │
│  ┌──────▼─────────────────▼───────────────────▼────────┐  │
│  │              packages/ (workspaces)                  │  │
│  │    ai-engine · database · shared-types               │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
  │  PostgreSQL  │    │    Redis     │    │    MinIO     │
  │  16+pgvector│    │ (BullMQ)     │    │  (S3-compat) │
  └─────────────┘    └──────────────┘    └──────────────┘
```

### Stack Tecnológico Detallado

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend Web** | Next.js (App Router) + React + TypeScript | 15 / 19 / 5.7 |
| **Estilos** | Tailwind CSS + shadcn/ui + Recharts | 3.4 |
| **Backend API** | NestJS + TypeScript | 11 / 5.7 |
| **ORM** | Prisma | 6.3 |
| **Base de Datos** | PostgreSQL + pgvector | 16 / 0.8 |
| **Cola de Trabajos** | BullMQ + Redis | 5.30 / 7-alpine |
| **Almacenamiento** | MinIO S3-compatible | latest |
| **IA — Proveedores** | OpenAI + Groq + Gemini + DeepSeek + Claude + MiniMax | Múltiple |
| **IA — Pipeline** | LangChain + SDKs nativos | 0.3 |
| **Generación PDF** | Puppeteer (Chrome headless) | 23 |
| **Generación DOCX** | docx (librería npm) | 9.7 |
| **Diagramas** | Mermaid → PNG (Puppeteer) | runtime |
| **App Móvil** | Expo SDK + React Native | 54 / 0.81.5 |
| **Push** | Expo Push API | - |
| **Orquestación** | Docker + Docker Compose | - |
| **Monorepo** | Turborepo | 2 |

---

## 📁 3. Estructura de Directorios

```
kimy/                               ← Raíz del monorepo
├── apps/
│   ├── api/                        ← NestJS 11 (puerto 3001)
│   │   ├── src/
│   │   │   ├── app.module.ts       ← Registro de todos los módulos
│   │   │   ├── main.ts             ← Bootstrap + Swagger + CORS + compresión
│   │   │   ├── advances/           ← Upload DOCX/PDF + versionado
│   │   │   ├── ai-analysis/        ← Pipeline IA + BullMQ workers
│   │   │   ├── auth/               ← JWT + Guards + 2FA TOTP
│   │   │   ├── chat/               ← Chat SSE + tool calling + STT/TTS
│   │   │   ├── dashboard/          ← KPIs y métricas
│   │   │   ├── diagram-generator/  ← Mermaid render → PNG (Puppeteer)
│   │   │   ├── fine-tuning/        ← Export JSONL + activación modelos
│   │   │   ├── notifications/      ← Push (Expo) + in-app
│   │   │   ├── orcid/              ← OAuth 2.0 ORCID
│   │   │   ├── plagiarism/         ← pgvector coseno + Copyleaks
│   │   │   ├── prisma/             ← PrismaService singleton
│   │   │   ├── programs/           ← Programas académicos
│   │   │   ├── references/         ← CrossRef API + validación
│   │   │   ├── reports/            ← PDF Puppeteer + ZIP batch + email
│   │   │   ├── review/             ← Revisión humana + FineTuningPair
│   │   │   ├── settings/           ← SystemSettings + providers registry
│   │   │   ├── storage/            ← MinIO S3 upload/download
│   │   │   ├── templates/          ← Documentos patrón institucionales
│   │   │   ├── thesis-generator/   ← Generador IA PDF+DOCX con Mermaid
│   │   │   └── users/              ← CRUD usuarios + ORCID + notif. prefs
│   │   └── package.json
│   │
│   ├── web/                        ← Next.js 15 (puerto 3000)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── login/
│   │   │   │   ├── forgot-password/
│   │   │   │   ├── reset-password/
│   │   │   │   └── dashboard/
│   │   │   │       ├── page.tsx         ← KPIs principal
│   │   │   │       ├── advances/        ← Lista + detalle + revisión
│   │   │   │       ├── bulk-review/     ← Revisión masiva
│   │   │   │       ├── chat/            ← Chat IA streaming
│   │   │   │       ├── fine-tuning/     ← Panel admin fine-tuning
│   │   │   │       ├── notifications/
│   │   │   │       ├── plagiarism/
│   │   │   │       ├── references/
│   │   │   │       ├── settings/
│   │   │   │       ├── statistics/
│   │   │   │       ├── templates/
│   │   │   │       ├── thesis-generator/
│   │   │   │       ├── upload/
│   │   │   │       └── users/
│   │   │   ├── components/          ← Componentes reutilizables
│   │   │   └── lib/                 ← api.ts (Axios) + helpers
│   │   └── package.json
│   │
│   └── mobile/                     ← Expo SDK 54 (app estudiantes)
│       ├── src/
│       │   ├── constants/           ← Colors, Spacing
│       │   ├── hooks/               ← useAuth, useAdvances, useNotifications
│       │   ├── navigation/          ← RootNavigator + BottomTabNavigator
│       │   ├── screens/             ← Login, Home, Reviews, History, Profile, Reports
│       │   ├── services/            ← api.ts (Axios + interceptor JWT)
│       │   └── store/               ← authStore (Zustand + SecureStore)
│       └── package.json
│
├── packages/
│   ├── ai-engine/                  ← Pipeline IA compartido
│   │   ├── src/
│   │   │   ├── pipeline/           ← AnalysisPipeline (análisis + generación)
│   │   │   ├── providers/          ← Registry de proveedores IA
│   │   │   └── prompts.ts          ← Prompts de análisis y generación
│   │   ├── dist/                   ← Build compilado (necesita rebuild)
│   │   └── package.json
│   │
│   ├── database/                   ← Prisma schema + seeds
│   │   ├── prisma/
│   │   │   └── schema.prisma       ← 20+ modelos, enums, pgvector
│   │   ├── seed.ts                 ← Usuarios, programas, templates de prueba
│   │   └── package.json
│   │
│   └── shared-types/               ← TypeScript types compartidos
│       ├── index.ts
│       └── package.json
│
├── docker-compose.yml              ← postgres, redis, minio, api, web
├── turbo.json                      ← Pipeline Turborepo
├── package.json                    ← Raíz (workspaces + scripts globales)
├── setup.ps1                       ← Setup paso 1
├── setup2.ps1                      ← Setup paso 2
└── .env.example                    ← Variables de entorno plantilla
```

---

## 🗄️ 4. Esquema de Base de Datos (Prisma)

PostgreSQL 16 con extensión **pgvector** para embeddings semánticos.

### Modelos principales

```
User ──────────────────────────────────────────────────────
  id, email, passwordHash, name, role (STUDENT/ADVISOR/COORDINATOR/ADMIN)
  programId, advisorId, signature, 2FA fields, notif. prefs
  ├── advances[] (Advance)
  ├── reviews[] (Review)
  ├── orcidProfile (OrcidProfile)
  ├── thesisGenerations[] (ThesisGeneration)
  └── chatConversations[] (ChatConversation)

Program
  id, name, code, isActive
  ├── users[], templates[], advances[], periods[]

ThesisTemplate
  id, programId, name, version, fileKey, fileType
  extractedSchema (JSON), formatting (JSON), rubric (JSON)
  citationStyle, isActive
  ├── chunks[] (TemplateChunk con vector(3072))

Advance
  id, studentId, programId, templateId
  title, advanceType, version, fileKey, fileSizeBytes, pageCount
  status: PENDING → AI_PROCESSING → AI_COMPLETE → HUMAN_REVIEW
           → OBSERVED → APPROVED → REJECTED
  ├── aiAnalysis (AIAnalysis)
  ├── review (Review)
  ├── chunks[] (AdvanceChunk con vector(3072))
  ├── plagiarismReports[]
  └── referenceAnalysis

AIAnalysis
  advanceId, structureScore, contentScore, formScore, originalityScore
  overallScore, gradeConverted (0-20), executiveSummary
  modelUsed, processingMs
  └── findings[] (AIFinding)

AIFinding
  sectionRef, severity (CRITICAL/MAJOR/MINOR/SUGGESTION)
  description, correctionSteps, exampleImprovement, recommendation
  humanAction, humanComment, adjustedSeverity (feedback humano)
  └── fineTuningPair (FineTuningPair)

Review
  advanceId, reviewerId, finalGrade, humanComment
  rubricAnswers (JSON), annotations (JSON), status

PlagiarismReport
  advanceId, method (EMBEDDINGS_COSINE/COPYLEAKS_API)
  overallScore, status
  └── alerts[] (PlagiarismAlert)

ReferenceAnalysis
  advanceId, totalRefs, verifiedCount, errorCount
  └── references[] (Reference con status VERIFIED/PARTIAL/NOT_FOUND/HALLUCINATED)

FineTuningDataset
  name, status (COLLECTING/READY/TRAINING/COMPLETED/FAILED)
  pairCount, modelId, jobId, accuracy, f1Score
  └── pairs[] (FineTuningPair)

OrcidProfile
  userId, orcidId, accessToken, refreshToken, tokenExpiry
  displayName, biography, keywords[]
  └── publications[] (OrcidPublication)

ChatConversation
  userId, title, modelUsed
  └── messages[] (ChatMessage con role USER/ASSISTANT/SYSTEM/TOOL)

ThesisGeneration
  userId, templateId, templateName, topic, userPrompt
  sectionNames[], aiProvider, content, status

SystemSettings (singleton: id = "default")
  institutionName, maxGrade, aiModel, aiProvider
  approvalThreshold, rigorLevel

Notification, AuditLog, LoginRecord, UserPushToken
DeliveryPeriod, TemplateChunk, AdvanceChunk
```

### Relaciones clave

1. **User → Advance**: Un estudiante sube múltiples avances (versionados por `advanceType`)
2. **Advance → AIAnalysis → AIFinding → FineTuningPair**: Pipeline completo de análisis + aprendizaje
3. **ThesisTemplate** contiene `formatting` (JSON) que se aplica al exportar PDF/DOCX en el Generador IA
4. **TemplateChunk / AdvanceChunk**: Almacenan embeddings `vector(3072)` para búsqueda semántica de plagio
5. **ChatConversation → ChatMessage**: Historial completo de chats con tool calls guardados como JSON

---

## 🤖 5. Pipeline de Análisis IA

### 5.1 Flujo completo al subir un avance

```
DOCX/PDF subido
      │
      ▼ (BullMQ job disparado)
1. EXTRACCIÓN DE TEXTO
   ├── DOCX → mammoth.js (preserva estructura)
   └── PDF  → pdf-parse

2. CHUNKING + EMBEDDINGS
   ├── RecursiveCharacterTextSplitter (~1500 tokens con overlap)
   ├── text-embedding-3-large (OpenAI) → vectores 3072 dims
   └── Almacenados en AdvanceChunk.embedding (pgvector)

3. ANÁLISIS IA MULTI-PROVEEDOR (con fallback automático)
   Cascada: primario → Groq → DeepSeek → OpenAI → Claude → MiniMax → Simulación
   
   Evaluación en 4 dimensiones:
   ├── Estructura   (30%): tabla de contenidos, secciones, jerarquía
   ├── Contenido    (40%): coherencia, argumentación, metodología
   ├── Forma        (20%): formato, normas APA, redacción
   └── Originalidad (10%): análisis cruzado con pgvector

   Salida por avance:
   ├── overallScore (0-100) → gradeConverted (0-20)
   ├── executiveSummary
   └── AIFindings[] con: sectionRef, severity, description,
                         correctionSteps, exampleImprovement

4. DETECCIÓN DE PLAGIO (paralelo al análisis)
   ├── pgvector <=> coseno: compara chunks del avance vs todos los del mismo programa
   └── Copyleaks API (si COPYLEAKS_ACCESS_TOKEN está configurado)

5. VALIDACIÓN DE CITAS (paralelo)
   └── CrossRef API: verifica DOI, autores, año de cada referencia

6. NOTIFICACIÓN PUSH
   └── Expo Push API → token del estudiante → "Tu análisis está listo"
```

### 5.2 Proveedores IA y Fallback

| Proveedor | Tipo | SDK | Modelos ejemplo |
|-----------|------|-----|-----------------|
| OpenAI | OpenAI-compatible | `openai` npm | gpt-4o, gpt-4o-mini |
| Groq | OpenAI-compatible | `openai` + baseURL | llama-3.3-70b-versatile |
| DeepSeek | OpenAI-compatible | `openai` + baseURL | deepseek-chat, deepseek-r1 |
| Gemini | SDK nativo | `@google/generative-ai` | gemini-2.0-flash |
| Claude | SDK nativo | `@anthropic-ai/sdk` | claude-3-5-sonnet-20241022 |
| MiniMax | OpenAI-compatible | `openai` + baseURL | MiniMax-Text-01 |
| Simulación | Interno | — | (sin API key, genera datos simulados) |

> **Auto-corrección:** Si la DB tiene `model: 'gpt-4o'` con `provider: 'groq'`, el sistema detecta la discrepancia y corrige el provider automáticamente con `buildPipeline()`.

### 5.3 Configuración del modelo activo

```
SystemSettings.aiProvider + SystemSettings.aiModel (en PostgreSQL)
                     ↓
             Leído en cada request
                     ↓
     AnalysisPipeline instanciado dinámicamente
                     ↓
     Sin necesidad de reiniciar el servidor
```

El modelo puede cambiarse desde:
- **Panel Settings** (UI web): `PATCH /api/settings`
- **Activar fine-tuneado**: `POST /api/fine-tuning/datasets/:id/activate`

---

## 💬 6. Chat IA con Tool Calling

### 6.1 Arquitectura del Chat

```
Usuario → POST /api/chat/send
              │
              ▼
    ChatService.sendMessage()
              │
    ┌─────────┴──────────┐
    │ Provider Detection │ → OpenAI / Groq / DeepSeek / Gemini / Claude / MiniMax
    └─────────┬──────────┘
              │
    SSE Response Stream
    ├── event: text        → chunks de respuesta
    ├── event: tool_calls  → herramienta invocada
    ├── event: tool_result → resultado de la herramienta
    ├── event: done        → fin del stream
    └── event: error       → error capturado
```

### 6.2 Tools disponibles (13)

Las herramientas permiten al asistente consultar la base de datos en tiempo real:

| Tool | Parámetros | Descripción |
|------|-----------|-------------|
| `count_thesis_by_status` | `status` | Conteo por estado |
| `count_thesis_above_grade` | `minGrade` | Avances con nota >= X |
| `get_student_stats` | `query` | Stats de un estudiante |
| `get_student_average` | `query` | Promedio de notas |
| `get_global_stats` | `startDate?`, `endDate?` | Stats globales con filtro de fecha |
| `get_program_stats` | — | Stats por programa |
| `get_ai_generation_stats` | `startDate?`, `endDate?` | Stats del Generador IA |
| `get_system_overview` | `startDate?`, `endDate?` | Vista general completa |
| `get_user_generations` | `query`, `startDate?`, `endDate?` | Generaciones de un usuario |
| `get_user_advances_detailed` | `query`, `status?`, fechas? | Avances con notas y fechas |
| `get_recent_activity` | `limit?` | Actividad reciente |
| `list_thesis_advances` | `limit?`, `status?`, filtros | Lista detallada de avances |
| `list_ai_generations` | `limit?`, `status?`, filtros | Lista de generaciones IA |

### 6.3 STT y TTS

- **Speech-to-Text**: Whisper OpenAI (primario) → Whisper Groq (fallback). Archivo de audio max 25MB.
- **Text-to-Speech**: OpenAI TTS `tts-1-hd` voz `nova` → Google Translate TTS (fallback gratuito).

---

## 🏗️ 7. Generador IA de Informes de Tesis

### 7.1 Flujo de generación

```
POST /api/thesis-generator/generate
{
  templateId, topic, userPrompt?,
  sectionNames[], aiProvider?, aiModel?,
  targetPageRange?: "20-30" | "30-40" | ... | "+80"
}
        │
        ▼
1. Cargar template + extraer texto del archivo original
2. Resolver proveedor IA (con fallback 6 niveles)
3. Invocar AnalysisPipeline.generateThesis()
   └── Prompt con: esquema de secciones + texto del template
                   + tema + instrucciones usuario + rango de páginas
4. Persistir en ThesisGeneration (BD)
5. Retornar { id, content, sections }
```

### 7.2 Exportación PDF

```
GET /api/thesis-generator/history/:id/pdf
        │
        ▼
1. Leer ThesisGeneration.content (Markdown)
2. Leer ThesisTemplate.formatting (fuente, márgenes, interlineado, etc.)
3. Renderizar bloques ```mermaid → PNG (DiagramRendererService)
4. Markdown → HTML (marked.js)
5. Puppeteer: HTML → PDF A4 con márgenes, numeración, fuente institucional
6. Return Buffer como application/pdf
```

### 7.3 Exportación DOCX

```
GET /api/thesis-generator/history/:id/docx
        │
        ▼
1. Leer content + formatting del template
2. Renderizar bloques ```mermaid → PNG
3. marked.lexer() → tokens estructurados
4. convertTokensToDocx() → Paragraph[], Table[], ImageRun[]
5. Document({sections, styles, numbering}) → Packer.toBuffer()
6. Return Buffer como .docx
```

### 7.4 Formato institucional aplicado

El campo `ThesisTemplate.formatting` (JSON) contiene:

```json
{
  "fontFamily": "Arial Narrow",
  "fontSize": 12,
  "lineSpacing": 2,
  "alignment": "justified",
  "margins": { "top": 2.5, "bottom": 2.5, "left": 3.0, "right": 2.5 },
  "indent": "1.27cm",
  "paragraphSpacing": "18pt",
  "pageNumbering": {
    "enabled": true,
    "position": "bottom-right",
    "excludeFirstPage": true
  }
}
```

Este formato se aplica tanto al PDF (via CSS en Puppeteer) como al DOCX (via propiedades de estilo de la librería `docx`).

---

## 📈 8. Generador de Diagramas

El módulo `diagram-generator` es usado por el Generador de Tesis y puede usarse de forma independiente:

### DiagramGeneratorService

Genera definiciones Mermaid usando IA según el tipo solicitado:

```typescript
generateDiagram({
  type: 'flowchart' | 'architecture' | 'gantt' | 'er' | 'sequence',
  context: string,  // descripción del diagrama
  aiProvider?: string
})
// Retorna: string con definición Mermaid
```

### DiagramRendererService

Renderiza definiciones Mermaid a imágenes PNG:

```typescript
// Renderizar un diagrama
renderMermaidToPng(definition: string): Promise<Buffer>

// Renderizar múltiples en paralelo
renderMultipleToPng(defs: Record<string, string>): Promise<Record<string, Buffer>>
```

**Implementación:** Usa Puppeteer con la librería `mermaid.js` en un contexto de browser headless. Requiere Chromium instalado.

---

## 🔐 9. Seguridad y Autenticación

### 9.1 JWT

```
Login → POST /api/auth/login
         │
         ▼ (bcrypt hash check)
    JWT firmado con JWT_SECRET
    Expira en JWT_EXPIRES_IN (default: 7d)
         │
         ▼
    Enviado como Bearer token en cada request
```

### 9.2 Roles y Guards

| Rol | Nivel | Permisos adicionales |
|-----|-------|---------------------|
| STUDENT | 1 | Sus propios avances, chat, generador |
| ADVISOR | 2 | Avances de sus estudiantes, revisión, feedback |
| COORDINATOR | 3 | Todo el programa, revisión masiva, estadísticas |
| ADMIN | 4 | Todo + settings + fine-tuning + gestión usuarios |

### 9.3 2FA (TOTP)

```
ACTIVATE:
  POST /api/auth/2fa/enable
      → genera secreto TOTP + QR
      → guarda en temp2faSecrets Map (TTL 10 min)

  POST /api/auth/2fa/verify  (código del autenticador)
      → valida código vs secreto temporal
      → guarda secreto cifrado en User.twoFactorSecret
      → genera códigos de recuperación

LOGIN con 2FA activo:
  POST /api/auth/login
      → retorna { requires2FA: true, tempToken }

  POST /api/auth/2fa/authenticate (tempToken + código TOTP)
      → valida y retorna JWT definitivo
```

> **Crítico:** Todos los endpoints 2FA usan `BadRequestException` (400), nunca `UnauthorizedException` (401), para evitar que el interceptor Axios haga logout automático.

### 9.4 Interceptor Axios (Web)

```typescript
// apps/web/src/lib/api.ts
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Logout automático y redirect a /login
    }
    return Promise.reject(error);
  }
);
```

---

## 📧 10. Notificaciones

### In-App

Modelo `Notification` en DB. Endpoints:
- `GET /api/notifications` — lista con paginación
- `PATCH /api/notifications/:id/read` — marcar como leída
- `GET /api/notifications/unread-count` — badge contador

### Push (Expo)

```
1. App móvil registra token: POST /api/notifications/push-token
   Body: { token: "ExponentPushToken[...]", platform: "ios|android" }
   Guardado en UserPushToken

2. Evento (análisis completado, comentario de asesor, etc.)
   → NotificationsService.sendPushToUser(userId, { title, body, data })
   → Expo Push API: POST https://exp.host/--/api/v2/push/send
   → Batches de 100 tokens máximo
```

> Push notifications reales requieren dispositivo físico. El simulador/emulador no recibe push.

---

## 📊 11. Dashboard y KPIs

El dashboard principal (`GET /api/dashboard/kpi`) retorna:

```json
{
  "totalAdvances": 0,
  "approvedCount": 0,
  "rejectedCount": 0,
  "observedCount": 0,
  "pendingCount": 0,
  "avgAIScore": 0.0,
  "avgHumanGrade": 0.0,
  "concordanceRate": 0.0,
  "plagiarismAlerts": 0,
  "recentActivity": [],
  "scoreByProgram": []
}
```

La concordancia IA-Humano mide el porcentaje de casos donde la evaluación IA y la nota humana coinciden dentro de un margen de ±2 puntos (escala 0-20).

---

## 📄 12. Reportes y Exportación

### Acta de Revisión (PDF individual)

```
GET /api/reports/advance/:id/pdf
```

Incluye: membrete institucional, datos del avance, evaluación IA (scores + hallazgos), ajustes humanos del asesor, detección de plagio, validación de citas.

**Stack:** Puppeteer + Handlebars (templates HTML en `apps/api/src/reports/templates/`).

### PDF Masivo (ZIP)

```
POST /api/reports/batch-pdf
Body: { advanceIds: ["id1", "id2", ...] }
```

Genera PDFs individuales y los comprime en ZIP con `archiver`. Requiere rol COORD o ADMIN.

### Email de Acta

```
POST /api/reports/advance/:id/send-email
```

Envía el PDF como adjunto vía `nodemailer`. Configurar SMTP en `.env`.

---

## 🔄 13. Fine-Tuning Pipeline

### Flujo completo

```
1. ASESOR revisa un hallazgo IA
   └── Acepta con edición / Modifica / Rechaza
         ↓
2. POST /api/review/finding/:id/feedback
   └── Crea FineTuningPair automáticamente
       { originalOutput, humanCorrection, outcomeType, reviewerId }
         ↓
3. Cuando hay 500+ pares:
   POST /api/fine-tuning/export
   └── Genera JSONL para OpenAI Fine-Tuning
         ↓
4. OpenAI Fine-Tuning (externo)
   └── POST https://api.openai.com/v1/fine_tuning/jobs
         ↓
5. POST /api/fine-tuning/datasets/:id/activate
   Body: { modelId: "ft:gpt-4o-mini:org:kimy:xxxxx" }
   └── Actualiza SystemSettings.aiModel en BD
         ↓
6. Próximos análisis usan el modelo fine-tuneado
   (sin reiniciar el servidor)
```

---

## 🔗 14. Integración ORCID

### Flujo OAuth 2.0

```
Asesor → /dashboard/profile → "Vincular ORCID"
    ↓
GET /api/orcid/authorize
    ↓ redirect
ORCID Authorization Server
    ↓ callback
GET /api/orcid/callback?code=...
    ↓ exchange code → access_token
POST orcid.org/oauth/token
    ↓ sync publications
GET orcid.org/v3.0/:orcid/works
    ↓ store in OrcidProfile + OrcidPublication[]
```

### Validación de expertise

```
Publicaciones ORCID del asesor → embeddings text-embedding-3-large
Título de la tesis del estudiante → embedding
Similitud coseno <=> si < 0.6 → alerta al coordinador
```

---

## 🚀 15. Guía de Instalación

### 15.1 Requisitos

- Node.js >= 20 (recomendado: 22 LTS)
- npm >= 10
- Docker Desktop (con Docker Compose v2)
- Al menos una API Key de IA (opcional — funciona en simulación sin ninguna)

### 15.2 Setup inicial (recomendado)

```powershell
# Paso 1: Infraestructura + DB + dependencias
.\setup.ps1

# Paso 2: AI Engine + MinIO bucket + Chromium para PDF
.\setup2.ps1
```

### 15.3 Variables de entorno necesarias

```env
# Base de datos (pgvector)
DATABASE_URL=postgresql://kimy:kimy_secret_2026@localhost:5434/kimy_thesis

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=thesis-documents

# Auth
JWT_SECRET=CHANGE_ME_IN_PRODUCTION
JWT_EXPIRES_IN=7d

# IA (configurar al menos uno o dejar vacío para simulación)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
# DEEPSEEK_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# MINIMAX_API_KEY=...

# Opcionales
ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=
COPYLEAKS_ACCESS_TOKEN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### 15.4 Desarrollo diario

```powershell
# Terminal 1: Infraestructura
docker compose up -d postgres redis minio

# Terminal 2: API
npm run dev --workspace=@kimy/api

# Terminal 3: Web
npm run dev --workspace=@kimy/web
```

### 15.5 Comandos Prisma (después de modificar schema.prisma)

```powershell
npm run db:generate   # Regenera el cliente Prisma
npm run db:push       # Sincroniza el schema con la DB
# ⚠️ Ambos son necesarios
# En Windows: puede aparecer EPERM error → parar NestJS y reintentar
```

### 15.6 App Móvil

```bash
cd apps/mobile
npm install
npx expo start
```

---

## 🌐 16. URLs y Servicios

| Servicio | URL | Credenciales |
|----------|-----|-------------|
| Web Frontend | http://localhost:3000 | Ver §17 |
| API REST | http://localhost:3001 | Bearer JWT |
| Swagger Docs | http://localhost:3001/api/docs | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| PostgreSQL | localhost:**5434** | kimy / kimy_secret_2026 |
| Redis | localhost:6379 | — |

---

## 🔑 17. Credenciales de Prueba (Seed)

Contraseña universal: **`Kimy2026!`**

| Rol | Email |
|-----|-------|
| ADMIN | `admin@kimy.edu` |
| ADMIN | `ayrton@kimy.edu` |
| COORDINATOR | `coordinador@kimy.edu` |
| ADVISOR | `asesor1@kimy.edu` |
| ADVISOR | `asesor2@kimy.edu` |
| STUDENT | `estudiante1@kimy.edu` |
| STUDENT | `estudiante2@kimy.edu` |
| STUDENT | `estudiante3@kimy.edu` |

---

## 🧱 18. Decisiones de Diseño

| Decisión | Opción elegida | Justificación |
|----------|---------------|---------------|
| **Monorepo** | Turborepo + npm workspaces | Tipos compartidos, builds coordinados, DX unificada |
| **Embeddings** | pgvector en PostgreSQL | Evita servicio adicional; suficiente para escala universitaria |
| **Cola de trabajos** | BullMQ + Redis | Workers independientes, reintentos automáticos, escalables |
| **Fallback IA** | 6 niveles en cascada | Alta disponibilidad sin intervención manual |
| **PDF/DOCX** | Puppeteer + `docx` | Máximo control sobre formato institucional |
| **Diagramas** | Mermaid → PNG (Puppeteer) | Compatible con todos los formatos de exportación |
| **Chat** | SSE streaming (no WebSockets) | Sin complejidad de conexiones persistentes; compatible con todos los proveedores |
| **Fine-tuning** | OpenAI Fine-Tuning API | Mejor calidad académica; activación sin downtime |
| **Push** | Expo Push API | iOS + Android sin servidores propios |
| **Storage** | MinIO | S3-compatible, self-hosted, sin costo |
| **2FA** | TOTP en memoria (Maps) | TTL simple, sin overhead de persistencia |
| **Gemini SDK** | SDK nativo (no LangChain) | Incompatibilidad de LangChain con Gemini 2.0 |
| **Puerto PostgreSQL** | 5434 (no 5432) | Evitar conflictos con PostgreSQL nativo en el host |

---

## 🚨 19. Problemas Conocidos y Soluciones

| Problema | Causa | Solución |
|----------|-------|---------|
| `EPERM: rename query_engine-windows.dll.node` | Race condition en Windows al regenerar Prisma | Parar NestJS watcher y reintentar `npm run db:generate` |
| API no ve cambios en `ai-engine` | Importa desde `dist/` compilado | `npm run build --workspace=@kimy/ai-engine` |
| PDF no se genera — "No se pudo iniciar Chromium" | Chromium no instalado | `npx puppeteer browsers install chrome` |
| Avance en `AI_PROCESSING` indefinidamente | Worker BullMQ caído o API key inválida | Revisar logs: `docker compose logs -f api \| grep ai-analysis` |
| `401` en 2FA causa logout | Interceptor Axios captura 401 | Todos los endpoints 2FA deben usar `BadRequestException` (400) |
| Web muy lenta en Docker (Windows) | Bind mounts NTFS → VM Linux (10-100x overhead) | Correr API y Web nativamente en Windows |
| `pgvector operator <=> not found` | Extensión no creada | `CREATE EXTENSION IF NOT EXISTS vector;` en psql/Prisma Studio |

---

## 📝 20. Información Académica

- **Institución:** Universidad Nacional de Trujillo (UNT) — Facultad de Ingeniería
- **Proyecto:** "Sistema de Revisión Inteligente de Tesis — KIMY"
- **Investigadores:** QUIÑONES JARA + ANGELDONES MENDOZA
- **Año:** 2026 — Ciclo 2026-I
