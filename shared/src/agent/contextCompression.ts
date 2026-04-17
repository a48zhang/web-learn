export interface AgentContextBudget {
  totalContextTokens: number;
  compressionTriggerTokens: number;
  recentWindowTokens: number;
  summaryTargetTokens: number;
}

export interface CompressionDecision {
  shouldCompress: boolean;
  estimatedPromptTokens: number;
}

export function defaultAgentContextBudget(): AgentContextBudget {
  return {
    totalContextTokens: 200_000,
    compressionTriggerTokens: 128_000,
    recentWindowTokens: 32_000,
    summaryTargetTokens: 12_000,
  };
}

export function shouldCompressConversation(
  estimatedPromptTokens: number,
  budget: AgentContextBudget
): CompressionDecision {
  return {
    shouldCompress: estimatedPromptTokens >= budget.compressionTriggerTokens,
    estimatedPromptTokens,
  };
}
