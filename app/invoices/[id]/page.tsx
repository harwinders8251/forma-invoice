import { getInvoiceById } from "@/lib/invoice-service";
import { InvoiceEditLoader } from "@/components/invoice-edit-loader";
import { InvoiceSkeleton } from "@/components/invoice-skeleton";
import { connection } from "next/server";
import { Suspense } from "react";

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditInvoicePageProps) {
  const { id } = await params;
  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return { title: "Invoice Not Found | Forma Invoice" };
    }
    return {
      title: `Invoice ${invoice.invoice_number} | Forma Invoice`,
    };
  } catch {
    return { title: "Edit Invoice | Forma Invoice" };
  }
}

async function EditInvoiceServerContent({ params }: EditInvoicePageProps) {
  await connection();
  const { id } = await params;

  let initialInvoice = null;
  try {
    initialInvoice = await getInvoiceById(id);
  } catch {
    initialInvoice = null;
  }

  return <InvoiceEditLoader invoiceId={id} initialInvoice={initialInvoice} />;
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  return (
    <Suspense fallback={<InvoiceSkeleton />}>
      <EditInvoiceServerContent params={params} />
    </Suspense>
  );
}
