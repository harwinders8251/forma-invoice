import { NextRequest, NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/lib/email-service";
import { SendInvoiceEmailSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid or missing invoice ID." },
        { status: 400 }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty if user wants to send directly to customer_email
      body = {};
    }

    // Optional validation if body fields are provided
    let recipients: string[] | undefined;
    let recipientEmail: string | undefined;
    let customMessage: string | undefined;
    let subject: string | undefined;

    if (body && Object.keys(body).length > 0) {
      const parsed = SendInvoiceEmailSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: parsed.error.issues[0]?.message || "Invalid email payload.",
          },
          { status: 400 }
        );
      }
      recipients = parsed.data.recipients;
      recipientEmail = parsed.data.recipient_email || undefined;
      customMessage = parsed.data.message;
      subject = parsed.data.subject;
    }

    const result = await sendInvoiceEmail({
      invoiceId: id,
      recipients,
      recipientEmail,
      customMessage,
      subject,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          sentRecipients: result.sentRecipients,
          failedRecipients: result.failedRecipients,
        },
        { status: 422 }
      );
    }

    const recipientCount = result.sentRecipients.length;
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      sentRecipients: result.sentRecipients,
      failedRecipients: result.failedRecipients,
      message: `Invoice email successfully dispatched to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
