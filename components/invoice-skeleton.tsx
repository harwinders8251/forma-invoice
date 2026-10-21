import Link from "next/link";
import { ArrowLeft, Loader2, FileText } from "lucide-react";

export function InvoiceSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Top Header Bar - Kept visible with matching layout to eliminate shift */}
      <div className="no-print mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
            title="Back to Invoices"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Edit Invoice
              </h1>
              <div className="h-6 w-24 bg-slate-200/80 rounded-md animate-pulse" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live side-by-side editing with instant PDF printing and email dispatch.
            </p>
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="h-9 w-28 bg-slate-200/70 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-slate-200/70 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-indigo-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Polished Centered Loading State Banner */}
      <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left transition-all">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
            <span>Loading your invoice</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Fetching invoice details, line items, and live calculations...
          </p>
        </div>
      </div>

      {/* Editor & Preview Skeletons Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Cards Skeleton */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Meta & Dates */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          {/* Card 2: Business & Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-3">
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-3">
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Card 3: Line Items */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-7 w-20 bg-slate-100 rounded-md animate-pulse" />
            </div>
            <div className="space-y-3">
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Card 4: Discounts & Taxes */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Right Column: Live Preview Paper Skeleton */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200/90 p-7 shadow-sm space-y-6">
            <div className="flex justify-between items-start pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-indigo-100 rounded animate-pulse" />
                <div className="h-7 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-8 w-28 bg-slate-100 rounded-lg animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="space-y-1.5 text-right flex flex-col items-end">
                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <div className="w-56 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="flex justify-between">
                  <div className="h-3 w-14 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-14 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                  <div className="h-6 w-24 bg-slate-300 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
