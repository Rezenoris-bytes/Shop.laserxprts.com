# LEI Platform

Catalogue, enquiry and quotation platform for Laser Experts India.

**Status: Phase 1 — Stage 1.1/1.3 complete.** Development/staging only.
`DEMO_MODE` is ON: the catalogue is sample data, and indexing is blocked.

## What this is

A technical-catalogue-driven lead generation and sales-operations system:

```
discover the right part for your machine
  -> Quote Request  ->  enquiry  ->  lead  ->  quote (+ revisions)  ->  accepted
```

It is **not** an online shop. There is no cart, no checkout and no payment
integration; the MVP is enquiry and quotation driven.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js + React + TypeScript + Tailwind |
| Backend | NestJS + Fastify (modular monolith) |
| Database | MySQL 8 + Prisma |
| Cache | Redis — rate limiting and refresh-token families only |
| Search | MySQL exact/prefix + FULLTEXT behind a SearchService |
| Hosting | Hostinger VPS + Docker + Nginx |

## Getting started

```bash
cp .env.example .env          # then fill in the secrets
npm install
docker compose up -d          # MySQL 8 + Redis
npm run db:migrate            # apply migrations
npm run dev:api               # http://localhost:4000
curl http://localhost:4000/health
```

MySQL runs on **3307** by default to avoid clashing with a local install.

### One-time database grants (development)

The app user needs two extra rights that a fresh MySQL container does not give
it. In production these belong to the deploy user, not the application user.

```bash
docker exec -i lei-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
  GRANT ALL PRIVILEGES ON \`prisma_migrate_shadow_db%\`.* TO 'lei'@'%';
  GRANT TRIGGER ON \`lei\`.* TO 'lei'@'%';
  FLUSH PRIVILEGES;"
```

## Repository layout

```
apps/
  api/                 NestJS + Fastify backend
    prisma/            schema, migrations, seed
    src/
      config/          env validation (fails fast at boot)
      common/          guards, filters, interceptors, pipes, decorators
      prisma/          PrismaService (soft-delete extension)
      redis/           rate limiting + token families
      demo/            DEMO_MODE rails and the production safety check
      health/          /health
  web/                 Next.js storefront and admin (Stage 2)
packages/
  shared-types/        API contract, enums, money/GST, normalisation
files/                 specification and design documents
```

## Architectural rules, enforced by tooling

These three erode silently if left to code review, so none of them is:

| Rule | Enforced by |
|---|---|
| Controllers never touch Prisma | ESLint — `PrismaService` importable only in `*.repository.ts` |
| Every route is `@Public()` or `@RequirePermission()` | Boot assertion — **the process exits** if any route declares neither |
| Soft-deleted rows are never read by accident | Prisma client extension injects `deletedAt: null` |

Plus, in CI: no hardcoded catalogue data in `apps/web`, no `Float` in the
schema, no wildcard CORS, no SVG in an upload allowlist, no hardcoded domain.

## Two things worth knowing before reading the schema

**Product vs ProductVariant.** Nothing in the schema encodes what groups
variants into a product — that arrives in the `product_key` column of the
import CSV. Because every commercial record references a `ProductVariant` and
never a `Product`, the grouping can be changed later with
`UPDATE product_variants SET product_id = ...` without touching a single
historical enquiry, quote or PDF.

**Search.** MySQL FULLTEXT splits on punctuation and drops short tokens, so a
customer typing `D27.9 T4.1` would get nothing. Exact and prefix matching runs
first against `product_variants.search_key`, a normalised form (`D279T41`)
produced by one shared function used at both write and read time.

## Commands

```bash
npm run dev              # both apps
npm run build            # shared -> api -> web
npm run lint
npm run typecheck
npm run test
npm run db:migrate
npm run db:studio
npm run docker:reset     # destroys volumes and restarts
```

## DEMO_MODE

The staging deployment sits on a subdomain of a real trading company's domain
and carries invented compatibility claims and placeholder prices. `DEMO_MODE`
exists so none of that can escape:

- `robots.txt` disallows everything; `X-Robots-Tag: noindex` on every response
- persistent sample-data banner on the storefront
- `SAMPLE — NOT A COMMERCIAL DOCUMENT` watermark on quote PDFs
- outbound email restricted to `MAIL_DEMO_ALLOWLIST`
- seed records visibly chipped in the admin UI

Setting `DEMO_MODE=false` while any seed data or `PLACEHOLDER` setting remains
in the database **refuses to boot**, so going live cannot be a checklist item
someone forgets.
