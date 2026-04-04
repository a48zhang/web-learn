// User types
export type UserRoleType = 'admin' | 'teacher' | 'student';
// Admin accounts are reserved and should be provisioned manually, not via public registration.

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRoleType;
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

// Topic types
export type TopicStatusType = 'draft' | 'published' | 'closed';
export type TopicType = 'knowledge' | 'website';

export interface Topic {
  id: string;
  title: string;
  description?: string;
  type: TopicType;
  websiteUrl?: string | null;
  createdBy: string;
  status: TopicStatusType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicDto {
  title: string;
  description?: string;
  type?: TopicType;
  websiteUrl?: string;
}

export interface UpdateTopicDto {
  title?: string;
  description?: string;
  type?: TopicType;
  websiteUrl?: string | null;
}

export interface UpdateTopicStatusDto {
  status: TopicStatusType;
}

export interface DeleteTopicResponse {
  id: string;
}

// Topic page types
export interface TopicPage {
  id: string;
  topicId: string;
  title: string;
  content: string;
  parentPageId?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicPageTreeNode extends TopicPage {
  children: TopicPageTreeNode[];
}

export interface CreateTopicPageDto {
  title: string;
  content?: string;
  parent_page_id?: string | null;
}

export interface UpdateTopicPageDto {
  title?: string;
  content?: string;
  parent_page_id?: string | null;
}

export interface ReorderTopicPagesDto {
  pages: Array<{
    id: string;
    order: number;
    parent_page_id?: string | null;
  }>;
}

// AI chat types
export type AIChatAgentType = 'learning' | 'building';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface AIChatRequestDto {
  messages: AIChatMessage[];
  topic_id: number;
  agent_type: AIChatAgentType;
}

export interface AIChatResponseDto {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: AIChatMessage;
    finish_reason: string | null;
  }>;
}

// Website topic types
export interface WebsiteStats {
  topicId: string;
  fileCount: number;
  totalSize: number;
  uploadedAt?: string;
  websiteUrl?: string | null;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const UserRole = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export const TopicStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
} as const;

export const TopicTypeMap = {
  KNOWLEDGE: 'knowledge',
  WEBSITE: 'website',
} as const;
