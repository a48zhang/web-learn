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
  ownerId: string;
  type: 'document' | 'video' | 'link' | 'other';
  title?: string;
  uri: string;
  uploadedAt: string;
}

export interface CreateResourceDto {
  type: 'document' | 'video' | 'link' | 'other';
  title?: string;
  uri?: string; // For links
}

// Task types
export interface Task {
  id: string;
  topicId: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
}

// Submission types
export interface SubmissionTaskSummary {
  id: string;
  title: string;
  topic?: {
    id: string;
    title: string;
  };
}

export interface SubmissionStudentSummary {
  id: string;
  username: string;
  email: string;
}

export interface Submission {
  id: string;
  taskId: string;
  studentId: string;
  content?: string;
  fileUrl?: string;
  submittedAt: string;
  task?: SubmissionTaskSummary;
  student?: SubmissionStudentSummary;
}

export interface SubmissionWithContext extends Submission {
  task?: SubmissionTaskSummary;
  student?: SubmissionStudentSummary;
}

export interface CreateSubmissionDto {
  content?: string;
  file?: File;
}

// Review types
export interface Review {
  id: string;
  submissionId: string;
  reviewerId: string;
  score?: number;
  feedback?: string;
  reviewedAt: string;
}

export interface CreateReviewDto {
  score?: number;
  feedback?: string;
}

export interface UpdateReviewDto {
  score?: number;
  feedback?: string;
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
