export interface AgentModelOption {
  label: string;
  id: string;
  desc: string;
  logoUrl: string;
}

export const AGENT_MODELS: AgentModelOption[] = [
  {
    label: 'MiniMax M2.7',
    id: 'MiniMax-M2.7',
    desc: '通用推理模型，上下文理解与速度平衡',
    logoUrl: 'https://avatars.githubusercontent.com/u/194880281?v=4',
  },
  {
    label: 'Qwen 3',
    id: 'qwen3',
    desc: '长逻辑和编程能力表现突出',
    logoUrl: 'https://avatars.githubusercontent.com/u/141221163?v=4',
  },
  {
    label: 'Doubao Seed Code',
    id: 'doubao-seed-2.0-code',
    desc: '针对代码生成与改造优化',
    logoUrl: 'https://avatars.githubusercontent.com/u/67365215?v=4',
  },
  {
    label: 'GPT-5.4',
    id: 'gpt-5.4',
    desc: '高阶规划、推理与编码模型',
    logoUrl: 'https://avatars.githubusercontent.com/u/14957082?v=4',
  },
];
