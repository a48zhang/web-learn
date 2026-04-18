import { AGENT_SKILLS, type AgentSkillDefinition, type AgentType } from '@web-learn/shared';

export function getAvailableSkills(agentType: AgentType): AgentSkillDefinition[] {
  return AGENT_SKILLS.filter((skill) => skill.appliesTo === 'both' || skill.appliesTo === agentType);
}
