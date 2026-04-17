import type { AgentType, AIChatMessage } from '@web-learn/shared';
import { AGENT_SKILLS } from '@web-learn/shared';
import { getAvailableSkills } from './skills';

const BUILDING_BASE_PROMPT = `你是 Web Learn 专题构建助手。你的职责是帮助用户创建交互式学习专题。

核心能力：
1. 理解用户需求，规划清晰的教学结构
2. 创建、修改、删除文件
3. 生成完整、可运行的代码
4. 优先使用中文界面和中文注释

技术要求：
- 使用 React 18 + TypeScript + Tailwind CSS
- 确保代码完整可运行
- 注重用户体验和交互设计

工作流程：
1. 理解需求
2. 规划结构（如果用户需要）
3. 实现代码
4. 测试验证`;

const LEARNING_BASE_PROMPT = `你是 Web Learn 学习助手。你的职责是帮助用户理解和学习专题内容。

核心能力：
1. 理解专题结构和内容
2. 回答用户关于专题的问题
3. 提供学习建议和导航
4. 解释代码和概念

工作方式：
- 优先使用中文交流
- 提供清晰的解释和示例
- 引导用户理解核心概念
- 适应用户的学习节奏`;

export function buildSystemPrompt(input: {
  agentType: AgentType;
  selectedSkills: string[];
  topicTitle?: string;
}): AIChatMessage {
  const fragments = getAvailableSkills(input.agentType)
    .filter((skill) => input.selectedSkills.includes(skill.id))
    .map((skill) => `- ${skill.systemPromptFragment}`);

  const basePrompt = input.agentType === 'building' ? BUILDING_BASE_PROMPT : LEARNING_BASE_PROMPT;
  
  const parts = [basePrompt];
  
  if (input.topicTitle) {
    parts.push(`当前专题：${input.topicTitle}`);
  }
  
  if (fragments.length > 0) {
    parts.push(`当前启用 skills:\n${fragments.join('\n')}`);
  }

  return {
    role: 'system',
    content: parts.join('\n\n'),
  };
}

export function buildSkillPrompt(selectedSkills: string[]): string {
  if (selectedSkills.length === 0) {
    return '';
  }
  
  const allSkills = [...AGENT_SKILLS];
  const activeSkills = allSkills.filter((skill) => selectedSkills.includes(skill.id));
  
  return activeSkills.map((skill) => skill.systemPromptFragment).join('\n');
}
