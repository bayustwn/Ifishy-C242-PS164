FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate
RUN npm prune --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

USER node
CMD ["npm", "run", "start:stack"]
