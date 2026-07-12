# Guía de Despliegue en Producción — KIMY

Esta guía contiene los pasos necesarios para publicar el código en GitHub y desplegar el backend en **Render** y el frontend en **Vercel**.

---

## 1. Subir el Código a GitHub

Dado que no se ha inicializado Git, sigue estos pasos en la terminal de tu máquina local:

```powershell
# 1. Inicializar el repositorio Git
git init

# 2. Agregar todos los archivos (el .gitignore configurado evitará subir credenciales y temporales)
git add .

# 3. Hacer el primer commit
git commit -m "chore: preparacion para despliegue en produccion"

# 4. Cambiar el nombre de la rama principal a 'main'
git branch -M main

# 5. Asociar tu repositorio remoto de GitHub
git remote add origin https://github.com/ayrtonqj/generador-tesis-ia-santos-ix.git

# 6. Subir el código a GitHub
git push -u origin main
```

---

## 2. Despliegue del Backend en Render

Hemos creado un archivo `render.yaml` (Render Blueprint) que automatiza la creación de toda la infraestructura del backend en Render (Base de datos PostgreSQL, Redis y la API en NestJS).

### Pasos para desplegar:

1. Ve a tu panel de control en [Render](https://dashboard.render.com).
2. Haz clic en **New** (Nuevo) en la esquina superior derecha y selecciona **Blueprint**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio `generador-tesis-ia-santos-ix`.
4. Render leerá el archivo `render.yaml` y te mostrará una lista de los recursos que va a crear:
   - **kimy-postgres** (PostgreSQL 16 con `pgvector` nativo).
   - **kimy-redis** (Redis para el procesamiento de colas BullMQ).
   - **kimy-api** (API en NestJS basada en el `Dockerfile` de producción).
5. **Variables de entorno obligatorias a rellenar**:
   Durante el setup del Blueprint, Render te pedirá ingresar valores para las variables que no están pre-configuradas:
   - `OPENAI_API_KEY`: Tu clave de OpenAI API.
   - `GEMINI_API_KEY`: Tu clave de Gemini API (si deseas usar Gemini 2.0 nativo).
   - `MINIO_ENDPOINT`: El host de tu S3-compatible (ej. `s3.amazonaws.com` o el host de Cloudflare R2). *Nota: En producción, es altamente recomendable usar AWS S3 o Cloudflare R2 en lugar de MinIO local.*
   - `MINIO_ACCESS_KEY` y `MINIO_SECRET_KEY`: Las credenciales de acceso a tu S3/R2.
   - `APP_URL` y `FRONTEND_URL`: URL temporal de tu frontend en Vercel (puedes poner un placeholder temporal como `https://tudominio.vercel.app` y luego actualizarlo cuando Vercel te dé la URL definitiva).
6. Haz clic en **Apply** (Aplicar) para iniciar el despliegue.

### Comandos de construcción en Render (definidos en `Dockerfile`):
- Instalación de dependencias del monorepo (`npm install`).
- Generación del cliente de base de datos (`npm run db:generate`).
- Compilación del backend usando Turborepo (`npx turbo run build --filter=@kimy/api...`).
- Exposición automática en el puerto dinámico de Render y ejecución de `npm run start --workspace=@kimy/api`.

---

## 3. Despliegue del Frontend en Vercel

Vercel detecta automáticamente proyectos creados con Next.js y configuraciones de monorepos de Turborepo.

### Pasos para desplegar:

1. Inicia sesión en [Vercel](https://vercel.com).
2. Haz clic en **Add New...** -> **Project**.
3. Importa el repositorio `generador-tesis-ia-santos-ix`.
4. En **Configure Project**:
   - **Root Directory**: Haz clic en *Edit* y selecciona `apps/web`.
   - **Build and Development Settings**:
     - Vercel detectará Turborepo por defecto. Asegúrate de que la casilla *"Include files outside of the Root Directory in the Build Step"* esté **marcada** (obligatorio ya que el frontend importa de `packages/shared-types`).
     - **Build Command**: Cambia el comando por defecto a:
       ```bash
       cd ../.. && npx turbo run build --filter=@kimy/web
       ```
   - **Environment Variables**: Agrega las siguientes variables de entorno:
     - `NEXT_PUBLIC_API_URL`: La URL pública del backend en Render (ej. `https://kimy-api.onrender.com`).
     - `NEXTAUTH_URL`: La URL pública de tu frontend en Vercel (ej. `https://generador-tesis-ia-santos-ix.vercel.app`).
     - `NEXTAUTH_SECRET`: Genera un hash aleatorio de 32 caracteres (puedes usar el comando `openssl rand -base64 32` en tu terminal).
     - `APP_URL`: La misma URL de tu frontend en Vercel.
5. Haz clic en **Deploy** (Desplegar).

---

## 4. Sembrado Inicial de Base de Datos en Producción (Seed)

El blueprint realiza automáticamente `prisma db push` en cada despliegue para sincronizar el esquema. Si deseas sembrar los usuarios de prueba en la base de datos de producción por única vez:

1. Ve al servicio de la API en Render (**kimy-api**).
2. Abre la pestaña **Shell** en el menú lateral.
3. Ejecuta el siguiente comando para sembrar los usuarios administradores y académicos de prueba:
   ```bash
   npm run db:seed
   ```
4. Las credenciales de prueba creadas serán:
   - **Admin**: `admin@kimy.edu` / `Kimy2026!`
   - **Coordinador**: `coordinador@kimy.edu` / `Kimy2026!`
   - **Asesor**: `asesor1@kimy.edu` / `Kimy2026!`
   - **Estudiante**: `estudiante1@kimy.edu` / `Kimy2026!`
