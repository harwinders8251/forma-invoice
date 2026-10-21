# Forma Invoice - Production-Ready Invoice Generator

Forma Invoice is a full-stack, decimal-safe invoice generator built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **Supabase PostgreSQL**, and **Resend**.

It provides an end-to-end workflow for businesses to create, manage, preview, export to PDF, and email professional client invoices with strict financial accounting accuracy.

---

## 🚀 Technology Stack

- **Framework**: Next.js 16.4.2 (App Router with Partial Prerendering & Server Actions)
- **Language**: TypeScript 5
- **UI & Styling**: Tailwind CSS v4, Lucide React icons
- **Database**: Supabase PostgreSQL with version-controlled migrations & Row Level Security (RLS)
- **Client**: `@supabase/supabase-js` v2
- **Validation**: Zod schema validation on client and server
- **Financial Calculations**: Decimal-safe arithmetic via `decimal.js` (Half-up banking rounding)
- **Email Delivery**: Resend SDK (`resend`) with automated delivery logging
- **Testing**: Vitest (`vitest`) for decimal accounting and schema unit testing

---

## ✨ Features

### 1. Dashboard (`/invoices`)
- Complete listing of saved invoices with invoice number, customer, issue date, due date, and formatted totals.
- Live search filtering by invoice number, customer name, or business name.
- Email delivery status badges (`Sent`, `Failed`, `Not sent`).
- Modal confirmation for destructive invoice deletion.
- Graceful empty states and database migration status banners.

### 2. Live Invoice Editor (`/invoices/new` and `/invoices/[id]`)
- **Business Details**: Name, email, and billing address.
- **Customer Details**: Name, email, and shipping/billing address.
- **Invoice Meta**: Unique invoice number with automated sequential generator (`INV-YYYY-XXXX`), issue date, and due date (with non-wrapping hyphens across all screen sizes).
- **Dynamic Line Items**: Add, edit, and remove line items with live unit price, quantity, column headers, and auto-computed line totals.
- **Financial Adjustments**: Fixed discount amount ($) and percentage tax rate (%).
- **Custom Metadata Fields**: Add custom fields (e.g., PO Number, Project Code, Payment Method) with individual show/hide visibility toggles, strictly constrained to max 10 fields per invoice, 40 characters label, and 80 characters value with live input character counters.
- **Notes & Payment Terms**: Custom terms, bank transfer details, or thank-you notes.

### 3. Real-Time Side-by-Side Preview & PDF Export
- Desktop editor displays a live invoice canvas updating with every keystroke.
- **Print / Save as PDF**: Pure CSS `@media print` styling that hides controls, buttons, and navigation, formatting the document directly for standard A4 portrait printing or PDF saving via the browser print dialog. Includes glyph overhang protection (`overflow: visible`, `pl-1`) and full layout grid resets.
- **Server-Side PDF Generation**: Direct PDF export via `GET /api/invoices/[id]/pdf` with PDFKit.
- Hidden custom fields are excluded from both the preview and the printed document.

### 4. Server-Side Email Delivery (`POST /api/invoices/[id]/send`)
- Dispatches invoices directly to clients via Resend with a clean, branded HTML email template and PDF attachment.
- Records delivery status (`sent` or `failed`) with provider message IDs in the `invoice_email_logs` table.
- Client credentials and API keys are kept strictly on the server.

---

## 🧮 Financial Calculation Rules

All monetary calculations are isolated in [`lib/invoice-calculations.ts`](lib/invoice-calculations.ts) using `decimal.js` to eliminate IEEE-754 floating-point rounding errors:

1. **Non-negative Rules**: Quantities, unit prices, discounts, and tax rates must be $\ge 0$.
2. **Line Total**: Rounded to 2 decimal places using `ROUND_HALF_UP`:
   $$\text{line\_total} = \text{round}_2(\text{quantity} \times \text{unit\_price})$$
3. **Subtotal**: Sum of rounded line totals:
   $$\text{subtotal} = \sum \text{line\_total}$$
4. **Discount Rule**: Fixed discount is capped at subtotal ($\text{discount} \le \text{subtotal}$).
5. **Taxable Amount**:
   $$\text{taxable\_amount} = \text{subtotal} - \text{discount}$$
6. **Tax Calculation**: Percentage tax applied to taxable amount and rounded to 2 decimal places:
   $$\text{tax\_amount} = \text{round}_2\left(\text{taxable\_amount} \times \frac{\text{tax\_rate}}{100}\right)$$
7. **Grand Total**:
   $$\text{grand\_total} = \text{taxable\_amount} + \text{tax\_amount}$$
8. **Server Recalculation**: Server Actions and API routes recompute all totals before persisting. Client-sent totals are never trusted blindly.

### Verified Test Case ($99.00 Example)
```text
Quantity: 2
Unit price: $50.00
Subtotal: $100.00
Fixed discount: $10.00
Tax rate: 10%
Taxable amount: $90.00
Tax: $9.00
Grand total: $99.00
```
*Validated via Vitest in `lib/invoice-calculations.test.ts`.*

---

## 📦 Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **Supabase Account**: Project URL and API Keys
- **Resend Account**: API Key for email sending (optional for local preview)

---

## 🛠️ Local Setup Instructions

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repo-url>
   cd forma-invoice
   npm install --legacy-peer-deps
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your actual values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=your_service_role_secret_key
   RESEND_API_KEY=re_...
   EMAIL_FROM=onboarding@resend.dev
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Verify Supabase Connection**:
   ```bash
   npm run test:supabase
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🗄️ Database Management & Migrations

All database schemas, constraints, indexes, triggers, and security policies are strictly managed via version-controlled Supabase migration files located in `supabase/migrations/`:

1. [`20261021120000_create_invoice_schema.sql`](supabase/migrations/20261021120000_create_invoice_schema.sql):
   - `public.invoices` table with financial `CHECK` constraints and `updated_at` trigger.
   - `public.invoice_items` table with foreign key `ON DELETE CASCADE`.
   - `public.invoice_email_logs` table for tracking Resend dispatches.
   - Database indexes on `invoice_number`, `customer_name`, `issue_date`, and foreign keys.
   - Atomic PostgreSQL stored procedure `upsert_invoice_with_items` for transactional saves.

2. [`20261021120001_add_invoice_security.sql`](supabase/migrations/20261021120001_add_invoice_security.sql):
   - Enables Row Level Security (RLS) on all tables.
   - Blocks public anonymous read/write access.
   - Configures `service_role` and `authenticated` role policies.

### Applying Migrations to Remote Supabase

To push migrations to your remote Supabase project:

1. Login to Supabase CLI:
   ```bash
   npx supabase login
   ```
2. Link your project ref:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
3. Push migrations:
   ```bash
   npx supabase db push
   ```

*Note: In local development, the application checks schema availability (`PGRST205` / schema cache) and provides an informative dashboard banner if tables need to be migrated.*

---

## 🔒 Authorization & Security Architecture

- **No Public Client Access**: Invoices contain sensitive client and financial data. The database tables have RLS enabled, and anonymous public queries via `anon`/publishable keys are rejected by default.
- **Server Gateway**: All queries and mutations are routed through Next.js Server Actions and Route Handlers.
- **Server-Only Privileged Client**: Privileged operations execute via [`lib/supabase-server.ts`](lib/supabase-server.ts) using `import "server-only"`, ensuring `SUPABASE_SECRET_KEY` is never bundled into client JavaScript.
- **Input Sanitization**: All incoming form payloads pass strict Zod schema validation before touching the database or calculation engine.

---

## ✉️ Resend Email Configuration

1. Obtain an API key from [Resend](https://resend.com).
2. Set `RESEND_API_KEY` in `.env.local`.
3. For testing without a custom domain, use `EMAIL_FROM=onboarding@resend.dev` (Resend's default sandbox sender) and send test emails to your registered Resend account email address.
4. For production, verify your custom domain in Resend and update `EMAIL_FROM=billing@yourdomain.com`.

---

## 🧪 Verification & Quality Checks

Run the following commands to verify project integrity:

```bash
# Run Vitest financial & validation unit tests
npm test

# Run ESLint check
npm run lint

# Run Next.js production build (Turbopack)
npm run build

# Test Supabase connection ping
npm run test:supabase
```

---

## 💡 Architecture & Design Decisions

- **Next.js 16 Partial Prerendering (PPR)**: Dynamic pages stream data inside React `<Suspense>` boundaries while prerendering static layout shells for sub-millisecond initial responses.
- **Server Actions for Mutations**: Used `saveInvoiceAction` and `deleteInvoiceAction` with `revalidatePath` for zero-boilerplate cache synchronization.
- **Zero-Dependency Native PDF Printing**: Rather than bundling heavy server-side headless browsers (e.g. Puppeteer), the preview leverages clean CSS `@media print` rules for browser-native printing and PDF downloading.

---

## ⏱️ Project Summary

- **Development Methodology**: Test-driven financial calculations, version-controlled Supabase migrations, strict Next.js App Router conventions.
- **Test Results**: 30/30 Unit Tests Passed (`vitest`), 0 TypeScript Errors (`tsc --noEmit`), 0 Lint Errors, Production Build Successful.
- **Deployment**: Zero-error production build verified on Next.js 16 (App Router) & Netlify.

