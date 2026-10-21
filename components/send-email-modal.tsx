"use client";

import { useState } from "react";
import {
  X,
  Send,
  Loader2,
  FileText,
  Plus,
  CheckCircle2,
  AlertCircle,
  History,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/invoice-calculations";

export interface EmailLogBrief {
  id: string;
  recipient_email: string;
  status: string;
  created_at: string;
  error_message?: string | null;
}

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: number;
  businessName: string;
  customerName: string;
  customerEmail?: string | null;
  previousLogs?: EmailLogBrief[];
  onSuccess: (info: { sentRecipients: string[]; message: string }) => void;
  onViewHistory?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatShortDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function SendEmailModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  grandTotal,
  businessName,
  customerName,
  customerEmail,
  previousLogs = [],
  onSuccess,
  onViewHistory,
}: SendEmailModalProps) {
  const [recipients, setRecipients] = useState<string[]>(() => {
    if (customerEmail && EMAIL_REGEX.test(customerEmail.trim())) {
      return [customerEmail.trim()];
    }
    return [];
  });
  const [inputValue, setInputValue] = useState("");
  const [subject, setSubject] = useState(
    () => `Invoice ${invoiceNumber} from ${businessName || "Acme Studio Inc."}`
  );
  const [message, setMessage] = useState(
    () =>
      `Hi ${customerName || "there"},\n\nPlease find attached your invoice. Kindly review the details and arrange payment by the due date.\n\nThank you,\n${businessName || "Acme Studio Inc."}`
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleAddRecipient = (emailToAdd?: string) => {
    const target = (emailToAdd ?? inputValue).trim();
    if (!target) return;

    if (!EMAIL_REGEX.test(target)) {
      setInputError("Please enter a valid email address (e.g. name@company.com).");
      return;
    }

    const lower = target.toLowerCase();
    if (recipients.some((r) => r.toLowerCase() === lower)) {
      setInputError("This email address is already added.");
      return;
    }

    setRecipients((prev) => [...prev, target]);
    setInputValue("");
    setInputError(null);
    setSubmitError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      handleAddRecipient();
    }
  };

  const handleRemoveRecipient = (indexToRemove: number) => {
    setRecipients((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSend = async () => {
    // If user left text in the input box, try adding it first
    const currentRecipients = [...recipients];
    if (inputValue.trim()) {
      if (EMAIL_REGEX.test(inputValue.trim())) {
        const lower = inputValue.trim().toLowerCase();
        if (!currentRecipients.some((r) => r.toLowerCase() === lower)) {
          currentRecipients.push(inputValue.trim());
          setRecipients(currentRecipients);
          setInputValue("");
          setInputError(null);
        }
      } else {
        setInputError("Please enter a valid email address.");
        return;
      }
    }

    if (currentRecipients.length === 0) {
      setInputError("Please add at least one recipient email address.");
      return;
    }

    if (isSending) return; // Guard against double-clicks
    setIsSending(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: currentRecipients,
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess({
          sentRecipients: data.sentRecipients || currentRecipients,
          message: data.message || `Invoice dispatched to ${currentRecipients.length} recipient(s).`,
        });
        onClose();
      } else {
        setSubmitError(data.error || "Failed to dispatch email. Please try again.");
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Network error dispatching email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/60 gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Send Invoice</h2>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
              <span
                className="font-mono text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md whitespace-nowrap invoice-number-no-wrap"
                style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
              >
                {invoiceNumber}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Failed to send email</p>
                <p className="text-xs text-rose-700 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {/* 1. Recipient Email - Required */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                To <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Add one or more email addresses
              </span>
            </div>

            {/* Chip container & input */}
            <div className="min-h-[46px] p-1.5 rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 bg-white transition-all">
              <div className="flex flex-wrap items-center gap-1.5">
                {recipients.map((rec, idx) => (
                  <span
                    key={`${rec}-${idx}`}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium max-w-full"
                  >
                    <span className="truncate max-w-[200px]">{rec}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(idx)}
                      disabled={isSending}
                      className="p-0.5 rounded-full hover:bg-indigo-200 text-indigo-600 transition-colors flex-shrink-0 cursor-pointer"
                      title="Remove recipient"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}

                <input
                  type="email"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (inputValue.trim()) {
                      handleAddRecipient();
                    }
                  }}
                  placeholder={
                    recipients.length === 0
                      ? "Enter recipient email (e.g. accounts@client.io)"
                      : "+ Add another recipient..."
                  }
                  disabled={isSending}
                  className="flex-1 min-w-[140px] px-2 py-1 text-xs text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
                />

                {inputValue.trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddRecipient()}
                    className="px-2 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            </div>

            {inputError && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{inputError}</span>
              </p>
            )}
          </div>

          {/* 2. Email Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-slate-800 transition-all"
            />
          </div>

          {/* 3. Personal Message - Optional */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Personal Message <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              placeholder="Hi, please find attached your invoice..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-slate-800 transition-all resize-y leading-relaxed"
            />
          </div>

          {/* 4. Invoice Attachment Card */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white border border-slate-200 text-rose-600 flex items-center justify-center shadow-xs flex-shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 truncate">
                  Invoice-{invoiceNumber}.pdf
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">
                  PDF document · {formatCurrency(grandTotal)}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto flex-shrink-0 whitespace-nowrap">
              <Check className="w-3 h-3" />
              <span>Attached</span>
            </span>
          </div>

          {/* 5. Previous Email History (if any) */}
          {previousLogs && previousLogs.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Previous Emails
                </span>
                {onViewHistory && (
                  <button
                    type="button"
                    onClick={onViewHistory}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <History className="w-3 h-3" />
                    <span>View all history</span>
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {previousLogs.slice(0, 3).map((log) => {
                  const isSent = log.status.toLowerCase() === "sent";
                  return (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-slate-50 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate pr-2 min-w-0">
                        {isSent ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-700 truncate">
                          {log.recipient_email}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                        {isSent ? "Sent" : "Failed"} {formatShortDate(log.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Buttons */}
        <div className="p-3.5 sm:p-4 sm:px-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold text-center transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || (recipients.length === 0 && !inputValue.trim())}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all hover:shadow disabled:opacity-50 cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending Invoice...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Invoice</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
