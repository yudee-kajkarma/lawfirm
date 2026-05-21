'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiFetch } from '@/lib/utils/apiFetch';
import type {
  DocumentCreateInput,
  UploadUrlInput,
} from '@/lib/utils/validators/document';
import type {
  DocumentListFilters,
  DocumentListMeta,
  DocumentRecord,
  DownloadUrlResponse,
  UploadUrlResponse,
} from '@/types/document';

const KEY = ['documents'] as const;

function buildQS(filters: DocumentListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.relatedToType) sp.set('relatedToType', filters.relatedToType);
  if (filters.relatedToId) sp.set('relatedToId', filters.relatedToId);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useDocumentsList(filters: DocumentListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<DocumentRecord[]>(`/api/documents${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as DocumentListMeta };
    },
  });
}

/**
 * Three-step upload: request presigned URL → PUT to S3 → record metadata.
 * Failure at any step throws; caller decides whether to retry or toast.
 */
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      file: File;
      businessUnit: string;
      relatedTo?: { type: 'lead' | 'case' | 'contact'; id: string } | null;
      description?: string | null;
      onProgress?: (loaded: number, total: number) => void;
    }) => {
      const { file, businessUnit, relatedTo, description } = args;

      // 1. Ask the server for a presigned PUT URL.
      const urlInput: UploadUrlInput = {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        businessUnit,
        relatedTo: relatedTo ?? null,
      };
      const urlRes = await apiFetch<UploadUrlResponse>('/api/documents/upload-url', {
        method: 'POST',
        body: JSON.stringify(urlInput),
      });

      // 2. PUT the bytes directly to S3. Fetch can't report progress without
      //    streaming hacks — browsers show their own progress indicator on
      //    the network tab, which is fine for v1.
      const putRes = await fetch(urlRes.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': urlInput.contentType },
        body: file,
      });
      if (!putRes.ok) {
        throw new ApiError(
          `S3 upload failed (${putRes.status}). Check the bucket's CORS config.`,
          'S3_UPLOAD_FAILED',
          putRes.status,
        );
      }

      // 3. Record metadata.
      const createInput: DocumentCreateInput = {
        filename: file.name,
        contentType: urlInput.contentType,
        size: file.size,
        s3Key: urlRes.data.s3Key,
        businessUnit,
        relatedTo: relatedTo ?? null,
        description: description ?? null,
        tags: [],
      };
      const createRes = await apiFetch<DocumentRecord>('/api/documents', {
        method: 'POST',
        body: JSON.stringify(createInput),
      });
      return createRes.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/documents/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

/**
 * Fetch a fresh presigned download URL. Doesn't cache via React Query — each
 * call returns a short-lived URL we want to use immediately.
 */
export async function fetchDownloadUrl(id: string, forceDownload = false): Promise<string> {
  const qs = forceDownload ? '?download=true' : '';
  const res = await apiFetch<DownloadUrlResponse>(`/api/documents/${id}/download-url${qs}`);
  return res.data.downloadUrl;
}
