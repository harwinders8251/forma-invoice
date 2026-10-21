-- Migration: 20261021120001_add_invoice_security.sql
-- Description: Enable Row Level Security (RLS) on invoices, invoice_items, and invoice_email_logs
-- Restricts public/anonymous access so invoices are never publicly queryable or modifiable directly from browser.

-- 1. Enable RLS on all invoice tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_email_logs ENABLE ROW LEVEL SECURITY;

-- 2. Service role policies (privileged server-side operations)
-- In Supabase PostgreSQL, the service_role role automatically bypasses RLS, but explicit policies ensure compliance in all setups.
DROP POLICY IF EXISTS "Service role full access on invoices" ON public.invoices;
CREATE POLICY "Service role full access on invoices"
ON public.invoices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on invoice_items" ON public.invoice_items;
CREATE POLICY "Service role full access on invoice_items"
ON public.invoice_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on invoice_email_logs" ON public.invoice_email_logs;
CREATE POLICY "Service role full access on invoice_email_logs"
ON public.invoice_email_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Authenticated user access (if Supabase Auth is enabled/used)
-- Authenticated users have access to read and manage invoices
DROP POLICY IF EXISTS "Authenticated users can select invoices" ON public.invoices;
CREATE POLICY "Authenticated users can select invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
CREATE POLICY "Authenticated users can insert invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;
CREATE POLICY "Authenticated users can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.invoices;
CREATE POLICY "Authenticated users can delete invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can manage invoice items"
ON public.invoice_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage email logs" ON public.invoice_email_logs;
CREATE POLICY "Authenticated users can manage email logs"
ON public.invoice_email_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Explicit Note: The 'anon' role is deliberately NOT granted access.
-- All client-side operations flow through Next.js Server Actions and validated API endpoints.
