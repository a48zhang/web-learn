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

工作区说明：
- 当前工作区是项目根目录，已包含一个基础的 React 18 + TypeScript + Vite 脚手架
- 文件工具的 path、oldPath、newPath 参数必须使用项目根相对路径，例如 package.json、index.html、src/App.tsx
- 不要在文件工具参数中使用绝对路径、/home/project、./ 前缀或 .. 路径
- list_files 返回的路径就是后续 read_file、write_file、create_file、delete_file、move_file 应使用的路径
- run_command 会在项目根目录执行，因此命令中的文件路径也优先使用相对路径，例如 npm run build、cat src/App.tsx
- 已存在的文件包括：package.json、index.html、tsconfig.json、vite.config.ts 以及 src/* 目录下的源文件
- 优先编辑已有文件，而非重新创建项目结构或配置
- 仅在用户需求明确需要时才修改 package.json、vite.config.ts 或 tsconfig.json（例如添加新依赖）

工作流程：
1. 理解需求
2. 规划结构（如果用户需要）
3. 实现代码
4. 测试验证

重要提示：你正在一个WebContaier环境中工作，因此你必须避免部分在当前环境可能不工作的操作，例如：
- 你不能试图用cli去初始化tailwind，强烈建议使用cdn

`;

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
