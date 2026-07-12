# Plan: Generador IA de Informes de Tesis

> Archivo de planificación — NO eliminar. Pendiente de implementación.

---

## Resumen

Nueva sección en el dashboard donde el usuario:
1. **Selecciona un template** (documento patrón)
2. **Elige secciones** a generar (checkboxes)
3. **Ingresa el tema** de la tesis
4. **Escribe un prompt personalizado** (opcional)
5. **Selecciona el proveedor IA** (independiente de Settings)
6. La IA **genera contenido académico** siguiendo la estructura del template

---

## Arquitectura

```
Frontend (Web)                           Backend (API)                             AI Engine
┌─────────────────────────────┐   POST /api/thesis-generator/generate   ┌──────────────────────┐
│ /dashboard/thesis-generator │ ──────────────────────────────────────► │ ThesisGeneratorModule │───► AnalysisPipeline.generateThesis()
│  · template dropdown        │   { templateId, topic, prompt,          │  ├─ controller        │     ├─ Construye prompt con:
│  · section checkboxes       │     sectionNames, aiProvider, aiModel } │  ├─ service           │     │  · TemplateSchema (estructura)
│  · topic input              │ ◄────────────────────────────────────── │  └─ dto               │     │  · TemplateText (estilo, opcional)
│  · prompt textarea          │   { content, sections[] }               │     └─ MinIO download  │     │  · Tópico del usuario
│  · provider selector        │                                         │        (template doc)  │     │  · Prompt del usuario
│  · result (HTML+Markdown)   │                                         └──────────────────────┘     │  · Lista de secciones
└─────────────────────────────┘                                                                     └───► Respuesta: markdown
```

---

## Archivos a crear (6)

| # | Archivo | Propósito |
|---|---------|-----------|
| 1 | `apps/api/src/thesis-generator/thesis-generator.module.ts` | Módulo NestJS |
| 2 | `apps/api/src/thesis-generator/thesis-generator.controller.ts` | Endpoints REST |
| 3 | `apps/api/src/thesis-generator/thesis-generator.service.ts` | Lógica de orquestación |
| 4 | `apps/api/src/thesis-generator/dto/generate.dto.ts` | Validación DTO |
| 5 | `apps/web/src/app/dashboard/thesis-generator/page.tsx` | Página completa del generador |
| 6 | `apps/web/src/app/dashboard/thesis-generator/loader.tsx` | Componente de loading animado |

---

## Archivos a modificar (6)

| # | Archivo | Cambio |
|---|---------|--------|
| 7 | `packages/ai-engine/src/types.ts` | Agregar `ThesisGenRequest`, `ThesisGenResult`, `ThesisGenSection` |
| 8 | `packages/ai-engine/src/prompts.ts` | Agregar `THESIS_GENERATION_PROMPT` (~50 líneas) |
| 9 | `packages/ai-engine/src/pipeline/analysis.pipeline.ts` | Método `generateThesis()` que usa `this.llm` con `maxTokens: 16384` |
| 10 | `packages/ai-engine/src/index.ts` | Exportar los nuevos tipos |
| 11 | `apps/api/src/app.module.ts` | Importar `ThesisGeneratorModule` |
| 12 | `apps/web/src/app/dashboard/layout.tsx` | Agregar link "Generador IA" en sidebar |

---

## Flujo completo

```
1. Usuario abre /dashboard/thesis-generator
   ↓
2. fetch GET /api/templates → llena dropdown de templates
   ↓
3. Usuario selecciona template → fetch GET /api/templates/:id
   → obtiene extractedSchema.sections[] → renderiza checkboxes
   ↓
4. Usuario marca secciones, escribe tema + prompt, elige provider
   ↓
5. POST /api/thesis-generator/generate
   { templateId, topic, userPrompt, sectionNames, aiProvider, aiModel }
   ↓
6. Backend:
   a. Carga template de DB (extractedSchema + fileKey)
   b. Valida sectionNames contra extractedSchema.sections
   c. (Opcional) Descarga template de MinIO → extrae texto como referencia de estilo
   d. Resuelve provider: del body → fallback system config
   e. Construye AnalysisPipeline con ese provider
   f. pipeline.generateThesis({
        templateSchema, templateText?, topic, userPrompt, sectionNames
      })
   g. Retorna { content: "markdown...", sections: [...] }
   ↓
7. Frontend renderiza HTML estilizado (dark/purple, Neon Glow)
   Botones: 📋 Copiar Markdown · 📥 Descargar .md
```

---

## DTO (`generate.dto.ts`)

```typescript
export class GenerateDto {
  @IsString()
  templateId: string;

  @IsString()
  @MinLength(3)
  topic: string;

  @IsOptional()
  @IsString()
  userPrompt?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  sectionNames: string[];

  @IsOptional()
  @IsString()
  aiProvider?: string;

  @IsOptional()
  @IsString()
  aiModel?: string;
}
```

---

## Endpoints

| Método | Endpoint | Roles | Body / Query | Respuesta |
|--------|----------|-------|-------------|-----------|
| `POST` | `/thesis-generator/generate` | ALL authenticated | `GenerateDto` | `{ content: string, sections: string[] }` |
| `GET` | `/thesis-generator/templates/:id/sections` | ALL authenticated | - | `{ sections: ThesisGenSection[] }` |

---

## Backend: ThesisGeneratorService.generate()

```
1. prisma.thesisTemplate.findUnique(templateId)
   → Si no existe: 404 NotFoundException

2. Validar que cada sectionName exista en extractedSchema.sections[]
   → Si no: 400 BadRequestException "Invalid section(s): ..."

3. Intentar obtener texto del template (para referencia de estilo):
   storageService.download(template.fileKey) → buffer
   extractText(buffer, template.fileType) → text
   (Si falla: continuar sin templateText, NO bloquear)

4. Resolver provider/ modelo:
   aiProvider del body → validar que tenga API key
   Si no viene en body: usar activeConfig del sistema

5. Construir config para AnalysisPipeline:
   { openaiKey, deepseekKey?, geminiKey?, claudeKey?, minimaxKey?,
     provider, model, maxGrade }

6. pipeline = new AnalysisPipeline(config)

7. result = await pipeline.generateThesis({
     templateSchema: extractedSchema,
     templateText,
     topic,
     userPrompt,
     sectionNames
   })

8. Return result
```

---

## Pipeline: generateThesis()

```typescript
async generateThesis(request: ThesisGenRequest): Promise<ThesisGenResult> {
  const systemPrompt = THESIS_GENERATION_PROMPT
    .replace('{{structure}}', JSON.stringify(request.templateSchema, null, 2))
    .replace('{{citationStyle}}', request.templateSchema.citationStyle || 'APA');

  const userMessage = [
    `## Tema de la tesis\n${request.topic}`,
    request.userPrompt ? `## Instrucciones del usuario\n${request.userPrompt}` : null,
    request.templateText ? `## Documento patrón (referencia de estilo)\n${request.templateText.substring(0, 10000)}` : null,
    `## Secciones a generar\n${request.sectionNames.join(', ')}`,
  ].filter(Boolean).join('\n\n');

  const response = await this.llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userMessage),
  ]);

  let content = response.content.toString();

  return { content, sections: request.sectionNames };
}
```

- `this.llm` con `maxTokens: 16384` (doble del default de análisis)
- TemplateText truncado a 10000 chars para evitar exceder contexto
- Respuesta en markdown, parseada directamente

---

## Prompt de IA (`THESIS_GENERATION_PROMPT`)

```
Eres un asistente experto en redacción de tesis académicas con más de 20 años
de experiencia en investigación y docencia universitaria.

Debes generar contenido académico para una tesis siguiendo ESTRICTAMENTE la
estructura del documento patrón proporcionado.

### Reglas:
1. Genera contenido SOLO para las secciones solicitadas por el usuario
2. Usa formato markdown con headers según el nivel de cada sección:
   - Nivel 1 → #
   - Nivel 2 → ##
   - Nivel 3 → ###
   - Nivel 4 → ####
3. Tono académico formal, lenguaje técnico preciso y objetivo
4. Integra el tema de la tesis como hilo conductor en toda la redacción
5. Si se proporciona "Documento patrón", úsalo como referencia de estilo,
   profundidad y formato
6. Si el usuario proporciona instrucciones personalizadas, PRIORIZA esas
   indicaciones sobre cualquier otra
7. Usa el estilo de citación detectado ({{citationStyle}}) para referencias
8. NO inventes datos numéricos concretos — usa placeholders como [dato],
   [valor], [año] cuando corresponda
9. Cada sección debe tener al menos 2-3 párrafos de contenido sustancial
10. Incluye transiciones naturales entre párrafos

### Estructura del documento patrón:
{{structure}}

Genera únicamente las secciones solicitadas, en el orden en que aparecen
en la estructura del patrón.
```

---

## Frontend: thesis-generator/page.tsx

### Layout (dark-first, purple accent #6C63FF, Neon Glow glassmorphism)

```
┌─── 🤖 GENERADOR DE INFORMES DE TESIS ─────────────────────────────┐
│                                                                     │
│ ┌─ Documento Patrón ──────────────────────────────────────────────┐ │
│ │ [▼ Seleccionar template...]                                    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Tema de la Tesis ──────────────────────────────────────────────┐ │
│ │ [Input grande, full-width, placeholder: "Ej: Sistema de..."]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Secciones a Generar ───────────────────────────────────────────┐ │
│ │ [☑ Seleccionar todas]  [☐ Deseleccionar todas]                │ │
│ │                                                                  │ │
│ │ ☑ I. INTRODUCCIÓN               (Requerido · ~500 palabras)    │ │
│ │ ☑ II. MARCO TEÓRICO             (Requerido · ~1500 palabras)   │ │
│ │ ☐ III. METODOLOGÍA              (Requerido · ~1000 palabras)   │ │
│ │ ☐ IV. RESULTADOS Y DISCUSIÓN    (Opcional · ~2000 palabras)    │ │
│ │ ☐ V. CONCLUSIONES               (Requerido · ~500 palabras)    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Prompt Personalizado (opcional) ───────────────────────────────┐ │
│ │ [Textarea 4 líneas, placeholder: "Ej: Enfócate en el análisis   │ │
│ │  cuantitativo utilizando datos estadísticos..."]                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Proveedor IA ──────────────────────────────────────────────────┐ │
│ │ [○] Groq Llama 3        ✓ API Key configurada  (recomendado)   │ │
│ │ [○] OpenAI GPT-4o       ✓ API Key configurada                  │ │
│ │ [●] DeepSeek V3         ✓ API Key configurada                  │ │
│ │ [○] Gemini 2.0 Flash    🔒 Sin API Key                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │              [🔮 Generar Informe]                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ Resultado ─────────────────────────────────────────────────────┐ │
│ │  [📋 Copiar Markdown]  [📥 Descargar .md]                     │ │
│ │                                                                  │ │
│ │  ┌───────────────────────────────────────────────────────────┐  │ │
│ │  │  ## II. MARCO TEÓRICO                                    │  │ │
│ │  │                                                           │  │ │
│ │  │  ### 2.1 Antecedentes de la Investigación                 │  │ │
│ │  │                                                           │  │ │
│ │  │  El presente estudio se fundamenta en las investigaciones │  │ │
│ │  │  previas sobre [tema], destacando los trabajos de [autor] │  │ │
│ │  │  ([año]) quienes establecieron las bases para...          │  │ │
│ │  │                                                           │  │ │
│ │  │  ### 2.2 Bases Teóricas                                   │  │ │
│ │  │                                                           │  │ │
│ │  │  El marco teórico de esta investigación se sustenta en    │  │ │
│ │  │  los siguientes enfoques conceptuales...                  │  │ │
│ │  └───────────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Estados de la UI

| Estado | Qué se muestra |
|--------|----------------|
| **Empty** | Solo el formulario, resultado vacío con texto "Completa el formulario y haz clic en Generar Informe" |
| **Loading** | Loader animado (skeleton/spinner) en el área de resultado, botón deshabilitado con spinner |
| **Error** | Result area muestra mensaje de error con borde rojo y detalle (ej: "El proveedor Groq no tiene API Key") |
| **Success** | HTML renderizado con estilos, botones de copiar/descargar visibles |

### Provider Selector

- Mismo patrón que `settings/page.tsx` (líneas 600-654)
- fetch `GET /api/settings/providers` para determinar disponibilidad
- Radio cards con iconos, colores por provider
- Estados: disabled (sin key, opacity-50, lock icon) / available (green dot) / selected (primary border + check circle)
- Default: `aiProvider` del sistema (de `GET /api/settings` )
- Auto-inferencia bidireccional provider ↔ modelo

---

## Persistencia en DB + Historial (v2)

### Problema original
El `POST /api/thesis-generator/generate` era un request sincrónico en memoria. Si el usuario navegaba a otra página, el resultado se perdía porque el estado React se descartaba al desmontar el componente.

### Solución: Modelo `ThesisGeneration` en Prisma

```prisma
model ThesisGeneration {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  templateId   String
  templateName String   @default("")
  topic        String
  userPrompt   String?
  sectionNames String[]
  aiProvider   String   @default("groq")
  content      String
  status       String   @default("COMPLETED")

  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
}
```

### Nuevos endpoints

| Método | Endpoint | Respuesta |
|--------|----------|-----------|
| `POST` | `/thesis-generator/generate` | `{ id, content, sections }` (ahora persiste) |
| `GET` | `/thesis-generator/history` | `ThesisGeneration[]` (sin content en listado) |
| `GET` | `/thesis-generator/history/:id` | `ThesisGeneration` completo con content |
| `DELETE` | `/thesis-generator/history/:id` | 204 (solo dueño o ADMIN) |

### Flujo nuevo

```
1. POST /generate → procesa LLM → guarda en DB → retorna { id, content }
2. Si usuario navega → resultado ya está en DB
3. Al volver a /thesis-generator → GET /history → ve lista de generaciones
4. Click "Ver" → GET /history/:id → renderiza contenido guardado
```

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/database/prisma/schema.prisma` | + modelo `ThesisGeneration` |
| `apps/api/src/thesis-generator/thesis-generator.service.ts` | `generate()` ahora persiste + `getHistory()`, `getGeneration()`, `deleteGeneration()` |
| `apps/api/src/thesis-generator/thesis-generator.controller.ts` | +3 endpoints + extrae `userId` |
| `apps/web/src/app/dashboard/thesis-generator/page.tsx` | + sección historial debajo del formulario |

---

## Lo que NO incluye (v1 — futuras iteraciones)

- Streaming SSE (se muestra loading spinner, contenido completo al final)
- Edición inline del contenido
- Exportar a PDF/DOCX (solo Markdown)
- Guardado como avance en el sistema
- Memoria de contexto entre generaciones

---

## Resumen de esfuerzo

| Componente | Archivos | Líneas estimadas |
|------------|----------|------------------|
| Tipos + Prompts | 2 | +60 |
| Pipeline method | 1 | +80 |
| Backend module | 4 | +180 |
| Frontend page | 2 | +350 |
| Registros (AppModule + Layout) | 2 | +5 |
| **Total** | **11** | **~675** |

---

## Notas

- Token limit de generación: `maxTokens: 16384` en `this.llm` (vs 8192 en análisis)
- Si el template tiene muchas secciones, considerar generación secuencial (1 llamada por sección) en futura iteración
- El texto del template se trunca a 10000 chars para no exceder contexto del LLM
- Reconstruir `@kimy/ai-engine` con `npm run build` después de modificar types/pipeline/prompts
- La página es accesible para todos los roles autenticados (STUDENT, ADVISOR, COORDINATOR, ADMIN)
