import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  normalizeEmail,
  normalizePhone,
  type EnquiryStatus,
  type LeadSource,
  type Priority,
} from '@lei/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateEnquiryData {
  publicRef: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  contactCompany?: string;
  contactCity?: string;
  message?: string;
  machineBrandId?: number;
  machineModelId?: number;
  machineVariantId?: number;
  consentText: string;
  ipAddress?: string;
  userAgent?: string;
  spamScore: number;
  items: Array<{ variantId: number; quantity: number; note?: string }>;
}

export interface CreateContactEnquiryData {
  publicRef: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  contactCompany?: string;
  subject?: string;
  message: string;
  consentText: string;
  ipAddress?: string;
  userAgent?: string;
  spamScore: number;
}

@Injectable()
export class EnquiriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the whole quote request in ONE transaction.
   *
   * Customer, enquiry, line items and lead are written together or not at all.
   * Emails are queued afterwards, deliberately outside the transaction: an
   * enquiry must never be lost because the mail provider was down.
   */
  async createEnquiry(data: CreateEnquiryData) {
    return this.prisma.raw.$transaction(async (tx) => {
      // Server-side revalidation. The browser sent ids; prices, names and
      // availability all come from here, never from the client.
      const variants = await tx.productVariant.findMany({
        where: { id: { in: data.items.map((item) => item.variantId) }, isActive: true },
        select: {
          id: true,
          partNumber: true,
          variantName: true,
          price: true,
          product: { select: { name: true } },
        },
      });
      const byId = new Map(variants.map((variant) => [variant.id, variant]));

      const customer = await this.findOrCreateCustomer(tx, data);

      const enquiry = await tx.enquiry.create({
        data: {
          publicRef: data.publicRef,
          customerId: customer?.id ?? null,
          type: 'PRODUCT',
          status: 'NEW',
          source: 'WEBSITE_QUOTE_REQUEST',
          // Contact snapshot: what was actually typed. If sales later corrects
          // the company name, this enquiry still shows the original.
          contactName: data.contactName,
          contactEmail: data.contactEmail ?? null,
          contactPhone: data.contactPhone ?? null,
          contactCompany: data.contactCompany ?? null,
          contactCity: data.contactCity ?? null,
          message: data.message ?? null,
          machineBrandId: data.machineBrandId ?? null,
          machineModelId: data.machineModelId ?? null,
          machineVariantId: data.machineVariantId ?? null,
          consentGiven: true,
          consentText: data.consentText,
          consentAt: new Date(),
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent?.slice(0, 255) ?? null,
          spamScore: data.spamScore,
        },
      });

      await tx.enquiryItem.createMany({
        data: data.items.map((item, index) => {
          const variant = byId.get(item.variantId);
          return {
            enquiryId: enquiry.id,
            variantId: variant ? item.variantId : null,
            // Snapshots keep the enquiry readable if the variant is later
            // renamed, repriced or withdrawn.
            productNameSnapshot: variant
              ? `${variant.product.name} (${variant.variantName})`
              : 'Item no longer available',
            partNumberSnapshot: variant?.partNumber ?? null,
            unitPriceSnapshot: variant?.price ?? null,
            quantity: item.quantity,
            customerNote: item.note ?? null,
            sortOrder: index * 10,
          };
        }),
      });

      // Every enquiry becomes a lead, so nothing sits in a queue nobody watches.
      if (customer) {
        await tx.lead.create({
          data: {
            customerId: customer.id,
            enquiryId: enquiry.id,
            leadType: 'PRODUCT',
            source: 'WEBSITE_QUOTE_REQUEST' as LeadSource,
            status: 'NEW',
            priority: 'MEDIUM' as Priority,
          },
        });
      }

      return { enquiry, customer, itemCount: data.items.length };
    });
  }

  async createContactEnquiry(data: CreateContactEnquiryData) {
    return this.prisma.raw.$transaction(async (tx) => {
      const customer = await this.findOrCreateCustomer(tx, {
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        contactCompany: data.contactCompany,
      });

      const enquiry = await tx.enquiry.create({
        data: {
          publicRef: data.publicRef,
          customerId: customer?.id ?? null,
          type: 'GENERAL',
          status: 'NEW',
          source: 'WEBSITE_ENQUIRY',
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone ?? null,
          contactCompany: data.contactCompany ?? null,
          subject: data.subject ?? null,
          message: data.message,
          consentGiven: true,
          consentText: data.consentText,
          consentAt: new Date(),
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent?.slice(0, 255) ?? null,
          spamScore: data.spamScore,
        },
      });

      if (customer) {
        await tx.lead.create({
          data: {
            customerId: customer.id,
            enquiryId: enquiry.id,
            leadType: 'PRODUCT', // general enquiries fall under product pipeline by default
            source: 'WEBSITE_ENQUIRY',
            status: 'NEW',
            priority: 'MEDIUM',
          },
        });
      }

      return { enquiry, customer };
    });
  }

  /**
   * Find-or-create keyed on normalised email, then normalised phone.
   *
   * Auto-created records are flagged `isVerified: false` so sales can see which
   * came from a public form and have not been confirmed.
   */
  private async findOrCreateCustomer(
    tx: Prisma.TransactionClient,
    data: { contactName: string; contactEmail?: string; contactPhone?: string; contactCompany?: string; contactCity?: string }
  ) {
    const emailNormalized = data.contactEmail ? normalizeEmail(data.contactEmail) : null;
    const phoneNormalized = data.contactPhone ? normalizePhone(data.contactPhone) : null;

    if (!emailNormalized && !phoneNormalized) return null;

    const existing = await tx.customer.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(emailNormalized ? [{ emailNormalized }] : []),
          ...(phoneNormalized ? [{ phoneNormalized }] : []),
        ],
      },
    });

    if (existing) return existing;

    return tx.customer.create({
      data: {
        customerType: data.contactCompany ? 'BUSINESS' : 'INDIVIDUAL',
        companyName: data.contactCompany ?? null,
        contactName: data.contactName,
        email: data.contactEmail ?? null,
        phone: data.contactPhone ?? null,
        emailNormalized,
        phoneNormalized,
        city: data.contactCity ?? null,
        status: 'PROSPECT',
        isVerified: false,
        source: 'WEBSITE_QUOTE_REQUEST',
      },
    });
  }

  // ── Admin reads ───────────────────────────────────────────────────────

  async list(params: {
    skip: number;
    take: number;
    status?: EnquiryStatus;
    assignedToId?: number;
    search?: string;
  }) {
    const where: Prisma.EnquiryWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
      ...(params.search
        ? {
            OR: [
              { publicRef: { contains: params.search } },
              { contactName: { contains: params.search } },
              { contactCompany: { contains: params.search } },
              { contactEmail: { contains: params.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.enquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          publicRef: true,
          status: true,
          priority: true,
          contactName: true,
          contactCompany: true,
          contactEmail: true,
          contactPhone: true,
          createdAt: true,
          isSeedData: true,
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.client.enquiry.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: number) {
    return this.prisma.client.enquiry.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                partNumber: true,
                variantName: true,
                price: true,
                product: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
        customer: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        attachments: { include: { file: true } },
        lead: true,
        quotes: { select: { id: true, quoteNumber: true, status: true } },
      },
    });
  }

  async update(id: number, data: Prisma.EnquiryUncheckedUpdateInput) {
    return this.prisma.raw.enquiry.update({ where: { id }, data });
  }

  async countByStatus() {
    const rows = await this.prisma.client.enquiry.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  /**
   * Duplicate detection: same contact, same day.
   *
   * Flags rather than merges. Two enquiries from one customer might be two
   * genuine requests, and auto-merging commercial records loses information
   * that cannot be recovered.
   */
  async findPossibleDuplicate(emailNormalized: string | null, phoneNormalized: string | null) {
    if (!emailNormalized && !phoneNormalized) return null;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.client.enquiry.findFirst({
      where: {
        createdAt: { gte: since },
        customer: {
          OR: [
            ...(emailNormalized ? [{ emailNormalized }] : []),
            ...(phoneNormalized ? [{ phoneNormalized }] : []),
          ],
        },
      },
      select: { id: true, publicRef: true, createdAt: true },
    });
  }
}
