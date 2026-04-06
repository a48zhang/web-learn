FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/gateway/package.json ./services/gateway/
RUN pnpm install --filter @web-learn/gateway --frozen-lockfile
COPY services/gateway ./services/gateway
RUN cd services/gateway && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/gateway/dist ./services/gateway/dist
COPY --from=builder /app/services/gateway/node_modules ./services/gateway/node_modules
COPY --from=builder /app/services/gateway/package.json ./services/gateway/
WORKDIR /app/services/gateway
EXPOSE 3000
CMD ["node", "dist/index.js"]
