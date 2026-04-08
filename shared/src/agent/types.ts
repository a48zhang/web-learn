// Agent tool definitions shared between frontend and model protocol
export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// Result returned by a tool execution
export interface AgentToolResult {
  content: string;
  isError?: boolean;
}

// Visible message persisted to backend
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Agent runtime state (frontend only, not sent to backend)
export interface AgentRunState {
  isRunning: boolean;
  currentToolName?: string | null;
  currentToolPath?: string | null;
  error: string | null;
}
