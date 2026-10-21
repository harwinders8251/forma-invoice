import "server-only";
import PDFDocument from "pdfkit";
import { InvoiceRecord } from "./invoice-service";
import { formatCurrency } from "./invoice-calculations";

/**
 * Generates a clean, professional vector PDF invoice buffer using pdfkit.
 */
export async function generateInvoicePdfBuffer(invoice: InvoiceRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Invoice ${invoice.invoice_number}`,
          Author: invoice.business_name || "Forma Invoice",
          Subject: `Invoice for ${invoice.customer_name}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header: Business Name & Invoice Badge
      doc.rect(40, 40, 515, 60).fill("#f8fafc");
      doc.strokeColor("#e2e8f0").lineWidth(1).rect(40, 40, 515, 60).stroke();

      doc.fillColor("#0f172a").fontSize(18).font("Helvetica-Bold");
      doc.text(invoice.business_name || "Forma Invoice", 55, 52);

      doc.fillColor("#475569").fontSize(9).font("Helvetica");
      if (invoice.business_email) {
        doc.text(invoice.business_email, 55, 75);
      }

      // Top Right: Invoice Title and Number
      doc.fillColor("#4338ca").fontSize(16).font("Helvetica-Bold");
      doc.text("INVOICE", 380, 50, { align: "right", width: 160 });

      doc.fillColor("#0f172a").fontSize(11).font("Helvetica");
      doc.text(invoice.invoice_number, 380, 70, { align: "right", width: 160 });

      let currentY = 120;

      // Bill To & Dates Grid
      doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold");
      doc.text("BILLED TO", 45, currentY);
      doc.text("INVOICE DETAILS", 350, currentY);

      currentY += 14;
      doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold");
      doc.text(invoice.customer_name || "Client", 45, currentY);

      // Dates on right
      doc.fillColor("#334155").fontSize(9).font("Helvetica");
      doc.text(`Issue Date: ${invoice.issue_date || "—"}`, 350, currentY);

      currentY += 14;
      if (invoice.customer_email) {
        doc.fillColor("#64748b").fontSize(9).font("Helvetica");
        doc.text(invoice.customer_email, 45, currentY);
      }
      doc.fillColor("#334155").fontSize(9).font("Helvetica");
      doc.text(`Due Date: ${invoice.due_date || "—"}`, 350, currentY);

      currentY += 14;
      if (invoice.customer_address) {
        doc.fillColor("#64748b").fontSize(8).font("Helvetica");
        doc.text(invoice.customer_address, 45, currentY, { width: 250 });
      }

      // Custom fields (visible only)
      const visibleFields = (invoice.custom_fields || []).filter((f) => f.isVisible && f.value?.trim());
      if (visibleFields.length > 0) {
        let fieldY = currentY;
        for (const cf of visibleFields) {
          doc.fillColor("#475569").fontSize(8).font("Helvetica");
          doc.text(`${cf.label}: ${cf.value}`, 350, fieldY, { width: 205, align: "right" });
          fieldY += 12;
        }
        currentY = Math.max(currentY + 25, fieldY);
      } else {
        currentY += 25;
      }

      currentY += 15;

      // Table Header
      doc.rect(40, currentY, 515, 22).fill("#f1f5f9");
      doc.strokeColor("#e2e8f0").lineWidth(1).rect(40, currentY, 515, 22).stroke();

      doc.fillColor("#475569").fontSize(9).font("Helvetica-Bold");
      doc.text("ITEM & DESCRIPTION", 50, currentY + 6, { width: 250 });
      doc.text("QTY", 310, currentY + 6, { width: 50, align: "center" });
      doc.text("UNIT PRICE", 370, currentY + 6, { width: 80, align: "right" });
      doc.text("TOTAL", 460, currentY + 6, { width: 85, align: "right" });

      currentY += 22;

      // Items Rows
      const items = invoice.items || [];
      doc.font("Helvetica").fontSize(9);

      for (const item of items) {
        const rowHeight = 22;
        doc.strokeColor("#f1f5f9").lineWidth(1).moveTo(40, currentY + rowHeight).lineTo(555, currentY + rowHeight).stroke();

        doc.fillColor("#1e293b");
        doc.text(item.description || "Item", 50, currentY + 6, { width: 250 });
        doc.text(String(item.quantity), 310, currentY + 6, { width: 50, align: "center" });
        doc.text(formatCurrency(item.unit_price), 370, currentY + 6, { width: 80, align: "right" });
        doc.font("Helvetica-Bold");
        doc.text(formatCurrency(item.line_total), 460, currentY + 6, { width: 85, align: "right" });
        doc.font("Helvetica");

        currentY += rowHeight;
      }

      currentY += 15;

      // Totals Box (Right aligned)
      const totalsX = 350;
      const totalsW = 195;

      // Subtotal
      doc.fillColor("#475569").fontSize(9).font("Helvetica");
      doc.text("Subtotal:", totalsX, currentY);
      doc.text(formatCurrency(invoice.subtotal), totalsX, currentY, { align: "right", width: totalsW });
      currentY += 15;

      // Discount
      if (invoice.discount_amount > 0) {
        doc.fillColor("#16a34a");
        doc.text("Discount:", totalsX, currentY);
        doc.text(`-${formatCurrency(invoice.discount_amount)}`, totalsX, currentY, { align: "right", width: totalsW });
        currentY += 15;
      }

      // Tax
      if (invoice.tax_rate > 0 || invoice.tax_amount > 0) {
        doc.fillColor("#475569");
        doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, currentY);
        doc.text(formatCurrency(invoice.tax_amount), totalsX, currentY, { align: "right", width: totalsW });
        currentY += 15;
      }

      // Total Line Divider
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(totalsX, currentY).lineTo(545, currentY).stroke();
      currentY += 8;

      // Grand Total
      doc.rect(totalsX - 5, currentY - 4, totalsW + 10, 26).fill("#eef2ff");
      doc.fillColor("#3730a3").fontSize(11).font("Helvetica-Bold");
      doc.text("TOTAL DUE:", totalsX + 5, currentY + 3);
      doc.text(formatCurrency(invoice.grand_total), totalsX, currentY + 3, { align: "right", width: totalsW });

      currentY += 45;

      // Notes & Terms
      if (invoice.notes) {
        doc.rect(40, currentY, 515, 45).fill("#f8fafc");
        doc.strokeColor("#e2e8f0").lineWidth(1).rect(40, currentY, 515, 45).stroke();

        doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold");
        doc.text("PAYMENT TERMS & NOTES", 50, currentY + 8);
        doc.fillColor("#334155").fontSize(8).font("Helvetica");
        doc.text(invoice.notes, 50, currentY + 20, { width: 495 });

        currentY += 55;
      }

      // Footer
      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica");
      doc.text(
        `Thank you for your business. Generated by ${invoice.business_name || "Forma Invoice"}.`,
        40,
        780,
        { align: "center", width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
