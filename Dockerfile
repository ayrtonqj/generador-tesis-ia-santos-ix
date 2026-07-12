# Image base con Node.js
FROM node:20-bullseye

# Instalar Chromium y dependencias necesarias para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Evitar descargar Chromium en puppeteer y usar el instalado en el sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiar el monorepo completo
COPY . .

# Instalar dependencias del monorepo
RUN npm install

# Generar el cliente Prisma
RUN npm run db:generate

# Compilar dependencias internas y la API usando Turborepo
RUN npx turbo run build --filter=@kimy/api...

# Puerto expuesto por defecto para NestJS (Render inyectará PORT en producción)
EXPOSE 3001

# Comando de inicio del servidor en modo producción
CMD ["npm", "run", "start", "--workspace=@kimy/api"]
