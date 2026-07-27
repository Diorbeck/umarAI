# Умар Telegram Bot — Railway/Docker
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN (npm ci --omit=dev || npm install --omit=dev) && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY memory-template ./memory-template
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Контейнер стартует как root (нужно, чтобы выдать права на смонтированный Volume),
# затем entrypoint роняет привилегии до пользователя node перед запуском Node.js.
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
