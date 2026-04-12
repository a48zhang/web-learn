FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY services/registry/package.json ./services/registry/
RUN pnpm install --filter @web-learn/registry --frozen-lockfile
COPY services/registry ./services/registry
RUN cd services/registry && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/registry/dist ./services/registry/dist
COPY --from=builder /app/services/registry/node_modules ./services/registry/node_modules
COPY --from=builder /app/services/registry/package.json ./services/registry/
WORKDIR /app/services/registry
EXPOSE 3010
CMD ["node", "dist/index.js"]
