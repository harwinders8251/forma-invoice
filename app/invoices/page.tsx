import { listInvoices, InvoiceRecord } from "@/lib/invoice-service";
import { InvoiceList } from "@/components/invoice-list";
import { Suspense } from "react";

interface InvoicesPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function InvoicesContent({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const query = params?.q || "";

  let invoices: InvoiceRecord[] = [];
  let isTableMissing = false;

  try {
    const result = await listInvoices(query);
    invoices = result.invoices;
    isTableMissing = !!result.isTableMissing;
  } catch (err: unknown) {
    console.error("Failed to load invoices:", err);
  }

  return (
    <InvoiceList
      initialInvoices={invoices}
      initialSearch={query}
      isTableMissing={isTableMissing}
    />
  );
}

export default function InvoicesPage({ searchParams }: InvoicesPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage, generate, preview, and dispatch professional client invoices.
          </p>
        </div>
      </div>

      {/* Main List streamed inside Suspense */}
      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
            Loading invoices...
          </div>
        }
      >
        <InvoicesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
