import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { getInvoiceById, InvoiceRecord } from "./invoice-service";
import { getSupabaseServer } from "./supabase-server";
import { formatCurrency } from "./invoice-calculations";
import { generateInvoicePdfBuffer } from "./pdf-service";

export interface SendInvoiceEmailParams {
  invoiceId: string;
  recipients?: string[];
  recipientEmail?: string;
  subject?: string;
  customMessage?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  sentRecipients: string[];
  failedRecipients: Array<{ email: string; error: string }>;
  error?: string;
}

/**
 * Builds a clean, professional, light-header HTML business invoice email.
 */
function renderInvoiceEmailHtml(invoice: InvoiceRecord, customMessage?: string): string {
  const itemsRows = (invoice.items || [])
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 14px; font-size: 13px; color: #1e293b; line-height: 1.4;">
          <strong>${escapeHtml(item.description)}</strong>
        </td>
        <td style="padding: 12px 14px; font-size: 13px; color: #475569; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px 14px; font-size: 13px; color: #475569; text-align: right;">
          ${formatCurrency(item.unit_price)}
        </td>
        <td style="padding: 12px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">
          ${formatCurrency(item.line_total)}
        </td>
      </tr>
    `
    )
    .join("");

  const visibleCustomFields = (invoice.custom_fields || [])
    .filter((cf) => cf.isVisible && cf.value?.trim())
    .map(
      (cf) => `
      <div style="font-size: 12px; margin-bottom: 4px;">
        <span style="color: #64748b;">${escapeHtml(cf.label)}:</span>
        <strong style="color: #0f172a; margin-left: 4px;">${escapeHtml(cf.value)}</strong>
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px; color: #1e293b;">
        <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Clean Light Header -->
          <div style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: top;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                    ${escapeHtml(invoice.business_name || "Forma Invoice")}
                  </h1>
                  ${invoice.business_email ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${escapeHtml(invoice.business_email)}</p>` : ""}
                </td>
                <td style="vertical-align: top; text-align: right;">
                  <span style="display: inline-block; padding: 5px 12px; background-color: #eef2ff; color: #4338ca; border-radius: 6px; font-size: 13px; font-weight: 700; font-family: monospace;">
                    ${escapeHtml(invoice.invoice_number)}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Main Content -->
          <div style="padding: 28px 36px 36px 36px;">

            <!-- Personal / Custom Message -->
            ${
              customMessage
                ? `
              <div style="padding: 16px 20px; background-color: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 6px; margin-bottom: 28px; font-size: 14px; color: #334155; line-height: 1.6;">
                ${escapeHtml(customMessage)}
              </div>
            `
                : `
              <div style="margin-bottom: 24px; font-size: 14px; color: #334155; line-height: 1.6;">
                Hi <strong>${escapeHtml(invoice.customer_name)}</strong>,<br />
                Please find your invoice details below. Kindly review and arrange payment by the due date. An official PDF document is attached for your records.
              </div>
            `
            }

            <!-- Prominent Invoice Summary Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: #64748b; margin-bottom: 4px;">
                      Amount Due
                    </div>
                    <div style="font-size: 28px; font-weight: 800; color: #1e1b4b; line-height: 1.1;">
                      ${formatCurrency(invoice.grand_total)}
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
                      Issue Date: <strong style="color: #0f172a;">${escapeHtml(invoice.issue_date || "—")}</strong>
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                      Due Date: <strong style="color: #b91c1c;">${escapeHtml(invoice.due_date || "—")}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Bill To Section -->
            <table style="width: 100%; margin-bottom: 24px; font-size: 13px;">
              <tr>
                <td style="vertical-align: top; width: 60%;">
                  <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">
                    Billed To
                  </div>
                  <div style="font-weight: 600; color: #0f172a; font-size: 14px;">${escapeHtml(invoice.customer_name)}</div>
                  ${invoice.customer_email ? `<div style="color: #475569; margin-top: 2px;">${escapeHtml(invoice.customer_email)}</div>` : ""}
                  ${invoice.customer_address ? `<div style="color: #64748b; margin-top: 2px; white-space: pre-line;">${escapeHtml(invoice.customer_address)}</div>` : ""}
                </td>
                <td style="vertical-align: top; width: 40%; text-align: right;">
                  ${visibleCustomFields}
                </td>
              </tr>
            </table>

            <!-- Line Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">
                    Description
                  </th>
                  <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">
                    Qty
                  </th>
                  <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">
                    Price
                  </th>
                  <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <!-- Calculation Breakdown -->
            <table style="width: 100%; margin-bottom: 28px;">
              <tr>
                <td style="width: 50%;"></td>
                <td style="width: 50%;">
                  <table style="width: 100%; font-size: 13px;">
                    <tr>
                      <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
                      <td style="padding: 4px 0; text-align: right; font-weight: 500; color: #0f172a;">${formatCurrency(invoice.subtotal)}</td>
                    </tr>
                    ${
                      invoice.discount_amount > 0
                        ? `
                      <tr>
                        <td style="padding: 4px 0; color: #16a34a;">Discount:</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #16a34a;">-${formatCurrency(invoice.discount_amount)}</td>
                      </tr>
                    `
                        : ""
                    }
                    ${
                      invoice.tax_rate > 0 || invoice.tax_amount > 0
                        ? `
                      <tr>
                        <td style="padding: 4px 0; color: #64748b;">Tax (${invoice.tax_rate}%):</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 500; color: #0f172a;">${formatCurrency(invoice.tax_amount)}</td>
                      </tr>
                    `
                        : ""
                    }
                    <tr>
                      <td colspan="2" style="padding-top: 8px; border-bottom: 1px solid #cbd5e1;"></td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; font-size: 14px; font-weight: 700; color: #0f172a;">TOTAL DUE:</td>
                      <td style="padding: 10px 0; text-align: right; font-size: 16px; font-weight: 800; color: #4338ca;">${formatCurrency(invoice.grand_total)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Attachment Notice -->
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="font-size: 13px; color: #334155;">
                    📎 <strong>Attached:</strong> Invoice-${escapeHtml(invoice.invoice_number)}.pdf
                  </td>
                  <td style="text-align: right; font-size: 12px; color: #64748b;">
                    PDF Document · ${formatCurrency(invoice.grand_total)}
                  </td>
                </tr>
              </table>
            </div>

            ${
              invoice.notes
                ? `
              <div style="padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">
                <strong>Payment Terms & Notes:</strong><br />
                ${escapeHtml(invoice.notes)}
              </div>
            `
                : ""
            }

          </div>

          <!-- Professional Footer -->
          <div style="padding: 20px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            <p style="margin: 0 0 4px 0; font-weight: 500; color: #64748b;">
              Thank you for your business.
            </p>
            <p style="margin: 0; color: #94a3b8;">
              ${escapeHtml(invoice.business_name || "Forma Invoice")} · This email was sent regarding invoice ${escapeHtml(invoice.invoice_number)}.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sends an invoice email to one or multiple recipients with attached PDF and logs each attempt in Supabase.
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<SendEmailResult> {
  const { invoiceId, subject, customMessage } = params;

  // 1. Fetch Invoice
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    return {
      success: false,
      sentRecipients: [],
      failedRecipients: [],
      error: "Invoice not found.",
    };
  }

  // 1b. Validate Invoice Integrity: reject invalid discount or calculation
  if (invoice.discount_amount < 0 || invoice.discount_amount > invoice.subtotal) {
    return {
      success: false,
      sentRecipients: [],
      failedRecipients: [],
      error: `Cannot send email: Invoice has an invalid discount ($${invoice.discount_amount.toFixed(2)}) exceeding subtotal ($${invoice.subtotal.toFixed(2)}).`,
    };
  }

  // 2. Normalize and Validate Recipients
  const rawRecipients: string[] = [];
  if (Array.isArray(params.recipients) && params.recipients.length > 0) {
    rawRecipients.push(...params.recipients);
  } else if (params.recipientEmail) {
    rawRecipients.push(params.recipientEmail);
  } else if (invoice.customer_email) {
    rawRecipients.push(invoice.customer_email);
  }

  const validRecipients = Array.from(
    new Set(
      rawRecipients
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e && e.includes("@")))
    )
  );

  if (validRecipients.length === 0) {
    return {
      success: false,
      sentRecipients: [],
      failedRecipients: [],
      error: "At least one valid recipient email address is required.",
    };
  }

  // 3. Generate PDF Buffer for attachment
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateInvoicePdfBuffer(invoice);
  } catch (err) {
    console.warn("PDF generation warning: proceeding without attachment", err);
  }

  const attachments = pdfBuffer
    ? [
        {
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  const emailSubject = subject || `Invoice ${invoice.invoice_number} from ${invoice.business_name || "Forma Invoice"}`;
  const htmlContent = renderInvoiceEmailHtml(invoice, customMessage);

  // 4. Configure Provider: Check SMTP vs Resend
  const smtpHost = process.env.MAIL_HOST;
  const smtpUser = process.env.MAIL_USERNAME;
  const smtpPass = process.env.MAIL_PASSWORD;
  const smtpPort = Number(process.env.MAIL_PORT) || 587;
  const smtpFromAddress =
    process.env.MAIL_FROM_ADDRESS || smtpUser || process.env.EMAIL_FROM || "billing@formainvoice.com";
  const smtpFromName =
    process.env.MAIL_FROM_NAME || invoice.business_name || "Forma Invoice";

  const isSmtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);
  const resendApiKey = process.env.RESEND_API_KEY;
  const isResendConfigured = Boolean(resendApiKey && !resendApiKey.startsWith("re_your_"));

  if (!isSmtpConfigured && !isResendConfigured) {
    return {
      success: false,
      sentRecipients: [],
      failedRecipients: [],
      error: "Email delivery is not configured. Please configure SMTP credentials (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD) in .env.local.",
    };
  }

  const supabase = getSupabaseServer();
  const sentRecipients: string[] = [];
  const failedRecipients: Array<{ email: string; error: string }> = [];
  let firstMessageId: string | undefined;

  // Primary: Send via SMTP
  if (isSmtpConfigured) {
    const isSecure = process.env.MAIL_ENCRYPTION === "ssl" || smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    for (const recipient of validRecipients) {
      try {
        const info = await transporter.sendMail({
          from: `"${smtpFromName}" <${smtpFromAddress}>`,
          to: recipient,
          subject: emailSubject,
          html: htmlContent,
          attachments,
        });

        sentRecipients.push(recipient);
        if (!firstMessageId) firstMessageId = info.messageId;

        // Log successful send in Supabase
        try {
          await supabase.from("invoice_email_logs").insert({
            invoice_id: invoice.id,
            recipient_email: recipient,
            status: "sent",
            provider_message_id: info.messageId,
          });
        } catch {
          // Table might not exist yet, ignore
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to deliver email through SMTP.";
        failedRecipients.push({ email: recipient, error: errorMsg });

        try {
          await supabase.from("invoice_email_logs").insert({
            invoice_id: invoice.id,
            recipient_email: recipient,
            status: "failed",
            error_message: errorMsg,
          });
        } catch {
          // Ignore
        }
      }
    }
  } else {
    // Fallback: Send via Resend API
    const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";
    const resend = new Resend(resendApiKey);

    for (const recipient of validRecipients) {
      try {
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: [recipient],
          subject: emailSubject,
          html: htmlContent,
          attachments: pdfBuffer
            ? [
                {
                  filename: `Invoice-${invoice.invoice_number}.pdf`,
                  content: pdfBuffer,
                },
              ]
            : undefined,
        });

        if (error) {
          failedRecipients.push({ email: recipient, error: error.message });
          try {
            await supabase.from("invoice_email_logs").insert({
              invoice_id: invoice.id,
              recipient_email: recipient,
              status: "failed",
              error_message: error.message,
            });
          } catch {
            // Ignore
          }
        } else {
          sentRecipients.push(recipient);
          if (!firstMessageId) firstMessageId = data?.id;

          try {
            await supabase.from("invoice_email_logs").insert({
              invoice_id: invoice.id,
              recipient_email: recipient,
              status: "sent",
              provider_message_id: data?.id,
            });
          } catch {
            // Ignore
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to deliver email through Resend.";
        failedRecipients.push({ email: recipient, error: errorMsg });

        try {
          await supabase.from("invoice_email_logs").insert({
            invoice_id: invoice.id,
            recipient_email: recipient,
            status: "failed",
            error_message: errorMsg,
          });
        } catch {
          // Ignore
        }
      }
    }
  }

  const overallSuccess = sentRecipients.length > 0;
  return {
    success: overallSuccess,
    messageId: firstMessageId,
    sentRecipients,
    failedRecipients,
    error: overallSuccess
      ? undefined
      : failedRecipients.map((f) => `${f.email}: ${f.error}`).join("; ") || "Failed to dispatch email.",
  };
}
