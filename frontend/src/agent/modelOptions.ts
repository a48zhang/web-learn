import type { ComponentType } from 'react';
import { XiaomiMiMo, OpenAI, Doubao, Minimax, Qwen } from '@lobehub/icons';

export interface AgentModelOption {
  label: string;
  id: string;
  desc: string;
  Logo: ComponentType;
}

export const AGENT_MODELS: AgentModelOption[] = [
  {
    label: 'Xiaomi MIMO',
    id: 'mimo-v2.5-pro',
    desc: '小米的最新Agentic模型',
    Logo: XiaomiMiMo,
  },
  {
    label: 'GPT-5.5',
    id: 'gpt-5.5',
    desc: '高阶规划、推理与编码模型',
    Logo: OpenAI,
  },
  {
    label: 'Doubao Seed Code',
    id: 'doubao-seed-2.0-code',
    desc: '字节跳动豆包模型，针对代码生成与改造优化',
    Logo: Doubao.Color,
  },
  {
    label: 'MiniMax M2.7',
    id: 'MiniMax-M2.7',
    desc: 'Minimax高速推理模型',
    Logo: Minimax.Color,
  },
  {
    label: 'Qwen 3',
    id: 'qwen3',
    desc: '通义千问高速模型',
    Logo: Qwen.Color,
  },
];
