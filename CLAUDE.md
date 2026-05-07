# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

星瞰 is a full-stack aerospace information platform providing satellite visualization (Cesium 3D), space education content, aerospace intelligence, and space weather monitoring. The platform uses Vue 3 (frontend) and NestJS (backend) with PostgreSQL.

## Common Commands

### Backend (backend-nest/)

```bash
pnpm run start:dev      # Start development server (port 3001)
pnpm run build          # Build for production
pnpm run test           # Run unit tests
pnpm run test:e2e       # Run e2e tests
pnpm run lint           # Run ESLint
```

### Frontend (frontend/)

```bash
pnpm run dev            # Start development server (port 5174)
pnpm run build          # Build for production (includes type-check)
pnpm run lint           # Run oxlint + ESLint
pnpm run type-check     # Run vue-tsc type checking
```

## Architecture

### Backend Structure

```
backend-nest/src/
├── modules/           # Domain modules (auth, user, satellite, etc.)
│   └── <module>/      # Each contains: controller, service, module, entities
├── common/            # Shared utilities
│   ├── entities/      # Shared database entities
│   ├── guards/        # Auth guards
│   ├── filters/       # Exception filters
│   └── interceptors/  # Response transformers
└── config/            # Configuration files (app.config.ts)
```

Key patterns:

- All API routes prefixed with `/api`
- WebSocket gateway at `/ws/satellites` for real-time satellite positions
- Global `AllExceptionsFilter` and `TransformInterceptor` for consistent responses
- Configuration loaded from environment variables via `ConfigService`
- TypeORM `synchronize: true` for auto schema sync (set false for production)

### Frontend Structure

```
frontend/src/
├── api/index.ts       # Centralized API layer with axios interceptors
├── stores/            # Pinia stores (user, theme)
├── hooks/             # Composables (useCesium, useWebSocket, useSatellite)
├── views/             # Page components
├── components/        # Reusable components (SatelliteList, OrbitPrediction, etc.)
├── router/index.ts    # Vue Router with auth guards
└── layouts/           # Layout components
```

Key patterns:

- API responses wrapped in `{ success, data, message }` format
- Token stored in localStorage, auto-refresh on 401
- Route guards check `meta.requiresAuth` and `meta.guestOnly`
- Cesium loaded via vite-plugin-cesium

### Key Domain Modules

| Module        | Purpose                                             |
| ------------- | --------------------------------------------------- |
| auth          | JWT authentication, login/register, token refresh   |
| user          | User profile management                             |
| satellite     | TLE data, orbit calculation, WebSocket broadcasting |
| space-weather | Space weather status and alerts from NOAA           |
| education     | Articles and daily quiz                             |
| intelligence  | Aerospace news and intelligence                     |
| points        | Daily check-in, points system                       |
| notification  | User notifications                                  |
| feedback      | User feedback submission                            |

### Satellite System Architecture

- `OrbitCalculatorService`: Uses satellite.js to calculate positions from TLE data
- `SpaceTrackService`: Fetches and caches TLE data from Space-Track API
- `SatelliteGateway`: WebSocket gateway broadcasting satellite positions every 5 seconds
- Frontend `useWebSocket` hook manages connection to backend

## Database Configuration

Environment variables (see backend-nest/.env.example):

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<password>
DB_NAME=nova_space
JWT_SECRET=<secret>
```

## Ports

- Frontend: 5174 (Vite dev server)
- Backend API: 3001
- WebSocket: ws://localhost:3001/ws/satellites
