// User types
export type UserRoleType = 'admin' | 'user';
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
  role: 'user';
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
export type TopicType = 'website';

export interface Topic {
  id: string;
  title: string;
  description?: string;
  type: TopicType;
  websiteUrl?: string | null;
  createdBy: string;
  status: TopicStatusType;
  filesSnapshot?: Record<string, string> | null;
  chatHistory?: AIChatMessage[] | null;
  publishedUrl?: string | null;
  shareLink?: string | null;
  editors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicDto {
  title: string;
  description?: string;
  type?: TopicType;
}

export interface UpdateTopicDto {
  title?: string;
  description?: string;
  type?: TopicType;
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
export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

// Website topic types
export interface WebsiteStats {
  fileCount: number;
  totalSize: number;
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
  USER: 'user',
} as const;

export const TopicStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
} as const;

export const TopicTypeMap = {
  WEBSITE: 'website',
} as const;

// Editor types
export interface EditorFile {
  path: string;
  content: string;
  isDirty: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileOperation {
  action: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
}

export interface AgentFileOperation {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
}

export interface AgentResponse {
  message: string;
  files: AgentFileOperation[];
}

export interface EditorState {
  files: Record<string, string>; // path -> content
  openFiles: string[]; // list of open file paths
  activeFile: string | null;
  isWebContainerReady: boolean;
  previewUrl: string | null;
}

export type { AgentToolDefinition, AgentToolResult, AgentMessage, AgentRunState } from '../agent/types';
