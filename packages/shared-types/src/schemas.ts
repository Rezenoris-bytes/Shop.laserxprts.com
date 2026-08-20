import { z } from 'zod';

/**
 * Request schemas shared by the API and the Next.js forms.
 *
 * This is the reason the project uses Zod rather than class-validator: the same
 * object validates the form in the browser and the DTO on the server, so the
 * two cannot drift. A field made required here is required in both places from
 * the moment it is edited.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

/**
 * Minimum 12 characters, checked against length rather than composition rules.
 * Composition rules ("one uppercase, one symbol") push people toward
 * `Password1!` and measurably weaken real-world passwords.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(200, 'Password is too long');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(190);

/** Indian mobile/landline, lenient about separators — normalised server-side. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number');

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Enter a valid 15-character GSTIN',
  );

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Hard server-side cap. "Never return unbounded lists" is enforced by the
  // schema, not by each endpoint remembering to.
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

// ── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Catalogue browsing ──────────────────────────────────────────────────────

export const productSortSchema = z.enum([
  'relevance',
  'name_asc',
  'name_desc',
  'price_asc',
  'price_desc',
  'newest',
]);
export type ProductSort = z.infer<typeof productSortSchema>;

export const productListQuerySchema = paginationSchema.extend({
  category: z.string().trim().max(190).optional(),
  brand: z.string().trim().max(190).optional(),
  machineModel: z.coerce.number().int().positive().optional(),
  machineBrand: z.coerce.number().int().positive().optional(),
  inStock: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: productSortSchema.default('relevance'),
  /**
   * Attribute filters as `slug:value` pairs, e.g. attr=orifice-diameter:1.5
   * Numeric attributes also accept a range: `slug:1.0..3.0`
   */
  attr: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1, 'Enter something to search for').max(120),
  category: z.string().trim().max(190).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Basket rehydration: the client stores ids only, never prices. */
export const resolveVariantsSchema = z.object({
  ids: z
    .union([z.string(), z.array(z.coerce.number().int().positive())])
    .transform((value) =>
      typeof value === 'string'
        ? value
            .split(',')
            .map((part) => Number(part.trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
        : value,
    )
    .pipe(z.array(z.number().int().positive()).max(100)),
});
export type ResolveVariantsInput = z.infer<typeof resolveVariantsSchema>;

// ── Quote Request (the basket) ──────────────────────────────────────────────

export const quoteRequestItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(100000),
  note: z.string().trim().max(500).optional(),
});
export type QuoteRequestItem = z.infer<typeof quoteRequestItemSchema>;

export const quoteRequestSchema = z
  .object({
    contactName: z.string().trim().min(2, 'Enter your name').max(150),
    contactEmail: emailSchema.optional(),
    contactPhone: phoneSchema.optional(),
    contactCompany: z.string().trim().max(200).optional(),
    contactCity: z.string().trim().max(100).optional(),
    message: z.string().trim().max(4000).optional(),

    // Machine context is captured once for the whole basket — the parts in a
    // request are normally all for the same machine.
    machineBrandId: z.number().int().positive().optional(),
    machineModelId: z.number().int().positive().optional(),
    machineVariantId: z.number().int().positive().optional(),

    items: z.array(quoteRequestItemSchema).min(1, 'Add at least one item').max(100),

    // DPDP Act 2023 — consent is recorded, not assumed.
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the privacy notice to continue' }),
    }),

    /** Honeypot. Real users never see this field; bots fill it in. */
    website: z.string().max(0).optional(),
    /** Milliseconds the form was on screen. Submissions under ~2s are bots. */
    elapsedMs: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Boolean(data.contactEmail || data.contactPhone), {
    path: ['contactEmail'],
    message: 'Enter an email address or a phone number so we can reply',
  });
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const contactFormSchema = z.object({
  contactName: z.string().trim().min(2).max(150),
  contactEmail: emailSchema,
  contactPhone: phoneSchema.optional(),
  contactCompany: z.string().trim().max(200).optional(),
  subject: z.string().trim().max(255).optional(),
  message: z.string().trim().min(10, 'Please tell us a little more').max(4000),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please accept the privacy notice to continue' }),
  }),
  website: z.string().max(0).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

// ── Analytics ───────────────────────────────────────────────────────────────

export const trackEventSchema = z.object({
  eventType: z.enum([
    'PAGE_VIEW',
    'PRODUCT_VIEW',
    'VARIANT_VIEW',
    'CATEGORY_VIEW',
    'SERVICE_VIEW',
    'SEARCH',
    'SEARCH_NO_RESULTS',
    'FILTER_USED',
    'COMPATIBILITY_SEARCH',
    'QUOTE_REQUEST_START',
    'QUOTE_REQUEST_ITEM_ADDED',
    'QUOTE_REQUEST_ITEM_REMOVED',
    'QUOTE_REQUEST_SUBMIT',
    'BROCHURE_DOWNLOAD',
    'WHATSAPP_CLICK',
    'PHONE_CLICK',
    'CONTACT_SUBMIT',
  ]),
  entityType: z.string().trim().max(64).optional(),
  entityId: z.number().int().positive().optional(),
  path: z.string().trim().max(500).optional(),
  /**
   * Deliberately narrow. This endpoint is public and unauthenticated, so it
   * accepts a fixed shape rather than arbitrary JSON — otherwise it is a free
   * write primitive for anyone with a browser.
   */
  metadata: z
    .object({
      query: z.string().max(120).optional(),
      resultCount: z.number().int().nonnegative().max(100000).optional(),
      filter: z.string().max(120).optional(),
      value: z.string().max(120).optional(),
    })
    .optional(),
});
export type TrackEventInput = z.infer<typeof trackEventSchema>;

// ── Admin: catalogue writes ─────────────────────────────────────────────────

export const adminListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(190).optional(),
  sort: z.string().trim().max(60).optional(),
  status: z.string().trim().max(40).optional(),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const upsertCategorySchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z
    .string()
    .trim()
    .max(190)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
    .optional(),
  parentId: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(20000).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  metaTitle: z.string().trim().max(255).optional(),
  metaDescription: z.string().trim().max(500).optional(),
});
export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;

export const upsertPartBrandSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z
    .string()
    .trim()
    .max(190)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().trim().max(20000).optional(),
  website: z.string().trim().url().max(255).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});
export type UpsertPartBrandInput = z.infer<typeof upsertPartBrandSchema>;

export const upsertProductSchema = z.object({
  categoryId: z.number().int().positive(),
  partBrandId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(2).max(255),
  slug: z
    .string()
    .trim()
    .max(190)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  productType: z
    .enum(['SPARE_PART', 'CONSUMABLE', 'COMPONENT', 'ACCESSORY', 'KIT'])
    .default('SPARE_PART'),
  shortDescription: z.string().trim().max(500).optional(),
  description: z.string().trim().max(50000).optional(),
  hsnCode: z.string().trim().max(12).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: z.string().trim().max(255).optional(),
  metaDescription: z.string().trim().max(500).optional(),
});
export type UpsertProductInput = z.infer<typeof upsertProductSchema>;

export const upsertVariantSchema = z.object({
  productId: z.number().int().positive(),
  sku: z.string().trim().min(1).max(64),
  partNumber: z.string().trim().min(1).max(100),
  mpn: z.string().trim().max(100).optional(),
  variantName: z.string().trim().min(1).max(120),
  price: z.number().nonnegative().max(99999999).nullable().optional(),
  priceType: z.enum(['FIXED', 'ON_REQUEST', 'CONTACT_SALES']).default('FIXED'),
  unitOfMeasure: z
    .enum(['PIECE', 'SET', 'PACK', 'METRE', 'LITRE', 'KG', 'HOUR', 'VISIT', 'LOT'])
    .default('PIECE'),
  packSize: z.number().int().min(1).default(1),
  minOrderQty: z.number().int().min(1).default(1),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
  isDefault: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  /** Attribute values keyed by attribute slug. */
  attributes: z.record(z.string(), z.string().max(255)).optional(),
});
export type UpsertVariantInput = z.infer<typeof upsertVariantSchema>;

export const updateInventorySchema = z.object({
  quantity: z.number().int().min(0).max(10000000),
  reorderLevel: z.number().int().min(0).max(10000000).optional(),
  stockStatus: z
    .enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'MADE_TO_ORDER', 'DISCONTINUED'])
    .optional(),
  reason: z.string().trim().min(1).max(50).default('COUNT'),
  notes: z.string().trim().max(500).optional(),
});
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

export const upsertCompatibilitySchema = z.object({
  productId: z.number().int().positive(),
  /** null = fits via every variant of the product (the common case). */
  variantId: z.number().int().positive().nullable().optional(),
  machineBrandId: z.number().int().positive(),
  machineModelId: z.number().int().positive(),
  machineVariantId: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  isVerified: z.boolean().default(false),
});
export type UpsertCompatibilityInput = z.infer<typeof upsertCompatibilitySchema>;

// ── Admin: sales ────────────────────────────────────────────────────────────

export const updateEnquirySchema = z.object({
  status: z
    .enum(['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'QUOTED', 'CLOSED_WON', 'CLOSED_LOST', 'SPAM'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.number().int().positive().nullable().optional(),
});
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;

export const quoteLineSchema = z.object({
  variantId: z.number().int().positive().nullable().optional(),
  serviceId: z.number().int().positive().nullable().optional(),
  productName: z.string().trim().min(1).max(255),
  partNumber: z.string().trim().max(100).optional(),
  hsnCode: z.string().trim().max(12).optional(),
  description: z.string().trim().max(2000).optional(),
  quantity: z.number().positive().max(1000000),
  unitPrice: z.number().nonnegative().max(99999999),
  discountPercent: z.number().min(0).max(100).default(0),
  gstRate: z.number().min(0).max(100).default(18),
  unitOfMeasure: z
    .enum(['PIECE', 'SET', 'PACK', 'METRE', 'LITRE', 'KG', 'HOUR', 'VISIT', 'LOT'])
    .default('PIECE'),
});
export type QuoteLineInputDto = z.infer<typeof quoteLineSchema>;

export const createRevisionSchema = z.object({
  items: z.array(quoteLineSchema).min(1, 'A quote needs at least one line').max(200),
  freightAmount: z.number().nonnegative().max(9999999).default(0),
  validUntil: z.string().datetime().optional(),
  notes: z.string().trim().max(4000).optional(),
  paymentTerms: z.string().trim().max(255).optional(),
  deliveryTerms: z.string().trim().max(255).optional(),
});
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;

export const createQuoteSchema = createRevisionSchema.extend({
  customerId: z.number().int().positive(),
  enquiryId: z.number().int().positive().nullable().optional(),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// ── Admin: machines & attributes ────────────────────────────────────────────

export const createMachineBrandSchema = z.object({
  name: z.string().trim().min(1).max(150),
});
export type CreateMachineBrandInput = z.infer<typeof createMachineBrandSchema>;

export const createMachineModelSchema = z.object({
  machineBrandId: z.number().int().positive(),
  name: z.string().trim().min(1).max(150),
});
export type CreateMachineModelInput = z.infer<typeof createMachineModelSchema>;

export const createMachineVariantSchema = z.object({
  machineModelId: z.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  laserType: z.string().trim().max(50).optional(),
  powerWatts: z.number().int().positive().optional(),
});
export type CreateMachineVariantInput = z.infer<typeof createMachineVariantSchema>;

export const createAttributeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(190).regex(/^[a-z0-9-]+$/).optional(),
  dataType: z.enum(['STRING', 'DECIMAL', 'INTEGER', 'BOOLEAN', 'ENUM']).default('STRING'),
  defaultScope: z.enum(['PRODUCT', 'VARIANT']).default('VARIANT'),
  unit: z.string().trim().max(20).optional(),
  isFilterable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;

// ── Admin: dashboard ─────────────────────────────────────────────────────────

export const dashboardResponseSchema = z.object({
  enquiries: z.object({
    new: z.number(),
    acknowledged: z.number(),
    inProgress: z.number(),
    total: z.number(),
  }),
  quotes: z.object({
    draft: z.number(),
    sent: z.number(),
    expiringSoon: z.number(),
  }),
  inventory: z.object({
    lowStock: z.number(),
    outOfStock: z.number(),
  }),
  searchNoResults: z.array(z.object({ normalized: z.string(), count: z.number() })),
  demoData: z.record(z.string(), z.number()),
  placeholderSettings: z.array(z.string()),
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

// ── Admin: users & permissions (SUPER_ADMIN only) ───────────────────────────

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  department: z.enum(['SALES', 'SERVICE', 'CATALOGUE', 'CONTENT', 'OPERATIONS']),
});
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

export const permissionGrantSchema = z.object({
  module: z.enum([
    'CATALOGUE', 'INVENTORY', 'MACHINES', 'SERVICES', 'SERVICE_REQUESTS',
    'CUSTOMERS', 'ENQUIRIES', 'LEADS', 'QUOTES', 'ORDERS', 'REPORTS',
    'USERS', 'AUDIT', 'SETTINGS',
  ]),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
});
export type PermissionGrantInput = z.infer<typeof permissionGrantSchema>;

export const setPermissionsSchema = z.object({
  permissions: z.array(permissionGrantSchema).max(20),
});
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;

export const updateSettingSchema = z.object({
  value: z.string().max(20000),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

/** Full gallery order for one product, first entry first. */
export const reorderMediaSchema = z.object({
  mediaIds: z.array(z.number().int().positive()).min(1).max(50),
});
export type ReorderMediaInput = z.infer<typeof reorderMediaSchema>;
