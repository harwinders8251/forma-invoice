"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, FileQuestion } from "lucide-react";
import { InvoiceRecord } from "@/lib/invoice-service";
import { invoiceRecordToFormData } from "@/lib/schemas";
import { getInvoiceAction } from "@/app/actions/invoices";
import { InvoiceEditor } from "@/components/invoice-editor";
import { InvoiceSkeleton } from "@/components/invoice-skeleton";

interface InvoiceEditLoaderProps {
  invoiceId: string;
  initialInvoice?: InvoiceRecord | null;
}

type LoaderStatus = "loading" | "success" | "error";

export function InvoiceEditLoader({
  invoiceId,
  initialInvoice,
}: InvoiceEditLoaderProps) {
  // If initial invoice was passed from server, start in success mode immediately (no fake delay)
  const [status, setStatus] = useState<LoaderStatus>(() =>
    initialInvoice && initialInvoice.id === invoiceId ? "success" : "loading"
  );
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(() =>
    initialInvoice && initialInvoice.id === invoiceId ? initialInvoice : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let isCurrentRequest = true;

    // If initial invoice matches and no retry was triggered, stay in initial success state
    if (initialInvoice && initialInvoice.id === invoiceId && retryKey === 0) {
      return;
    }

    async function fetchInvoice() {
      try {
        const res = await getInvoiceAction(invoiceId);

        // Guard against stale requests and unmounted components
        if (!isMounted || !isCurrentRequest) return;

        if (res.success && res.data) {
          setInvoice(res.data);
          setStatus("success");
        } else {
          setInvoice(null);
          setErrorMessage(
            res.error || "The requested invoice could not be found or may have been deleted."
          );
          setStatus("error");
        }
      } catch (err: unknown) {
        if (!isMounted || !isCurrentRequest) return;
        setInvoice(null);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading the invoice."
        );
        setStatus("error");
      }
    }

    fetchInvoice();

    // Cleanup: cancel pending stale updates on unmount or id/retry change
    return () => {
      isMounted = false;
      isCurrentRequest = false;
    };
  }, [invoiceId, retryKey, initialInvoice]);

  // 1. Loading State (Centered spinner + 0-shift skeleton matching editor & preview)
  if (status === "loading") {
    return <InvoiceSkeleton />;
  }

  // 2. Error State (Friendly, non-blocking, responsive with Retry & Back actions)
  if (status === "error" || !invoice) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
        {/* Top Header Bar preserved to avoid layout shifts and maintain navigation */}
        <div className="no-print mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/invoices"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              title="Back to Invoices"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Edit Invoice
              </h1>
              <p className="text-xs text-slate-500">
                Return to invoices or retry fetching the invoice data.
              </p>
            </div>
          </div>
        </div>

        {/* Polished, Friendly Error Card */}
        <div className="max-w-md mx-auto my-12 p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-xs">
            <FileQuestion className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">
              Invoice Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {errorMessage || "The requested invoice could not be found or may have been deleted."}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setErrorMessage(null);
                setRetryKey((k) => k + 1);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
            <Link
              href="/invoices"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Invoices</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Success State: Render the full invoice editor with all calculations and persistence
  const initialFormData = invoiceRecordToFormData(invoice);
  return <InvoiceEditor initialData={initialFormData} isEditMode={true} />;
}
