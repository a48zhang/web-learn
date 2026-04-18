export interface AgentToolResult {
  content: string;
  isError?: boolean;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolAction {
  id: string;
  name: string;
  args: any;
  state: 'running' | 'success' | 'error';
  result?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolAction[];
}

export interface AgentRunState {
  isRunning: boolean;
  currentToolName?: string | null;
  currentToolPath?: string | null;
  error: string | null;
}

import type { AgentType } from './skills';

export interface AgentConversationSummary {
  id: string;
  topicId: string;
  userId: string;
  agentType: AgentType;
  selectedSkills: string[];
  updatedAt: string;
}

export interface PersistedAgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AgentCompressedContext {
  summary: string;
  summaryVersion: number;
  firstUncompressedMessageId: string | null;
  updatedAt: string;
  hasCompressedContext: boolean;
}

export interface PersistedConversationState {
  selectedSkills: string[];
  compressedContext: AgentCompressedContext;
  messages: PersistedAgentMessage[];
}
