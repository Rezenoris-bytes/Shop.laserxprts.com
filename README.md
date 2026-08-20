# LEI Platform

Catalogue, enquiry, and quotation platform for Laser Experts India.

## Status

**Phase 1 — Development / Staging**

> The project is currently under active development. Staging uses sample data and is not production-ready.

## Overview

LEI Platform is a technical catalogue and sales platform designed to help users:

- Browse and search products
- Find suitable parts
- Submit enquiries
- Request quotations
- Manage leads
- Create and manage quotations

The platform is **not an online store**. It does not currently include cart, checkout, or payment functionality.

## Tech Stack

| Layer      | Technology                               |
| ---------- | ---------------------------------------- |
| Frontend   | Next.js, React, TypeScript, Tailwind CSS |
| Backend    | NestJS, Fastify                          |
| Database   | MySQL 8, Prisma                          |
| Cache      | Redis                                    |
| Search     | MySQL                                    |
| Deployment | Docker, Nginx, Hostinger VPS             |

## Project Structure

```text
apps/
├── api/              # Backend API
└── web/              # Frontend application

packages/
└── shared-types/     # Shared types, enums and utilities

files/
└── specifications/   # Project specifications and documentation
```

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Configure environment

```bash
cp .env.example .env
```

Update `.env` with the required configuration.

### 3. Start dependencies

```bash
docker compose up -d
```

### 4. Install dependencies

```bash
npm install
```

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Start the application

```bash
npm run dev
```

The development applications will be available at their configured local ports.

## Common Commands

```bash
npm run dev          # Start development environment
npm run build        # Build applications
npm run lint         # Run linting
npm run typecheck    # Run TypeScript checks
npm run test         # Run tests

npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio

npm run docker:reset # Reset Docker environment
```

## Environment

Environment-specific configuration should be stored in `.env`.

Do not commit:

- Secrets
- Passwords
- API keys
- Production credentials
- Local environment files

Use `.env.example` as the reference for required variables.

## Development Guidelines

When contributing:

1. Keep frontend and backend responsibilities separated.
2. Reuse shared types and utilities where appropriate.
3. Avoid hardcoding environment-specific values.
4. Keep database changes migration-based.
5. Run linting, type checking, and tests before committing.
6. Update documentation when introducing significant changes.

## License

This project is proprietary software belonging to **Laser Experts India**.
