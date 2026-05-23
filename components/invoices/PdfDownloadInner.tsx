'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Invoice } from '@/types/invoice';

import { InvoicePdf } from './InvoicePdf';

/**
 * Heavy-import client component. Loaded via `next/dynamic` from
 * `InvoicePdfButton.tsx` so the @react-pdf/renderer chunk only ships when
 * the user actually visits an invoice detail page.
 */
export default function PdfDownloadInner({ invoice }: { invoice: Invoice }) {
  return (
    <PDFDownloadLink
      document={<InvoicePdf invoice={invoice} />}
      fileName={`${invoice.invoiceNumber}.pdf`}
    >
      {({ loading }) => (
        <Button size="sm" variant="outline" className="gap-2" disabled={loading}>
          <Download className="size-3.5" />
          {loading ? 'Generating…' : 'Download PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
