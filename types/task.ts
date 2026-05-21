import type {
  PolyRelatedType,
  TaskPriority,
  TaskStatus,
} from '@/lib/constants/enums';

export type TaskRelatedTo = {
  type: PolyRelatedType;
  id: string;
};

export type Task = {
  _id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  businessUnit: string;
  relatedTo: TaskRelatedTo | null;
  assignedTo: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  tags: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListMeta = { page: number; limit: number; total: number };

export type TaskListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  businessUnit?: string;
  smartListId?: string;
  /** Filter to tasks attached to a specific record. */
  relatedToType?: PolyRelatedType;
  relatedToId?: string;
  /** When true, only tasks whose dueDate is past AND status isn't terminal. */
  overdue?: boolean;
  sort?: string;
};
