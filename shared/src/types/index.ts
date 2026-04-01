// User types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'teacher' | 'student';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: 'teacher' | 'student';
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Topic/Project types
export interface Topic {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  status: 'draft' | 'published' | 'closed';
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicDto {
  title: string;
  description?: string;
  deadline?: string;
}

export interface UpdateTopicDto {
  title?: string;
  description?: string;
  deadline?: string;
}

export interface UpdateTopicStatusDto {
  status: 'draft' | 'published' | 'closed';
}

// Resource types
export interface Resource {
  id: string;
  topicId: string;
  title: string;
  type: 'document' | 'link' | 'file';
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export interface CreateResourceDto {
  topicId: string;
  title: string;
  type: 'document' | 'link' | 'file';
  url: string;
}

// Task types
export interface Task {
  id: string;
  topicId: string;
  title: string;
  description: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  topicId: string;
  title: string;
  description: string;
  assignedTo?: string;
  dueDate?: string;
}

// Submission types
export interface Submission {
  id: string;
  taskId: string;
  studentId: string;
  content: string;
  attachments?: string[];
  status: 'submitted' | 'graded';
  grade?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

export interface CreateSubmissionDto {
  taskId: string;
  content: string;
  attachments?: string[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Status enum
export const UserRole = {
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export const TopicStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
} as const;

export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const SubmissionStatus = {
  SUBMITTED: 'submitted',
  GRADED: 'graded',
} as const;