# 🎓 KIMY — Sistema de Revisión Inteligente de Tesis

> **Sistema web completo + app móvil** para la gestión, revisión y evaluación automatizada de avances de tesis universitarias con inteligencia artificial.

---

## ✨ Características

| Módulo | Descripción |
|--------|-------------|
| 🤖 **Análisis IA Multi-Proveedor** | GPT-4o / Groq (Llama 3.3 70B) / Gemini 2.0 Flash / DeepSeek / Claude / MiniMax con fallback automático de 6 niveles |
| 📊 **Dashboard con KPIs** | Vista general con métricas, concordancia IA-Humano y alertas de plagio en tiempo real |
| 📝 **Retroalimentación accionable** | Hallazgos con instrucciones de corrección, ejemplos de mejora y severidad (Crítico / Mayor / Menor / Sugerencia) |
| 🔍 **Detección de plagio** | Embeddings coseno con pgvector (`<=>`) + integración opcional Copyleaks API |
| 📚 **Validación de citas** | Verificación automática con CrossRef API (verified / partial / not_found / hallucinated) |
| 🎯 **Fine-tuning continuo** | Recolección de pares humano-IA y activación/desactivación de modelos personalizados desde panel Admin |
| 🔗 **Integración ORCID** | OAuth 2.0 para perfiles académicos de asesores (publicaciones, afiliaciones, validación de expertise) |
| 📱 **App Móvil (Expo SDK 54)** | Dashboard, hallazgos IA por severidad, historial de notas, descarga de PDFs y push notifications reales |
| 📄 **Reportes PDF** | Actas de revisión con evaluación IA + ajustes humanos + plagio + citas generadas con Puppeteer + Handlebars |
| 💬 **Chat IA Multi-Proveedor** | Chat streaming SSE con tool calls a la DB, speech-to-text (Whisper), text-to-speech y gestión de conversaciones |
| 🏗️ **Generador IA de Tesis** | Generación de contenido académico completo desde templates con exportación a PDF/DOCX con formato institucional |
| 📈 **Diagramas IA (Mermaid)** | Generación automática de diagramas de flujo, arquitectura y Gantt embebidos en PDF/DOCX |
| 🔔 **Push Notifications** | Expo Push API real: análisis IA listo, asesor comentó, deadline próximo |
| 🗂️ **Revisión por Lotes** | Análisis masivo de múltiples avances con barra de progreso en tiempo real |
| 🔐 **Autenticación 2FA** | TOTP (Google Authenticator) con códigos de recuperación, bloqueo por intentos fallidos |

---

## 🏗️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| **Frontend Web** | Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v3, shadcn/ui, Recharts |
| **Backend** | NestJS 11, TypeScript, Arquitectura Modular, Swagger/OpenAPI |
| **Base de Datos** | PostgreSQL 16 + pgvector (embeddings semánticos 3072 dims) |
| **ORM** | Prisma 6 (con `db push` para desarrollo) |
| **Almacenamiento** | MinIO (S3-compatible para documentos Word/PDF) |
| **Colas** | BullMQ + Redis (análisis IA, plagio, citas — workers independientes) |
| **IA — Proveedores** | OpenAI (GPT-4o/mini) · Groq (Llama 3.3 70B) · Google Gemini 2.0 Flash · DeepSeek V3/R1 · Claude 3.5 Sonnet · MiniMax Text-01 |
| **IA — Fallback** | 6 niveles: primario → Groq → DeepSeek → OpenAI → Claude → MiniMax → Simulación |
| **Embeddings** | text-embedding-3-large → pgvector (3072 dims) |
| **Chat IA** | SSE streaming multi-proveedor · tool calling DB · Whisper STT · OpenAI TTS |
| **Generación PDF** | Puppeteer (Chrome headless) + Handlebars para actas · Puppeteer para tesis generadas |
| **Generación DOCX** | Librería `docx` con formato completo (fuente, márgenes, sangría, numeración) |
| **Diagramas** | Mermaid renderizado a PNG vía Puppeteer, embebible en PDF y DOCX |
| **Reportes** | `archiver` para ZIP de PDFs batch + `nodemailer` para envío de actas por correo |
| **App Móvil** | Expo SDK 54, React Native 0.81, React Navigation 7, TanStack Query 5, Zustand 5 |
| **Notificaciones Push** | Expo Push API (registro de tokens, batches de 100 msgs) |
| **Contenedores** | Docker + Docker Compose (PostgreSQL+pgvector, Redis, MinIO) |
| **Monorepo** | Turborepo 2 (npm workspaces) |

---

## 📁 Estructura del Proyecto

```
kimy/
├── apps/
│   ├── web/                    # Next.js 15 — Portal web (puerto 3000)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── login/          # Autenticación
│   │       │   ├── forgot-password/
│   │       │   ├── reset-password/
│   │       │   └── dashboard/      # Área principal autenticada
│   │       │       ├── page.tsx    # Dashboard/KPIs principal
│   │       │       ├── advances/   # Lista y detalle de avances
│   │       │       │   └── [id]/   # Detalle individual + revisión
│   │       │       ├── bulk-review/    # Revisión por lotes
│   │       │       ├── chat/           # Chat IA con streaming
│   │       │       ├── fine-tuning/    # Panel de fine-tuning
│   │       │       ├── notifications/  # Centro de notificaciones
│   │       │       ├── plagiarism/     # Reportes de plagio
│   │       │       ├── references/     # Citas validadas
│   │       │       ├── settings/       # Configuración del sistema
│   │       │       ├── statistics/     # Estadísticas y gráficos
│   │       │       ├── templates/      # Documentos patrón
│   │       │       ├── thesis-generator/ # Generador IA de informes
│   │       │       ├── upload/         # Subir nuevo avance
│   │       │       └── users/          # Gestión de usuarios
│   │       ├── components/     # Componentes reutilizables (UI)
│   │       └── lib/            # Cliente Axios, helpers
│   │
│   ├── api/                    # NestJS — Backend REST (puerto 3001)
│   │   └── src/
│   │       ├── advances/       # Carga y versionado de avances
│   │       ├── ai-analysis/    # Pipeline IA + workers BullMQ
│   │       ├── auth/           # JWT + Roles + Guards + 2FA (TOTP)
│   │       ├── chat/           # Chat IA streaming SSE + tool calling
│   │       ├── dashboard/      # KPIs y métricas
│   │       ├── diagram-generator/ # Diagramas Mermaid + render PNG
│   │       ├── fine-tuning/    # Export JSONL + activación modelos
│   │       ├── notifications/  # Push real (Expo API) + in-app
│   │       ├── orcid/          # OAuth ORCID
│   │       ├── plagiarism/     # pgvector + Copyleaks provider
│   │       ├── prisma/         # PrismaService
│   │       ├── programs/       # Programas académicos
│   │       ├── references/     # CrossRef API
│   │       ├── reports/        # PDF (Puppeteer + Handlebars) + ZIP
│   │       ├── review/         # Revisión humana + FineTuningPair
│   │       ├── settings/       # SystemSettings (modelo activo)
│   │       ├── storage/        # MinIO S3
│   │       ├── templates/      # Documentos patrón institucionales
│   │       ├── thesis-generator/ # Generador IA de informes (PDF+DOCX)
│   │       └── users/          # CRUD usuarios
│   │
│   └── mobile/                 # Expo SDK 54 — App Móvil (estudiantes)
│       ├── index.js            # Entry point
│       ├── app.json            # Expo config (notifications, deep linking)
│       └── src/
│           ├── constants/      # Colors, Spacing, BorderRadius
│           ├── hooks/          # useAuth, useAdvances, useFindings, useNotifications
│           ├── navigation/     # RootNavigator + BottomTabNavigator (5 tabs)
│           ├── screens/
│           │   ├── auth/       # LoginScreen
│           │   ├── home/       # HomeScreen (KPIs + último avance)
│           │   ├── history/    # GradeHistoryScreen (gráfico línea)
│           │   ├── profile/    # ProfileScreen
│           │   ├── reports/    # ReportsScreen (descarga PDF)
│           │   └── reviews/    # ReviewsList + FindingDetail + FindingItemDetail
│           ├── services/       # api.ts (Axios + interceptor JWT)
│           └── store/          # authStore.ts (Zustand + SecureStore)
│
├── packages/
│   ├── database/               # Prisma schema + seeds
│   │   ├── prisma/schema.prisma  # 20+ modelos: User, Advance, AIAnalysis, ChatConversation, etc.
│   │   └── seed.ts             # Datos de prueba (usuarios, programas, templates)
│   ├── ai-engine/              # Pipeline IA compartido (compilar antes de usar)
│   │   └── src/
│   │       ├── pipeline/       # AnalysisPipeline (análisis + generación)
│   │       ├── providers/      # Registry de proveedores IA
│   │       └── prompts.ts      # Prompts de análisis y generación
│   └── shared-types/           # TypeScript types compartidos
│
├── docker-compose.yml          # PostgreSQL+pgvector, Redis, MinIO, API, Web
├── turbo.json                  # Configuración Turborepo
├── setup.ps1                   # Script de setup paso 1 (infra + DB)
├── setup2.ps1                  # Script de setup paso 2 (AI engine + MinIO + Chromium)
└── .env.example                # Plantilla de variables de entorno
```

---

## 🚀 Instalación y Ejecución

### Prerequisitos

- **Node.js >= 20** (recomendado: 22 LTS)
- **Docker Desktop** con Docker Compose v2
- **npm >= 10**
- **API Key de IA** (opcional): OpenAI, Groq, Gemini, DeepSeek, Claude o MiniMax *(el sistema funciona en modo simulación sin ninguna key)*

---

### ⚡ Opción 1: Setup Automático (Recomendado)

Ejecuta ambos scripts en orden. Hacen **todo** automáticamente:

```powershell
# Paso 1: Infraestructura, DB y dependencias
.\setup.ps1

# Paso 2: Compilar AI Engine, crear bucket MinIO, instalar Chromium para PDF
.\setup2.ps1
```

**setup.ps1** hace:
1. Copia `.env.example` → `.env` y `packages/database/.env`
2. Levanta los contenedores Docker (postgres, redis, minio)
3. Espera que PostgreSQL esté healthy
4. Instala dependencias npm del monorepo completo
5. Genera el cliente Prisma
6. Sincroniza el esquema con la DB (pgvector incluido)
7. Siembra usuarios y datos de prueba

**setup2.ps1** hace:
1. Compila `packages/ai-engine` a `dist/`
2. Crea el bucket `thesis-documents` en MinIO
3. Instala Chromium para Puppeteer (necesario para PDF)

> [!TIP]
> Después del setup inicial, para desarrollo diario solo necesitas los 3 comandos de la Opción 2.

---

### 🔧 Opción 2: Desarrollo Diario (Recomendado en Windows)

```powershell
# Terminal 1 — Solo servicios (PostgreSQL, Redis, MinIO)
docker compose up -d postgres redis minio

# Terminal 2 — API NestJS en modo watch
npm run dev --workspace=@kimy/api

# Terminal 3 — Web Next.js
npm run dev --workspace=@kimy/web
```

> [!IMPORTANT]
> **Docker Desktop en Windows es lento para desarrollo** con bind mounts. Ejecutar API y Web directamente en Windows (sin VM) es **5-10x más rápido** que correr todo dentro de Docker. Solo dockeriza los servicios de infraestructura (postgres, redis, minio).

---

### 📱 Opción 3: App Móvil (Expo)

La app móvil se ejecuta **independientemente** de Docker.

```bash
# Instalar dependencias de la app móvil
cd apps/mobile
npm install

# Iniciar servidor de desarrollo Expo
npx expo start

# Opciones:
# - Escanear QR con Expo Go (Android/iOS)
# - Presionar 'a' para Android emulator
# - Presionar 'i' para iOS simulator
# - Presionar 'w' para abrir en browser
```

> [!IMPORTANT]
> Asegúrate de que el backend esté corriendo antes de usar la app móvil.
>
> **Configuración de URL del API:** Por defecto la app conecta a `http://192.168.1.41:3001`. Si usas dispositivo físico, actualiza `EXPO_PUBLIC_API_URL` en `.env` con la IP local de tu máquina. Si solo usas emulador, cambia a `http://localhost:3001`.

---

### 🌐 URLs del Sistema

| Servicio | URL | Notas |
|----------|-----|-------|
| **Frontend Web** | http://localhost:3000 | Next.js 15 |
| **API REST** | http://localhost:3001 | NestJS |
| **Swagger / OpenAPI** | http://localhost:3001/api/docs | Documentación interactiva |
| **MinIO Console** | http://localhost:9001 | Storage S3 (bucket: `thesis-documents`) |
| **PostgreSQL** | `localhost:5434` | ⚠️ Puerto **5434** (no 5432) |
| **Redis** | `localhost:6379` | BullMQ broker |

> [!IMPORTANT]
> PostgreSQL en Docker mapea al puerto **`5434`** (no al 5432 estándar). El archivo `.env.example` ya está configurado correctamente: `DATABASE_URL=postgresql://kimy:kimy_secret_2026@localhost:5434/kimy_thesis`

---

### 🔑 Credenciales de Prueba

Contraseña para todos los usuarios: **`Kimy2026!`**

| Rol | Email |
|-----|-------|
| **Administrador** | `admin@kimy.edu` / `ayrton@kimy.edu` |
| **Coordinador** | `coordinador@kimy.edu` |
| **Asesor** | `asesor1@kimy.edu` / `asesor2@kimy.edu` |
| **Estudiante** | `estudiante1@kimy.edu` / `estudiante2@kimy.edu` / `estudiante3@kimy.edu` |

---

## 📐 Arquitectura

```
┌─────────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Next.js 15 Web    │────▶│   NestJS API     │────▶│  PostgreSQL  │
│   (port 3000)       │     │   (port 3001)    │     │  + pgvector  │
└─────────────────────┘     └──────┬───────────┘     └──────────────┘
                                   │                        │
          ┌────────────────────────┼──────────────┐         │ MinIO S3
          │                        │              │         │ (storage)
┌─────────▼─────────┐   ┌──────────▼──────────┐  │  ┌──────▼─────────┐
│   Expo App Móvil   │   │   BullMQ Workers    │  │  │  Chat IA (SSE) │
│   (estudiantes)    │   │   (Redis)           │  │  │  + Tool Calling│
└───────────────────┘   └──────────┬───────────┘  │  └───────┬────────┘
                                   │              │          │
     ┌─────────────────────────────┼──────────────┼──────────┘
     ▼                             ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────────────┐
│ OpenAI /  │  │  DeepSeek │  │  CrossRef │  │  Puppeteer (Chrome)  │
│Groq/Gemini│  │Claude/Mini│  │    API    │  │  PDF + Mermaid → PNG │
└───────────┘  └───────────┘  └───────────┘  └──────────────────────┘
```

---

## 🤖 Pipeline de Análisis IA

Al cargar un avance, se ejecuta automáticamente:

```
Avance (DOCX/PDF)
       │
       ▼
1. EXTRACCIÓN     → mammoth.js (DOCX) / pdf-parse (PDF)
       │
       ▼
2. CHUNKING       → RecursiveCharacterTextSplitter (~1500 tokens)
       │
       ▼
3. EMBEDDINGS     → text-embedding-3-large → almacena en pgvector (3072 dims)
       │
       ├──────────────────────────────────────────────────┐
       ▼                                                  ▼
4. ANÁLISIS IA (multi-proveedor con fallback)        DETECCIÓN PLAGIO
   OpenAI · Groq · Gemini · DeepSeek                pgvector <=> coseno
   Claude · MiniMax · Simulación                    + Copyleaks API (opcional)
   ├── Evaluación estructura (30%)
   ├── Evaluación contenido  (40%)                  VALIDACIÓN CITAS
   ├── Evaluación forma      (20%)                  CrossRef API
   └── Evaluación originalidad(10%)                 (verified/partial/hallucinated)
       │
       ▼
5. OUTPUT
   ├── Score por dimensión + nota decimal (0-20)
   ├── Hallazgos (descripción, instrucción, ejemplo, severidad)
   └── Resumen ejecutivo IA
       │
       ▼
6. NOTIFICACIÓN PUSH → Expo Push API → App Móvil (estudiante)
```

> El modelo activo se lee dinámicamente desde `SystemSettings.aiModel`/`aiProvider` en la DB, lo que permite cambiar de proveedor o activar modelos fine-tuneados **sin reiniciar el servidor**.

---

## 📊 Módulos del Sistema

| # | Módulo | Descripción | Roles |
|---|--------|-------------|-------|
| 1 | **Auth** | JWT + Roles (4 niveles) + 2FA TOTP + recuperación contraseña | Todos |
| 2 | **Documentos Patrón** | Upload y versionado de templates institucionales | COORD / ADMIN |
| 3 | **Dashboard** | KPIs, alertas, concordancia IA-Humano | ADVISOR+ |
| 4 | **Avances** | Upload DOCX/PDF, versionado, previsualización | Todos |
| 5 | **Análisis IA** | Pipeline automatizado (análisis + plagio + citas) | Auto |
| 6 | **Revisión** | Panel lado a lado, feedback humano → FineTuningPair | ADVISOR+ |
| 7 | **Revisión Masiva** | Análisis por lotes con progreso en tiempo real | COORD / ADMIN |
| 8 | **Plagio** | pgvector coseno + Copyleaks API configurable | ADVISOR+ |
| 9 | **Referencias** | CrossRef API con rate limiting (1 req/seg) | Auto |
| 10 | **ORCID** | OAuth 2.0 + publicaciones + validación expertise | ADVISOR |
| 11 | **Reportes** | PDF con membrete, plagio, citas, evaluación completa | Todos |
| 12 | **Estadísticas** | Gráficos radar, histograma, concordancia IA (Recharts) | ADVISOR+ |
| 13 | **Fine-tuning** | Export JSONL + activación de modelos en producción | ADMIN |
| 14 | **Notificaciones** | Push real (Expo API) + in-app | Todos |
| 15 | **Chat IA** | Chat streaming SSE multi-proveedor con tool calls DB, STT y TTS | Todos |
| 16 | **App Móvil** | Dashboard, hallazgos, notas, PDF download, push notifications | STUDENT |
| 17 | **Generador IA Tesis** | Generación de contenido académico desde template con PDF/DOCX | Todos |
| 18 | **Generador Diagramas** | Diagramas Mermaid renderizados a PNG, embebibles en PDF/DOCX | Auto |

---

## 🧠 Pipeline de Fine-Tuning

El sistema acumula correcciones de asesores para mejorar el modelo de IA continuamente.

### 1. Acumulación automática

Cada vez que un asesor acepta con edición, modifica o rechaza un hallazgo, se crea un `FineTuningPair` automáticamente.

### 2. Exportar dataset JSONL (requiere 500+ pares)

```bash
# Via API (recomendado):
curl -X POST http://localhost:3001/api/fine-tuning/export \
  -H "Authorization: Bearer <admin-token>"
```

### 3. Entrenar en OpenAI

```bash
# Subir el archivo JSONL
curl https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F purpose="fine-tune" \
  -F file="@finetuning-dataset.jsonl"

# Crear el job de fine-tuning
curl https://api.openai.com/v1/fine_tuning/jobs \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "training_file": "<file_id_del_paso_anterior>",
    "model": "gpt-4o-mini-2024-08-06"
  }'
```

### 4. Activar el modelo fine-tuneado (sin reiniciar el servidor)

```bash
# Activar — el próximo análisis usará este modelo
curl -X POST http://localhost:3001/api/fine-tuning/datasets/<dataset-id>/activate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"modelId": "ft:gpt-4o-mini-2024-08-06:tu-org:kimy:xxxxxxx"}'

# Verificar modelo activo
curl http://localhost:3001/api/fine-tuning/active-model \
  -H "Authorization: Bearer <admin-token>"

# Desactivar (restaurar modelo base)
curl -X POST http://localhost:3001/api/fine-tuning/deactivate \
  -H "Authorization: Bearer <admin-token>"
```

> [!NOTE]
> El modelo activo se guarda en `SystemSettings.aiModel` en la base de datos.
> El servicio de análisis lo lee en cada request, sin necesidad de reiniciar el servidor.

---

## 💬 Chat IA Multi-Proveedor

El sistema incluye un chat inteligente accesible desde el dashboard (widget flotante + página completa):

| Capacidad | Descripción |
|-----------|-------------|
| **Streaming SSE** | Respuestas en tiempo real con eventos `text`, `tool_calls`, `tool_result`, `done`, `error` |
| **6 Proveedores IA** | OpenAI, Groq, DeepSeek, Gemini, Claude, MiniMax — seleccionables por conversación |
| **Tool Calling** | 13 herramientas que consultan la DB en tiempo real (avances, estadísticas, generaciones IA, actividad reciente, etc.) |
| **Speech-to-Text** | Transcripción de audio vía OpenAI Whisper con fallback a Groq Whisper |
| **Text-to-Speech** | Síntesis de voz vía OpenAI TTS (`tts-1-hd`, voz `nova`) con fallback a Google Translate TTS |
| **Conversaciones** | Creación, listado, renombrado y eliminación con historial de hasta 40 mensajes |
| **Widget Flotante** | Acceso rápido desde cualquier página del dashboard |

### Tools disponibles en Chat

| Tool | Descripción |
|------|-------------|
| `count_thesis_by_status` | Conteo de avances por estado |
| `count_thesis_above_grade` | Avances con nota >= X |
| `get_student_stats` | Estadísticas de un estudiante |
| `get_student_average` | Promedio de notas de un estudiante |
| `get_global_stats` | Estadísticas globales (con filtro de fecha) |
| `get_program_stats` | Estadísticas por programa académico |
| `get_ai_generation_stats` | Estadísticas del Generador IA |
| `get_system_overview` | Vista general completa del sistema |
| `get_user_generations` | Generaciones IA de un usuario |
| `get_user_advances_detailed` | Avances de un estudiante con filtros |
| `get_recent_activity` | Actividad reciente del sistema |
| `list_thesis_advances` | Lista detallada de avances con notas y estados |
| `list_ai_generations` | Lista detallada de tesis generadas por IA |

### Endpoints del Chat

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/chat/send` | Enviar mensaje y recibir respuesta SSE | JWT |
| POST | `/api/chat/speech-to-text` | Transcribir audio subido (max 25MB) | JWT |
| POST | `/api/chat/text-to-speech` | Convertir texto a audio MP3 | JWT |
| GET | `/api/chat/conversations` | Listar conversaciones del usuario | JWT |
| GET | `/api/chat/conversations/:id/messages` | Obtener mensajes de una conversación | JWT |
| DELETE | `/api/chat/conversations/:id` | Eliminar una conversación | JWT |
| PATCH | `/api/chat/conversations/:id` | Renombrar una conversación | JWT |

> **Stack:** SSE sobre HTTP (no WebSockets). Los streams se procesan con OpenAI SDK, Anthropic SDK o Gemini SDK nativo según el proveedor activo. Gemini usa SDK nativo para evitar incompatibilidades con LangChain.

---

## 🏗️ Generador IA de Informes de Tesis

El generador crea contenido académico completo desde la estructura de un documento patrón institucional:

| Capacidad | Descripción |
|-----------|-------------|
| **Generación desde Template** | Selecciona un documento patrón y las secciones a generar |
| **Multi-Proveedor independiente** | Usa cualquier proveedor IA configurado, independiente del sistema |
| **Rango de Páginas** | Controla la extensión: 20-30 / 30-40 / 40-50 / 50-60 / 60-70 / 70-80 / +80 páginas |
| **Exportación PDF** | Genera PDF formateado (Puppeteer) con estilos del template (fuente, márgenes, interlineado, numeración) |
| **Exportación DOCX** | Genera documento Word (librería `docx`) con el mismo formato del template |
| **Diagramas Mermaid** | Los diagramas del contenido se renderizan a PNG y se embeben en PDF y DOCX |
| **Historial Persistente** | Todas las generaciones se guardan en DB con CRUD completo |
| **Fallback Automático** | Si el proveedor falla, intenta con los 5 restantes antes de marcar error |

### Endpoints del Generador

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/thesis-generator/generate` | Generar contenido académico | JWT |
| GET | `/api/thesis-generator/history` | Listar generaciones del usuario | JWT |
| GET | `/api/thesis-generator/history/:id` | Obtener una generación con contenido | JWT |
| DELETE | `/api/thesis-generator/history/:id` | Eliminar una generación (solo dueño) | JWT |
| GET | `/api/thesis-generator/history/:id/pdf` | Descargar como PDF | JWT |
| GET | `/api/thesis-generator/history/:id/docx` | Descargar como DOCX | JWT |
| GET | `/api/thesis-generator/templates/:id/sections` | Obtener secciones disponibles de un template | JWT |

---

## 📈 Generador de Diagramas (Mermaid)

El módulo `diagram-generator` permite crear diagramas técnicos y académicos automáticamente:

- **DiagramGeneratorService**: Genera definiciones Mermaid usando IA (flujo de trabajo, arquitectura, Gantt, etc.)
- **DiagramRendererService**: Renderiza definiciones Mermaid a PNG usando Puppeteer (Chrome headless)
- **Integración en PDF/DOCX**: Los bloques `\`\`\`mermaid` del contenido generado se convierten a imágenes PNG y se embeben automáticamente en la exportación

> [!IMPORTANT]
> Requiere Chromium instalado: `npx puppeteer browsers install chrome`
> El `setup2.ps1` lo instala automáticamente.

---

## 🔐 Autenticación 2FA (TOTP)

El sistema implementa autenticación de dos factores con Google Authenticator o apps compatibles TOTP:

| Endpoint | Descripción | Nota crítica |
|----------|-------------|--------------|
| `POST /api/auth/2fa/enable` | Iniciar activación — devuelve QR y secreto | Usa `BadRequestException` (no 401) |
| `POST /api/auth/2fa/verify` | Verificar código y activar 2FA definitivamente | Usa `BadRequestException` (no 401) |
| `POST /api/auth/2fa/disable` | Desactivar 2FA | Usa `BadRequestException` (no 401) |
| `POST /api/auth/2fa/authenticate` | Autenticar con código TOTP después del login | Usa `BadRequestException` (no 401) |

> [!CAUTION]
> **Nunca uses `UnauthorizedException` (HTTP 401) en endpoints 2FA.** El interceptor Axios de la web captura el 401 y hace logout automático, interrumpiendo el flujo de 2FA. Todos los errores 2FA deben lanzar `BadRequestException` (400).

**Estado en memoria (no Redis):**
- `temp2faSecrets` Map — secreto TOTP entre `enable` y `confirm-enable` (TTL 10 min)
- `loginAttempts` Map — 5 fallos → bloqueo 15 min
- `recoveryTokens` Map — tokens de recuperación de contraseña

---

## 📄 Configuración del Documento Patrón

### Subir un Documento Patrón

1. Inicia sesión como **Coordinador** o **Administrador**
2. Ve a **Dashboard → Doc. Patrón → Nueva Plantilla**
3. Selecciona el archivo (PDF o DOCX, máximo 50MB)
4. Ingresa nombre y versión (ej: `Tesis Maestría v2.0`)
5. Selecciona el programa académico y el estilo de citas (APA/Vancouver)

### Extracción automática de estructura y formato

Al subir, el sistema extrae:

1. **Esquema de secciones** (`extractedSchema`): estructura jerárquica del template
2. **Formato institucional** (`formatting`): fuente, tamaño, márgenes, interlineado, sangría, numeración de páginas — usado para exportar PDF/DOCX con el mismo formato del template original

```json
{
  "sections": [
    {"name": "CAPÍTULO I: INTRODUCCIÓN", "level": 1, "required": true, "estimatedWords": 3000},
    {"name": "PLANTEAMIENTO DEL PROBLEMA", "level": 2, "required": true}
  ],
  "citationStyle": "APA",
  "writingStyle": "Académico formal"
}
```

### Pesos de evaluación por dimensión

| Dimensión | Peso Default |
|-----------|-------------|
| Estructura | 30% |
| Contenido | 40% |
| Forma | 20% |
| Originalidad | 10% |

---

## 🔗 Integración ORCID

### Configuración

```env
ORCID_CLIENT_ID=APP-XXXXXXXXXXXXXXXXX
ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> Sandbox: https://sandbox.orcid.org — Producción: https://orcid.org

### Flujo de vinculación

1. Asesor → **Mi Perfil → Vincular ORCID**
2. Redirige a `GET /api/orcid/authorize` → OAuth ORCID
3. Callback en `GET /api/orcid/callback` → obtiene token
4. El sistema sincroniza: nombre, afiliación, publicaciones (título, año, DOI, journal)

### Validación de expertise

El sistema compara semánticamente las publicaciones ORCID del asesor con el título de la tesis supervisada mediante embeddings. Si la similitud es baja (< 60%), el coordinador recibe una alerta.

---

## 🔍 Detección de Plagio

### Método interno (siempre activo)

pgvector con distancia coseno (`<=>`) entre embeddings de chunks. Umbral: **85% de similitud**.

### Copyleaks API (opcional)

```env
COPYLEAKS_ACCESS_TOKEN=tu-token-de-copyleaks
```

| Método | Cobertura | Umbral | Costo |
|--------|-----------|--------|-------|
| pgvector (interno) | Avances del mismo programa | > 85% similitud coseno | Gratis |
| Copyleaks API | Internet + repositorios académicos | Configurable | API calls |

---

## 📡 Referencia de API

Documentación completa interactiva: **http://localhost:3001/api/docs**

### Endpoints principales

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/auth/login` | Login JWT | Público |
| POST | `/api/auth/2fa/enable` | Iniciar activación 2FA | JWT |
| POST | `/api/auth/2fa/verify` | Verificar código y activar 2FA | JWT |
| POST | `/api/auth/2fa/disable` | Desactivar 2FA | JWT |
| POST | `/api/auth/2fa/authenticate` | Autenticar con código TOTP | TempToken |
| GET | `/api/advances` | Listar avances del usuario | JWT |
| POST | `/api/advances` | Subir nuevo avance | JWT |
| GET | `/api/advances/:id` | Detalle de un avance | JWT |
| GET | `/api/ai-analysis/:advanceId` | Obtener análisis IA | JWT |
| POST | `/api/ai-analysis/:id/analyze` | Solicitar análisis | JWT |
| POST | `/api/ai-analysis/:id/reanalyze` | Re-analizar avance | JWT |
| POST | `/api/ai-analysis/:id/detailed-feedback` | Generar feedback detallado | JWT |
| GET | `/api/review/finding/:id` | Obtener hallazgo | JWT |
| POST | `/api/review/finding/:id/feedback` | Feedback humano → FineTuningPair | ADVISOR |
| GET | `/api/orcid/authorize` | Iniciar OAuth ORCID | ADVISOR |
| GET | `/api/orcid/callback` | Callback OAuth ORCID | Público |
| POST | `/api/fine-tuning/export` | Exportar dataset JSONL | ADMIN |
| POST | `/api/fine-tuning/datasets/:id/activate` | Activar modelo fine-tuneado | ADMIN |
| POST | `/api/fine-tuning/deactivate` | Desactivar modelo fine-tuneado | ADMIN |
| GET | `/api/fine-tuning/active-model` | Modelo activo actual | ADMIN |
| POST | `/api/notifications/push-token` | Registrar token push móvil | JWT |
| GET | `/api/notifications` | Listar notificaciones | JWT |
| PATCH | `/api/notifications/:id/read` | Marcar notificación como leída | JWT |
| GET | `/api/notifications/unread-count` | Contador de no leídas | JWT |
| GET | `/api/reports/advance/:id/html` | Vista previa HTML del acta | JWT |
| GET | `/api/reports/advance/:id/pdf` | Descargar acta PDF | JWT |
| POST | `/api/reports/advance/:id/send-email` | Enviar acta por correo | JWT |
| POST | `/api/reports/batch-pdf` | Descargar ZIP con PDFs masivos | COORD/ADMIN |
| POST | `/api/reports/batch-send-email` | Enviar emails masivos | COORD/ADMIN |
| GET | `/api/dashboard/kpi` | KPIs del dashboard | JWT |
| GET | `/api/templates` | Listar documentos patrón | JWT |
| GET | `/api/settings` | Obtener configuración del sistema | JWT |
| PATCH | `/api/settings` | Actualizar configuración del sistema | ADMIN |
| GET | `/api/settings/providers` | Proveedores IA disponibles con estado | JWT |
| POST | `/api/chat/send` | Chat IA streaming SSE | JWT |
| POST | `/api/chat/speech-to-text` | Transcripción de audio | JWT |
| POST | `/api/chat/text-to-speech` | Síntesis de voz | JWT |
| GET | `/api/chat/conversations` | Listar conversaciones | JWT |
| POST | `/api/thesis-generator/generate` | Generar contenido académico | JWT |
| GET | `/api/thesis-generator/history` | Historial de generaciones | JWT |
| GET | `/api/thesis-generator/history/:id/pdf` | Descargar PDF de generación | JWT |
| GET | `/api/thesis-generator/history/:id/docx` | Descargar DOCX de generación | JWT |

### Roles y permisos

| Rol | Avances | Revisión | Dashboard | Chat | Generador IA | Fine-tuning | Admin |
|-----|---------|----------|-----------|------|-------------|-------------|-------|
| **Estudiante** | Propios | Ver resultados | Limitado | ✓ | ✓ | ✗ | ✗ |
| **Asesor** | Sus estudiantes | Revisar + feedback | Completo | ✓ | ✓ | ✗ | ✗ |
| **Coordinador** | Todo el programa | Todo | Completo + bulk | ✓ | ✓ | ✗ | ✗ |
| **Administrador** | Todo | Todo | Completo | ✓ | ✓ | ✓ | ✓ |

---

## 📦 Dependencias Principales por Paquete

### `apps/api` (NestJS Backend)

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@nestjs/common` / `core` | ^11.0.0 | Framework NestJS |
| `@nestjs/bullmq` + `bullmq` | ^11 / ^5 | Cola de trabajos IA (BullMQ + Redis) |
| `@nestjs/jwt` + `passport-jwt` | ^11 / ^4 | Autenticación JWT |
| `@nestjs/swagger` | ^11.0.0 | Documentación OpenAPI |
| `@google/generative-ai` | ^0.24.1 | Gemini SDK nativo (sin LangChain) |
| `@kimy/ai-engine` | workspace:* | Pipeline IA compartido |
| `@prisma/client` + `prisma` | ^6.3.0 | ORM PostgreSQL |
| `archiver` | ^8.0.0 | Generación de ZIP para PDFs batch |
| `bcryptjs` | ^2.4.3 | Hash de contraseñas |
| `class-transformer` + `class-validator` | ^0.5 / ^0.14 | Validación de DTOs |
| `docx` | ^9.7.1 | Generación de DOCX |
| `handlebars` | ^4.7.8 | Templates HTML para actas PDF |
| `image-size` | ^1.2.1 | Dimensiones de imágenes PNG (Mermaid) |
| `marked` | ^18.0.5 | Parser Markdown → HTML / tokens DOCX |
| `minio` | ^8.0.0 | Cliente MinIO S3 |
| `multer` | ^1.4.5-lts.1 | Upload de archivos multipart |
| `nodemailer` | ^6.10.1 | Envío de correos (actas PDF) |
| `puppeteer` | ^23.11.1 | Chrome headless (PDF + Mermaid PNG) |
| `qrcode` | ^1.5.4 | Generación QR para 2FA |
| `speakeasy` | ^2.0.0 | TOTP para autenticación 2FA |

### `packages/ai-engine` (Pipeline IA)

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@anthropic-ai/sdk` | ^0.100.1 | Claude (Anthropic) |
| `@google/generative-ai` | ^0.21.0 | Gemini nativo |
| `@langchain/core` | ^0.3.80 | LangChain core |
| `@langchain/openai` | ^0.4.0 | GPT-4o / Groq / DeepSeek / MiniMax vía OpenAI-compat |
| `langchain` | ^0.3.0 | Pipeline completo |
| `mammoth` | ^1.8.0 | Extracción de texto DOCX |
| `pdf-parse` | ^1.1.1 | Extracción de texto PDF |

### `apps/web` (Next.js 15)

| Paquete | Versión | Uso |
|---------|---------|-----|
| `next` | ^15.2.0 | Framework web |
| `react` + `react-dom` | ^19.0.0 | UI |
| `@tanstack/react-query` | ^5.62.0 | Gestión de estado servidor |
| `axios` | ^1.7.0 | Cliente HTTP |
| `lucide-react` | ^0.468.0 | Iconos |
| `react-markdown` + `remark-gfm` | ^10 / ^4 | Renderizado de Markdown |
| `recharts` | ^2.15.0 | Gráficos (dashboard/estadísticas) |
| `shadcn` + componentes radix-ui | ^4.7.0 | Componentes UI |
| `sonner` | ^1.7.0 | Toast notifications |
| `tailwindcss` | ^3.4.0 | Estilos CSS |

### `apps/mobile` (Expo SDK 54)

| Paquete | Versión | Uso |
|---------|---------|-----|
| `expo` | ~54.0.0 | SDK Expo |
| `react-native` | 0.81.5 | Framework móvil |
| `expo-notifications` | ~0.32.17 | Push notifications |
| `expo-secure-store` | ~15.0.8 | Almacenamiento seguro (JWT) |
| `expo-router` | ~6.0.23 | Navegación basada en archivos |
| `@tanstack/react-query` | ^5.64.1 | Gestión de estado servidor |
| `react-native-reanimated` | ~4.1.1 | Animaciones nativas |
| `zustand` | ^5.0.3 | Estado global (auth) |

---

## 🔧 Scripts de Utilidad

```bash
# ─── Base de Datos ────────────────────────────────────────────────
# Regenerar cliente Prisma (después de modificar schema.prisma)
npm run db:generate

# Sincronizar schema con la DB (después de modificar schema.prisma)
npm run db:push

# ⚠️ Ambos son necesarios después de modificar el schema
# En Windows puede aparecer: "EPERM: rename query_engine-windows.dll.node"
# Solución: parar el watcher de NestJS y reintentar

# Reset completo de la base de datos
npm run db:push -- --force && npm run db:seed

# Abrir Prisma Studio (UI visual)
npm run db:studio

# ─── AI Engine ────────────────────────────────────────────────────
# Compilar después de modificar packages/ai-engine/src/
npm run build --workspace=@kimy/ai-engine
# o
cd packages/ai-engine && npm run build

# La API importa desde dist/ — SIEMPRE recompilar después de cambios

# ─── Chat IA ──────────────────────────────────────────────────────
# El chat está disponible en:
#   Web:   http://localhost:3000/dashboard/chat
#   Widget flotante en todas las páginas del dashboard
#   API:   POST /api/chat/send (SSE streaming)

# ─── Generador IA de Tesis ───────────────────────────────────────
# El generador está disponible en:
#   Web:   http://localhost:3000/dashboard/thesis-generator
#   API:   POST /api/thesis-generator/generate

# ─── App Móvil ────────────────────────────────────────────────────
cd apps/mobile
npm install          # Primera vez
npx expo start       # Modo desarrollo
npx expo start --clear   # Limpiar caché

# ─── Docker ───────────────────────────────────────────────────────
# Solo infraestructura (recomendado para desarrollo en Windows)
docker compose up -d postgres redis minio

# Ver logs de todos los servicios
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f api

# Reiniciar solo el backend
docker compose restart api

# Parar todo
docker compose down

# Parar y eliminar volúmenes (⚠️ borra los datos)
docker compose down -v

# Limpiar recursos Docker huérfanos
docker system prune -a --volumes

# ─── Backup ───────────────────────────────────────────────────────
docker compose exec postgres pg_dump -U kimy kimy_thesis > backup_$(date +%Y%m%d).sql
```

---

## 🚨 Solución de Problemas

### Error: `@prisma/client did not initialize yet`

**Causa:** Binarios de Prisma generados en Windows no son compatibles con Linux (Docker).

```bash
docker compose exec api npm run db:generate
docker compose restart api
```

### Error: `EPERM: rename query_engine-windows.dll.node`

**Causa:** Race condition de Windows al regenerar Prisma con el watcher activo.

**Solución:** Parar el watcher de NestJS (`Ctrl+C`) y luego ejecutar `npm run db:generate`.

### Error: `DATABASE_URL not found`

```powershell
Copy-Item -Path .env -Destination packages/database/.env
npm run db:push
```

### Error: `ECONNREFUSED` en Redis

```bash
docker compose up -d redis
```

### Error: `Cannot find module '@kimy/ai-engine'` o cambios no se reflejan en API

**Causa:** `@kimy/ai-engine` compila a `dist/` y la API importa desde allí. Si modificas prompts, pipeline o tipos, la API no lo ve hasta que recompiles.

```powershell
npm run build --workspace=@kimy/ai-engine
```

### Error: `401 Unauthorized` en análisis IA

1. Verifica en `.env`: `OPENAI_API_KEY=sk-...`
2. El sistema activa **modo simulación** automáticamente si no hay API key válida
3. Alternativas gratuitas: `GEMINI_API_KEY` o `GROQ_API_KEY`

### Error: `Connection refused` en MinIO

```bash
docker compose up -d minio
# Acceder a http://localhost:9001 y crear el bucket 'thesis-documents'
# O ejecutar setup2.ps1 para crearlo automáticamente
```

### Avance se queda en `AI_PROCESSING`

```bash
# Revisar logs del worker de IA
docker compose logs -f api | grep "ai-analysis"

# Re-intentar el análisis via API
curl -X POST http://localhost:3001/api/ai-analysis/<advance-id>/reanalyze \
  -H "Authorization: Bearer <token>"
```

### Error al generar PDF: `No se pudo iniciar Chromium`

```powershell
# Instalar Chromium para Puppeteer
npx puppeteer browsers install chrome
# O ejecutar setup2.ps1 que lo hace automáticamente
```

### App Móvil no conecta al backend

1. Verifica que Docker esté corriendo: `docker compose ps`
2. Si usas dispositivo físico, actualiza `EXPO_PUBLIC_API_URL=http://<IP-LOCAL>:3001` en `.env`
3. Limpia caché de Expo: `npx expo start --clear`

### El sitio web carga muy lento en desarrollo

**Causa:** Docker Desktop en Windows tiene un cuello de botella con bind mounts.

**Solución:** Corre web y API fuera de Docker:

```bash
docker compose up -d postgres redis minio
npm run dev --workspace=@kimy/api
npm run dev --workspace=@kimy/web
```

### Error: `pgvector operator <=> not found`

```sql
-- Ejecutar en Prisma Studio o psql:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error push notifications no llegan

1. Push notifications reales requieren dispositivo físico (no simulador)
2. Verifica que el token se registre: `POST /api/notifications/push-token`
3. Los tokens deben tener formato `ExponentPushToken[...]`
4. Para producción se requiere EAS (Expo Application Services)

### Error: `ORCID callback failed`

1. Verifica `ORCID_CLIENT_ID` y `ORCID_CLIENT_SECRET` en `.env`
2. El `redirect_uri` debe ser exactamente: `http://localhost:3001/api/orcid/callback`
3. Para producción, usa credenciales de ORCID production (no sandbox)

---

## 🧱 Decisiones de Arquitectura

| Decisión | Opción elegida | Razón |
|----------|---------------|-------|
| Monorepo | Turborepo (npm workspaces) | Pipeline de build compartido entre web, api y packages |
| Embeddings | pgvector (PostgreSQL) | Evita servicio adicional; excelente para < 1M vectores |
| Colas | BullMQ + Redis | Workers independientes y escalables horizontalmente |
| Fine-tuning | OpenAI Fine-Tuning API | Mejor calidad para evaluación académica estructurada |
| Push | Expo Push API | Compatible con iOS + Android sin servidores propios |
| Storage | MinIO | S3-compatible, self-hosted, sin costo de nube |
| IA Fallback | Groq → DeepSeek → OpenAI → Claude → MiniMax → Simulación | 6 niveles de respaldo para alta disponibilidad |
| Chat IA | SSE streaming (no WebSockets) | Compatible con cualquier proveedor; tool calling para queries DB en tiempo real |
| Generador Tesis | Pipeline independiente con maxTokens 16384 | Doblado del límite de análisis; exportación PDF/DOCX con formato de template |
| Diagramas | Mermaid → Puppeteer → PNG | Diagramas técnicos renderizados como imagen embebible en PDF y DOCX |
| Modelo activo | SystemSettings en BD | Permite A/B testing sin reiniciar servicios |
| Gemini SDK | SDK nativo (`@google/generative-ai`) | La versión de LangChain del proyecto no soporta Gemini 2.0 |
| 2FA | TOTP en memoria (no Redis/DB) | TTL simple sin overhead de serialización; datos temporales sin persistencia necesaria |

---

## 📝 Licencia

Proyecto académico — QUIÑONES JARA + ANGELDONES MENDOZA — Universidad Nacional de Trujillo — 2026
