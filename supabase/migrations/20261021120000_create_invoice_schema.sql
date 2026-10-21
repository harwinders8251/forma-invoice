-- Migration: 20261021120000_create_invoice_schema.sql
-- Description: Create invoices, invoice_items, and invoice_email_logs tables with constraints and atomic RPC

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    business_email TEXT,
    business_address TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    notes TEXT,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Financial and Integrity Constraints
    CONSTRAINT chk_invoices_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT chk_invoices_tax_rate_non_negative CHECK (tax_rate >= 0),
    CONSTRAINT chk_invoices_subtotal_non_negative CHECK (subtotal >= 0),
    CONSTRAINT chk_invoices_tax_amount_non_negative CHECK (tax_amount >= 0),
    CONSTRAINT chk_invoices_grand_total_non_negative CHECK (grand_total >= 0),
    CONSTRAINT chk_invoices_discount_lte_subtotal CHECK (discount_amount <= subtotal),
    CONSTRAINT chk_invoices_due_date_gte_issue CHECK (due_date >= issue_date)
);

-- 2. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12,4) NOT NULL,
    unit_price NUMERIC(12,4) NOT NULL,
    line_total NUMERIC(12,2) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,

    -- Item Constraints
    CONSTRAINT chk_items_quantity_non_negative CHECK (quantity >= 0),
    CONSTRAINT chk_items_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT chk_items_line_total_non_negative CHECK (line_total >= 0)
);

-- 3. Invoice Email Logs Table
CREATE TABLE IF NOT EXISTS public.invoice_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes for Performance and Queries
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON public.invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_invoice_email_logs_invoice_id ON public.invoice_email_logs(invoice_id);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 6. Atomic Transaction RPC: Upsert Invoice with Line Items
CREATE OR REPLACE FUNCTION public.upsert_invoice_with_items(
    p_invoice JSONB,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_item RECORD;
    v_pos INTEGER := 0;
BEGIN
    -- Extract or assign ID
    IF p_invoice ? 'id' AND (p_invoice->>'id') IS NOT NULL AND (p_invoice->>'id') <> '' THEN
        v_invoice_id := (p_invoice->>'id')::UUID;
        
        UPDATE public.invoices
        SET
            invoice_number = p_invoice->>'invoice_number',
            business_name = p_invoice->>'business_name',
            business_email = p_invoice->>'business_email',
            business_address = p_invoice->>'business_address',
            customer_name = p_invoice->>'customer_name',
            customer_email = p_invoice->>'customer_email',
            customer_address = p_invoice->>'customer_address',
            issue_date = (p_invoice->>'issue_date')::DATE,
            due_date = (p_invoice->>'due_date')::DATE,
            notes = p_invoice->>'notes',
            discount_amount = (p_invoice->>'discount_amount')::NUMERIC,
            tax_rate = (p_invoice->>'tax_rate')::NUMERIC,
            subtotal = (p_invoice->>'subtotal')::NUMERIC,
            tax_amount = (p_invoice->>'tax_amount')::NUMERIC,
            grand_total = (p_invoice->>'grand_total')::NUMERIC,
            custom_fields = COALESCE(p_invoice->'custom_fields', '[]'::jsonb),
            updated_at = now()
        WHERE id = v_invoice_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice with id % not found for update', v_invoice_id;
        END IF;

        -- Remove existing items for clean transactional overwrite
        DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
    ELSE
        INSERT INTO public.invoices (
            invoice_number,
            business_name,
            business_email,
            business_address,
            customer_name,
            customer_email,
            customer_address,
            issue_date,
            due_date,
            notes,
            discount_amount,
            tax_rate,
            subtotal,
            tax_amount,
            grand_total,
            custom_fields
        ) VALUES (
            p_invoice->>'invoice_number',
            p_invoice->>'business_name',
            p_invoice->>'business_email',
            p_invoice->>'business_address',
            p_invoice->>'customer_name',
            p_invoice->>'customer_email',
            p_invoice->>'customer_address',
            (p_invoice->>'issue_date')::DATE,
            (p_invoice->>'due_date')::DATE,
            p_invoice->>'notes',
            (p_invoice->>'discount_amount')::NUMERIC,
            (p_invoice->>'tax_rate')::NUMERIC,
            (p_invoice->>'subtotal')::NUMERIC,
            (p_invoice->>'tax_amount')::NUMERIC,
            (p_invoice->>'grand_total')::NUMERIC,
            COALESCE(p_invoice->'custom_fields', '[]'::jsonb)
        )
        RETURNING id INTO v_invoice_id;
    END IF;

    -- Insert items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        description TEXT,
        quantity NUMERIC,
        unit_price NUMERIC,
        line_total NUMERIC,
        position INTEGER
    )
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id,
            description,
            quantity,
            unit_price,
            line_total,
            position
        ) VALUES (
            v_invoice_id,
            v_item.description,
            v_item.quantity,
            v_item.unit_price,
            v_item.line_total,
            COALESCE(v_item.position, v_pos)
        );
        v_pos := v_pos + 1;
    END LOOP;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;
