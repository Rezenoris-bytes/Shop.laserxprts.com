**LEI --- GitHub Actions Development Plan**

*Code Quality • Build Validation • Database/Schema Validation • Security
Checks*

**No deployment workflow yet --- hosting phase deferred**

Since LEI is not being hosted yet, the GitHub Actions plan focuses only
on code quality, build validation, database/schema validation, and
security checks. This plan is based on GitHub's current Actions
workflow, secrets, permissions, and trigger guidance.

1\. Git Branch Strategy

We are using only two permanent branches:

-   **main** --- Stable / release-ready branch

-   **dev** --- Active development branch

**Flow:**

dev → Pull Request → CI → Review → main

*No test, staging, release, L1, L2, or other long-lived branches.*

2\. GitHub Actions We Need Now

For the current development stage, three workflows are recommended:

.github/workflows/

> ├── ci.yml
>
> ├── database.yml
>
> └── security.yml

**Workflow Summary**

  ------------------ ------------------------------ -------------------------
  **Workflow**       **Purpose**                    **Runs on**

  **ci.yml**         Build, lint, type-check, tests dev, main, PR

  **database.yml**   Prisma / MySQL schema          dev, main, PR
                     validation                     

  **security.yml**   Dependency / security checks   dev, main, PR
  ------------------ ------------------------------ -------------------------

*Deployment workflow is intentionally excluded for now.*

3\. ci.yml --- Main CI Pipeline

This is the most important workflow.

Triggers

-   push → dev

-   push → main

-   pull_request → main

GitHub Actions supports branch filters on workflow triggers, so
execution can be restricted to exactly these branches.

Frontend Checks (Next.js)

1.  npm ci

2.  ESLint

3.  TypeScript type-check

4.  Build

Backend Checks (NestJS)

5.  npm ci

6.  ESLint

7.  TypeScript type-check

8.  Unit tests

9.  Build

Result

If anything fails: ❌ CI FAILED

If everything passes: ✅ CI PASSED

4\. database.yml --- Database Validation

Because the stack uses NestJS + Prisma + MySQL, a dedicated database
workflow is required.

Checks

10. Prisma Format (npx prisma format)

11. Prisma Validate (npx prisma validate)

12. Prisma Generate (npx prisma generate)

13. Migration Validation

Later, once the schema is stable, migrations should be tested against a
temporary MySQL service in GitHub Actions.

Why separate this?

A frontend build can pass while someone accidentally introduces a broken
Prisma schema. We want both Application validation and Database
validation before merging into main.

5\. security.yml --- Security Checks

This workflow should stay lightweight.

Checks

-   npm audit (or chosen dependency-audit tooling)

-   Vulnerable npm packages

-   Outdated dependencies

-   Accidentally committed secrets

-   Unsafe configuration

GitHub recommends least-privilege handling for Actions credentials and
secrets.

Severity Policy

-   **Critical / High** → Fail the workflow

-   **Moderate / Low** → Report / Review (do not block development)

6\. Pull Request Flow

Normal developer workflow:

14. Local development

15. git push origin dev

16. CI + Database + Security run automatically

17. All checks PASS

18. Create PR: dev → main

19. CI runs again on the PR

20. Code review

21. Merge into main

7\. What Happens When You Push to dev

**Example:**

git add .

git commit -m \"feat: add product catalogue\"

git push origin dev

GitHub automatically runs CI, Database, and Security. You should see:

-   ✅ CI

-   ✅ Database

-   ✅ Security

*You do not need to merge to main after every commit.*

8\. What Happens When You Create PR dev → main

GitHub runs the checks again. Require all checks to be green before
allowing the PR to merge.

dev → Pull Request → CI + Database + Security → All green → Merge → main

9\. main Branch Protection

Configure branch protection rules for main:

-   Pull request required

-   CI must pass

-   Database validation must pass

-   Security check must pass

-   No direct push

-   No force push

Result: direct pushes to main are blocked.

**Only path: dev → PR → Checks → Merge → main**

10\. GitHub Secrets

Since we are not deploying yet, production secrets (VPS_HOST, VPS_USER,
VPS_SSH_KEY, etc.) are not needed.

Keep development secrets local:

-   .env

-   .env.local

Commit only:

-   .env.example

Example .env.example contents:

DATABASE_URL=

JWT_SECRET=

JWT_REFRESH_SECRET=

REDIS_URL=

NEXT_PUBLIC_API_URL=

**Never commit real credentials into the repository.**

11\. CI Database

**Do not connect GitHub Actions to a personal/local MySQL database.**

Eventually the database workflow should spin up a temporary MySQL
service on the GitHub runner, run Prisma migrations against it, then
destroy the test database. This keeps CI independent of any developer
machine.

For the initial setup, start with schema validation (format / validate /
generate) and add the temporary MySQL service once the first Prisma
migration exists.

12\. Docker

Docker remains part of the local development stack, but GitHub does not
need to build or deploy Docker images yet.

**Locally:**

-   Docker Compose → MySQL + Redis

-   Next.js and NestJS can run directly via npm run dev

*Docker build + Hostinger VPS deployment will be a separate phase.*

13\. Workflows We Are NOT Creating Now

Do not create these yet:

-   deploy.yml

-   production.yml

-   VPS / SSH deployment

-   Docker registry publishing

-   SSL automation

-   Nginx deployment

-   Production health checks

-   Production database migration

-   Production backup workflow

14\. Future Deployment Workflow

When ready to host LEI, add:

.github/workflows/deploy.yml

Flow at that time: main → CI → Docker build → Hostinger VPS → Health
check

*This does not need to be built now.*

15\. Final GitHub Actions Architecture (NOW)

.github/workflows/

> **├── ci.yml**
>
> ├── Next.js lint / type-check / build
>
> └── NestJS lint / type-check / test / build
>
> **├── database.yml**
>
> ├── Prisma format / validate / generate
>
> └── Migration validation
>
> **└── security.yml**
>
> ├── Dependency audit + security checks

Final Decision

For LEI right now, lock the following:

-   3 GitHub Actions workflows: **ci.yml, database.yml, security.yml**

-   2 branches: **dev and main**

-   No deployment workflow until hosting begins

-   No production secrets until production exists

*This keeps the CI/CD setup professional without introducing
infrastructure that is not currently needed.*
