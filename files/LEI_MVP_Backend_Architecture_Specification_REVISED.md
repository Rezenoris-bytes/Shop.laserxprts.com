**Modular Monolith • NestJS + Fastify • Prisma • MySQL**

Version 1.1 \| MVP Architecture Baseline \| Corrections Applied \| 18
August 2026

  -----------------------------------------------------------------------
  **Decision: LEI will use a modular monolith for the MVP. One NestJS +
  Fastify backend will contain clearly separated business modules, while
  Prisma and MySQL remain the shared data layer. This keeps development
  fast, deployment simple, and the codebase ready for selective
  extraction into services later if scale requires it.**
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# Revision 1.1 --- Implementation Corrections

Inventory source of truth: the inventory module/table owns
stock_quantity, reorder_level and stock_status. The products module must
not duplicate these fields.

Order traceability: the orders module stores both quote_id and
quote_revision_id; quote_revision_id identifies the exact accepted
commercial revision.

Service-to-sales linkage: every service request creates or updates a
linked lead with lead_type=SERVICE. Service admins handle technical
operations; Sales can use the linked lead for commercial follow-up when
permitted.

Translation model: use explicit product_translations,
category_translations and service_translations tables for en/hi content.
English is the default locale.

Machine data rule: machine_variant_id is authoritative when present.
laser_type and laser_power on service/customer-machine records are
fallback/manual fields only when no exact variant is known.

MVP scope is enquiry/quote driven. Do not introduce cart, checkout or
payment modules unless the business scope changes.

# 1. Purpose and Scope

This document defines the backend architecture for the Laser Experts
India (LEI) MVP. It is the implementation baseline for the backend team
and should be treated as the reference design before schema and module
coding begins.

-   Support a product catalogue for laser spares, consumables,
    components, and related technical products.

-   Support service discovery and service-request workflows for
    retrofit, maintenance, repair, remanufacturing, AMC, welding,
    chiller repair, and related services.

-   Support sales operations through enquiries, leads, quotes, quote
    revisions, order fulfilment, and customer activity.

-   Secure the operational platform around two system roles: SUPER_ADMIN
    and ADMIN, with configurable permissions for Admin users.

-   Provide an API-first backend for the Next.js storefront and custom
    admin panel.

-   Keep the MVP cost-conscious and operationally simple on a Hostinger
    VPS.

# 2. Confirmed Technology Stack

  ------------------------------------------------------------------------
  **Layer**               **Technology**          **MVP Decision**
  ----------------------- ----------------------- ------------------------
  **Frontend**            Next.js + React +       Locked
                          TypeScript              

  **UI / Styling**        Tailwind CSS            Locked

  **Backend**             NestJS + Fastify        Locked

  **Database**            MySQL                   Locked

  **ORM**                 Prisma                  Locked

  **Search**              MySQL Full-Text         MVP; Meilisearch later
                                                  if needed

  **Authentication**      JWT + httpOnly          Locked
                          cookies + refresh-token 
                          rotation                

  **File Storage**        Local VPS storage       MVP; object storage
                                                  later

  **Caching**             Redis                   Use selectively for rate
                                                  limiting/cache/session
                                                  support

  **Analytics**           GA4 + custom events     Locked

  **Admin**               Next.js + NestJS custom Locked
                          admin                   

  **Payments**            Razorpay / Stripe       Post-MVP

  **Hosting**             Hostinger VPS           Locked

  **Web Server**          Nginx                   Locked

  **Containerization**    Docker + Docker Compose Locked

  **CI/CD**               GitHub Actions          Locked

  **Monitoring**          Docker logs +           MVP
                          UptimeRobot             

  **Security**            Helmet + rate           Locked
                          limiting + CORS         
                          whitelist + validation  
  ------------------------------------------------------------------------

# 3. Why a Modular Monolith?

A modular monolith is one deployable NestJS application with strong
internal business boundaries. LEI gets the simplicity of one backend
without turning the codebase into an unstructured monolith.

  -----------------------------------------------------------------------
  **Reason**              **How it helps LEI**    **Result**
  ----------------------- ----------------------- -----------------------
  **Faster MVP delivery** One codebase, one API,  Lower development
                          one deployment path     effort

  **Lower infrastructure  No network of           Better fit for a single
  cost**                  independent services or VPS
                          gateways                

  **Simpler debugging**   Product → Quote → Order Faster issue resolution
                          can be traced in one    
                          process                 

  **Shared transactions** Quote acceptance and    Safer business
                          order creation can use  workflows
                          one DB transaction      

  **Clear boundaries**    Each business area is   Maintainable codebase
                          its own NestJS module   

  **Future extraction     A module can be         No premature
  path**                  extracted later if      microservices cost
                          scale requires it       
  -----------------------------------------------------------------------

# 4. High-Level Architecture

LEI CUSTOMER / ADMIN\
│\
▼\
┌─────────────────────┐\
│ Next.js / React │\
│ Storefront + Admin │\
└──────────┬──────────┘\
│ HTTPS / REST JSON\
▼\
┌─────────────────────┐\
│ NestJS + Fastify │\
│ Modular Monolith │\
└──────────┬──────────┘\
│\
┌────────────────────────┼────────────────────────┐\
│ │ │\
▼ ▼ ▼\
AUTH / RBAC CATALOGUE SALES\
│ Products / Services Enquiries / Quotes\
│ Machines / Inventory Orders / Leads\
│ │ │\
└────────────────────────┼────────────────────────┘\
▼\
Prisma Data Access\
│\
▼\
MySQL\
│\
┌─────────────────┴─────────────────┐\
▼ ▼\
Redis Local VPS Storage\
cache / rate limits images / PDFs / files\
\
GA4 + Custom Event Tracking

# 5. NestJS Module Boundaries

  -----------------------------------------------------------------------
  **Module**                          **Responsibility**
  ----------------------------------- -----------------------------------
  **Auth**                            Login, refresh, logout, password
                                      handling, token rotation

  **Users**                           User profiles, account status,
                                      system role assignment

  **Permissions**                     Admin permission/function mapping

  **Catalogue**                       Products, categories, brands,
                                      attributes, media, inventory

  **Machines**                        Machine brands, models, variants,
                                      compatibility references

  **Services**                        Service catalogue and
                                      service-request workflows

  **Customers**                       Customer profiles, addresses,
                                      customer machines

  **Sales**                           Enquiries, leads, quotes, quote
                                      revisions, orders

  **Analytics**                       Sessions and approved
                                      customer-activity events

  **Admin**                           Audit logs and admin operational
                                      APIs

  **Files**                           Upload validation and controlled
                                      VPS file storage

  **Search**                          Search normalization, filtering,
                                      ranking, and future provider
                                      abstraction
  -----------------------------------------------------------------------

# 6. Recommended Project Structure

src/\
├── main.ts\
├── app.module.ts\
├── config/\
├── common/\
│ ├── decorators/\
│ ├── guards/\
│ ├── interceptors/\
│ ├── filters/\
│ ├── pipes/\
│ └── utils/\
├── auth/\
├── users/\
├── permissions/\
├── catalogue/\
│ ├── products/\
│ ├── categories/\
│ ├── part-brands/\
│ ├── attributes/\
│ ├── compatibility/\
│ ├── media/\
│ └── inventory/\
├── machines/\
├── services/\
├── customers/\
├── sales/\
│ ├── enquiries/\
│ ├── leads/\
│ ├── quotes/\
│ ├── quote-revisions/\
│ └── orders/\
├── analytics/\
├── admin/\
├── files/\
├── search/\
└── prisma/

Each business module should own its controller, service, DTOs,
validation rules, and module-specific logic. Cross-module access should
happen through service interfaces rather than direct table manipulation
from unrelated modules.

# 7. Authentication and Authorization

The MVP needs strong authentication for the operational/admin side.
Customer login remains optional for the first release; guests can browse
products and submit enquiries/quote requests.

-   Authentication: JWT access token + refresh token rotation.

-   Refresh token: Secure, HttpOnly, SameSite cookie.

-   Password hashing: Argon2id.

-   Access token lifetime: short-lived; refresh flow issues a new access
    token.

-   System roles: SUPER_ADMIN and ADMIN only.

-   Admin functions are permission-based, so an ADMIN can be assigned
    Sales, Service, Catalogue, Content, or Operations responsibilities
    without creating separate system roles.

-   Every protected endpoint must enforce both authentication and
    authorization.

SUPER_ADMIN\
└── Full system control\
\
ADMIN\
├── Sales permissions\
├── Service permissions\
├── Catalogue permissions\
├── Content permissions\
└── Operations permissions

# 8. Data Integrity Rules

• Inventory is updated through InventoryService only; ProductService may
read stock but must not maintain duplicate stock fields.\
• Accepting a quote revision creates an order linked to that exact
quote_revision_id.\
• Quote revisions are immutable after creation. A new commercial change
creates a new revision.\
• Service requests may store fallback machine information only when
machine_variant_id is null.\
• Every service request creates or updates a lead with
lead_type=SERVICE; the service request remains the operational source of
truth for technical execution.

# 8. Core API Design

The MVP exposes a versioned REST API. All public and admin API routes
use a consistent JSON response envelope and pagination format.

  ----------------------------------------------------------------------------------------------
  **Area**                            **Representative routes**
  ----------------------------------- ----------------------------------------------------------
  **Auth**                            POST /api/v1/auth/login\
                                      POST /api/v1/auth/refresh\
                                      POST /api/v1/auth/logout\
                                      GET /api/v1/auth/me

  **Products**                        GET /api/v1/products\
                                      GET /api/v1/products/:slug\
                                      POST /api/v1/products\
                                      PATCH /api/v1/products/:id

  **Categories / Brands**             GET /api/v1/categories\
                                      GET /api/v1/part-brands\
                                      POST /api/v1/categories

  **Search**                          GET
                                      /api/v1/search?q=\...&category=\...&brand=\...&page=\...

  **Services**                        GET /api/v1/services\
                                      GET /api/v1/services/:slug\
                                      POST /api/v1/services/:id/requests

  **Customers**                       GET /api/v1/customers\
                                      GET /api/v1/customers/:id

  **Sales**                           POST /api/v1/enquiries\
                                      GET /api/v1/leads\
                                      POST /api/v1/quotes\
                                      POST /api/v1/quotes/:id/revisions

  **Orders**                          POST /api/v1/orders\
                                      GET /api/v1/orders/:id\
                                      PATCH /api/v1/orders/:id/status

  **Analytics**                       POST /api/v1/analytics/events

  **Admin**                           GET /api/v1/admin/dashboard\
                                      GET /api/v1/admin/audit-logs
  ----------------------------------------------------------------------------------------------

# 9. Sales and Fulfilment Workflow

Customer\
│\
▼\
Enquiry\
│\
▼\
Lead\
│\
▼\
Quote\
│\
├── Revision 1\
├── Revision 2\
└── Revision 3\
│\
▼\
Accepted\
│\
▼\
Order\
│\
├── CONFIRMED\
├── PACKED\
├── SHIPPED\
└── DELIVERED

Quote revisions are immutable historical records. The current revision
is referenced from the quote header, while previous revisions remain
available for sales and audit history.

# 10. Service Request Workflow

Customer → Service page → Service request → Lead created/updated
(SERVICE) → Service Admin assignment → Technical assessment → Quote →
Follow-up → Service completion.\
The linked lead is available to Sales according to ADMIN permissions;
technical assignment remains on the service request. This prevents
high-value retrofit and repair enquiries from disappearing from the
commercial pipeline.

# 11. Search Architecture

MVP search uses MySQL full-text plus structured filters and
compatibility joins. Search logic is isolated behind a SearchService so
the search engine can be upgraded without changing frontend contracts.

Query\
↓\
Normalize / tokenize\
↓\
Exact SKU / Part Number match\
↓\
Brand / machine / model matching\
↓\
MySQL Full-Text\
↓\
Compatibility filters\
↓\
Rank and paginate results

-   Index slug, SKU, part number, category, brand, active status, and
    compatibility references.

-   Use pagination for every catalogue list endpoint.

-   Keep search provider code isolated so Meilisearch can be introduced
    later.

-   Do not introduce vector search or AI infrastructure in the MVP.

# 12. File Upload Architecture

The MVP stores files on the Hostinger VPS. Uploads must go through the
NestJS backend so the API can validate and control the storage path.

Next.js\
↓\
NestJS upload endpoint\
↓\
Validate MIME / extension / size\
↓\
Generate safe filename\
↓\
Store in controlled directory\
↓\
Save file metadata in MySQL

-   Products: /uploads/products

-   Services: /uploads/services

-   Documents: /uploads/documents

-   Quote attachments: /uploads/quotes

# 13. Customer Analytics and Tracking

The frontend sends only approved business events to the backend. The
backend validates event types and stores useful events in MySQL. GA4
receives analytics events separately for acquisition and marketing
analysis.

-   PAGE_VIEW

-   PRODUCT_VIEW

-   CATEGORY_VIEW

-   SEARCH

-   FILTER_USED

-   QUOTE_START

-   QUOTE_SUBMIT

-   SERVICE_VIEW

-   BROCHURE_DOWNLOAD

-   WHATSAPP_CLICK

-   PHONE_CLICK

-   CONTACT_SUBMIT

-   LOGIN

# 14. Admin Audit Logging

Audit logging is required for administrative actions involving customer
data, quotes, prices, inventory, orders, and permissions. The goal is to
know who changed what and when.

admin_audit_logs\
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
id\
user_id\
action\
entity_type\
entity_id\
old_values\
new_values\
ip_address\
created_at

# 15. Performance and Reliability Rules

-   Use Fastify as the NestJS HTTP adapter.

-   Use Prisma with explicit select/include choices; avoid
    over-fetching.

-   Never return unbounded catalogue lists; always paginate.

-   Add database indexes for common product, compatibility, quote, and
    order lookups.

-   Use Redis only where it provides an MVP benefit: rate limiting,
    short-lived cache, or session support.

-   Prefer server-side rendering and server components in Next.js for
    public catalogue pages.

-   Keep uploads off the application bundle and use optimized image
    handling.

-   Use Nginx for TLS termination and reverse proxying.

-   Run automated database backups on the VPS and test restoration
    before launch.

# 16. Security Baseline

  -----------------------------------------------------------------------
  **Control**                         **Requirement**
  ----------------------------------- -----------------------------------
  **Helmet**                          Secure HTTP headers

  **CORS whitelist**                  Allow only approved frontend/admin
                                      origins

  **Rate limiting**                   Reduce brute-force and abuse risk

  **Validation**                      DTO validation before business
                                      logic

  **Password hashing**                Argon2id; never store plaintext
                                      passwords

  **Cookie security**                 HttpOnly + Secure + SameSite for
                                      refresh tokens

  **Authorization**                   Guard every admin endpoint by
                                      permission

  **File validation**                 MIME, extension and size checks

  **Secrets**                         Environment variables / secret
                                      management; never commit secrets

  **Audit**                           Record sensitive admin operations
  -----------------------------------------------------------------------

# 17. Deployment Architecture

Hostinger VPS\
│\
├── Nginx\
│ ├── HTTPS / TLS\
│ └── Reverse proxy\
│\
├── Docker Compose\
│ ├── Next.js\
│ ├── NestJS API\
│ ├── MySQL\
│ └── Redis\
│\
├── Local storage\
│ └── Product / service / quote files\
│\
└── Monitoring\
├── Docker logs\
└── UptimeRobot

PM2 is not required inside Docker containers. Docker manages process
lifecycle for the MVP. If the deployment later moves away from
containers, PM2 can be reconsidered.

# 18. CI/CD Flow

Developer\
↓\
GitHub Pull Request\
↓\
GitHub Actions\
├── Install dependencies\
├── Lint\
├── Unit tests\
├── Build Next.js\
├── Build NestJS\
└── Build Docker images\
↓\
Merge to deployment branch\
↓\
Deploy to Hostinger VPS\
↓\
Health check\
↓\
Live

# 19. MVP Implementation Order

  -----------------------------------------------------------------------
  **Phase**                           **Scope**
  ----------------------------------- -----------------------------------
  **1. Foundation**                   NestJS + Fastify, Docker, MySQL,
                                      Prisma, Redis, config, logging

  **2. Auth & RBAC**                  Users, SUPER_ADMIN / ADMIN,
                                      permissions, JWT, refresh-token
                                      rotation

  **3. Catalogue**                    Categories, part brands, products,
                                      attributes, media, inventory,
                                      compatibility

  **4. Machine data**                 Machine brands, models, variants,
                                      shared compatibility references

  **5. Services**                     Services, service categories,
                                      service requests, attachments

  **6. Customers**                    Customers, addresses, customer
                                      machines

  **7. Sales**                        Enquiries, leads, quotes,
                                      revisions, orders

  **8. Analytics**                    Sessions, validated events,
                                      activity timeline

  **9. Admin**                        Dashboard, catalogue operations,
                                      sales operations, audit logs

  **10. Performance & security**      Indexes, pagination, rate limiting,
                                      validation, backup/restore

  **11. Deployment**                  Nginx, SSL, Docker Compose, GitHub
                                      Actions, monitoring
  -----------------------------------------------------------------------

# 20. Future Evolution (Post-MVP)

The modular monolith should remain the default architecture until there
is a real operational reason to split a module. Possible upgrades are
intentionally deferred:

-   Meilisearch for typo-tolerant, faster catalogue search and
    autocomplete.

-   Cloud object storage such as Cloudflare R2 or Backblaze B2 for
    high-volume media and documents.

-   Vector search / embeddings for semantic compatibility and agentic
    product discovery.

-   Online payments with Razorpay or Stripe when LEI wants transactional
    checkout.

-   Selective module extraction into services only if traffic, teams, or
    operational boundaries justify it.

# 21. Architecture Rules to Freeze

-   Do not introduce microservices during MVP implementation.

-   Do not let controllers directly query Prisma; business logic belongs
    in module services.

-   Do not allow arbitrary cross-module table access; use module
    services/interfaces.

-   Do not store refresh tokens in localStorage.

-   Do not overwrite historical quote revisions.

-   Do not hard-delete catalogue items that are referenced by historical
    quotes/orders; use soft deletion where appropriate.

-   Do not add AI/vector infrastructure until real search requirements
    justify it.

-   Do not expose internal database or storage paths to the browser.

-   Every production deployment must include database backup and health
    verification.
