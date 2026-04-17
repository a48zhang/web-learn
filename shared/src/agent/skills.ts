export type AgentType = 'building' | 'learning';

export interface AgentSkillDefinition {
  id: string;
  name: string;
  description: string;
  appliesTo: AgentType | 'both';
  systemPromptFragment: string;
  toolNames?: string[];
}

export const AGENT_SKILLS: AgentSkillDefinition[] = [
  {
    id: 'topic-planner',
    name: '专题规划',
    description: '先规划教学结构，再进入实现',
    appliesTo: 'building',
    systemPromptFragment: '优先输出专题结构方案，得到确认后再生成代码。',
  },
  {
    id: 'topic-navigator',
    name: '内容导览',
    description: '优先定位结构和导航路径',
    appliesTo: 'learning',
    systemPromptFragment: '优先帮助用户定位模块、结构和阅读路径。',
  },
];
