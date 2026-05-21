'use client';

import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useUploadDocument } from '@/hooks/useDocuments';
import { ApiError } from '@/lib/utils/apiFetch';
import type { PolyRelatedType } from '@/lib/constants/enums';
import { MAX_DOCUMENT_SIZE_BYTES } from '@/lib/utils/validators/document';

type Props = {
  businessUnit: string;
  relatedTo?: { type: PolyRelatedType; id: string };
  label?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function DocumentUploader({
  businessUnit,
  relatedTo,
  label = 'Upload file',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0]!; // process one at a time for v1

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast.error(`File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_DOCUMENT_SIZE_BYTES)}.`);
      return;
    }

    try {
      const doc = await upload.mutateAsync({
        file,
        businessUnit,
        relatedTo: relatedTo ?? null,
      });
      toast.success(`Uploaded ${doc.filename}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Upload failed';
      toast.error(msg);
    } finally {
      // Reset the input so picking the same file again still triggers change.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Upload className="size-3.5" />
        {upload.isPending ? 'Uploading…' : label}
      </Button>
    </>
  );
}
