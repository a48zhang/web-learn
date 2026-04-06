FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/topic-space/package.json ./services/topic-space/
RUN pnpm install --filter @web-learn/topic-space-service --frozen-lockfile
COPY services/topic-space ./services/topic-space
RUN cd services/topic-space && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/topic-space/dist ./services/topic-space/dist
COPY --from=builder /app/services/topic-space/node_modules ./services/topic-space/node_modules
COPY --from=builder /app/services/topic-space/package.json ./services/topic-space/
WORKDIR /app/services/topic-space
EXPOSE 3002
CMD ["node", "dist/index.js"]
