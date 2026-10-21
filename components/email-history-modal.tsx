"use client";

import { useEffect, useState } from "react";
import { X, Mail, CheckCircle2, AlertCircle, Clock, Send, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/invoice-calculations";

export interface EmailLogEntry {
  id: string;
  invoice_id: string | null;
  recipient_email: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface EmailHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal?: number;
  initialLogs?: EmailLogEntry[];
  onOpenSendModal?: () => void;
}

function formatHistoryDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    }

    return `${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} at ${timeStr}`;
  } catch {
    return dateStr;
  }
}

export function EmailHistoryModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  grandTotal,
  initialLogs = [],
  onOpenSendModal,
}: EmailHistoryModalProps) {
  const [logs, setLogs] = useState<EmailLogEntry[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFreshLogs = async () => {
    if (!invoiceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email-logs`);
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setError(data.error || "Failed to load email history.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error fetching history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    let isMounted = true;
    const controller = new AbortController();

    fetch(`/api/invoices/${invoiceId}/email-logs`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
        } else {
          setError(data.error || "Failed to load email history.");
        }
      })
      .catch((err: unknown) => {
        if (!isMounted || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Network error fetching history.");
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, invoiceId]);

  if (!isOpen) return null;

  // Calculate unique recipients
  const uniqueRecipients = Array.from(
    new Set(
      logs
        .filter((l) => l.status === "sent")
        .map((l) => l.recipient_email.toLowerCase())
    )
  );

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100 shadow-2xs">
                <Mail className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Email history</h2>
            </div>
            <div className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
              <span>History for</span>
              <strong
                className="text-slate-800 whitespace-nowrap invoice-number-no-wrap font-mono font-bold"
                style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
              >
                {invoiceNumber}
              </strong>
              {grandTotal !== undefined && (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                  {formatCurrency(grandTotal)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={fetchFreshLogs}
              disabled={isLoading}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats banner if sent */}
        {logs.length > 0 && (
          <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-indigo-50/40 border-b border-indigo-100/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-900 gap-2.5">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4">
              <div className="bg-white/80 sm:bg-transparent p-2 sm:p-0 rounded-lg border border-indigo-100 sm:border-none">
                <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold block sm:inline">Total attempts: </span>
                <strong className="text-slate-900">{logs.length}</strong>
              </div>
              <div className="bg-white/80 sm:bg-transparent p-2 sm:p-0 rounded-lg border border-indigo-100 sm:border-none">
                <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold block sm:inline">Recipients: </span>
                <strong className="text-slate-900">{uniqueRecipients.length}</strong>
              </div>
            </div>
            {onOpenSendModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSendModal();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl sm:rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold sm:font-medium text-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send another email</span>
              </button>
            )}
          </div>
        )}

        {/* Body / List */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {logs.length === 0 ? (
            <div className="text-center py-10 sm:py-12 px-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-800">No emails dispatched yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No delivery records found for this invoice. You can send the invoice directly to one or more client recipients.
              </p>
              {onOpenSendModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSendModal();
                  }}
                  className="mt-4 sm:mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Invoice Now</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Mobile Card List View (< sm screens, e.g. 332px) */}
              <div className="sm:hidden space-y-2.5">
                {logs.map((log) => {
                  const isSuccess = log.status.toLowerCase() === "sent";
                  const isFailed = log.status.toLowerCase() === "failed";
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white space-y-2 shadow-2xs"
                    >
                      {/* Top: Date + Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-500">
                          {formatHistoryDate(log.created_at)}
                        </span>
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>SENT</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>FAILED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>{log.status.toUpperCase()}</span>
                          </span>
                        )}
                      </div>

                      {/* Recipient Chip */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] text-slate-400 flex-shrink-0">To:</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs truncate max-w-full block">
                          {log.recipient_email}
                        </span>
                      </div>

                      {/* Document info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                        <span className="font-medium text-slate-700">Invoice {invoiceNumber}</span>
                        <span className="text-slate-400">PDF attached</span>
                      </div>

                      {/* Failure message if failed */}
                      {isFailed && log.error_message && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tablet & Desktop Table (>= sm screens) */}
              <div className="hidden sm:block rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                <table className="w-full min-w-[560px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">Document</th>
                      <th className="py-3 px-4 min-w-[170px]">Recipients</th>
                      <th className="py-3 px-4 whitespace-nowrap">Type</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => {
                      const isSuccess = log.status.toLowerCase() === "sent";
                      const isFailed = log.status.toLowerCase() === "failed";
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                            {formatHistoryDate(log.created_at)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-900 font-semibold whitespace-nowrap">
                            Invoice {invoiceNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-xs">
                              {log.recipient_email}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              Invoice ⚡
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>SENT</span>
                              </span>
                            ) : isFailed ? (
                              <div className="inline-flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>FAILED</span>
                                </span>
                                {log.error_message && (
                                  <span className="text-[10px] text-rose-500 mt-0.5 max-w-[200px] truncate" title={log.error_message}>
                                    {log.error_message}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>{log.status.toUpperCase()}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 sm:px-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs text-slate-500">
          <div className="text-[11px] sm:text-xs text-center sm:text-left text-slate-500">
            Dispatched via secure server-side delivery with attached PDF.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold text-center transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
