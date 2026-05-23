'use client';

import { Download } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import type { Invoice } from '@/types/invoice';

// @react-pdf/renderer pulls in a bunch of Node-shaped code and can't SSR.
// Dynamically load it client-side only; show a disabled placeholder while
// the chunk is being fetched.
const PdfDownload = dynamic(() => import('./PdfDownloadInner'), {
  ssr: false,
  loading: () => (
    <Button size="sm" variant="outline" className="gap-2" disabled>
      <Download className="size-3.5" />
      Loading…
    </Button>
  ),
});

export function InvoicePdfButton({ invoice }: { invoice: Invoice }) {
  return <PdfDownload invoice={invoice} />;
}
