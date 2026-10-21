"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Printer,
  Mail,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Lock,
  History,
  MoreHorizontal,
} from "lucide-react";
import { InvoiceFormData, CustomField, InvoiceItem } from "@/lib/schemas";
import {
  calculateInvoiceTotals,
  CalculatedInvoiceTotals,
} from "@/lib/invoice-calculations";
import {
  saveInvoiceAction,
  deleteInvoiceAction,
} from "@/app/actions/invoices";
import { InvoicePreview } from "./invoice-preview";
import { ToastNotification, ToastData } from "./toast-notification";
import { SendEmailModal } from "./send-email-modal";
import { EmailHistoryModal } from "./email-history-modal";

interface InvoiceEditorProps {
  initialData: InvoiceFormData;
  isEditMode?: boolean;
}

export function InvoiceEditor({
  initialData,
  isEditMode: initialEditMode = false,
}: InvoiceEditorProps) {
  const router = useRouter();

  // Mode: is it saved (existing) or brand new?
  const [isSavedMode, setIsSavedMode] = useState<boolean>(
    initialEditMode || Boolean(initialData.id)
  );
  const [formData, setFormData] = useState<InvoiceFormData>(initialData);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() =>
    JSON.stringify(initialData)
  );

  // Floating Toast notification state (Single source of feedback, managed with smooth fade-out)
  const [toast, setToast] = useState<ToastData | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Unsaved changes tracker relative to last saved state
  const isDirty = useMemo(() => {
    if (!isSavedMode) return false;
    return JSON.stringify(formData) !== lastSavedSnapshot;
  }, [formData, lastSavedSnapshot, isSavedMode]);

  // Email Modals State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEmailHistoryModal, setShowEmailHistoryModal] = useState(false);

  // Dropdown Menu & Mobile View State
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<"form" | "preview">("form");

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#more-actions-menu") && !target.closest("#more-actions-btn")) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMoreMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMoreMenu]);

  const handleEmailSent = (info: { sentRecipients: string[]; message: string }) => {
    setToast({
      type: "success",
      title: "Invoice email sent successfully!",
      message: info.message,
      duration: 4000,
    });
    router.refresh();
  };

  const rawSubtotal = useMemo(() => {
    return formData.items.reduce((sum, it) => {
      const q = Math.max(0, Number(it.quantity) || 0);
      const p = Math.max(0, Number(it.unit_price) || 0);
      return sum + Math.round(q * p * 100) / 100;
    }, 0);
  }, [formData.items]);

  const discountError = useMemo(() => {
    const disc = Number(formData.discount_amount);
    if (disc < 0) return "Discount cannot be negative.";
    if (disc > rawSubtotal) {
      return `Discount ($${disc.toFixed(2)}) cannot exceed subtotal ($${rawSubtotal.toFixed(2)}).`;
    }
    return null;
  }, [formData.discount_amount, rawSubtotal]);

  const taxRateError = useMemo(() => {
    const rate = Number(formData.tax_rate);
    if (rate < 0) return "Tax rate cannot be negative.";
    if (rate > 100) return "Tax rate cannot exceed 100%.";
    return null;
  }, [formData.tax_rate]);

  // Dynamic Live Financial Recalculation (Never clamp invalid discounts silently)
  const calculatedTotals: CalculatedInvoiceTotals = useMemo(() => {
    const rawDiscount = Number(formData.discount_amount);
    const rawTaxRate = Number(formData.tax_rate);

    // If explicit validation error detected on discount or tax, surface invalid state immediately
    if (discountError || taxRateError) {
      return {
        items: formData.items.map((it, idx) => {
          const q = Math.max(0, Number(it.quantity) || 0);
          const p = Math.max(0, Number(it.unit_price) || 0);
          return {
            description: it.description,
            quantity: q,
            unit_price: p,
            line_total: Math.round(q * p * 100) / 100,
            position: idx,
          };
        }),
        subtotal: rawSubtotal,
        discount_amount: isNaN(rawDiscount) ? 0 : rawDiscount,
        taxable_amount: 0,
        tax_rate: isNaN(rawTaxRate) ? 0 : rawTaxRate,
        tax_amount: 0,
        grand_total: 0,
        isInvalid: true,
        errorMessage: discountError || taxRateError || "Invalid financial calculation parameters.",
      };
    }

    try {
      return calculateInvoiceTotals({
        items: formData.items,
        discount_amount: formData.discount_amount,
        tax_rate: formData.tax_rate,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Financial calculation error.";
      return {
        items: formData.items.map((it, idx) => ({
          description: it.description,
          quantity: Math.max(0, Number(it.quantity) || 0),
          unit_price: Math.max(0, Number(it.unit_price) || 0),
          line_total: Math.round(Math.max(0, Number(it.quantity) || 0) * Math.max(0, Number(it.unit_price) || 0) * 100) / 100,
          position: idx,
        })),
        subtotal: rawSubtotal,
        discount_amount: isNaN(rawDiscount) ? 0 : rawDiscount,
        taxable_amount: 0,
        tax_rate: isNaN(rawTaxRate) ? 0 : rawTaxRate,
        tax_amount: 0,
        grand_total: 0,
        isInvalid: true,
        errorMessage: errorMsg,
      };
    }
  }, [formData.items, formData.discount_amount, formData.tax_rate, rawSubtotal, discountError, taxRateError]);

  // Comprehensive Invoice Validation Issues Checklist
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!formData.invoice_number?.trim()) {
      issues.push("Invoice number is required.");
    }
    if (!formData.business_name?.trim()) {
      issues.push("Business name is required.");
    }
    if (!formData.customer_name?.trim()) {
      issues.push("Customer name is required.");
    }
    if (formData.issue_date && formData.due_date && formData.due_date < formData.issue_date) {
      issues.push("Due date cannot be earlier than issue date.");
    }
    if (discountError) {
      issues.push(discountError);
    }
    if (taxRateError) {
      issues.push(taxRateError);
    }
    if (!formData.items || formData.items.length === 0) {
      issues.push("At least one line item is required.");
    } else {
      formData.items.forEach((it, idx) => {
        if (!it.description?.trim()) {
          issues.push(`Line item ${idx + 1}: Description is required.`);
        }
        if (Number(it.quantity) <= 0) {
          issues.push(`Line item ${idx + 1}: Quantity must be greater than zero.`);
        }
        if (Number(it.unit_price) < 0) {
          issues.push(`Line item ${idx + 1}: Unit price cannot be negative.`);
        }
      });
    }
    if (calculatedTotals.isInvalid && calculatedTotals.errorMessage) {
      if (!issues.includes(calculatedTotals.errorMessage)) {
        issues.push(calculatedTotals.errorMessage);
      }
    }
    return issues;
  }, [formData, discountError, taxRateError, calculatedTotals.isInvalid, calculatedTotals.errorMessage]);

  const isInvoiceValid = validationIssues.length === 0;
  const primaryValidationError = validationIssues[0] || null;

  // Field change handlers
  const updateField = <K extends keyof InvoiceFormData>(
    field: K,
    value: InvoiceFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // Line item handlers
  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          quantity: 1,
          unit_price: 0,
          position: prev.items.length,
        },
      ],
    }));
  };

  const updateItem = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number | undefined
  ) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) {
      setGlobalError("Invoice must have at least one line item.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Custom field handlers
  const addCustomFieldWithPreset = (presetLabel?: string, presetValue?: string) => {
    const existingLabels = formData.custom_fields.map((f) => f.label.trim().toLowerCase());
    let defaultLabel = presetLabel || "Payment Method";
    if (!presetLabel) {
      if (!existingLabels.includes("po number")) defaultLabel = "PO Number";
      else if (!existingLabels.includes("project code")) defaultLabel = "Project Code";
      else if (!existingLabels.includes("payment method")) defaultLabel = "Payment Method";
      else defaultLabel = "Contract Ref";
    }

    const newField: CustomField = {
      id: `cf-${Date.now()}`,
      label: defaultLabel,
      value: presetValue || "",
      isVisible: true,
    };
    setFormData((prev) => ({
      ...prev,
      custom_fields: [...prev.custom_fields, newField],
    }));
  };

  const addCustomField = () => addCustomFieldWithPreset();

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setFormData((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  };

  const removeCustomField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((f) => f.id !== id),
    }));
  };

  // Save / Update Handler
  const handleSave = () => {
    setGlobalError(null);
    setErrors({});

    if (!isInvoiceValid) {
      const err = primaryValidationError || "Please fix the highlighted errors.";
      setGlobalError(err);
      setToast({
        type: "error",
        title: "Please fix the highlighted errors.",
        message: err,
        duration: 5000,
      });
      return;
    }

    startSaveTransition(async () => {
      const res = await saveInvoiceAction(formData);
      if (res.success && res.data) {
        const savedId = res.data.id;
        const updatedData: InvoiceFormData = {
          ...formData,
          id: savedId,
        };

        const wasNew = !isSavedMode;
        setFormData(updatedData);
        setIsSavedMode(true);
        setLastSavedSnapshot(JSON.stringify(updatedData));

        // Update browser URL silently without page reload or unmounting editor
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/invoices/${savedId}`);
        }

        // Single Source of Success Feedback (Toast only, 3s duration)
        setToast({
          type: "success",
          title: wasNew ? "Invoice created successfully!" : "Invoice updated successfully!",
          message: wasNew
            ? `Invoice ${formData.invoice_number} created successfully.`
            : `Invoice ${formData.invoice_number} updated successfully.`,
          duration: 3000,
        });
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        const errMsg = res.error || "Unable to save invoice. Please try again.";
        setGlobalError(errMsg);
        setToast({
          type: "error",
          title: "Unable to save invoice. Please try again.",
          message: errMsg,
          duration: 5000,
        });
      }
    });
  };

  // Delete Handler
  const handleDelete = () => {
    if (!formData.id) return;
    startDeleteTransition(async () => {
      const res = await deleteInvoiceAction(formData.id!);
      if (res.success) {
        router.push("/invoices");
      } else {
        setGlobalError(res.error || "Failed to delete invoice");
        setShowDeleteModal(false);
      }
    });
  };

  // Print Handler
  const handlePrint = () => {
    if (!isInvoiceValid) {
      setGlobalError(
        `Cannot print or save PDF: ${primaryValidationError || "Invoice contains validation errors."}`
      );
      return;
    }
    window.print();
  };

  // Automatically trigger print dialog if requested via ?print=1 from invoice listing
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("print=1")) {
      if (isInvoiceValid) {
        const timer = setTimeout(() => {
          window.print();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isInvoiceValid]);

  // Intercept Ctrl+P / Cmd+P to block printing invalid invoices via keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        if (!isInvoiceValid) {
          e.preventDefault();
          setGlobalError(
            `Print / PDF blocked: ${primaryValidationError || "Invoice contains validation errors."}`
          );
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInvoiceValid, primaryValidationError]);



  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6">
      {/* Smooth Animated Toast Notification (Top Right) */}
      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      {/* Sticky Action Bar (Directly below sticky header) */}
      <div className="no-print sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 -mx-2.5 sm:-mx-6 lg:-mx-8 px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3 mb-4 sm:mb-6 transition-all shadow-xs">
        <div className="flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left: Back Arrow + Invoice Number + Status Badge */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            <Link
              href="/invoices"
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
              title="Back to Invoices"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span
                className="font-mono font-bold text-slate-900 text-xs sm:text-base lg:text-lg tracking-tight whitespace-nowrap invoice-number-no-wrap flex-shrink-0"
                style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
              >
                {formData.invoice_number}
              </span>

              {/* Dynamic Status Indicator */}
              {!isSavedMode ? (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap flex-shrink-0">
                  Draft
                </span>
              ) : isDirty ? (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="hidden sm:inline">Unsaved</span>
                  <span className="sm:hidden">Edit</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Saved</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions Grouping */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Tablet Tab Switcher (Form vs Preview on sm..lg) */}
            <div className="hidden sm:flex lg:hidden items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveMobileTab("form")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer text-xs ${
                  activeMobileTab === "form"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setActiveMobileTab("preview")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer text-xs ${
                  activeMobileTab === "preview"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Preview
              </button>
            </div>

          {/* Secondary Outline: Print / Save as PDF (Shown on md+ tablets & desktop) */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={!isInvoiceValid}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer ${
              !isInvoiceValid
                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            }`}
            title={
              !isInvoiceValid
                ? `Printing blocked: ${primaryValidationError}`
                : "Open browser print dialog to print or save as PDF"
            }
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print / PDF</span>
          </button>

          {/* Secondary Outline: Send Email (Shown on md+ tablets & desktop) */}
          <button
            type="button"
            onClick={() => {
              if (!isSavedMode || !formData.id) {
                setToast({
                  type: "error",
                  title: "Action Blocked",
                  message: "Please save the invoice before sending an email.",
                });
                return;
              }
              if (!isInvoiceValid) {
                setGlobalError(`Cannot send email: ${primaryValidationError}`);
                return;
              }
              setShowEmailModal(true);
            }}
            disabled={!isInvoiceValid || !isSavedMode}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer ${
              !isInvoiceValid || !isSavedMode
                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            }`}
            title={
              !isSavedMode
                ? "Please save invoice before sending email"
                : !isInvoiceValid
                ? `Sending email blocked: ${primaryValidationError}`
                : "Send invoice via email"
            }
          >
            <Mail className="w-4 h-4 text-slate-500" />
            <span>Send Email</span>
          </button>

          {/* Primary Filled Indigo: Save Changes / Save Invoice */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isInvoiceValid || isSaving}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer ${
              !isInvoiceValid || isSaving
                ? "bg-indigo-400 cursor-not-allowed opacity-60"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow"
            }`}
            title={
              !isInvoiceValid
                ? `Save blocked: ${primaryValidationError}`
                : isSavedMode
                ? "Save Changes"
                : "Save Invoice"
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{isSavedMode ? "Save" : "Create"}</span>
              </>
            )}
          </button>

          {/* More Actions Dropdown (⋯ More) */}
          <div className="relative">
            <button
              id="more-actions-btn"
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
              title="More Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div
                id="more-actions-menu"
                className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Send Email inside dropdown for mobile & small tablets */}
                <button
                  type="button"
                  disabled={!isInvoiceValid || !isSavedMode}
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (!isSavedMode || !formData.id) {
                      setToast({
                        type: "error",
                        title: "Action Blocked",
                        message: "Please save the invoice before sending an email.",
                      });
                      return;
                    }
                    if (!isInvoiceValid) {
                      setGlobalError(`Cannot send email: ${primaryValidationError}`);
                      return;
                    }
                    setShowEmailModal(true);
                  }}
                  className="md:hidden w-full text-left px-3.5 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>Send Email</span>
                </button>

                {/* Print button inside dropdown for mobile & small tablets */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    handlePrint();
                  }}
                  disabled={!isInvoiceValid}
                  className="md:hidden w-full text-left px-3.5 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-400" />
                  <span>Print / PDF</span>
                </button>

                <button
                  type="button"
                  disabled={!isSavedMode || !formData.id}
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowEmailHistoryModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Email History</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  type="button"
                  disabled={!isSavedMode || !formData.id}
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Delete Invoice</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher on < sm viewports (e.g. 332px) */}
        <div className="sm:hidden flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200 mt-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveMobileTab("form")}
            className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center ${
              activeMobileTab === "form"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Form Details
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab("preview")}
            className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer text-center ${
              activeMobileTab === "preview"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Live Preview
          </button>
        </div>
      </div>

      {/* Feedback Alerts - Hidden on Print */}
      {globalError && (
        <div className="no-print mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Form on Left (7 cols), Sticky Preview on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full min-w-0 max-w-full">
        {/* Left: Form Editor (no-print) */}
        <div
          className={`no-print lg:col-span-7 space-y-6 w-full min-w-0 ${
            activeMobileTab === "form" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Card 1: Invoice Numbers & Dates */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex-shrink-0">
                1
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Invoice Details & Dates
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={formData.invoice_number || "Generating..."}
                    className="w-full px-3 py-2 pr-9 text-sm font-semibold font-mono text-slate-800 bg-slate-100 border border-slate-300 rounded-lg cursor-not-allowed select-all focus:outline-none whitespace-nowrap invoice-number-no-wrap"
                    style={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
                    title="Auto-generated unique invoice number (read-only)"
                  />
                  <div
                    className="absolute right-3 flex items-center pointer-events-none text-slate-400"
                    title="Auto-generated & Locked"
                  >
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Automatically generated by the system.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issue Date *
                </label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => updateField("issue_date", e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    errors.issue_date ? "border-rose-400 bg-rose-50/50" : "border-slate-300"
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                {errors.issue_date && (
                  <p className="text-xs text-rose-600 mt-1">{errors.issue_date}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => updateField("due_date", e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    errors.due_date ? "border-rose-400 bg-rose-50/50" : "border-slate-300"
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                {errors.due_date && (
                  <p className="text-xs text-rose-600 mt-1">{errors.due_date}</p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Business & Customer Information */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex-shrink-0">
                2
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Business & Customer Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Business Information */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Your Business
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => updateField("business_name", e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      errors.business_name ? "border-rose-400 bg-rose-50/50" : "border-slate-300"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  {errors.business_name && (
                    <p className="text-xs text-rose-600 mt-1">{errors.business_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={formData.business_email || ""}
                    onChange={(e) => updateField("business_email", e.target.value)}
                    placeholder="billing@acme.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Address
                  </label>
                  <textarea
                    rows={2}
                    value={formData.business_address || ""}
                    onChange={(e) => updateField("business_address", e.target.value)}
                    placeholder="Street, City, State, ZIP"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Bill To (Customer)
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => updateField("customer_name", e.target.value)}
                    placeholder="e.g. Globex Corp"
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      errors.customer_name ? "border-rose-400 bg-rose-50/50" : "border-slate-300"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  {errors.customer_name && (
                    <p className="text-xs text-rose-600 mt-1">{errors.customer_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={formData.customer_email || ""}
                    onChange={(e) => updateField("customer_email", e.target.value)}
                    placeholder="ap@globex.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Address
                  </label>
                  <textarea
                    rows={2}
                    value={formData.customer_address || ""}
                    onChange={(e) => updateField("customer_address", e.target.value)}
                    placeholder="Street, City, State, ZIP"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Line Items & Calculations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex-shrink-0">
                  3
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Line Items & Calculations
                </h3>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, index) => {
                const calculatedItem = calculatedTotals.items[index];
                const lineTotal = calculatedItem?.line_total || 0;

                return (
                  <div
                    key={index}
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center"
                  >
                    <div className="w-full sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Description of item or service *"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:contents">
                      <div className="flex items-center gap-2 sm:contents">
                        <div className="w-20 sm:w-auto sm:col-span-2">
                          <label className="block text-[10px] uppercase font-semibold text-slate-400 sm:hidden mb-0.5">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            onKeyDown={(e) => {
                              if (e.key === "-") e.preventDefault();
                            }}
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                            }
                            className={`w-full px-2.5 py-1.5 text-sm rounded-lg border ${
                              Number(item.quantity) <= 0
                                ? "border-rose-400 bg-rose-50/50"
                                : "border-slate-300 bg-white"
                            } text-center focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          />
                        </div>

                        <div className="w-24 sm:w-auto sm:col-span-2">
                          <label className="block text-[10px] uppercase font-semibold text-slate-400 sm:hidden mb-0.5">
                            Price ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            onKeyDown={(e) => {
                              if (e.key === "-") e.preventDefault();
                            }}
                            placeholder="Price"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                            }
                            className={`w-full px-2.5 py-1.5 text-sm rounded-lg border ${
                              Number(item.unit_price) < 0
                                ? "border-rose-400 bg-rose-50/50"
                                : "border-slate-300 bg-white"
                            } text-right focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 sm:contents pt-3.5 sm:pt-0">
                        <div className="sm:col-span-1 text-right font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                          ${lineTotal.toFixed(2)}
                        </div>

                        <div className="sm:col-span-1 text-right flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {errors.items && (
              <p className="text-xs text-rose-600 mt-1">{errors.items}</p>
            )}

            {/* Financial Adjustments (Discount & Tax) inside section 3 */}
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                Discounts & Taxes
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fixed Discount Amount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    onKeyDown={(e) => {
                      if (e.key === "-") e.preventDefault();
                    }}
                    value={formData.discount_amount}
                    onChange={(e) =>
                      updateField("discount_amount", parseFloat(e.target.value) || 0)
                    }
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      discountError ? "border-rose-400 bg-rose-50/50" : "border-slate-300"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  {discountError ? (
                    <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{discountError}</span>
                    </p>
                  ) : (
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Deducted directly from the subtotal before tax.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    onKeyDown={(e) => {
                      if (e.key === "-") e.preventDefault();
                    }}
                    value={formData.tax_rate}
                    onChange={(e) =>
                      updateField("tax_rate", parseFloat(e.target.value) || 0)
                    }
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      taxRateError ? "border-rose-400 bg-rose-50/50" : "border-slate-300"
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  {taxRateError ? (
                    <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{taxRateError}</span>
                    </p>
                  ) : (
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Calculated on discounted subtotal.
                    </span>
                  )}
                </div>
              </div>

              {/* Live Calculation Summary Bar */}
              {calculatedTotals.isInvalid ? (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-rose-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Calculation Blocked: {calculatedTotals.errorMessage}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-600 font-semibold">
                      Subtotal: ${calculatedTotals.subtotal.toFixed(2)}
                    </span>
                    <span className="font-bold text-rose-700 bg-rose-100/90 px-2.5 py-1 rounded-md border border-rose-300">
                      Grand Total: Invalid
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono text-slate-700">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-slate-500 whitespace-nowrap">
                      Subtotal: <strong className="text-slate-900">${calculatedTotals.subtotal.toFixed(2)}</strong>
                    </span>
                    {calculatedTotals.discount_amount > 0 && (
                      <span className="text-emerald-700 whitespace-nowrap">
                        Discount: <strong>-${calculatedTotals.discount_amount.toFixed(2)}</strong>
                      </span>
                    )}
                    <span className="text-slate-500 whitespace-nowrap">
                      Taxable: <strong className="text-slate-900">${calculatedTotals.taxable_amount.toFixed(2)}</strong>
                    </span>
                    <span className="text-slate-500 whitespace-nowrap">
                      Tax ({calculatedTotals.tax_rate}%): <strong className="text-slate-900">${calculatedTotals.tax_amount.toFixed(2)}</strong>
                    </span>
                  </div>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 whitespace-nowrap ml-auto">
                    Grand Total: ${calculatedTotals.grand_total.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Custom Fields */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 md:p-6 shadow-xs space-y-3.5 sm:space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex-shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Custom Fields
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    Add custom metadata (e.g. PO #, Project Code, Payment Method). Toggle visibility to hide on preview/print.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addCustomField}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 border border-indigo-100 sm:border-transparent transition-colors flex-shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            {/* Preset Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-medium">Quick Presets:</span>
              <button
                type="button"
                onClick={() => addCustomFieldWithPreset("PO Number", "PO-84920")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                + PO Number
              </button>
              <button
                type="button"
                onClick={() => addCustomFieldWithPreset("Project Code", "WEB-2026")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                + Project Code
              </button>
              <button
                type="button"
                onClick={() => addCustomFieldWithPreset("Payment Method", "Bank Transfer")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                + Payment Method
              </button>
            </div>

            <div className="space-y-2.5">
              {formData.custom_fields.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">
                  No custom fields added.
                </div>
              ) : (
                formData.custom_fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2"
                  >
                    <div className="grid grid-cols-2 gap-2 flex-1 sm:flex sm:items-center sm:gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. PO #)"
                        value={field.label}
                        onChange={(e) =>
                          updateCustomField(field.id, { label: e.target.value })
                        }
                        className="w-full sm:w-1/3 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      <input
                        type="text"
                        placeholder="Value (e.g. PO-84920)"
                        value={field.value}
                        onChange={(e) =>
                          updateCustomField(field.id, { value: e.target.value })
                        }
                        className="w-full sm:flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-1.5 sm:pt-0 border-t border-slate-200/60 sm:border-none">
                      <span className="text-[11px] text-slate-500 font-medium sm:hidden">
                        {field.isVisible ? (
                          <span className="text-indigo-600 font-semibold">Visible on invoice</span>
                        ) : (
                          <span className="text-slate-400">Hidden from print</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateCustomField(field.id, { isVisible: !field.isVisible })
                          }
                          title={field.isVisible ? "Visible on invoice" : "Hidden from invoice"}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            field.isVisible
                              ? "text-indigo-600 bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100"
                              : "text-slate-400 bg-white border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {field.isVisible ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                          title="Remove custom field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 5: Notes / Payment Terms */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 md:p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex-shrink-0">
                5
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Payment Terms & Notes
              </h3>
            </div>
            <textarea
              rows={3}
              value={formData.notes || ""}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Add payment terms, bank details, or custom thank-you message..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Right: Sticky Live Preview (Full-width on print) */}
        <div
          className={`lg:col-span-5 sticky top-28 print:static print:w-full print:block transition-all w-full min-w-0 max-w-full ${
            activeMobileTab === "preview" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="no-print mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Live Invoice Preview
            </span>
            <span className="text-[11px] text-slate-400">
              Updates in real-time
            </span>
          </div>

          <InvoicePreview
            invoiceNumber={formData.invoice_number}
            businessName={formData.business_name}
            businessEmail={formData.business_email}
            businessAddress={formData.business_address}
            customerName={formData.customer_name}
            customerEmail={formData.customer_email}
            customerAddress={formData.customer_address}
            issueDate={formData.issue_date}
            dueDate={formData.due_date}
            notes={formData.notes}
            totals={calculatedTotals}
            customFields={formData.custom_fields}
          />
        </div>
      </div>

      {/* Send Email Modal */}
      {showEmailModal && formData.id && (
        <SendEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          invoiceId={formData.id}
          invoiceNumber={formData.invoice_number}
          grandTotal={calculatedTotals.grand_total}
          businessName={formData.business_name}
          customerName={formData.customer_name}
          customerEmail={formData.customer_email}
          onSuccess={handleEmailSent}
          onViewHistory={() => {
            setShowEmailModal(false);
            setShowEmailHistoryModal(true);
          }}
        />
      )}

      {/* Email History Modal */}
      {showEmailHistoryModal && formData.id && (
        <EmailHistoryModal
          isOpen={showEmailHistoryModal}
          onClose={() => setShowEmailHistoryModal(false)}
          invoiceId={formData.id}
          invoiceNumber={formData.invoice_number}
          grandTotal={calculatedTotals.grand_total}
          onOpenSendModal={() => {
            setShowEmailHistoryModal(false);
            setShowEmailModal(true);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) setShowDeleteModal(false);
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
                onClick={() => setShowDeleteModal(false)}
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
                  {formData.invoice_number}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">
                  {formData.customer_name || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-bold text-indigo-700">
                  ${calculatedTotals.grand_total.toFixed(2)}
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
                  {formData.invoice_number}
                </strong>
                ? All line items and associated email logs will be permanently deleted.
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50 text-center"
              >
                Cancel, Keep Invoice
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 text-center"
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
