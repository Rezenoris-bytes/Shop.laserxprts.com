LEI MVP Database Architecture & Admin Plan --- Revised

Laser Experts India \| MySQL + Prisma \| Two-Role Administration Model
\| Revision 1.1 \| 18 August 2026

**Purpose.** Define a practical MVP database and admin architecture for
LEI covering products, technical services, customers, enquiries, quotes,
fulfilment, inventory, analytics and sales operations. The
administration model is intentionally limited to two system roles:
SUPER_ADMIN and ADMIN. An ADMIN can be assigned a business function such
as Sales, Service, Catalogue, Content or Operations without creating
additional system roles.

# Revision 1.1 --- Corrections Applied

This revision resolves the schema and implementation ambiguities
identified during architecture review. The rules below are authoritative
for Prisma schema design and migration work.

Inventory has one source of truth: the inventory table. Product-level
stock_quantity, stock_status and reorder_level are removed from
products.

Orders record the exact accepted quote revision through
quote_revision_id; quote_id remains for parent-level traceability.

Service requests create or link a lead with lead_type=SERVICE so
high-value retrofit/repair/service enquiries are visible to sales.
Service operations remain independently assignable.

Hindi/English support is represented with explicit product_translations,
category_translations and service_translations tables; English is the
default locale.

laser_type and laser_power on service_requests/customer_machines are
fallback/manual values only when machine_variant_id is not known; when a
variant is selected, the referenced variant is the source of truth.

The MVP is enquiry/quote driven; no cart or payment workflow is part of
the MVP. Customer login is optional and deferred unless required by the
business.

# 1. Final MVP Administration Decision

**Only two system roles exist:** SUPER_ADMIN and ADMIN.

-   SUPER_ADMIN is the owner-level account with full access to the
    platform, users, settings, security, data and audit logs.

-   ADMIN is the operational account. The Super Admin assigns the Admin
    a business function/department and a set of module permissions.

-   Salesperson, service executive, catalogue manager, content editor
    and operations user are NOT separate system roles. They are Admin
    users with different assigned functions and permissions.

-   All customer, quote, service and order assignments continue to
    reference the users table, so ownership is always traceable to a
    real admin account.

  -----------------------------------------------------------------------
  **System role**         **Meaning**             **Can be assigned by**
  ----------------------- ----------------------- -----------------------
  SUPER_ADMIN             Full control: users,    ---
                          settings, security,     
                          catalogue, services,    
                          sales, reports, audit   
                          and data.               

  ADMIN                   Operational user.       SUPER_ADMIN
                          Access is controlled by 
                          assigned                
                          department/function and 
                          module permissions.     
  -----------------------------------------------------------------------

# 2. Admin Function Model (not system roles)

Use a separate function/department field for operational responsibility.
These labels are business assignments, not authentication roles.

  -----------------------------------------------------------------------
  **Admin function**      **Typical               **Default modules**
                          responsibilities**      
  ----------------------- ----------------------- -----------------------
  SALES                   Leads, customers,       Customers, Leads,
                          enquiries, quotes,      Enquiries, Quotes,
                          quote revisions,        Orders, Activity
                          orders, follow-up.      

  SERVICE                 Service requests,       Customers, Machines,
                          machine history,        Services, Service
                          technical follow-up,    Requests, Quotes
                          service quotations.     

  CATALOGUE               Products, categories,   Catalogue, Inventory,
                          brands, attributes,     Media
                          compatibility,          
                          inventory.              

  CONTENT                 Pages, services         Content/SEO, Services,
                          content, SEO metadata,  Media
                          FAQs, media.            

  OPERATIONS              Order fulfilment, stock Orders, Inventory,
                          updates, delivery       Enquiries
                          tracking, internal      
                          follow-up.              
  -----------------------------------------------------------------------

# 3. Admin Permission Model

The Super Admin should be able to create an Admin account and choose
exactly what that person can access. Keep the permission model simple
for MVP: module-level permissions rather than a complicated policy
engine.

> ADMIN_USER\
> role = ADMIN\
> function = SALES \| SERVICE \| CATALOGUE \| CONTENT \| OPERATIONS\
> permissions = \[MODULE_READ, MODULE_CREATE, MODULE_UPDATE,
> MODULE_DELETE\]\
> \
> SUPER_ADMIN\
> role = SUPER_ADMIN\
> permissions = ALL

  -------------------------------------------------------------------------------
  **Module**        **SUPER_ADMIN**   **ADMIN           **Notes**
                                      (example)**       
  ----------------- ----------------- ----------------- -------------------------
  Users & Roles     Full              No                Only Super Admin
                                                        creates/disables Admin
                                                        accounts.

  Catalogue         Full              Assigned          Catalogue Admin can
                                                        manage
                                                        products/attributes.

  Inventory         Full              Assigned          Operations/Catalogue
                                                        Admin can update stock.

  Services          Full              Assigned          Service Admin can manage
                                                        service records/requests.

  Customers         Full              Assigned          Sales/Service Admin sees
                                                        customer data needed for
                                                        work.

  Leads & Enquiries Full              Assigned          Sales Admin manages sales
                                                        pipeline.

  Quotes            Full              Assigned          Sales/Service Admin can
                                                        create/revise; ownership
                                                        is logged.

  Orders            Full              Assigned          Sales/Operations Admin
                                                        manages post-quote
                                                        fulfilment.

  Reports           Full              Assigned          Admin sees only
                                                        operational reports
                                                        relevant to function.

  Audit Logs        Full              No                Audit data remains Super
                                                        Admin only for MVP.

  System Settings   Full              No                Infrastructure/security
                                                        settings remain Super
                                                        Admin only.
  -------------------------------------------------------------------------------

# 4. Recommended User Tables

> users\
> \-\-\-\-\--\
> id (PK)\
> name\
> email\
> password_hash\
> role // SUPER_ADMIN \| ADMIN\
> function // SALES \| SERVICE \| CATALOGUE \| CONTENT \| OPERATIONS\
> is_active\
> last_login\
> created_at\
> updated_at\
> \
> admin_permissions\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> user_id (FK users)\
> module\
> can_view\
> can_create\
> can_update\
> can_delete\
> created_at\
> updated_at

Design note: Keep the role column limited to two values. The function
column identifies the person's business responsibility, while
admin_permissions controls exact access. This keeps the security model
understandable and lets the Super Admin assign an Admin as Sales,
Service, Catalogue or any other function later without changing the
database structure.

# 5. Core LEI Business Domains

  -----------------------------------------------------------------------
  **Domain**              **Purpose**             **MVP**
  ----------------------- ----------------------- -----------------------
  Authentication &        Two system roles; Admin Required
  Administration          functions; permissions; 
                          audit.                  

  Catalogue               Products, categories,   Required
                          part brands, technical  
                          attributes,             
                          compatibility.          

  Machine/OEM             Machine brands, models  Required
                          and variants shared     
                          across compatibility    
                          and service.            

  Inventory               Manual stock quantity   Required
                          and fulfilment status.  

  Services                Retrofit, repair,       Required
                          maintenance, AMC,       
                          welding, chiller and    
                          other services.         

  Customers               Company/customer        Required
                          records and machine     
                          history.                

  Sales                   Enquiries, leads,       Required
                          quotes and quote        
                          revisions.              

  Orders                  Post-quote fulfilment   Required
                          and delivery tracking.  

  Analytics               Customer activity and   Required
                          basic behaviour         
                          tracking.               

  SEO/Content             Metadata and future     Required
                          bilingual support.      
  -----------------------------------------------------------------------

# 6. High-Level ERD

> users ──\< admin_permissions\
> │\
> ├──\< customers ──\< customer_machines\
> │ │\
> │ ├──\< enquiries ──\< quotes ──\< quote_revisions ──\<
> quote_revision_items\
> │ │ │\
> │ │ └──\< orders ──\< order_items\
> │ ├──\< leads\
> │ └──\< customer_events\
> │\
> └──\< admin_audit_logs\
> \
> categories ──\< products \>── part_brands\
> │\
> ├──\< product_attribute_values \>── attributes\
> ├──\< product_compatibility \>── machine_models\
> ├──\< product_media\
> └── inventory\
> \
> machine_brands ──\< machine_models ──\< machine_variants\
> service_categories ──\< services ──\< service_requests

# 7. Catalogue Schema

> products\
> \-\-\-\-\-\-\--\
> id (PK)\
> category_id (FK)\
> part_brand_id (FK)\
> name\
> slug\
> sku\
> part_number\
> short_description\
> description\
> product_type\
> price\
> price_type // FIXED \| ON_REQUEST \| CONTACT_SALES\
> is_featured\
> is_active\
> deleted_at\
> meta_title\
> meta_description\
> canonical_url\
> og_title\
> og_description\
> og_image\
> seo_indexable\
> created_at\
> updated_at\
> \
> categories\
> \-\-\-\-\-\-\-\-\--\
> id (PK)\
> parent_id (FK self, nullable)\
> name\
> slug\
> description\
> image\
> sort_order\
> is_active\
> meta_title\
> meta_description\
> canonical_url\
> created_at\
> updated_at\
> \
> part_brands\
> \-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> name\
> slug\
> logo\
> description\
> is_active\
> created_at\
> updated_at

Use one products table for nozzles, ceramics, lenses, heads, cables,
sensors, regulators, valves and other catalogue items. Technical
differences are represented through attributes and compatibility
references, not separate product tables.

# 8. Product Attributes & Compatibility

> attributes\
> \-\-\-\-\-\-\-\-\--\
> id (PK)\
> name\
> slug\
> data_type\
> unit\
> is_filterable\
> is_searchable\
> sort_order\
> \
> product_attribute_values\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> product_id (FK)\
> attribute_id (FK)\
> value\
> \
> product_compatibility\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> product_id (FK)\
> machine_brand_id (FK)\
> machine_model_id (FK)\
> machine_variant_id (FK, nullable)\
> part_compatibility_notes\
> created_at\
> updated_at

# 9. Machine & OEM Reference Model

> machine_brands\
> \-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> name\
> slug\
> logo\
> is_active\
> \
> machine_models\
> \-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> machine_brand_id (FK)\
> name\
> slug\
> is_active\
> \
> machine_variants\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> machine_model_id (FK)\
> name\
> laser_type\
> power_range\
> is_active

Service requests, customer machine history and product compatibility use
the same machine references. laser_type and laser_power are
fallback/manual fields only when machine_variant_id is null; when a
variant is selected, the machine variant is the authoritative source. Do
not store machine brand/model as free text.

# 10. Services & Service Requests

> service_categories\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> name\
> slug\
> sort_order\
> is_active\
> \
> services\
> \-\-\-\-\-\-\--\
> id (PK)\
> service_category_id (FK)\
> name\
> slug\
> short_description\
> description\
> pricing_type\
> price\
> is_featured\
> is_active\
> meta_title\
> meta_description\
> canonical_url\
> created_at\
> updated_at\
> \
> service_requests\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> customer_id (FK)\
> service_id (FK)\
> machine_brand_id (FK, nullable)\
> machine_model_id (FK, nullable)\
> machine_variant_id (FK, nullable)\
> laser_type\
> laser_power\
> problem_description\
> preferred_date\
> location\
> status\
> assigned_to (FK users)\
> created_at\
> updated_at

MVP service categories should cover the published LEI business areas,
including CO2-to-Fiber Retrofit, Fiber Laser Upgrade, Laser Head Repair,
Periodic Maintenance, AMC, Remanufacturing, Pre-Purchase Consultation,
Laser Welding Service and Laser Chiller Repair.

## Translation / i18n Schema

product_translations\
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
id (PK)\
product_id (FK)\
locale // en \| hi\
name\
short_description\
description\
meta_title\
meta_description\
unique(product_id, locale)\
\
category_translations\
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
id (PK)\
category_id (FK)\
locale // en \| hi\
name\
description\
meta_title\
meta_description\
unique(category_id, locale)\
\
service_translations\
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
id (PK)\
service_id (FK)\
locale // en \| hi\
name\
short_description\
description\
meta_title\
meta_description\
unique(service_id, locale)

English is the default locale. Hindi support is implemented through
these translation tables rather than duplicated \*\_en / \*\_hi columns.
Product, category and service base tables retain the canonical/default
English content.

# 11. Customer, Sales & Lead Data

> customers\
> \-\-\-\-\-\-\-\--\
> id (PK)\
> user_id (FK, nullable)\
> company_name\
> contact_name\
> email\
> phone\
> gstin\
> country\
> state\
> city\
> address\
> status\
> created_at\
> updated_at\
> \
> customer_machines\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> customer_id (FK)\
> machine_brand_id (FK)\
> machine_model_id (FK)\
> machine_variant_id (FK, nullable)\
> serial_number\
> laser_type\
> laser_power\
> installation_year\
> notes\
> created_at\
> updated_at\
> \
> leads\
> \-\-\-\--\
> id (PK)\
> customer_id (FK)\
> source\
> lead_type\
> status\
> priority\
> score\
> assigned_to (FK users)\
> notes\
> created_at\
> updated_at\
> \
> enquiries\
> \-\-\-\-\-\-\-\--\
> id (PK)\
> customer_id (FK)\
> type\
> product_id (FK, nullable)\
> service_id (FK, nullable)\
> subject\
> message\
> status\
> priority\
> assigned_to (FK users)\
> created_at\
> updated_at

# 12. Quotes & Orders

> quotes\
> \-\-\-\-\--\
> id (PK)\
> quote_number\
> customer_id (FK)\
> enquiry_id (FK, nullable)\
> current_revision_id (FK, nullable)\
> status\
> created_at\
> updated_at\
> \
> quote_revisions\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> quote_id (FK)\
> revision_number\
> valid_until\
> subtotal\
> discount\
> tax\
> total\
> notes\
> created_by (FK users)\
> created_at\
> \
> quote_revision_items\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> quote_revision_id (FK)\
> product_id (FK, nullable)\
> service_id (FK, nullable)\
> description\
> quantity\
> unit_price\
> total\
> \
> orders\
> \-\-\-\-\--\
> id (PK)\
> order_number\
> quote_id (FK)\
> customer_id (FK)\
> status\
> tracking_number\
> courier\
> subtotal\
> discount\
> tax\
> total\
> confirmed_at\
> packed_at\
> shipped_at\
> delivered_at\
> created_at\
> updated_at\
> \
> order_items\
> \-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> order_id (FK)\
> product_id (FK, nullable)\
> service_id (FK, nullable)\
> description\
> quantity\
> unit_price\
> total

# 13. Inventory, Media & Analytics

> inventory\
> \-\-\-\-\-\-\-\--\
> id (PK)\
> product_id (FK, unique)\
> stock_quantity\
> reorder_level\
> stock_status\
> last_counted_at\
> updated_at\
> \
> Inventory is the single source of truth for stock quantity, reorder
> level and stock status. Products do not duplicate these fields.

# 14. Security & Audit

> admin_audit_logs\
> \-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
> id (PK)\
> user_id (FK)\
> action\
> entity_type\
> entity_id\
> old_values_json\
> new_values_json\
> ip_address\
> created_at

Audit logs are visible to SUPER_ADMIN only for MVP. Admin users can
perform business operations only within their assigned permissions.
Customer/quote changes should record the acting user.

# 15. Admin Panel Structure

> LEI ADMIN\
> │\
> ├── Dashboard\
> │\
> ├── Catalogue\
> │ ├── Products\
> │ ├── Categories\
> │ ├── Part Brands\
> │ ├── Attributes\
> │ ├── Compatibility\
> │ └── Inventory\
> │\
> ├── Machines / OEM\
> │ ├── Machine Brands\
> │ ├── Machine Models\
> │ └── Variants\
> │\
> ├── Services\
> │ ├── Services\
> │ └── Service Requests\
> │\
> ├── Sales\
> │ ├── Enquiries\
> │ ├── Leads\
> │ ├── Quotes\
> │ ├── Quote Revisions\
> │ └── Orders\
> │\
> ├── Customers\
> │ ├── Customers\
> │ ├── Machine History\
> │ └── Activity Timeline\
> │\
> ├── Content / SEO\
> │ ├── Pages\
> │ ├── FAQs\
> │ └── Metadata\
> │\
> ├── Reports\
> │\
> └── Settings\
> ├── Admin Users\
> ├── Admin Functions\
> └── Permissions

# 16. Admin Management Workflow

> SUPER_ADMIN\
> ↓\
> Create Admin User\
> ↓\
> Assign Function\
> ├── Sales\
> ├── Service\
> ├── Catalogue\
> ├── Content\
> └── Operations\
> ↓\
> Assign Module Permissions\
> ↓\
> Admin logs in\
> ↓\
> Admin sees only assigned modules\
> ↓\
> All important changes are audited

Example: a Sales Admin can access Customers, Leads, Enquiries, Quotes,
Orders and Activity, but cannot modify users, security settings or
system configuration. A Catalogue Admin can manage products, categories,
attributes, compatibility and inventory, but does not automatically
receive access to customer PII or audit logs.

# 17. Business Workflows

> 17.1 Product enquiry → order\
> Customer finds product\
> → Product enquiry\
> → Lead created/updated\
> → Sales Admin assigned\
> → Quote created\
> → Quote revision(s)\
> → Customer accepts\
> → Order created\
> → Confirmed → Packed → Shipped → Delivered\
> \
> 17.2 Service enquiry\
> Customer selects service\
> → Machine/OEM selected\
> → Technical details submitted\
> → Service request created\
> → Service Admin assigned\
> → Quote\
> → Follow-up\
> → Service completion

# 18. Critical Indexes

  -----------------------------------------------------------------------------
  **Table**                  **Index**                  **Reason**
  -------------------------- -------------------------- -----------------------
  products                   UNIQUE(slug),              Fast catalogue and
                             INDEX(category_id),        direct product lookup
                             INDEX(part_brand_id),      
                             INDEX(part_number)         

  product_attribute_values   INDEX(product_id,          EAV filtering and
                             attribute_id),             technical lookup
                             INDEX(attribute_id,        
                             value(100))                

  product_compatibility      INDEX(product_id),         Machine compatibility
                             INDEX(machine_model_id),   search
                             INDEX(machine_brand_id,    
                             machine_model_id)          

  machine_models             INDEX(machine_brand_id),   Stable machine lookup
                             UNIQUE(machine_brand_id,   
                             slug)                      

  service_requests           INDEX(customer_id),        Operational service
                             INDEX(service_id),         queue
                             INDEX(status),             
                             INDEX(assigned_to)         

  enquiries                  INDEX(customer_id),        Lead/enquiry dashboard
                             INDEX(status),             
                             INDEX(assigned_to),        
                             INDEX(created_at)          

  quotes                     UNIQUE(quote_number),      Quote lookup and
                             INDEX(customer_id),        workflow
                             INDEX(status)              

  orders                     UNIQUE(order_number),      Fulfilment tracking
                             INDEX(customer_id),        
                             INDEX(status),             
                             INDEX(tracking_number)     

  customer_events            INDEX(customer_id,         Customer timeline and
                             created_at),               analytics
                             INDEX(session_id,          
                             created_at),               
                             INDEX(event_type,          
                             created_at)                

  admin_permissions          UNIQUE(user_id, module)    Prevent duplicate
                                                        permission rows
  -----------------------------------------------------------------------------

# 19. Implementation Order

-   Create the MySQL database and Prisma project.

-   Create users, the two-role system, Admin functions,
    admin_permissions and authentication.

-   Create catalogue tables: categories, part_brands, products,
    attributes, product media and inventory.

-   Create machine/OEM reference tables and product compatibility.

-   Create services and service requests.

-   Create customers, enquiries, leads and customer machine history.

-   Create quotes, quote revisions, quote items, orders and order items.

-   Create sessions, customer events and admin audit logs.

-   Add SEO fields plus product/category/service translation tables and
    seed English as the default locale.

-   Add indexes and validate common queries before loading the full LEI
    catalogue.

-   Build NestJS modules around the same domains.

-   Build the Next.js admin screens around permissions and business
    functions.

-   Create seed data for one Super Admin and at least one Admin function
    per major workflow.

-   Run permission tests to verify that Admin users cannot access Super
    Admin-only screens or audit logs.

# 20. MVP Acceptance Checklist

-   Only two system roles exist: SUPER_ADMIN and ADMIN.

-   SUPER_ADMIN can create, deactivate and reassign ADMIN users.

-   Each ADMIN can be assigned a business function and module-level
    permissions.

-   Admin permissions can be changed without changing the database role
    model.

-   Products, services, enquiries, quotes and orders reference real user
    accounts for ownership/assignment.

-   Every saleable LEI spare/consumable can be represented by the
    product model.

-   Product compatibility and customer machine history use normalized
    machine/OEM references.

-   Quotes can be revised without overwriting historical revisions.

-   Accepted quotes can become tracked orders.

-   Stock quantity can be recorded and updated manually through the
    inventory table, which is the single source of truth.

-   Sales Admin can see relevant customer activity and enquiry/quote
    history.

-   Admin changes to customer and quote data are auditable by
    SUPER_ADMIN.

-   Product/category/service pages have SEO fields.

-   MySQL search can later be replaced or extended by Meilisearch
    without changing the core business tables.

# 21. Final Recommendation

**Freeze this as the LEI MVP baseline.** Keep the security model to two
system roles only: SUPER_ADMIN and ADMIN. Use Admin function + module
permissions to represent Sales, Service, Catalogue, Content and
Operations responsibilities. This gives the Super Admin complete control
while keeping the operational side flexible enough to add or reassign
people later without redesigning the authentication model.
