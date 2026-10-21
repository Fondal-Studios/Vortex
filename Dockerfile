# Servidor cooperativo en un contenedor mínimo (sirve para Render con Docker, Koyeb, Fly.io, Railway o cualquier nube).
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 TRUST_PROXY=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY src ./src
COPY public ./public
COPY assets ./assets
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "server/server.js"]
