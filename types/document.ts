import type { PolyRelatedType } from '@/lib/constants/enums';

export type DocumentRelatedTo = {
  type: PolyRelatedType;
  id: string;
};

export type DocumentRecord = {
  _id: string;
  filename: string;
  contentType: string;
  size: number;
  businessUnit: string;
  relatedTo: DocumentRelatedTo | null;
  description: string | null;
  tags: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentListMeta = { page: number; limit: number; total: number };

export type DocumentListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  businessUnit?: string;
  relatedToType?: PolyRelatedType;
  relatedToId?: string;
  sort?: string;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
};

export type DownloadUrlResponse = {
  downloadUrl: string;
  expiresIn: number;
};
