export type CaseChecklistItem = {
  _id: string;
  caseId: string;
  businessUnit: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  dueDate: string | null;
  order: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};
