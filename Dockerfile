FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json eslint.config.mjs ./
COPY src ./src
COPY test ./test

RUN npm run build

FROM node:22-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main"]
