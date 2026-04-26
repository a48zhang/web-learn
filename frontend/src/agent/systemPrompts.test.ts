import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './systemPrompts';

describe('systemPrompts', () => {
  it('describes the agent workspace as project-root-relative instead of /home/project', () => {
    const prompt = buildSystemPrompt({
      agentType: 'building',
      selectedSkills: [],
    }).content;

    expect(prompt).toContain('项目根相对路径');
    expect(prompt).toContain('src/App.tsx');
    expect(prompt).toContain('run_command 会在项目根目录执行');
    expect(prompt).not.toContain('工作区（/home/project）');
  });
});
