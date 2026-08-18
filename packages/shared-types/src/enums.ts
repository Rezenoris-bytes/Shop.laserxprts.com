/**
 * Domain enums, mirrored from the Prisma schema.
 *
 * These are declared here (not imported from @prisma/client) so the frontend
 * can use them without pulling in the Prisma runtime. A test in the API package
 * fails the build if these ever drift from the generated Prisma enums.
 */

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AdminDepartment = {
  SALES: 'SALES',
  SERVICE: 'SERVICE',
  CATALOGUE: 'CATALOGUE',
  CONTENT: 'CONTENT',
  OPERATIONS: 'OPERATIONS',
} as const;
export type AdminDepartment = (typeof AdminDepartment)[keyof typeof AdminDepartment];

export const PermissionModule = {
  CATALOGUE: 'CATALOGUE',
  INVENTORY: 'INVENTORY',
  MACHINES: 'MACHINES',
  SERVICES: 'SERVICES',
  SERVICE_REQUESTS: 'SERVICE_REQUESTS',
  CUSTOMERS: 'CUSTOMERS',
  ENQUIRIES: 'ENQUIRIES',
  LEADS: 'LEADS',
  QUOTES: 'QUOTES',
  ORDERS: 'ORDERS',
  REPORTS: 'REPORTS',
  USERS: 'USERS',
  AUDIT: 'AUDIT',
  SETTINGS: 'SETTINGS',
} as const;
export type PermissionModule = (typeof PermissionModule)[keyof typeof PermissionModule];

export const PermissionAction = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const ProductType = {
  SPARE_PART: 'SPARE_PART',
  CONSUMABLE: 'CONSUMABLE',
  COMPONENT: 'COMPONENT',
  ACCESSORY: 'ACCESSORY',
  KIT: 'KIT',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const PriceType = {
  FIXED: 'FIXED',
  ON_REQUEST: 'ON_REQUEST',
  CONTACT_SALES: 'CONTACT_SALES',
} as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];

export const UnitOfMeasure = {
  PIECE: 'PIECE',
  SET: 'SET',
  PACK: 'PACK',
  METRE: 'METRE',
  LITRE: 'LITRE',
  KG: 'KG',
  HOUR: 'HOUR',
  VISIT: 'VISIT',
  LOT: 'LOT',
} as const;
export type UnitOfMeasure = (typeof UnitOfMeasure)[keyof typeof UnitOfMeasure];

export const StockStatus = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  MADE_TO_ORDER: 'MADE_TO_ORDER',
  DISCONTINUED: 'DISCONTINUED',
} as const;
export type StockStatus = (typeof StockStatus)[keyof typeof StockStatus];

export const AttributeDataType = {
  STRING: 'STRING',
  DECIMAL: 'DECIMAL',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ENUM: 'ENUM',
} as const;
export type AttributeDataType = (typeof AttributeDataType)[keyof typeof AttributeDataType];

/**
 * Advisory only. This NEVER constrains where an AttributeValue may be written —
 * it is a default for the importer and the admin form. The Product/Variant
 * boundary is decided by imported data, not by the schema.
 */
export const AttributeScope = {
  PRODUCT: 'PRODUCT',
  VARIANT: 'VARIANT',
} as const;
export type AttributeScope = (typeof AttributeScope)[keyof typeof AttributeScope];

export const MediaType = {
  IMAGE: 'IMAGE',
  DATASHEET: 'DATASHEET',
  BROCHURE: 'BROCHURE',
  MANUAL: 'MANUAL',
  CERTIFICATE: 'CERTIFICATE',
  DRAWING: 'DRAWING',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const FileContext = {
  PRODUCT: 'PRODUCT',
  VARIANT: 'VARIANT',
  CATEGORY: 'CATEGORY',
  PART_BRAND: 'PART_BRAND',
  MACHINE_BRAND: 'MACHINE_BRAND',
  SERVICE: 'SERVICE',
  SERVICE_REQUEST: 'SERVICE_REQUEST',
  ENQUIRY: 'ENQUIRY',
  QUOTE: 'QUOTE',
  IMPORT: 'IMPORT',
} as const;
export type FileContext = (typeof FileContext)[keyof typeof FileContext];

export const CustomerType = {
  BUSINESS: 'BUSINESS',
  INDIVIDUAL: 'INDIVIDUAL',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const CustomerStatus = {
  PROSPECT: 'PROSPECT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const EnquiryType = {
  PRODUCT: 'PRODUCT',
  SERVICE: 'SERVICE',
  BULK: 'BULK',
  GENERAL: 'GENERAL',
} as const;
export type EnquiryType = (typeof EnquiryType)[keyof typeof EnquiryType];

export const EnquiryStatus = {
  NEW: 'NEW',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_PROGRESS: 'IN_PROGRESS',
  QUOTED: 'QUOTED',
  CLOSED_WON: 'CLOSED_WON',
  CLOSED_LOST: 'CLOSED_LOST',
  SPAM: 'SPAM',
} as const;
export type EnquiryStatus = (typeof EnquiryStatus)[keyof typeof EnquiryStatus];

export const LeadType = {
  PRODUCT: 'PRODUCT',
  SERVICE: 'SERVICE',
  BULK: 'BULK',
} as const;
export type LeadType = (typeof LeadType)[keyof typeof LeadType];

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  QUOTED: 'QUOTED',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
  DORMANT: 'DORMANT',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LeadSource = {
  WEBSITE_ENQUIRY: 'WEBSITE_ENQUIRY',
  WEBSITE_QUOTE_REQUEST: 'WEBSITE_QUOTE_REQUEST',
  SERVICE_REQUEST: 'SERVICE_REQUEST',
  PHONE: 'PHONE',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  REFERRAL: 'REFERRAL',
  EXHIBITION: 'EXHIBITION',
  MANUAL: 'MANUAL',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  UNDER_REVISION: 'UNDER_REVISION',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const TaxTreatment = {
  CGST_SGST: 'CGST_SGST',
  IGST: 'IGST',
  EXEMPT: 'EXEMPT',
  ZERO_RATED: 'ZERO_RATED',
} as const;
export type TaxTreatment = (typeof TaxTreatment)[keyof typeof TaxTreatment];

export const ServicePricingType = {
  FIXED: 'FIXED',
  PER_HOUR: 'PER_HOUR',
  PER_VISIT: 'PER_VISIT',
  ON_REQUEST: 'ON_REQUEST',
  CONTACT_SALES: 'CONTACT_SALES',
} as const;
export type ServicePricingType = (typeof ServicePricingType)[keyof typeof ServicePricingType];

export const ServiceRequestStatus = {
  NEW: 'NEW',
  ASSIGNED: 'ASSIGNED',
  ASSESSMENT: 'ASSESSMENT',
  QUOTED: 'QUOTED',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ServiceRequestStatus = (typeof ServiceRequestStatus)[keyof typeof ServiceRequestStatus];

export const EventType = {
  PAGE_VIEW: 'PAGE_VIEW',
  PRODUCT_VIEW: 'PRODUCT_VIEW',
  VARIANT_VIEW: 'VARIANT_VIEW',
  CATEGORY_VIEW: 'CATEGORY_VIEW',
  SERVICE_VIEW: 'SERVICE_VIEW',
  SEARCH: 'SEARCH',
  /** Separated deliberately — the most commercially valuable signal on the site. */
  SEARCH_NO_RESULTS: 'SEARCH_NO_RESULTS',
  FILTER_USED: 'FILTER_USED',
  COMPATIBILITY_SEARCH: 'COMPATIBILITY_SEARCH',
  QUOTE_REQUEST_START: 'QUOTE_REQUEST_START',
  QUOTE_REQUEST_ITEM_ADDED: 'QUOTE_REQUEST_ITEM_ADDED',
  QUOTE_REQUEST_ITEM_REMOVED: 'QUOTE_REQUEST_ITEM_REMOVED',
  QUOTE_REQUEST_SUBMIT: 'QUOTE_REQUEST_SUBMIT',
  BROCHURE_DOWNLOAD: 'BROCHURE_DOWNLOAD',
  WHATSAPP_CLICK: 'WHATSAPP_CLICK',
  PHONE_CLICK: 'PHONE_CLICK',
  CONTACT_SUBMIT: 'CONTACT_SUBMIT',
  LOGIN: 'LOGIN',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SOFT_DELETE: 'SOFT_DELETE',
  RESTORE: 'RESTORE',
  HARD_DELETE: 'HARD_DELETE',
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  QUOTE_SENT: 'QUOTE_SENT',
  QUOTE_ACCEPTED: 'QUOTE_ACCEPTED',
  QUOTE_REJECTED: 'QUOTE_REJECTED',
  STOCK_ADJUST: 'STOCK_ADJUST',
  IMPORT: 'IMPORT',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const EmailStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  BOUNCED: 'BOUNCED',
  COMPLAINED: 'COMPLAINED',
  FAILED: 'FAILED',
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export const ImportStatus = {
  PENDING: 'PENDING',
  VALIDATING: 'VALIDATING',
  VALIDATED: 'VALIDATED',
  APPLYING: 'APPLYING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const Locale = {
  en: 'en',
  hi: 'hi',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
