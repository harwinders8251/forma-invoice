"use client";

import { CustomField } from "@/lib/schemas";
import { formatCurrency, CalculatedInvoiceTotals } from "@/lib/invoice-calculations";
import { Building2, User } from "lucide-react";

interface InvoicePreviewProps {
  invoiceNumber: string;
  businessName: string;
  businessEmail?: string;
  businessAddress?: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  totals: CalculatedInvoiceTotals;
  customFields?: CustomField[];
}

/**
 * Format YYYY-MM-DD date to human-readable "Oct 21, 2026"
 */
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function InvoicePreview({
  invoiceNumber,
  businessName,
  businessEmail,
  businessAddress,
  customerName,
  customerEmail,
  customerAddress,
  issueDate,
  dueDate,
  notes,
  totals,
  customFields = [],
}: InvoicePreviewProps) {
  // Only display custom fields where isVisible === true and label is not blank
  const visibleCustomFields = customFields.filter(
    (cf) => cf.isVisible && cf.label.trim().length > 0 && cf.value.trim().length > 0
  );

  return (
    <div
      className={`print-container bg-white rounded-2xl border shadow-xl print:shadow-none print:border-none p-3.5 sm:p-6 md:p-8 text-slate-900 transition-all font-sans relative overflow-hidden w-full max-w-full min-w-0 ${
        totals.isInvalid ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200/90"
      }`}
    >
      {/* 4px Top Indigo Strip (Paper Look) */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 absolute top-0 left-0 right-0 print:hidden" />

      {/* Prominent Invalid Invoice Notice - When invoice has validation errors */}
      {totals.isInvalid && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
            <span className="font-bold uppercase tracking-wider text-rose-700">Invalid Invoice</span>
            <span className="text-slate-600 hidden sm:inline">
              — Not ready for issue. Save, PDF print, and email dispatch are blocked.
            </span>
          </div>
          <span className="text-[11px] font-bold bg-rose-200/80 text-rose-800 px-2.5 py-0.5 rounded-md border border-rose-300 self-start sm:self-auto">
            Action Required
          </span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 sm:gap-6 pb-6 border-b border-slate-200 w-full">
        <div className="w-full sm:w-auto sm:flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[11px] uppercase tracking-widest font-bold block ${
                totals.isInvalid ? "text-rose-600" : "text-indigo-600"
              }`}
            >
              {totals.isInvalid ? "TAX INVOICE (DRAFT / INVALID)" : "TAX INVOICE"}
            </span>
            {totals.isInvalid && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                BLOCKED
              </span>
            )}
          </div>
          <h2
            className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap font-mono invoice-number-no-wrap"
            style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
          >
            {invoiceNumber || "INV-YYYY-XXXX"}
          </h2>
          <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-1 text-xs w-full">
            <div className="p-2 sm:p-0 rounded-lg sm:rounded-none bg-slate-50 sm:bg-transparent border sm:border-0 border-slate-200/70 sm:flex sm:items-center sm:gap-2">
              <span className="text-[10px] sm:text-xs uppercase sm:normal-case font-semibold text-slate-400 sm:text-slate-600 block sm:w-20">
                Issue Date:
              </span>
              <span className="text-slate-900 font-semibold sm:font-medium">
                {formatDisplayDate(issueDate)}
              </span>
            </div>
            <div className="p-2 sm:p-0 rounded-lg sm:rounded-none bg-slate-50 sm:bg-transparent border sm:border-0 border-slate-200/70 sm:flex sm:items-center sm:gap-2">
              <span className="text-[10px] sm:text-xs uppercase sm:normal-case font-semibold text-slate-400 sm:text-slate-600 block sm:w-20">
                Due Date:
              </span>
              <span className="text-slate-900 font-semibold sm:font-medium">
                {formatDisplayDate(dueDate)}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full pt-3 sm:pt-0 sm:w-auto sm:text-right border-t sm:border-t-0 border-slate-100 sm:flex-shrink-0">
          <div className="flex items-center sm:justify-end gap-1.5 font-bold text-slate-900 text-base sm:text-lg">
            <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="break-words sm:whitespace-nowrap font-bold text-slate-900">{businessName || "Your Company Name"}</span>
          </div>
          {businessEmail && (
            <div className="text-xs text-slate-500 mt-1 break-all sm:break-normal">{businessEmail}</div>
          )}
          {businessAddress && (
            <div className="text-xs text-slate-500 whitespace-pre-line mt-1.5 leading-relaxed break-words sm:ml-auto max-w-xs">
              {businessAddress}
            </div>
          )}
        </div>
      </div>

      {/* Bill To & Visible Custom Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 py-6 border-b border-slate-200 text-xs w-full">
        <div className="w-full">
          <span className="uppercase tracking-wider font-bold text-slate-400 text-[10px] block mb-2">
            BILLED TO
          </span>
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm mb-1">
            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="break-words">{customerName || "Customer Name"}</span>
          </div>
          {customerEmail && (
            <div className="text-slate-500 mb-1 break-all">{customerEmail}</div>
          )}
          {customerAddress && (
            <div className="text-slate-500 whitespace-pre-line leading-relaxed break-words">
              {customerAddress}
            </div>
          )}
        </div>

        {/* Custom Fields (Only visible ones shown, hidden excluded from print & preview) */}
        {visibleCustomFields.length > 0 && (
          <div className="w-full sm:text-right space-y-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="uppercase tracking-wider font-bold text-slate-400 text-[10px] block mb-2">
              INVOICE DETAILS
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-1.5 sm:gap-1">
              {visibleCustomFields.map((field) => (
                <div key={field.id} className="text-xs leading-relaxed flex items-center justify-between sm:justify-end gap-2">
                  <span className="text-slate-500 font-medium">{field.label}:</span>
                  <span className="font-semibold text-slate-800 break-words">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="py-6 border-b border-slate-200 w-full min-w-0 max-w-full">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200/90 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-2.5 px-2.5 sm:px-3 text-left rounded-l-md">Item & Description</th>
                <th className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">Qty</th>
                <th className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">Price</th>
                <th className="py-2.5 px-2.5 sm:px-3 text-right rounded-r-md whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {totals.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    No items added yet
                  </td>
                </tr>
              ) : (
                totals.items.map((item, idx) => (
                  <tr key={idx} className="text-slate-700">
                    <td className="py-3 px-2.5 sm:px-3 font-medium text-slate-900 break-words whitespace-pre-line">
                      {item.description || "Untitled Item"}
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-center text-slate-600 font-mono whitespace-nowrap">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-right text-slate-600 font-mono whitespace-nowrap">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 px-2.5 sm:px-3 text-right font-semibold text-slate-900 font-mono whitespace-nowrap">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Calculations Summary */}
      <div className="py-6 border-b border-slate-200 flex justify-end w-full">
        <div className="w-full sm:w-80 space-y-2.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-900 font-mono">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>

          {totals.isInvalid ? (
            <div className="space-y-2.5 pt-1">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  <span>Invalid Discount ({formatCurrency(totals.discount_amount)})</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-snug">
                  Discount cannot exceed subtotal ({formatCurrency(totals.subtotal)}). Calculation is blocked.
                </p>
              </div>

              <div className="flex justify-between text-slate-400 text-xs italic">
                <span>Taxable Subtotal:</span>
                <span>Blocked</span>
              </div>
              <div className="flex justify-between text-slate-400 text-xs italic">
                <span>Tax ({totals.tax_rate}%):</span>
                <span>Blocked</span>
              </div>

              <div className="pt-3 border-t-2 border-rose-300 flex justify-between items-baseline">
                <span className="text-sm font-bold text-rose-900 uppercase tracking-tight">
                  Grand Total (USD):
                </span>
                <span className="text-base font-bold text-rose-600 font-mono">
                  Invalid (Fix Errors)
                </span>
              </div>
            </div>
          ) : (
            <>
              {totals.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700 bg-emerald-50/60 px-2 py-1 rounded">
                  <span>Fixed Discount:</span>
                  <span className="font-semibold font-mono">
                    -{formatCurrency(totals.discount_amount)}
                  </span>
                </div>
              )}

              {totals.discount_amount > 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Taxable Subtotal:</span>
                  <span className="font-medium font-mono">
                    {formatCurrency(totals.taxable_amount)}
                  </span>
                </div>
              )}

              {totals.tax_rate > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({totals.tax_rate}%):</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {formatCurrency(totals.tax_amount)}
                  </span>
                </div>
              )}

              {/* Grand Total in Soft Indigo Box */}
              <div className="pt-2">
                <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 flex justify-between items-baseline shadow-xs">
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    Grand Total (USD):
                  </span>
                  <span className="text-2xl font-black text-indigo-700 font-mono tracking-tight">
                    {formatCurrency(totals.grand_total)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes / Payment Terms */}
      {notes && (
        <div className="pt-6 text-xs text-slate-500 w-full">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
            NOTES & PAYMENT TERMS
          </span>
          <p className="whitespace-pre-line leading-relaxed text-slate-600 break-words w-full">{notes}</p>
        </div>
      )}

      {/* Print Footer */}
      <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
        Thank you for your business. Generated by Forma Invoice.
      </div>
    </div>
  );
}
