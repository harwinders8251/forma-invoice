import { InvoiceEditor } from "@/components/invoice-editor";
import { InvoiceSkeleton } from "@/components/invoice-skeleton";
import { InvoiceFormData } from "@/lib/schemas";
import { generateNextInvoiceNumber } from "@/lib/invoice-service";
import { Suspense } from "react";
import { connection } from "next/server";

export const metadata = {
  title: "New Invoice | Forma Invoice",
  description: "Create and customize a new client invoice with live preview.",
};

async function NewInvoiceContent() {
  await connection();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dueDateStr = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const nextInvoiceNumber = await generateNextInvoiceNumber();

  // Default initial invoice matching the required interview test case ($99.00)
  const defaultInvoice: InvoiceFormData = {
    invoice_number: nextInvoiceNumber,
    business_name: "Acme Studio Inc.",
    business_email: "billing@acmestudio.com",
    business_address: "100 Innovation Way, Suite 400\nSan Francisco, CA 94105",
    customer_name: "Starlight Corp",
    customer_email: "accounts@starlight.io",
    customer_address: "500 Market St, Floor 12\nSan Francisco, CA 94104",
    issue_date: todayStr,
    due_date: dueDateStr,
    notes: "Payment is due within 14 days of invoice date. Thank you for your partnership!",
    discount_amount: 10,
    tax_rate: 10,
    items: [
      {
        description: "Full-Stack Web Development & Consulting",
        quantity: 2,
        unit_price: 50,
        position: 0,
      },
    ],
    custom_fields: [
      {
        id: "cf-1",
        label: "PO Number",
        value: "PO-84920",
        isVisible: true,
      },
      {
        id: "cf-2",
        label: "Project Code",
        value: "WEB-2026",
        isVisible: true,
      },
    ],
  };

  return <InvoiceEditor initialData={defaultInvoice} isEditMode={false} />;
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<InvoiceSkeleton />}>
      <NewInvoiceContent />
    </Suspense>
  );
}
