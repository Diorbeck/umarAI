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

# Не root
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
