'use client';

import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentsList, fetchDownloadUrl } from '@/hooks/useDocuments';
import { ApiError } from '@/lib/utils/apiFetch';
import type { PolyRelatedType } from '@/lib/constants/enums';
import type { DocumentRecord } from '@/types/document';

import { DocumentDeleteAlert } from './DocumentDeleteAlert';
import { DocumentUploader } from './DocumentUploader';
import { formatBytes, getFileTypeInfo } from './DocumentIcon';

type Props = {
  relatedToType: PolyRelatedType;
  relatedToId: string;
  businessUnit: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function openDownload(id: string) {
  try {
    const url = await fetchDownloadUrl(id);
    // Open in a new tab. PDFs preview, others download depending on browser.
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Failed to get download link';
    toast.error(msg);
  }
}

export function DocumentsPanel({ relatedToType, relatedToId, businessUnit }: Props) {
  const list = useDocumentsList({
    relatedToType,
    relatedToId,
    limit: 50,
  });

  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const items = list.data?.items ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>
              Documents
              {items.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              )}
            </span>
            <DocumentUploader
              businessUnit={businessUnit}
              relatedTo={{ type: relatedToType, id: relatedToId }}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents yet — upload contracts, IDs, evidence, or notes.
            </p>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {items.map((doc) => {
                const info = getFileTypeInfo(doc.contentType);
                return (
                  <li
                    key={doc._id}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
                  >
                    <div
                      className="flex size-9 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${info.color}20`, color: info.color }}
                    >
                      <info.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{doc.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {info.label} · {formatBytes(doc.size)} · {formatDate(doc.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => void openDownload(doc._id)}
                        aria-label="Download"
                      >
                        <Download className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => setDeleting(doc)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {deleting && (
        <DocumentDeleteAlert
          doc={deleting}
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
        />
      )}
    </>
  );
}
