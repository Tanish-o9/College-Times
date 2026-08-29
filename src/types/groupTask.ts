export interface GroupTask {
  id?: string;
  groupId: string;
  title: string;
  description: string;
  createdBy: string;
  creatorName: string;
  assignedTo?: string;
  assignedToName?: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: any;
  milestone?: string;
  createdAt: any;
  updatedAt?: any;
}
