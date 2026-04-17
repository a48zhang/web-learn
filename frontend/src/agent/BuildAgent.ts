import { BaseAgent } from './BaseAgent';
import type { AgentType } from '@web-learn/shared';

export class BuildAgent extends BaseAgent {
  getAgentType(): AgentType {
    return 'building';
  }
}
