import {
  File,
  FileSpreadsheet,
  FileText,
  Image,
  type LucideIcon,
} from 'lucide-react';

type IconConfig = { icon: LucideIcon; label: string; color: string };

/** Maps a MIME type to a lucide icon + colour + short label. Best-effort. */
export function getFileTypeInfo(contentType: string): IconConfig {
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/')) return { icon: Image, label: 'Image', color: '#8b5cf6' };
  if (ct === 'application/pdf') return { icon: FileText, label: 'PDF', color: '#ef4444' };
  if (ct.includes('spreadsheet') || ct === 'application/vnd.ms-excel') {
    return { icon: FileSpreadsheet, label: 'Spreadsheet', color: '#10b981' };
  }
  if (
    ct.includes('word') ||
    ct.startsWith('text/') ||
    ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { icon: FileText, label: 'Document', color: '#3b82f6' };
  }
  return { icon: File, label: 'File', color: '#64748b' };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
