import type { Metadata } from "next";
import Link from "next/link";
import { FileText, PlusCircle } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forma Invoice | Professional Invoice Generator",
  description:
    "Fast, accurate, decimal-safe invoice generator with live preview, PDF export, and email delivery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
        {/* Top Navigation Bar - Hidden on print */}
        <header className="no-print sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-8">
              <Link href="/invoices" className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-200">
                  <FileText size={18} />
                </div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">
                  Forma<span className="text-indigo-600">Invoice</span>
                </span>
              </Link>
              <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
                <Link
                  href="/invoices"
                  className="border-b-2 border-indigo-600 py-5 text-slate-900 font-semibold transition-colors"
                >
                  Invoices
                </Link>
                <span
                  className="py-5 text-slate-400 hover:text-slate-600 cursor-pointer flex items-center gap-1.5 transition-colors"
                  title="Customer Management (Coming Soon)"
                >
                  Customers
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/invoices/new"
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:shadow flex items-center gap-1.5 flex-shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline sm:inline">New Invoice</span>
                <span className="xs:hidden sm:hidden">New</span>
              </Link>
              <div
                className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 border border-indigo-200/80 shadow-xs cursor-pointer"
                title="Acme Studio Inc. (Admin)"
              >
                AS
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}
