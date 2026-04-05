# Microservices Architecture Refactoring Implementation Plan

See docs/microservices-architecture-design.md for the full spec.

## Summary

Refactor monolith backend into microservices:
- packages/utils: shared config, logger, database helpers
- services/gateway: API proxy (port 3000)
- services/auth: Auth service (port 3001)
- services/topic-space: Topics + Pages CRUD (port 3002)
- services/ai: AI chat (port 3003)
- Docker Compose orchestration
