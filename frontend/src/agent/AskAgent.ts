import { BaseAgent } from './BaseAgent';
import type { AgentType } from '@web-learn/shared';

export class AskAgent extends BaseAgent {
  getAgentType(): AgentType {
    return 'learning';
  }
}
