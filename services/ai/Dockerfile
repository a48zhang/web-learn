FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/ai/package.json ./services/ai/
RUN pnpm install --filter @web-learn/ai-service --frozen-lockfile
COPY services/ai ./services/ai
RUN cd services/ai && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/ai/dist ./services/ai/dist
COPY --from=builder /app/services/ai/node_modules ./services/ai/node_modules
COPY --from=builder /app/services/ai/package.json ./services/ai/
WORKDIR /app/services/ai
EXPOSE 3003
CMD ["node", "dist/index.js"]
