'use client';

import { Download, FileText, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DocumentDeleteAlert } from '@/components/documents/DocumentDeleteAlert';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { formatBytes, getFileTypeInfo } from '@/components/documents/DocumentIcon';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { fetchDownloadUrl, useDocumentsList } from '@/hooks/useDocuments';
import { ApiError } from '@/lib/utils/apiFetch';
import type { DocumentRecord } from '@/types/document';

const PAGE_SIZE = 25;

const RELATED_HREF: Record<string, string> = {
  lead: '/leads',
  case: '/cases',
  contact: '/contacts',
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
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Failed to get download link';
    toast.error(msg);
  }
}

export function DocumentsClient() {
  const { currentBU, businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
    }),
    [page, debouncedSearch, currentBU],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, currentBU]);

  const query = useDocumentsList(filters);

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  // Uploading from the global page only works when a specific BU is selected —
  // otherwise we don't know where to file the document.
  const canUpload = currentBU !== 'all';

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = !!debouncedSearch;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or description…"
              className="pl-8"
            />
          </div>
        </div>
        {canUpload ? (
          <DocumentUploader businessUnit={currentBU} label="Upload file" />
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick a specific business unit to upload.
          </p>
        )}
      </div>

      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtersActive ? 'No matching documents' : 'No documents yet'}
          description={
            filtersActive
              ? 'Clear search to see all documents.'
              : 'Upload files from a lead, case, or contact detail page — or use the upload button above when a BU is selected.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]" />
                <TableHead>Filename</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[100px] text-right">Size</TableHead>
                <TableHead className="w-[140px]">Related</TableHead>
                <TableHead className="w-[140px]">Business unit</TableHead>
                <TableHead className="w-[120px]">Uploaded</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((doc) => {
                const info = getFileTypeInfo(doc.contentType);
                return (
                  <TableRow key={doc._id} className="hover:bg-muted/40">
                    <TableCell>
                      <div
                        className="flex size-8 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${info.color}20`, color: info.color }}
                      >
                        <info.icon className="size-4" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{doc.filename}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{info.label}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatBytes(doc.size)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.relatedTo ? (
                        <Link
                          href={`${RELATED_HREF[doc.relatedTo.type] ?? '/'}/${doc.relatedTo.id}`}
                          className="capitalize underline-offset-2 hover:underline"
                        >
                          {doc.relatedTo.type}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: buColor(doc.businessUnit) }}
                        />
                        <span>{buName(doc.businessUnit)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell>
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
                          className="size-7"
                          onClick={() => setDeleting(doc)}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {deleting && (
        <DocumentDeleteAlert
          doc={deleting}
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
        />
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b bg-muted/20 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
