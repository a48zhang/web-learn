FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/auth/package.json ./services/auth/
RUN pnpm install --filter @web-learn/auth-service --frozen-lockfile
COPY services/auth ./services/auth
RUN cd services/auth && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/auth/dist ./services/auth/dist
COPY --from=builder /app/services/auth/node_modules ./services/auth/node_modules
COPY --from=builder /app/services/auth/package.json ./services/auth/
WORKDIR /app/services/auth
EXPOSE 3001
CMD ["node", "dist/index.js"]
