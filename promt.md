Actúa como un arquitecto de software senior y experto en desarrollo full-stack con especialización en sistemas inteligentes de procesamiento de documentos. Tu misión es diseñar y desarrollar una aplicación web completa (y su cliente móvil) para la gestión, revisión y evaluación automatizada de avances de tesis universitarias.

## Contexto del Negocio
El sistema será utilizado en un entorno académico universitario donde estudiantes de posgrado/maestría presentan avances periódicos de sus tesis en formato Word (.docx) o PDF. Los revisores (asesores, directores de tesis y coordinadores académicos) necesitan evaluar estos documentos, dejar retroalimentación estructurada y generar reportes oficiales. El flujo actual es manual, desorganizado y genera pérdida de trazabilidad.

Se requiere un sistema de revisión inteligente que compare cada avance contra un documento patrón institucional (template de tesis) y evalue automáticamente el cumplimiento de estructura, contenido y calidad académica, generando retroalimentación accionable para el estudiante. El sistema debe aprender continuamente de las correcciones humanas, detectar similitudes entre documentos de estudiantes, validar la veracidad de las citas bibliográficas y vincular la identidad académica de los asesores mediante ORCID.

## Stack Tecnológico (Obligatorio)

### Core Web
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS, shadcn/ui
- **Backend:** Node.js con NestJS (arquitectura modular), TypeScript
- **Base de Datos:** PostgreSQL 16 (con Prisma ORM)
- **Autenticación:** NextAuth.js / Passport-JWT con roles y permisos granulares
- **Almacenamiento:** MinIO o AWS S3-compatible para gestión de documentos
- **Generación de PDFs:** Puppeteer + Handlebars (reportes) o react-pdf
- **Gráficos/Estadísticas:** Recharts o Tremor
- **Colas/Procesamiento:** BullMQ (Redis) para procesamiento por lotes, envío de emails y jobs de IA
- **Email:** Nodemailer con plantillas HTML (MJML)
- **Contenerización:** Docker + Docker Compose para desarrollo y producción

### Stack de Inteligencia Artificial
- **Motor de IA:** OpenAI API (GPT-4o / GPT-4o-mini) o equivalente local (Ollama + Llama 3) configurable
- **Framework de IA:** LangChain.js o Vercel AI SDK para orquestación de prompts y cadenas
- **Procesamiento de Documentos:** 
  - PDF: pdf-parse, mammoth.js para extracción de texto
  - Word: mammoth.js o docx-parser para extracción estructurada
- **Embeddings:** OpenAI text-embedding-3-large o local con nomic-embed-text para comparación semántica
- **Vector Store:** PostgreSQL con pgvector para almacenar embeddings del documento patrón y avances
- **Chunking:** RecursiveCharacterTextSplitter para segmentación inteligente de secciones

### Stack de Mejoras Adicionales (Nuevo)
- **Fine-tuning / RLHF:** Almacenamiento de pares (hallazgo-IA, corrección-humana) en tabla `AIFinding.humanComment`. Pipeline de fine-tuning con OpenAI Fine-Tuning API o entrenamiento local de clasificador de severidad (scikit-learn / fastText) cuando se acumulen 500+ ejemplos validados.
- **Detección de Plagio:** 
  - Opción A: SDK/API de Copyleaks para detección avanzada.
  - Opción B: Comparación coseno entre embeddings de todos los avances del programa usando pgvector (`<=>` cosine distance) para detectar secciones con alta similitud (> 85%) entre estudiantes.
- **Validación Bibliográfica:** Integración con api.crossref.org/works?query= para verificar existencia y metadatos (año, autores, DOI, título) de cada referencia extraída.
- **ORCID Integration:** OAuth 2.0 con ORCID API (sandbox/production) para vinculación de perfiles de asesores, auto-poblado de historial académico (publicaciones, afiliaciones) y validación de expertise.
- **App Móvil (Estudiantes):** React Native con Expo (SDK 52+), TypeScript, React Navigation, Expo Notifications para push notifications, y consumo de la misma API REST del backend.

## Usuarios y Roles

### Plataforma Web
1. **Estudiante:** Sube avances, visualiza retroalimentación (humana + IA), descarga reportes de su tesis, consulta su puntaje y recomendaciones de mejora. Recibe notificaciones push en la app móvil cuando la revisión está lista.
2. **Asesor/Director:** Revisa avances individualmente, valida o ajusta la evaluación de IA (feedback que alimenta el sistema de aprendizaje), deja comentarios por sección, aprueba/rechaza con observaciones. Su perfil está vinculado a ORCID.
3. **Coordinador Académico:** Revisión por lotes, genera reportes de gestión, visualiza estadísticas del programa, configura documentos patrón y rúbricas de evaluación. Monitorea alertas de plagio.
4. **Administrador:** Gestión de usuarios, configuración de períodos de entrega, parámetros del sistema, gestión de modelos de IA y templates, supervisión de jobs de fine-tuning.

### App Móvil (Solo Estudiantes)
- Visualización de hallazgos de IA con severidad, instrucciones de corrección y ejemplos de mejora.
- Historial de versiones y evolución de notas.
- Notificaciones push: "Tu revisión IA está lista", "El asesor ha dejado comentarios", "Fecha límite de entrega próxima".
- Descarga de reportes PDF en el dispositivo.
- Solo lectura; no permite subida de documentos desde móvil (scope inicial).

## Requerimientos Funcionales

### Módulo 1: Autenticación y Gestión de Usuarios
- Login con email/password y recuperación de contraseña.
- Gestión de perfiles y asignación de roles.
- Asignación de estudiantes a asesores/directores.
- **ORCID Integration (Nuevo):** 
  - Durante la creación/edición del perfil de asesor, botón "Vincular con ORCID" que redirige al flujo OAuth 2.0 de ORCID.
  - Al autorizar, el sistema consulta la API pública de ORCID para obtener: nombre, afiliación actual, lista de publicaciones (título, año, DOI, journal).
  - Almacenar `orcidId`, `orcidAccessToken`, `orcidRefreshToken` en tabla `AdvisorProfile`.
  - Validación cruzada: verificar que el asesor tiene publicaciones en el área temática de la tesis que supervisa (comparación semántica entre embeddings del título de la tesis y los títulos de sus publicaciones ORCID). Si no hay coincidencia significativa, emitir alerta al coordinador.

### Módulo 2: Gestión de Documentos Patrón (Template Institucional)
- El coordinador/administrador puede cargar y versionar un **Documento Patrón Institucional** (Word/PDF) que define la estructura esperada de una tesis.
- El sistema extrae automáticamente la estructura del patrón: índice, secciones obligatorias, subsecciones, extensión sugerida por sección, formato de citas, estilo de escritura.
- Configuración de rúbricas de evaluación asociadas al patrón (pesos por sección, criterios de calidad, rangos de nota).
- Múltiples documentos patrón por programa académico (maestría en educación, ingeniería, derecho, etc.).

### Módulo 3: Dashboard de Gestión
- Vista general con KPIs: avances pendientes, revisados, rechazados, promedio de tiempo de revisión, promedio de notas IA vs. notas humanas.
- Filtros por programa académico, período, asesor, estado y rango de cumplimiento IA.
- Timeline/historial de actividad reciente.
- Notificaciones en tiempo real (WebSockets o Server-Sent Events).
- Alertas de avances con bajo cumplimiento IA (< 60%).
- **Nuevas métricas (Nuevo):**
  - Tasa de concordancia IA-Humano (% de hallazgos aceptados sin modificación).
  - Alertas de posible plagio detectado (similitud > 85% con otro avance del programa).
  - Estadísticas de citas válidas/inválidas por programa académico.

### Módulo 4: Carga y Gestión de Avances
- Carga individual de documentos (Word/PDF) con validación de tipo y tamaño máximo (50MB).
- Extracción de metadatos básicos (título, autor, fecha, número de páginas).
- Versionado de documentos: el estudiante puede subir múltiples versiones de un mismo avance.
- Previsualización del documento en el navegador (PDF.js para PDFs; conversión a PDF para Word).
- Al cargar un avance, el sistema lo encola automáticamente para análisis de IA contra el documento patrón correspondiente.
- **Nuevo:** Tras la carga, el avance también se encola para detección de plagio y validación de citas.

### Módulo 5: Revisión Inteligente con IA (Core del Sistema)
Al subirse un avance, el sistema debe ejecutar un pipeline de análisis automatizado:

#### 5.1 Extracción y Estructuración
- Extraer texto completo del documento estudiante preservando la estructura de secciones.
- Comparar la estructura del avance contra el documento patrón (secciones presentes, ausentes, desordenadas).
- Identificar el tipo de avance (capítulo 1, 2, 3, etc.) si es posible.

#### 5.2 Análisis de Contenido y Cumplimiento
- **Detección de Faltantes:** Identificar secciones obligatorias del patrón que no aparecen en el avance.
- **Detección de Errores:** 
  - Errores estructurales (falta de índice, numeración incorrecta, ausencia de bibliografía).
  - Errores de contenido (objetivos poco claros, hipótesis no definidas, metodología ausente).
  - Errores de forma (extensión insuficiente/sobrepasada, formato de citas incorrecto, lenguaje no académico).
- **Análisis Semántico:** Comparar la coherencia entre secciones (¿la introducción justifica la metodología? ¿los resultados responden a los objetivos?).

#### 5.3 Retroalimentación Accionable (Output de IA)
Para cada hallazgo detectado, la IA debe generar:

1. **Descripción del Error/Faltante:** Qué se encontró o qué falta, con referencia a la sección y página (aproximada).
2. **Severidad:** Crítico / Mayor / Menor / Sugerencia.
3. **Instrucción de Corrección:** Explicación paso a paso de cómo corregir el error o cómo completar la sección faltante.
4. **Ejemplo de Mejora:** Un párrafo o fragmento de ejemplo de cómo debería redactarse o estructurarse correctamente.
5. **Recomendación General:** Consejos de mejora académica (fuentes sugeridas, profundidad requerida, redacción).

#### 5.4 Calificación Automatizada
- La IA debe asignar un **porcentaje de cumplimiento** sobre 100% basado en:
  - Estructura (30%): Presencia y orden de secciones.
  - Contenido (40%): Profundidad, coherencia, argumentación, citas.
  - Forma (20%): Extensión, formato, redacción académica.
  - Originalidad/Calidad (10%): Coherencia interna, calidad del lenguaje.
- **Conversión a Nota Decimal:** El porcentaje debe traducirse a una nota en escala decimal (ej: 0.0 a 5.0 o 0.0 a 20.0, configurable por institución) con la fórmula: `(porcentaje / 100) * nota_maxima`.
- **Resumen Ejecutivo de IA:** Un párrafo consolidado que sintetice: fortalezas del documento, debilidades principales, prioridad de corrección y estimación de nivel de avance.

#### 5.5 Revisión Humana + IA + Fine-tuning (Actualizado)
- El asesor visualiza la evaluación de IA en el panel de revisión.
- Puede aceptar, modificar o descartar cada hallazgo de IA.
- Puede ajustar la nota final si considera que la IA subestimó o sobrestimó.
- **Feedback Loop (Nuevo):** Cada vez que un asesor modifica o descarta un hallazgo de la IA, el sistema almacena el par (hallazgo-IA original, corrección-humana, acción: `accepted` | `modified` | `rejected`) en la tabla `AIFinding.humanComment`.
  - Si la acción es `modified`: guardar el texto corregido por el humano y la severidad ajustada.
  - Si la acción es `rejected`: guardar la razón de rechazo (campo opcional) para análisis posterior.
- **Pipeline de Fine-tuning (Nuevo):** 
  - Cuando la tabla acumule 500+ ejemplos validados (estado `reviewed` y acción diferente de `accepted` o con modificación significativa), el sistema debe permitir (vía endpoint administrativo) exportar el dataset en formato JSONL para fine-tuning de GPT-4o-mini mediante OpenAI Fine-Tuning API.
  - Alternativa local: entrenar un clasificador de severidad (Crítico/Mayor/Menor/Sugerencia) usando los pares almacenados, desplegable como microservicio Python con FastAPI.
  - El modelo fine-tuneado o el clasificador local debe poder ser activado/desactivado desde el panel de administración para evaluación A/B.

### Módulo 6: Revisión Individual de Avances (Humana + IA)
- Visualización lado a lado: documento (izquierda) y panel de revisión (derecha).
- Panel de revisión con dos pestañas: "Evaluación IA" (autogenerada) y "Mi Revisión" (manual del asesor).
- Sistema de anotaciones/comentarios anclados a páginas o párrafos específicos.
- Estados de revisión: Pendiente → Análisis IA en Proceso → En Revisión Humana → Observado → Aprobado → Rechazado.
- Checklist de rúbrica de evaluación configurable (pre-llenado por IA, editable por humano).
- Generación de acta de revisión en PDF que incluye: evaluación IA, ajustes humanos, nota final consensuada.

### Módulo 7: Revisión por Lotes (Bulk Review)
- El coordinador selecciona una carpeta/repositorio o múltiples avances filtrados.
- Procesamiento masivo de IA encolado en BullMQ con barra de progreso en tiempo real.
- Aplicación masiva de estados, comentarios genéricos o asignación a revisores.
- Generación de reportes comparativos de lotes (ranking de cumplimiento, promedio de notas).

### Módulo 8: Detección de Plagio (Nuevo)
- **Análisis Intra-programa:** Después de extraer el texto de un avance, generar embeddings de cada sección (chunk de ~500 tokens) y almacenarlos en pgvector. Ejecutar una consulta de similitud coseno contra todos los chunks de avances previos del mismo programa académico.
  - Umbral de alerta: similitud coseno > 0.85 (o distancia < 0.15).
  - Si se detecta similitud alta, generar un hallazgo de IA tipo "Posible similitud con avance de [estudiante X]" con el porcentaje de coincidencia y las secciones involucradas.
  - Este hallazgo aparece en el panel del asesor con severidad "Mayor" y requiere validación humana.
- **Integración Copyleaks (Opcional/Configurable):** Si el administrador configura una API key de Copyleaks, enviar el documento a su API para análisis contra internet y repositorios académicos. Incorporar el resultado en el reporte de plagio.

### Módulo 9: Validación de Citas Bibliográficas con CrossRef (Nuevo)
- **Extracción de Referencias:** Mediante prompt especializado a la IA, extraer todas las referencias bibliográficas del documento (formato APA, Vancouver, etc.) en una lista estructurada: título, autores, año, journal, DOI (si existe).
- **Verificación con CrossRef:** Para cada referencia sin DOI o con DOI dudoso, consultar `https://api.crossref.org/works?query=[título codificado]` y `https://api.crossref.org/works/[DOI]` si existe.
  - Comparar metadatos obtenidos vs. metadatos del documento estudiante.
  - Estados de validación: `verified` (coincidencia exacta), `partial` (año o autores difieren ligeramente), `not_found` (no existe en CrossRef), `hallucinated` (la referencia parece inventada por el estudiante).
- **Hallazgo de IA:** Para cada cita con estado `not_found` o `hallucinated`, generar un hallazgo con severidad "Mayor" indicando: "La referencia '[título]' no fue encontrada en bases académicas. Verifique los datos o consulte [sugerencia de búsqueda en Google Scholar]."
- Para citas `partial`, sugerir la corrección exacta obtenida de CrossRef.

### Módulo 10: Reportes y Exportación
- **Reportes Operacionales:** 
  - Acta de revisión individual (con evaluación IA + ajustes humanos + hallazgos de plagio + estado de citas).
  - Consolidado de observaciones y recomendaciones.
  - Comparativo de versiones (mejora entre versión 1, 2, 3 con gráfico de evolución de nota).
- **Reportes de Gestión:** 
  - Productividad de revisores.
  - Estadísticas de aprobación/rechazo por programa.
  - Tiempos de respuesta.
  - Efectividad de IA (concordancia entre nota IA y nota humana).
  - **Nuevo:** Tasa de citas válidas/inválidas por programa. Ranking de similitud intra-programa.
- Exportación a PDF con membrete institucional, numeración y tabla de contenido automática.
- Envío de reportes por email: individual o masivo (con selección de destinatarios y plantilla).

### Módulo 11: Estadísticas Descriptivas y Visualización
- Gráficos de barras: avances por mes/semestre.
- Gráficos circulares: distribución de estados de revisión.
- Líneas de tiempo: evolución de un estudiante a través de sus versiones (nota IA vs. nota humana).
- Heatmaps: carga de trabajo por asesor.
- Gráficos de IA:
  - Radar de cumplimiento por dimensión (estructura, contenido, forma, originalidad).
  - Histograma de distribución de notas del programa.
  - Gráfico de concordancia IA-Humano.
  - **Nuevo:** Gráfico de evolución de precisión del modelo de IA a lo largo del tiempo (basado en feedback humano acumulado).
  - **Nuevo:** Mapa de calor de similitud entre avances del programa (matriz de estudiantes).

### Módulo 12: App Móvil para Estudiantes (Nuevo)
- **Stack:** React Native con Expo (SDK 52+), TypeScript, React Navigation (bottom tabs), Expo Notifications.
- **Autenticación:** Login con las mismas credenciales del sistema web (JWT compartido).
- **Funcionalidades:**
  - **Inicio:** Dashboard resumido con nota más reciente, próxima fecha límite y cantidad de hallazgos pendientes por corregir.
  - **Mis Revisones:** Lista de avances con estado (Pendiente, En Revisión, Observado, Aprobado). Al tocar uno, ver los hallazgos de IA organizados por severidad (Crítico, Mayor, Menor, Sugerencia).
  - **Detalle de Hallazgo:** Ver la descripción del error, la instrucción de corrección y el ejemplo de mejora. No se permite editar desde móvil.
  - **Historial de Notas:** Gráfico de línea con la evolución de notas por versión.
  - **Reportes:** Descarga de PDFs de actas y reportes al dispositivo.
  - **Notificaciones Push:** 
    - "Tu revisión IA está lista" (cuando el job de IA finaliza).
    - "El asesor [Nombre] ha dejado comentarios en tu avance".
    - "Quedan 3 días para la fecha límite de entrega del avance [Capítulo X]".
- **Scope:** Solo lectura para estudiantes. La carga de documentos se mantiene en la web por ahora.

## Requerimientos No Funcionales
- **Diseño:** Interfaz moderna, limpia, accesible (WCAG 2.1 AA), responsive (desktop primario, tablet compatible). App móvil con UI nativa fluida (React Native Paper o NativeWind).
- **Rendimiento:** Carga inicial web < 2s, previsualización de PDF < 3s, análisis IA de documento < 30s (asíncrono), procesamiento por lotes soporta 100+ documentos, app móvil < 1.5s para lista de hallazgos.
- **Seguridad:** Encriptación de archivos en reposo, validación de inputs, protección contra XSS/SQL Injection, rate limiting, sanitización de outputs de IA, tokens ORCID cifrados en reposo (AES-256).
- **Escalabilidad:** Arquitectura modular que permita añadir módulos sin refactorización mayor. Workers de IA independientes y escalables horizontalmente.
- **Trazabilidad:** Auditoría completa (quién hizo qué y cuándo) en tabla de logs.
- **Privacidad de Datos:** Los documentos y datos de IA no se usan para entrenar modelos externos; preferencia por procesamiento local si es posible. Datos ORCID solo para lectura de perfil público.

## Arquitectura y Patrones Esperados
- Backend: Clean Architecture / Hexagonal (dominio, aplicación, infraestructura).
- Frontend Web: Atomic Design, Custom Hooks, Server Components donde aplique.
- App Móvil: Feature-based folders, Custom Hooks, React Query (TanStack Query) para estado del servidor.
- API RESTful con documentación OpenAPI/Swagger (compartida entre web y móvil).
- Base de datos normalizada (3NF) con índices estratégicos y extensión pgvector.
- Migrations con Prisma Migrate.
- Tests unitarios (Jest) y de integración mínimos para endpoints críticos.
- Jobs de IA desacoplados mediante BullMQ workers independientes.
- App móvil en monorepo compartido (Turborepo) o repositorio separado conectado a la misma API.

## Entregables Esperados
1. Estructura completa de carpetas del proyecto (monorepo recomendado con Turborepo: apps/web, apps/api, apps/mobile, packages/shared-types, packages/ui).
2. Esquema de base de datos (diagrama ER o definición Prisma) incluyendo tablas de evaluación IA, AIFinding.humanComment, plagio, citas validadas, ORCID profiles.
3. Código funcional de los módulos principales (no stubs), especialmente:
   - Pipeline de análisis IA.
   - Sistema de feedback humano con acumulación en AIFinding.humanComment.
   - Detección de similitud con pgvector.
   - Validación de citas con CrossRef.
   - OAuth ORCID.
4. Prompts de sistema optimizados para: evaluación académica, extracción de referencias bibliográficas, análisis de estructura.
5. Docker Compose para levantar toda la stack (incluyendo Redis, pgvector, backend, frontend web).
6. README con instrucciones de instalación, variables de entorno, decisiones de arquitectura, guía de configuración del documento patrón, y pasos para vincular ORCID y configurar Copyleaks.
7. Código base funcional de la app móvil (Expo) con navegación, autenticación, lista de hallazgos y notificaciones push configuradas.
8. Documentación del pipeline de fine-tuning: formato del dataset JSONL, comando para ejecutar fine-tuning con OpenAI API, y cómo activar el modelo fine-tuneado en el sistema.

## Instrucción Final
Desarrolla el código completo, funcional y listo para ejecutar. Asume las mejores prácticas actuales (2026). El análisis de IA debe ser robusto, contextualizado al documento patrón y generar retroalimentación realmente útil para el estudiante, no genérica. El sistema de feedback humano debe ser transparente y alimentar genuinamente la mejora del modelo. La detección de plagio debe ser eficiente con pgvector y no generar falsos positivos masivos. La validación de citas con CrossRef debe manejar rate limits (política de cortesía: 1 request/segundo). La app móvil debe ser fluida y útil para el estudiante en su día a día. Si identificas ambigüedades, toma decisiones razonables documentándolas. Prioriza la calidad del código, la mantenibilidad, la experiencia de usuario y la precisión académica de la evaluación automatizada.

---

## Módulo 13 (Futuro): Autenticación de Dos Factores (2FA) con Google Authenticator

### Objetivo
Agregar una capa extra de seguridad al inicio de sesión mediante códigos TOTP (Time-based One-Time Password) generados por aplicaciones como Google Authenticator, Microsoft Authenticator o Authy. Cada usuario puede activar/desactivar 2FA desde su panel de configuración.

### Implementación
- **Backend (NestJS):**
  - Instalar paquete `speakeasy` para generación y verificación de códigos TOTP, y `qrcode` para generar el QR de configuración.
  - Nuevo campo `twoFactorSecret` (string opcional) en el modelo `User` de Prisma para almacenar el secreto cifrado.
  - Nuevo campo `twoFactorBackupCodes` (string opcional, JSON array) para 8 códigos de respaldo de un solo uso (hasheados con bcrypt).
  - Nuevos endpoints:
    - `POST /auth/2fa/enable` — genera un secreto TOTP, devuelve la URL `otpauth://` y un QR en base64 para escanear.
    - `POST /auth/2fa/verify` — recibe el código TOTP del usuario, verifica, y activa 2FA guardando el secreto.
    - `POST /auth/2fa/disable` — desactiva 2FA (requiere contraseña actual para seguridad).
  - Modificar `POST /auth/login`:
    - Si el usuario tiene `twoFactorSecret` activo, devolver `{ requires2fa: true, tempToken: "jwt_limitado" }` en lugar del JWT completo.
    - El `tempToken` es un JWT de corta duración (5 minutos) que solo permite acceder al endpoint `POST /auth/2fa/authenticate`.
  - Nuevo endpoint `POST /auth/2fa/authenticate`:
    - Recibe `tempToken` + `code` (TOTP de 6 dígitos).
    - Verifica el código contra el secreto del usuario.
    - Si es válido, retorna el JWT completo de acceso.
    - Si el código falla, intenta con los códigos de respaldo (verificación contra hash bcrypt). Si coincide, elimina ese código de respaldo de la lista.
- **Frontend Web (Next.js):**
  - En la página de login (`/login`), después de enviar credenciales válidas, si la respuesta incluye `requires2fa: true`, mostrar un modal/pantalla con un input de 6 dígitos para el código TOTP.
  - En el panel de configuración (`/dashboard/settings`), sección "Seguridad":
    - Botón "Activar 2FA" que muestra un QR y un campo para verificar el primer código.
    - Botón "Desactivar 2FA" que pide la contraseña actual.
    - Lista de códigos de respaldo (mostrar una sola vez, descargar como PDF).
- **Frontend Mobile (React Native/Expo):**
  - Misma lógica que web: después del login exitoso, si hay `requires2fa`, mostrar pantalla de ingreso de código TOTP.
  - Usar `expo-secure-store` para almacenar el `tempToken` durante el flujo.

### Flujo Completo
1. Usuario ingresa email + contraseña → `POST /auth/login`.
2. Si 2FA está activo → respuesta `{ requires2fa: true, tempToken }`.
3. App/web muestra campo para código de 6 dígitos.
4. Usuario abre Google Authenticator, lee el código, lo ingresa.
5. `POST /auth/2fa/authenticate` con `tempToken` + `code`.
6. Si OK → recibe JWT final, redirigido al dashboard.
7. Si el código es incorrecto 5 veces seguidas → cuenta bloqueada por 15 minutos.

---

## Módulo 14 (Futuro): Panel de Configuración por Usuario

### Objetivo
Cada usuario (independientemente de su rol) dispone de una sección de configuración donde puede personalizar su experiencia y gestionar su cuenta sin depender del administrador.

### Funcionalidades

#### Perfil
- Editar nombre, foto de perfil (avatar), firma digital (para asesores/coordinadores en actas).
- Cambiar contraseña (con verificación de contraseña actual).
- Vista previa del perfil tal como lo ven otros usuarios.

#### Preferencias de Notificaciones
- Toggles individuales para cada tipo de notificación:
  - **Push (app móvil):** análisis IA completado, comentarios de asesor, fechas límite.
  - **Email:** acta de revisión disponible, feedback detallado generado, avance observado/aprobado.
  - **Web (in-app):** notificaciones en el dashboard (badge de campana).
- Frecuencia de resumen semanal (diario/semanal/nunca).

#### Preferencias de IA (para coordinadores/administradores)
- Selección del **proveedor de IA preferido** (OpenAI GPT-4o, Gemini 2.0 Flash, DeepSeek V3, Groq Llama 3).
- Indicador visual de qué proveedores tienen API key configurada (verde = configurado, rojo = no configurado).
- Modelo por defecto para análisis (fine-tuned o base).
- Umbral de puntuación mínima para considerar un avance como "aprobado por IA".

#### Seguridad (para todos los usuarios)
- Estado de 2FA (activado/desactivado).
- Botón para activar/desactivar 2FA (ver Módulo 13).
- Historial de inicio de sesión (últimos 10 accesos con IP, dispositivo, fecha).
- Sesiones activas: ver y cerrar sesiones remotas.

### Implementación Técnica
- **Backend:** Nuevo endpoint `PATCH /users/me/settings` que guarda un JSON con preferencias en el campo `User.preferences` (tipo `Json` en Prisma).
- **Frontend:** Nueva página `/dashboard/settings` con secciones tabs: Perfil, Notificaciones, IA, Seguridad.
- **App Móvil:** Nueva pantalla `SettingsScreen` accesible desde el tab de perfil, con las mismas opciones adaptadas a mobile.

---

## Módulo 15 (Futuro): Vista Previa Antes de Descargar

### Objetivo
Antes de descargar un reporte o acta en PDF, el usuario puede previsualizar el contenido en el navegador para verificar que sea correcto y evitar descargas innecesarias.

### Funcionalidades

#### Vista Previa de Reporte Individual
- Botón "Vista Previa" junto al botón "Descargar PDF" en la página de detalle del avance.
- Al hacer clic, abre un modal/panel lateral que muestra el contenido del reporte renderizado en HTML (usando el endpoint existente `GET /reports/advance/:advanceId/html`).
- El HTML se renderiza en un contenedor con scroll, manteniendo el mismo estilo que tendrá en el PDF.
- Botones dentro de la previsualización: "Descargar PDF", "Enviar por Correo", "Cerrar".
- Indicador de número de páginas estimado.

#### Vista Previa de Documento Original
- Usar el endpoint `GET /advances/:id/preview` que retorna una URL firmada de MinIO.
- Renderizar el PDF original en un `<iframe>` o usando un visor PDF embebido (PDF.js).
- Para documentos Word, mostrar una nota "Vista previa de Word no disponible en navegador; descargue el archivo original."

#### Vista Previa en Revisión por Lotes
- En la página de Bulk Review, al seleccionar uno o varios avances, botón "Vista Previa Rápida".
- Muestra un modal con pestañas/paginación para navegar entre los reportes de los avances seleccionados.
- Útil para que el coordinador verifique el contenido antes de descargar el ZIP masivo o enviar los correos.

### Implementación Técnica
- **Frontend Web:** Componente reutilizable `ReportPreviewModal` que recibe `advanceId` o `htmlContent` y lo renderiza.
- Reutilizar el HTML generado por `ReportsService.buildReportHTML()` que ya está optimizado para impresión.
- Para el modal, usar un contenedor con `max-h-[80vh] overflow-y-auto` y estilos que imiten el formato A4.

---

## Módulo 16 (Futuro): Múltiples Proveedores de IA Seleccionables

### Objetivo
Permitir que el coordinador/administrador elija qué motor de inteligencia artificial se utiliza para el análisis de tesis, en lugar de depender exclusivamente de OpenAI. Esto da flexibilidad, reduce costos (DeepSeek es significativamente más barato), y permite redundancia si un proveedor falla.

### Proveedores Soportados

| Proveedor | Modelo Principal | Modelo Rápido | Embeddings | Costo Aprox. |
|-----------|-----------------|---------------|------------|--------------|
| **OpenAI** | GPT-4o / GPT-4o-mini | GPT-4o-mini | text-embedding-3-large | $$$ |
| **Gemini** | Gemini 2.0 Flash | Gemini 2.0 Flash Lite | No soporta (se salta) | $ |
| **Groq** | Llama 3.3 70B | Llama 3.1 8B | No soporta (se salta) | $ (free tier) |
| **DeepSeek** | DeepSeek V3 / DeepSeek R1 | DeepSeek V3 | No soporta (se salta) | $$ (muy barato) |

### Arquitectura de Selección

#### Nivel 1: Sistema (por defecto)
- Variable de entorno `AI_PROVIDER=openai|gemini|groq|deepseek`.
- Si no está configurada, usa OpenAI como fallback.

#### Nivel 2: Base de Datos (sobrescribe env)
- Tabla `SystemSettings` con campo `aiProvider` (string).
- El administrador puede cambiar el proveedor desde el panel de configuración.
- El cambio es inmediato para los próximos análisis (no afecta análisis en curso).

#### Nivel 3: Por usuario (opcional)
- El coordinador puede seleccionar un proveedor diferente para su programa en `User.preferences.aiProvider`.
- Esto permite que diferentes programas usen diferentes motores (ej. Ingeniería usa Gemini por su rendimiento con técnico, Educación usa GPT-4o por mejor redacción).

### Implementación Técnica
- **Backend:**
  - Agregar DeepSeek como nuevo provider en `AnalysisPipeline` usando la API compatible con OpenAI (`https://api.deepseek.com/v1`).
  - No requiere nuevas dependencias porque DeepSeek expone API compatible con OpenAI.
  - Modificar `AiAnalysisService.getActiveModel()` para que también lea `aiProvider`.
  - Modificar `AiAnalysisService.buildPipeline()` para pasar el proveedor seleccionado.
  - Nuevo endpoint `PATCH /admin/ai-settings` para cambiar proveedor global.
- **Frontend:**
  - En settings del administrador, selector de proveedor con indicador de estado (API key configurada o no).
  - En settings del coordinador, selector de proveedor para su programa (opcional).

---

## Módulo 17 (Futuro): Feedback Detallado y Documentado de Mejora

### Objetivo
Generar un informe de retroalimentación mucho más completo y accionable que el simple análisis de hallazgos. Este informe es un documento narrativo que guía al estudiante paso a paso en la mejora de su tesis, como si un director de tesis experimentado estuviera sentado a su lado.

### Diferencia con el Análisis Actual
| Aspecto | Análisis Actual (Hallazgos) | Feedback Detallado (Nuevo) |
|---------|---------------------------|---------------------------|
| Formato | Lista de hallazgos individuales | Documento narrativo estructurado |
| Contenido | Errores puntuales | Contexto, análisis, plan de mejora |
| Empatía | Neutro | Constructivo y motivador |
| Accionable | Pasos de corrección por hallazgo | Plan de mejora priorizado (corto/mediano/largo plazo) |
| Recursos | No incluye | Referencias, herramientas y recursos sugeridos |

### Estructura del Informe de Feedback

1. **Resumen Ejecutivo Ampliado (2-3 párrafos)**
   - Logros principales del estudiante (reconocimiento positivo).
   - Áreas críticas que requieren atención inmediata.
   - Progreso general hacia la meta.
   - Mensaje motivador.

2. **Análisis por Sección**
   - Para cada sección del documento esperada según el tipo de avance:
     - Estado: OK / Observado / Ausente.
     - Fortalezas específicas (no genéricas, ej. "Buen uso de normativa APA en tablas").
     - Debilidades y oportunidades de mejora.
     - Sugerencia concreta de mejora con ejemplo.

3. **Análisis por Dimensión**
   - Estructura, Contenido, Forma, Originalidad.
   - Explicación contextualizada de la puntuación.
   - Prioridad de atención: ALTA (< 60%), MEDIA (< 75%), BAJA (>= 75%).

4. **Recomendaciones Priorizadas (top 5)**
   - Lista ordenada por urgencia (1 = más crítico).
   - Cada una con: área, recomendación detallada, impacto esperado.

5. **Plan de Mejora**
   - **Corto plazo (próximos días):** 2-3 acciones inmediatas (ej. "Agregar las secciones faltantes del Capítulo I").
   - **Mediano plazo (próximas semanas):** 2-3 acciones de desarrollo (ej. "Profundizar el marco teórico con 10 fuentes adicionales").
   - **Largo plazo:** 1-2 acciones estratégicas (ej. "Someter a revisión de estilo antes de la entrega final").

6. **Recursos Sugeridos**
   - 3-5 referencias bibliográficas, herramientas online o plantillas que ayuden al estudiante.

### Implementación Técnica
- **Backend:** Nuevo prompt `DETAILED_FEEDBACK_PROMPT` en `@kimy/ai-engine` que recibe scores + findings + texto del estudiante y genera el informe estructurado en JSON.
- Nuevo endpoint `POST /ai-analysis/:id/detailed-feedback`. Almacena el resultado en el campo `AIAnalysis.detailedFeedback` (JSON).
- **Frontend:** Nueva pestaña "Feedback Detallado" en la página de detalle del avance, con secciones colapsables para cada parte del informe.
- **App Móvil:** Nueva pantalla o sección expandible en el detalle de hallazgos que muestre el feedback completo.
- También disponible en la descarga por lotes: al descargar los reportes en ZIP, cada PDF incluye el feedback detallado como sección adicional en el acta.

---

## Módulo 18 (Futuro): Descarga por Lotes de Reportes en PDF

### Objetivo
El coordinador o administrador puede descargar un archivo ZIP (o PDF consolidado) con los reportes de múltiples avances seleccionados, ahorrando tiempo en procesos de revisión masiva.

### Funcionalidades

#### Descarga desde Revisión por Lotes
- Una vez completado el análisis masivo de varios avances (Módulo 7), aparecen los botones:
  - **"📥 Descargar PDFs"** — Descarga un ZIP con un PDF por avance (nombre del archivo = `Estudiante_Tipo_vX.pdf`).
  - **"📧 Enviar por correo"** — Envía a cada estudiante su reporte PDF individual por email.
- El coordinador puede elegir el formato de descarga:
  - **ZIP con PDFs individuales** (recomendado para distribución).
  - **PDF consolidado** (un solo PDF con todos los reportes concatenados, útil para imprimir o archivar).

#### Descarga desde Lista de Avances
- Checkboxes de selección múltiple en la tabla de avances.
- Botón flotante "Acciones" → "Descargar reportes seleccionados".
- Selector de formato (ZIP / PDF consolidado).

### Implementación Técnica
- **Backend:**
  - `POST /reports/batch-pdf` — recibe `{ advanceIds: string[], format?: 'zip' | 'consolidated' }`.
  - Para formato ZIP: usar `archiver` para comprimir múltiples PDFs generados por `generateAdvancePdf()`.
  - Para formato consolidado: generar PDFs individuales y luego concatenarlos con `pdf-lib` o similar.
  - `POST /reports/batch-send-email` — recibe `{ advanceIds: string[] }`, itera cada avance llamando a `sendAdvanceReportEmail()` y retorna resumen con conteo de éxitos/fallos.
- **Frontend:**
  - Botones en la cabecera de la sección de Resultados en Bulk Review.
  - Botones en la cabecera de la tabla de avances en la página de Avances.
  - Indicador de progreso durante la generación del ZIP (para lotes grandes).

---

## Módulo 19 (Futuro): Notificaciones por Correo Electrónico con Resultados y PDF Adjunto

### Objetivo
Automatizar el envío de notificaciones por correo electrónico a los estudiantes cuando su análisis IA está completo, incluyendo el acta de revisión en PDF como adjunto y un resumen ejecutivo en el cuerpo del mensaje.

### Flujo Actual vs. Flujo Mejorado
| Aspecto | Actual | Mejorado |
|---------|--------|----------|
| Disparador | Manual (clic en "Enviar por Correo") | Automático al completar análisis IA + manual desde Bulk Review |
| Contenido | Email genérico con nota | Email con resumen ejecutivo, scores por dimensión, enlace al feedback detallado |
| Adjunto | PDF del acta | PDF del acta + enlace al feedback detallado |
| Destinatarios | Un estudiante | Individual (automático) o múltiples (desde Bulk Review) |

### Tipos de Notificaciones por Email

1. **Análisis IA Completado (Automático)**
   - Disparador: cuando el worker de IA termina de procesar un avance.
   - Destinatario: el estudiante autor del avance.
   - Contenido:
     - Asunto: "Tu avance [tipo] ha sido evaluado — Nota: [nota]/20".
     - Cuerpo: resumen ejecutivo, scores por dimensión (barras de progreso en HTML), enlace "Ver feedback detallado".
     - Adjunto: PDF del acta de revisión.

2. **Revisión Humana Completada**
   - Disparador: cuando el asesor finaliza su revisión y asigna una nota final.
   - Contenido: nota final del asesor, comentarios del asesor, comparativa nota IA vs humana.

3. **Recordatorio de Fecha Límite**
   - Disparador: job cron semanal que revisa fechas de entrega próximas (configurable en settings).
   - Contenido: "Quedan [días] días para entregar [tipo de avance]. Tu progreso actual: [última nota]".

### Implementación Técnica
- **Integración con BullMQ:**
  - Al completar el análisis IA en el worker (`ai-analysis.worker.ts`), encolar un job `send-email` que ejecute el envío.
  - Cola separada `email-queue` para no bloquear la cola de análisis.
  - Intentos: 3 con backoff exponencial.
- **Plantilla de Email Mejorada:**
  - Usar el HTML generado por `buildReportHTML()` como base.
  - Agregar sección ejecutiva al inicio (scores, resumen, enlace al feedback detallado).
  - Incluir enlace al feedback detallado (página web del avance).
- **Configuración por Usuario:**
  - Desde el panel de configuración (Módulo 14), el estudiante puede optar por no recibir emails automáticos.
  - Desde el panel de configuración, el coordinador puede activar/desactivar el envío automático para su programa.
- **Endpoint Batch:**
  - `POST /reports/batch-send-email` ya implementado (ver Módulo 18).
  - Para envío masivo: procesar en lotes de 10 emails con intervalo de 1 segundo para evitar rate limiting del SMTP.
