"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  PlusCircle,
  FileText,
  Trash2,
  Edit,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Printer,
  Mail,
  History,
  TrendingUp,
  X,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import { formatCurrency } from "@/lib/invoice-calculations";
import { deleteInvoiceAction } from "@/app/actions/invoices";
import { ToastNotification, ToastData } from "./toast-notification";
import { SendEmailModal, EmailLogBrief } from "./send-email-modal";
import { EmailHistoryModal, EmailLogEntry } from "./email-history-modal";

interface InvoiceListItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  business_name: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  created_at: string;
  email_logs?: Array<{
    id: string;
    recipient_email: string;
    status: string;
    created_at: string;
    error_message?: string | null;
  }>;
}

interface InvoiceListProps {
  initialInvoices: InvoiceListItem[];
  initialSearch?: string;
  isTableMissing?: boolean;
}

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00");
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

function formatRelativeDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getInvoiceStatus(inv: InvoiceListItem): {
  label: "Draft" | "Ready";
  variant: "draft" | "ready";
} {
  const isReady =
    Boolean(inv.customer_name?.trim()) &&
    Number(inv.subtotal) > 0 &&
    Number(inv.discount_amount) <= Number(inv.subtotal);

  if (isReady) {
    return { label: "Ready", variant: "ready" };
  }

  return { label: "Draft", variant: "draft" };
}

function getEmailDeliveryStatus(inv: InvoiceListItem): {
  status: "not_sent" | "sent" | "partially_sent" | "failed";
  label: string;
  uniqueCount: number;
  lastDate?: string;
} {
  const logs = inv.email_logs || [];
  if (logs.length === 0) {
    return { status: "not_sent", label: "Not sent", uniqueCount: 0 };
  }

  const sentLogs = logs.filter((l) => l.status === "sent");
  const failedLogs = logs.filter((l) => l.status === "failed");

  // Deduplicate unique recipients
  const uniqueEmails = Array.from(
    new Set(
      sentLogs
        .map((l) => l.recipient_email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e))
    )
  );

  const uniqueCount = uniqueEmails.length > 0 ? uniqueEmails.length : sentLogs.length;
  const latestLog = logs[0]; // sorted descending

  if (sentLogs.length > 0 && failedLogs.length > 0 && uniqueCount > 0) {
    return {
      status: "partially_sent",
      label: `Partially sent · ${uniqueCount} recipient${uniqueCount === 1 ? "" : "s"}`,
      uniqueCount,
      lastDate: latestLog?.created_at,
    };
  }

  if (sentLogs.length > 0) {
    return {
      status: "sent",
      label: `Sent · ${uniqueCount} recipient${uniqueCount === 1 ? "" : "s"}`,
      uniqueCount,
      lastDate: latestLog?.created_at,
    };
  }

  if (failedLogs.length > 0) {
    return {
      status: "failed",
      label: "Failed",
      uniqueCount: 0,
      lastDate: latestLog?.created_at,
    };
  }

  return { status: "not_sent", label: "Not sent", uniqueCount: 0 };
}

export function InvoiceList({
  initialInvoices,
  initialSearch = "",
  isTableMissing = false,
}: InvoiceListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "sent" | "not_sent">("all");
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [sendModalInvoice, setSendModalInvoice] = useState<InvoiceListItem | null>(null);
  const [historyModalInvoice, setHistoryModalInvoice] = useState<InvoiceListItem | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Derived active invoices: directly mirrors fresh server props minus optimistically deleted items
  const activeInvoices = initialInvoices.filter(
    (inv) => !deletedIds.includes(inv.id)
  );

  // 3 Executive Metrics (Total Invoiced, Sent & Dispatched, Pending Dispatch)
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let sentAmount = 0;
    let sentCount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let readyCount = 0;

    activeInvoices.forEach((inv) => {
      const total = Number(inv.grand_total) || 0;
      totalInvoiced += total;

      const emailStatus = getEmailDeliveryStatus(inv);
      const invStatus = getInvoiceStatus(inv);

      if (invStatus.variant === "ready") {
        readyCount++;
      }

      if (emailStatus.status === "sent" || emailStatus.status === "partially_sent") {
        sentAmount += total;
        sentCount++;
      } else {
        pendingAmount += total;
        pendingCount++;
      }
    });

    return {
      totalInvoiced,
      totalCount: activeInvoices.length,
      sentAmount,
      sentCount,
      pendingAmount,
      pendingCount,
      readyCount,
      notSentCount: pendingCount,
    };
  }, [activeInvoices]);

  const handleEmailSent = (info: { sentRecipients: string[]; message: string }) => {
    setToast({
      type: "success",
      title: "Invoice dispatched successfully!",
      message: info.message,
      duration: 4000,
    });
    router.refresh();
  };

  // Automatically refresh server data whenever visiting the page or when window regains focus
  useEffect(() => {
    router.refresh();

    const handleFocus = () => {
      router.refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [router]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Combined client-side filter (Search + Status Filter)
  const filtered = useMemo(() => {
    return activeInvoices.filter((inv) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.customer_name.toLowerCase().includes(q) ||
          inv.business_name.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (statusFilter === "all") return true;

      const invStatus = getInvoiceStatus(inv);
      const emailStatus = getEmailDeliveryStatus(inv);

      if (statusFilter === "ready") {
        return invStatus.variant === "ready";
      }
      if (statusFilter === "sent") {
        return emailStatus.status === "sent" || emailStatus.status === "partially_sent";
      }
      if (statusFilter === "not_sent") {
        return emailStatus.status === "not_sent" || emailStatus.status === "failed";
      }

      return true;
    });
  }, [activeInvoices, search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    const targetToDelete = deleteTarget;

    startDeleteTransition(async () => {
      const res = await deleteInvoiceAction(targetToDelete.id);
      if (res.success) {
        setDeletedIds((prev) => [...prev, targetToDelete.id]);
        setDeleteTarget(null);
        setToast({
          type: "success",
          title: "Invoice deleted successfully!",
          message: `Invoice ${targetToDelete.invoice_number} has been deleted.`,
        });
        router.refresh();
      } else {
        setDeleteError(res.error || "Failed to delete invoice");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Smooth Animated Toast Notification (Top Right) */}
      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      {/* Table Missing Banner */}
      {isTableMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-amber-950">
                Database Tables Missing (Migrations Needed)
              </h4>
              <p className="text-sm text-amber-800">
                Supabase database mein <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">invoices</code> table abhi create nahi hui hai.
                Aap terminal mein Supabase CLI se migration push kar sakte hain:
              </p>
              <div className="mt-2 bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                <code>npx supabase link --project-ref viswaejormtxjssvmaka<br />npx supabase db push</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total Invoiced */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Invoiced
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(metrics.totalInvoiced)}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              {metrics.totalCount} {metrics.totalCount === 1 ? "invoice" : "invoices"} generated
            </p>
          </div>
          <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs flex-shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card 2: Sent / Dispatched */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Sent & Dispatched
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(metrics.sentAmount)}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              {metrics.sentCount} {metrics.sentCount === 1 ? "invoice" : "invoices"} dispatched
            </p>
          </div>
          <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-xs flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card 3: Pending Dispatch */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-600">
              Pending Dispatch
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(metrics.pendingAmount)}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              {metrics.pendingCount} {metrics.pendingCount === 1 ? "invoice" : "invoices"} not sent
            </p>
          </div>
          <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-xs flex-shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Controls Bar: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto flex-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer flex-shrink-0 ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "all"
                  ? "bg-slate-100 text-slate-800 font-bold"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {metrics.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ready")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer flex-shrink-0 ${
              statusFilter === "ready"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Ready</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "ready"
                  ? "bg-emerald-50 text-emerald-700 font-bold"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {metrics.readyCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("sent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer flex-shrink-0 ${
              statusFilter === "sent"
                ? "bg-white text-indigo-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Sent</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "sent"
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {metrics.sentCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("not_sent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer flex-shrink-0 ${
              statusFilter === "not_sent"
                ? "bg-white text-amber-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Not sent</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "not_sent"
                  ? "bg-amber-50 text-amber-700 font-bold"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              {metrics.notSentCount}
            </span>
          </button>
        </div>

        {/* Search & Refresh & Mobile View Switcher */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
          {/* Mobile View Switcher (Table vs Cards on < sm viewports) */}
          <div className="flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded-xl border border-slate-200 sm:hidden flex-shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Table View (Full Columns)"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Cards View (Compact)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh invoices list"
            className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer flex-shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Invoices List / Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {search || statusFilter !== "all"
              ? "No matching invoices found"
              : "No invoices created yet"}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            {search || statusFilter !== "all"
              ? "Try adjusting your search query or switching the status filter tab."
              : "Create your first professional invoice with line items, tax, discounts, live preview and PDF export."}
          </p>
          {!search && statusFilter === "all" && (
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Invoice</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Mobile Card List View (< sm screens, visible when Cards mode is selected) */}
          {viewMode === "cards" && (
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map((inv) => {
                const invoiceStatus = getInvoiceStatus(inv);
                const emailStatus = getEmailDeliveryStatus(inv);

                return (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-3"
                  >
                    {/* Top: Invoice # + Invoice Status + Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center gap-1.5 font-bold text-indigo-600 font-mono text-sm whitespace-nowrap invoice-number-no-wrap"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span
                            className="whitespace-nowrap font-mono font-bold invoice-number-no-wrap"
                            style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
                          >
                            {inv.invoice_number}
                          </span>
                        </div>
                        {invoiceStatus.variant === "ready" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span>Draft</span>
                          </span>
                        )}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-base">
                          {formatCurrency(inv.grand_total)}
                        </div>
                        {inv.discount_amount > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            -${inv.discount_amount.toFixed(2)} disc.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Customer & Due Date */}
                    <div className="flex items-center justify-between text-xs text-slate-600 gap-2">
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 block truncate">
                          {inv.customer_name}
                        </span>
                        {inv.customer_email && (
                          <span className="text-[11px] text-slate-400 block truncate">
                            {inv.customer_email}
                          </span>
                        )}
                      </div>
                      <div className="text-right whitespace-nowrap text-[11px] flex-shrink-0">
                        <span className="text-slate-400">Due: </span>
                        <span className="font-medium text-slate-700">{formatDateDisplay(inv.due_date)}</span>
                      </div>
                    </div>

                    {/* Bottom: Email Status Pill + Action Buttons */}
                    <div
                      className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div>
                        {emailStatus.status === "sent" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap cursor-pointer"
                            title="Click to view email delivery history"
                          >
                            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                            <span>{emailStatus.label}</span>
                          </button>
                        ) : emailStatus.status === "partially_sent" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap cursor-pointer"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>{emailStatus.label}</span>
                          </button>
                        ) : emailStatus.status === "failed" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Failed</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSendModalInvoice(inv);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Not sent</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSendModalInvoice(inv);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Send Invoice Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryModalInvoice(inv);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="View Email History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/invoices/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit Invoice"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/invoices/${inv.id}?print=1`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Print or Save PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(inv);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop, Tablet & Mobile Table (Full horizontally scrollable table) */}
          <div className={`${viewMode === "table" ? "block" : "hidden sm:block"} overflow-x-auto`}>
            <table className="w-full min-w-[960px] text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th
                    className="py-3.5 px-4 whitespace-nowrap invoice-number-no-wrap min-w-[160px] w-[160px]"
                    style={{ whiteSpace: "nowrap", minWidth: "160px", width: "160px" }}
                  >
                    <span className="whitespace-nowrap invoice-number-no-wrap" style={{ whiteSpace: "nowrap" }}>
                      Invoice #
                    </span>
                  </th>
                  <th className="py-3.5 px-4 min-w-[160px]">Customer</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[105px]">Issue Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap min-w-[105px]">Due Date</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[110px]">Amount</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap min-w-[100px]">Invoice Status</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap min-w-[150px]">Email Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((inv) => {
                  const invoiceStatus = getInvoiceStatus(inv);
                  const emailStatus = getEmailDeliveryStatus(inv);

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <td
                        className="py-3.5 px-4 font-semibold text-indigo-600 whitespace-nowrap invoice-number-no-wrap min-w-[160px] w-[160px]"
                        style={{ whiteSpace: "nowrap", minWidth: "160px", width: "160px" }}
                      >
                        <div
                          className="flex items-center gap-1.5 group-hover:underline whitespace-nowrap invoice-number-no-wrap font-mono"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                          <span
                            className="whitespace-nowrap font-mono font-semibold invoice-number-no-wrap"
                            style={{ whiteSpace: "nowrap", wordBreak: "keep-all", overflowWrap: "normal" }}
                          >
                            {inv.invoice_number}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="truncate max-w-[200px]">{inv.customer_name}</div>
                        {inv.customer_email && (
                          <div className="text-xs text-slate-400 font-normal truncate max-w-[200px]">
                            {inv.customer_email}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                        {formatDateDisplay(inv.issue_date)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                        {formatDateDisplay(inv.due_date)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        <div>{formatCurrency(inv.grand_total)}</div>
                        {inv.discount_amount > 0 && (
                          <div className="text-xs font-normal text-emerald-600 text-right">
                            -${inv.discount_amount.toFixed(2)} disc.
                          </div>
                        )}
                      </td>

                      {/* Invoice Status (Ready / Draft) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {invoiceStatus.variant === "ready" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Draft</span>
                          </span>
                        )}
                      </td>

                      {/* Email Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {emailStatus.status === "sent" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="group/badge inline-flex flex-col items-center cursor-pointer whitespace-nowrap"
                            title="Click to view complete email history"
                          >
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 group-hover/badge:bg-indigo-100 transition-colors whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 text-indigo-600 flex-shrink-0" />
                              <span className="whitespace-nowrap">{emailStatus.label}</span>
                            </span>
                            {emailStatus.lastDate && (
                              <span className="text-[10px] text-slate-400 mt-0.5 group-hover/badge:text-slate-600 whitespace-nowrap">
                                Last sent {formatRelativeDate(emailStatus.lastDate)}
                              </span>
                            )}
                          </button>
                        ) : emailStatus.status === "partially_sent" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="group/badge inline-flex flex-col items-center cursor-pointer whitespace-nowrap"
                            title="Click to view partial delivery details"
                          >
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 group-hover/badge:bg-amber-100 transition-colors whitespace-nowrap">
                              <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                              <span className="whitespace-nowrap">{emailStatus.label}</span>
                            </span>
                            {emailStatus.lastDate && (
                              <span className="text-[10px] text-slate-400 mt-0.5 group-hover/badge:text-slate-600 whitespace-nowrap">
                                Last sent {formatRelativeDate(emailStatus.lastDate)}
                              </span>
                            )}
                          </button>
                        ) : emailStatus.status === "failed" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="group/badge inline-flex flex-col items-center cursor-pointer whitespace-nowrap"
                            title="Click to view failure details"
                          >
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 group-hover/badge:bg-rose-100 transition-colors whitespace-nowrap">
                              <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                              <span>Failed</span>
                            </span>
                            {emailStatus.lastDate && (
                              <span className="text-[10px] text-rose-500 mt-0.5 whitespace-nowrap">
                                Failed {formatRelativeDate(emailStatus.lastDate)}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSendModalInvoice(inv);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                            title="Click to dispatch email"
                          >
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Not sent</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSendModalInvoice(inv);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Send Invoice Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalInvoice(inv);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="View Email History"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/invoices/${inv.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/invoices/${inv.id}?print=1`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Print or Save PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(inv);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {sendModalInvoice && (
        <SendEmailModal
          isOpen={Boolean(sendModalInvoice)}
          onClose={() => setSendModalInvoice(null)}
          invoiceId={sendModalInvoice.id}
          invoiceNumber={sendModalInvoice.invoice_number}
          grandTotal={sendModalInvoice.grand_total}
          businessName={sendModalInvoice.business_name}
          customerName={sendModalInvoice.customer_name}
          customerEmail={sendModalInvoice.customer_email}
          previousLogs={sendModalInvoice.email_logs?.map((l): EmailLogBrief => ({
            id: l.id,
            recipient_email: l.recipient_email || "",
            status: l.status,
            created_at: l.created_at,
            error_message: l.error_message,
          }))}
          onSuccess={handleEmailSent}
          onViewHistory={() => {
            const current = sendModalInvoice;
            setSendModalInvoice(null);
            setHistoryModalInvoice(current);
          }}
        />
      )}

      {/* Email History Modal */}
      {historyModalInvoice && (
        <EmailHistoryModal
          isOpen={Boolean(historyModalInvoice)}
          onClose={() => setHistoryModalInvoice(null)}
          invoiceId={historyModalInvoice.id}
          invoiceNumber={historyModalInvoice.invoice_number}
          grandTotal={historyModalInvoice.grand_total}
          initialLogs={historyModalInvoice.email_logs?.map((l): EmailLogEntry => ({
            id: l.id,
            invoice_id: historyModalInvoice.id,
            recipient_email: l.recipient_email || "",
            status: l.status,
            provider_message_id: null,
            error_message: l.error_message || null,
            created_at: l.created_at,
          }))}
          onOpenSendModal={() => {
            const current = historyModalInvoice;
            setHistoryModalInvoice(null);
            setSendModalInvoice(current);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Delete Invoice Confirmation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This action cannot be undone. Please confirm below.
                </p>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Info Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span
                  className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap invoice-number-no-wrap"
                  style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
                >
                  {deleteTarget.invoice_number}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">
                  {deleteTarget.customer_name || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-bold text-indigo-700">
                  {formatCurrency(deleteTarget.grand_total)}
                </span>
              </div>
            </div>

            <div className="text-xs text-rose-700 leading-relaxed bg-rose-50/70 p-3 rounded-xl border border-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>
                Are you sure you want to permanently delete invoice{" "}
                <strong
                  className="whitespace-nowrap font-mono invoice-number-no-wrap"
                  style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
                >
                  {deleteTarget.invoice_number}
                </strong>
                ? All line items and associated email logs will be permanently deleted.
              </span>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel, Keep Invoice
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Invoice...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
