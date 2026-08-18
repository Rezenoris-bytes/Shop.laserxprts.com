LEI --- MVP Technical Stack & Execution Plan --- Revised

Laser Experts India \| Custom Web Platform \| Revision 1.1 \| 18 August
2026

MVP baseline: 160--180 development hours \| First demo target: Hour
40--50

**Project Objective**

Build a fast, SEO-friendly, custom LEI platform that makes industrial
products and services easy to discover and understand, while giving the
sales team a central place to manage customers, enquiries, quotations,
and basic customer activity.

# Revision 1.1 --- Timeline Corrections

No cart/checkout implementation is part of the MVP. The MVP is
enquiry/quote driven, with post-quote order fulfilment tracking.

Customer login is optional and deferred. Guest visitors can browse
products and submit enquiries/quote requests. Admin authentication is
mandatory.

Service requests create or link a SERVICE lead so high-value retrofit,
repair and maintenance enquiries are visible to Sales when permitted.

Inventory is managed through a dedicated inventory table; products do
not duplicate stock fields.

Accepted orders store the exact quote revision that was accepted for
full commercial traceability.

Hindi/English content is implemented through translation tables; English
remains the default MVP locale unless Hindi content production is
explicitly scheduled.

# 1. Confirmed MVP Technology Stack

  -----------------------------------------------------------------------
  **Layer**               **Technology**          **MVP role**
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js + React +       SEO, performance,
                          TypeScript              storefront, service
                                                  pages

  UI / Styling            Tailwind CSS            Consistent responsive
                                                  interface

  Backend                 NestJS + Fastify        Custom REST API and
                                                  business logic

  Database                MySQL                   Core business and
                                                  customer data

  ORM                     Prisma                  Type-safe database
                                                  access

  Search                  MySQL Full-Text (MVP)   Simple
                                                  product/part-number
                                                  discovery; upgrade to
                                                  Meilisearch later

  Authentication          JWT + httpOnly          Secure customer/admin
                          cookies + refresh-token authentication
                          rotation                

  File Storage            Local VPS (MVP)         Product images, PDFs,
                                                  catalogues; move to
                                                  R2/B2 later if required

  Caching                 Redis                   Use for
                                                  sessions/cart/rate
                                                  limiting where needed;
                                                  avoid complex caching
                                                  initially

  Analytics               GA4 + custom event      Marketing analytics
                          tracking                plus first-party
                                                  business events

  Admin Panel             Next.js + NestJS custom Products, services,
                          admin                   quotes, customers,
                                                  leads

  Payments                Stripe / Razorpay       Not part of MVP; add
                                                  when online payments
                                                  are required

  Hosting                 Hostinger VPS           Application and
                                                  database hosting

  Web Server              Nginx                   Reverse proxy and
                                                  HTTPS/TLS

  Containerization        Docker + Docker Compose Consistent local and
                                                  production environments

  CI/CD                   GitHub Actions          Build, test and deploy
                                                  pipeline

  Monitoring / Logs       Docker logs +           Basic operational
                          UptimeRobot             visibility

  Security                Helmet + rate           Baseline API and app
                          limiting + CORS         security
                          whitelist +             
                          class-validator         
  -----------------------------------------------------------------------

# 2. MVP Architecture

-   Customer browser → Next.js storefront → NestJS + Fastify REST API →
    Prisma → MySQL

-   Next.js custom admin → NestJS admin APIs → MySQL

-   Local VPS storage for images, PDFs and catalogues during MVP

-   GA4 + custom event tracking for user and sales-intent signals

-   All application components deployed on the Hostinger VPS using
    Docker Compose and Nginx.

# 3. MVP Scope

## Customer website

-   Homepage

-   Product catalogue

-   Category pages

-   Product detail pages

-   Services catalogue

-   Service detail pages

-   Search and basic filters

-   Request quote / enquiry

-   Contact / WhatsApp / phone actions

-   Guest enquiry/quote; customer login optional and deferred

## Admin / Sales

-   Dashboard

-   Products

-   Categories

-   Brands

-   Specifications

-   Services

-   Customers

-   Enquiries

-   Quote requests

-   Leads

-   Basic customer activity

-   Basic reports

## Tracking

-   Page view

-   Product view

-   Category view

-   Search

-   Filter used

-   Quote started

-   Quote submitted

-   Brochure download

-   WhatsApp click

-   Phone click

-   Contact form

-   Admin login / authentication events

# MVP Business Workflow Baseline

Product: Product discovery → Enquiry → Lead → Quote → Quote revision(s)
→ Accepted → Order → Confirmed → Packed → Shipped → Delivered.\
Service: Service discovery → Service request → SERVICE lead → Service
Admin assignment → Technical assessment → Quote → Follow-up → Service
completion.\
Stock: Inventory table is the only source of truth for quantity, reorder
level and stock status.

# 4. Step-by-Step Execution Timeline

Planning baseline: 175 hours. Expected range: 160--190 hours, depending
mainly on content/product-data readiness. Work is tracked in 1-hour
blocks for progress reporting.

  ----------------------------------------------------------------------------------------------------------------------------
  **Phase**      **Hours**      **Effort**     **Main work**                                             **Milestone**
  -------------- -------------- -------------- --------------------------------------------------------- ---------------------
  Phase 1 ---    1--10          10             Requirements, scope freeze, repo, Next.js,                Development
  Planning &                                   NestJS/Fastify, Docker Compose, MySQL, Prisma,            environment ready.
  Foundation                                   environment config, Nginx structure, CI baseline.         

  Phase 2 ---    11--28         18             Schema for users, roles, customers, products, categories, Core API functional.
  Database &                                   brands, attributes, services, enquiries, quotes, leads,   
  Backend                                      events; Prisma migrations; auth/RBAC; core APIs.          
  Foundation                                                                                             

  Phase 3 ---    29--42         14             LEI visual system, typography, responsive layout, header, Reusable UI
  Design System                                navigation, footer, buttons, cards, forms, modal/drawer,  foundation complete.
  & Frontend                                   loading/error states, mobile navigation.                  
  Foundation                                                                                             

  Phase 4 ---    43--52         10             Hero, featured products, categories, services, why LEI,   Presentable homepage.
  Homepage                                     industries, brands, process, testimonials, CTA, footer.   

  Phase 5 ---    53--75         23             Listings, category pages, brand pages, search, filters,   Customers can
  Product                                      sorting, pagination, product cards, product details,      discover products.
  Catalogue                                    related products, compatibility, specifications,          
                                               downloads.                                                

  Phase 6 ---    76--88         13             2D/3D or 5-axis laser cutting, tube laser cutting,        Service catalogue
  Services                                     CO2→fiber retrofit, machine services, remanufacturing,    complete.
                                               maintenance/AMC, other engineering services.              

  Phase 7 ---    89--102        14             Product quotes, service quotes, bulk enquiries, contact   End-to-end enquiry
  Quote /                                      forms, file uploads, customer details, sales              workflow.
  Enquiry System                               notifications, admin quote management.                    

  Phase 8 ---    103--120       18             Dashboard, product/category/brand/service management,     Sales team can
  Admin Panel                                  customer management, quotes, enquiries, leads, recent     operate the platform.
                                               activity, sales view.                                     

  Phase 9 ---    121--132       12             Implement                                                 Basic customer
  Customer                                     page/product/search/filter/quote/contact/download/login   intelligence
  Tracking                                     events; persist useful events; connect GA4.               available.

  Phase 10 ---   133--144       12             Metadata, canonical URLs, Open Graph, sitemap, robots,    Search-engine-ready
  SEO                                          breadcrumbs, product/service schema, internal linking,    platform.
                                               SEO-friendly URLs.                                        

  Phase 11 ---   145--155       11             Image optimization, caching where useful, pagination, DB  MVP hardened.
  Performance &                                indexes, query optimization, bundle/mobile optimization,  
  Security                                     Helmet, rate limiting, CORS, validation, secure uploads,  
                                               admin authorization.                                      

  Phase 12 ---   156--175       20             Hostinger VPS deployment, Docker, Nginx, SSL, production  MVP ready for
  Deployment &                                 environment, backups, domain/DNS, functional testing,     demo/controlled
  Testing                                      API/auth/admin/quote/mobile/SEO/performance/security QA,  launch.
                                               final bug fixing.                                         
  ----------------------------------------------------------------------------------------------------------------------------

# Data Integrity / Architecture Gate

Before schema migration coding begins, verify: single-source inventory,
quote_revision_id on orders, service-request-to-lead linkage,
translation tables, machine fallback rule, and absence of cart/payment
scope in MVP. This is a mandatory architecture gate and is included
within the existing 175-hour baseline.

# 5. First Demo Target

-   Target around Hour 40--50.

-   Homepage is presentable and responsive.

-   Product listing and at least one category are functional.

-   Search works for core product names/part numbers.

-   Product details are connected to the backend.

-   Service page and request-quote flow are demonstrable.

-   Basic admin can show products and enquiries.

# 6. Post-MVP Upgrade Path

  -----------------------------------------------------------------------
  **Upgrade**             **Current MVP**         **Later**
  ----------------------- ----------------------- -----------------------
  Search                  MySQL Full-Text         Meilisearch for typo
                                                  tolerance,
                                                  autocomplete, ranking
                                                  and faster discovery

  File Storage            Local VPS               Cloudflare R2 /
                                                  Backblaze B2 when file
                                                  volume or traffic
                                                  justifies it

  Payments                Not included            Razorpay / Stripe when
                                                  online checkout is
                                                  approved

  AI / Agentic discovery  Not included            Semantic search and
                                                  agentic product/service
                                                  assistant

  Lead scoring            Basic activity only     Advanced intent scoring
                                                  and sales automation
  -----------------------------------------------------------------------

# 7. MVP Engineering Principles

-   Keep the architecture modular but do not introduce microservices
    during MVP.

-   Use server rendering and server components where they improve
    performance and SEO.

-   Index database columns used for search, filtering and relationships;
    avoid N+1 queries.

-   Use pagination for catalogue and admin tables.

-   Validate all API inputs and uploaded files.

-   Keep secrets in environment variables; never commit credentials.

-   Automate database backups on the VPS from the beginning.

-   Keep search, storage and payment integrations replaceable so the MVP
    can evolve without a rewrite.

# 8. Final Stack Summary

**Frontend:** Next.js + React + TypeScript

**Backend:** NestJS + Fastify

**Database:** MySQL + Prisma

**Search:** MySQL Full-Text for MVP → Meilisearch later

**Hosting:** Hostinger VPS + Docker + Nginx

**Admin:** Custom Next.js + NestJS admin

**Analytics:** GA4 + custom event tracking

**Payments:** Deferred until post-MVP
