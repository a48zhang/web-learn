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
