/* eslint-disable no-console */
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { AdminDepartment, normalizeEmail } from '@lei/shared';
import { expandTemplate } from '../../src/admin/permission-templates';
import { seedCatalogueFromCsv } from './catalogue';

loadEnv({ path: path.resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

/**
 * Seed entry point.
 *
 * Two distinct jobs, deliberately separated:
 *
 *   1. Accounts and settings — written here in TypeScript, because they are
 *      infrastructure, not catalogue data.
 *   2. The catalogue — loaded from CSV through the SAME importer production
 *      will use. That is the point: the import path is exercised and debugged
 *      from day one, and swapping demo data for the real LEI catalogue is
 *      replacing CSV files, not changing code.
 *
 * Idempotent: safe to re-run. Passwords are only set on first creation, so
 * re-seeding never resets a password someone has changed.
 */
async function main(): Promise<void> {
  console.log('\nSeeding LEI database\n' + '='.repeat(60));

  await seedSettings();
  const users = await seedUsers();
  await seedCatalogueFromCsv(prisma);

  console.log('\n' + '='.repeat(60));
  console.log('Seed complete.\n');
  console.log('Sign in at /admin with:');
  for (const user of users) {
    console.log(`  ${user.email.padEnd(34)} ${user.password}   (${user.label})`);
  }
  console.log(
    '\nThese are development credentials for DEMO_MODE only.\n' +
      'Setting DEMO_MODE=false while seed data or PLACEHOLDER settings remain\n' +
      'will refuse to boot.\n',
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

/**
 * LEI's own company data.
 *
 * None of the four source specification documents contained this, yet a quote
 * PDF cannot be rendered without it. Every value below is a PLACEHOLDER and is
 * detected as such by the boot-time production check.
 */
async function seedSettings(): Promise<void> {
  const settings: Array<{
    key: string;
    value: string;
    group: string;
    description: string;
    isSecret?: boolean;
  }> = [
    // Company identity — required on every quotation.
    {
      key: 'company.legal_name',
      value: 'PLACEHOLDER — Laser Experts India',
      group: 'company',
      description: 'Registered legal name, printed on quotations',
    },
    {
      key: 'company.gstin',
      value: 'PLACEHOLDER — 27AAAAA0000A1Z5',
      group: 'company',
      description: 'LEI GSTIN. Supplied by the accountant.',
    },
    {
      key: 'company.state_code',
      value: '27',
      group: 'company',
      description: 'GST state code. Decides CGST+SGST vs IGST.',
    },
    {
      key: 'company.address',
      value: 'PLACEHOLDER — registered address',
      group: 'company',
      description: 'Registered address for quotations',
    },
    { key: 'company.city', value: 'PLACEHOLDER', group: 'company', description: 'City' },
    { key: 'company.pincode', value: '000000', group: 'company', description: 'PIN code' },
    {
      key: 'company.phone',
      value: 'PLACEHOLDER — +91 00000 00000',
      group: 'company',
      description: 'Primary contact number',
    },
    {
      key: 'company.email',
      value: 'PLACEHOLDER — sales@example.com',
      group: 'company',
      description: 'Primary contact email',
    },
    {
      key: 'company.website',
      value: 'PLACEHOLDER',
      group: 'company',
      description: 'Website shown on quotations',
    },

    // Quotation defaults.
    {
      key: 'quote.number_prefix',
      value: 'LEI/Q',
      group: 'quote',
      description: 'Quote number prefix, e.g. LEI/Q/2026-27/0042',
    },
    {
      key: 'quote.validity_days',
      value: '15',
      group: 'quote',
      description: 'Default validity period in days',
    },
    {
      key: 'quote.default_gst_rate',
      value: '18',
      group: 'quote',
      description: 'Fallback GST rate when a product has none',
    },
    {
      key: 'quote.payment_terms',
      value: 'PLACEHOLDER — 100% advance',
      group: 'quote',
      description: 'Default payment terms',
    },
    {
      key: 'quote.delivery_terms',
      value: 'PLACEHOLDER — Ex-works',
      group: 'quote',
      description: 'Default delivery terms',
    },
    {
      key: 'quote.terms',
      value:
        'PLACEHOLDER — Terms and conditions to be supplied by LEI.\n' +
        '1. Prices are in INR and exclusive of freight unless stated.\n' +
        '2. GST is charged at the applicable rate.\n' +
        '3. This quotation is valid for the period stated above.',
      group: 'quote',
      description: 'Terms printed on quotations. Snapshotted onto each revision at issue time.',
    },

    // Operations.
    {
      key: 'notify.sales_emails',
      value: 'sales@example.com',
      group: 'notify',
      description: 'Comma-separated recipients for new-enquiry alerts',
    },
    {
      key: 'whatsapp.number',
      value: '910000000000',
      group: 'contact',
      description: 'WhatsApp number in wa.me format (country code, no +)',
    },
    {
      key: 'contact.phone',
      value: 'PLACEHOLDER — +91 00000 00000',
      group: 'contact',
      description: 'Phone number shown on the storefront',
    },
  ];

  let created = 0;
  for (const setting of settings) {
    const existing = await prisma.setting.findUnique({ where: { key: setting.key } });
    if (existing) continue;
    await prisma.setting.create({
      data: {
        key: setting.key,
        value: setting.value,
        group: setting.group,
        description: setting.description,
        isSecret: setting.isSecret ?? false,
      },
    });
    created += 1;
  }

  console.log(
    `  settings          ${created} created, ${settings.length - created} already present`,
  );
}

// ── Users ───────────────────────────────────────────────────────────────────

async function seedUsers() {
  const accounts = [
    {
      name: 'LEI Owner',
      email: 'owner@lei.local',
      password: 'DevSuperAdmin2026!',
      role: 'SUPER_ADMIN' as const,
      department: null,
      label: 'full access',
    },
    {
      name: 'Priya Sales',
      email: 'sales@lei.local',
      password: 'DevSalesAdmin2026!',
      role: 'ADMIN' as const,
      department: AdminDepartment.SALES,
      label: 'sales',
    },
    {
      name: 'Arun Catalogue',
      email: 'catalogue@lei.local',
      password: 'DevCatalogue2026!',
      role: 'ADMIN' as const,
      department: AdminDepartment.CATALOGUE,
      label: 'catalogue — no customer PII',
    },
    {
      name: 'Meera Service',
      email: 'service@lei.local',
      password: 'DevServiceAdm2026!',
      role: 'ADMIN' as const,
      department: AdminDepartment.SERVICE,
      label: 'service',
    },
    {
      name: 'Karthik Ops',
      email: 'ops@lei.local',
      password: 'DevOperations2026!',
      role: 'ADMIN' as const,
      department: AdminDepartment.OPERATIONS,
      label: 'operations',
    },
    {
      name: 'Divya Content',
      email: 'content@lei.local',
      password: 'DevContentAdm2026!',
      role: 'ADMIN' as const,
      department: AdminDepartment.CONTENT,
      label: 'content',
    },
  ];

  let created = 0;
  for (const account of accounts) {
    const emailNormalized = normalizeEmail(account.email);
    const existing = await prisma.user.findUnique({ where: { emailNormalized } });
    if (existing) continue;

    const user = await prisma.user.create({
      data: {
        name: account.name,
        email: account.email,
        emailNormalized,
        // Same Argon2id parameters the application uses.
        passwordHash: await argon2.hash(account.password, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
        role: account.role,
        department: account.department,
        isActive: true,
      },
    });

    // SUPER_ADMIN needs no permission rows — the guard short-circuits on role.
    if (account.department) {
      await prisma.adminPermission.createMany({
        data: expandTemplate(account.department).map((row) => ({ ...row, userId: user.id })) as never,
      });
    }

    created += 1;
  }

  console.log(
    `  users             ${created} created, ${accounts.length - created} already present`,
  );
  return accounts;
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
