# Dockerfile
 
FROM node:16-alpine

LABEL org.opencontainers.image.title "Xupopter Runner"
LABEL org.opencontainers.image.description "A self-hosted no-code webscrapper."
LABEL org.opencontainers.image.url="https://github.com/tetreum/xupopter_runner"
LABEL org.opencontainers.image.source='https://github.com/tetreum/xupopter_runner'
 
RUN npm install -g pnpm
 
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
 
COPY . .
RUN pnpm build
 
ENV NODE_ENV production
ENV PORT 8089
EXPOSE $PORT

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider --no-check-certificate http://localhost:$PORT/api/health || exit 1

CMD ["node", "index.js"]