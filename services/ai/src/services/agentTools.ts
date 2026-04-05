import { Op } from 'sequelize';
import { Topic, TopicPage } from '../models';

type ToolContext = {
  topicId: number;
  userId: number;
  userRole: string;
};

type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, context: ToolContext) => Promise<any>;
};

const toPageTree = (pages: TopicPage[]) => {
  const nodes = pages.map((page) => ({
    id: page.id,
    topic_id: page.topic_id,
    title: page.title,
    order: page.order,
    parent_page_id: page.parent_page_id ?? null,
    children: [] as any[],
  }));
  const map = new Map<number, (typeof nodes)[number]>();
  for (const node of nodes) map.set(node.id, node);

  const roots: typeof nodes = [];
  for (const node of nodes) {
    if (node.parent_page_id) {
      const parent = map.get(node.parent_page_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }
  return roots;
};

const ensureTopicAccess = async (topicId: number) => {
  const topic = await Topic.findByPk(topicId);
  if (!topic) {
    throw new Error('Topic not found');
  }
  if (topic.status !== 'published') {
    throw new Error('Topic is not published');
  }
  return topic;
};

const ensureBuildingAccess = async (topicId: number, context: ToolContext) => {
  const topic = await Topic.findByPk(topicId);
  if (!topic) {
    throw new Error('Topic not found');
  }
  if (context.userRole !== 'teacher' || topic.created_by !== context.userId) {
    throw new Error('Access denied');
  }
  if (topic.type !== 'knowledge') {
    throw new Error('Building assistant only supports knowledge topics');
  }
  return topic;
};

const learningTools: AgentTool[] = [
  {
    name: 'get_topic_info',
    description: '获取专题基础信息与状态',
    parameters: {
      type: 'object',
      properties: {
        topic_id: { type: 'integer', description: '专题ID' },
      },
      required: ['topic_id'],
    },
    execute: async (args, context) => {
      const topicId = Number(args.topic_id || context.topicId);
      const topic = await ensureTopicAccess(topicId);
      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        type: topic.type,
        status: topic.status,
      };
    },
  },
  {
    name: 'list_pages',
    description: '列出专题所有页面（仅知识库型）',
    parameters: {
      type: 'object',
      properties: {
        topic_id: { type: 'integer', description: '专题ID' },
      },
      required: ['topic_id'],
    },
    execute: async (args, context) => {
      const topicId = Number(args.topic_id || context.topicId);
      const topic = await ensureTopicAccess(topicId);
      if (topic.type !== 'knowledge') {
        return [];
      }
      const pages = await TopicPage.findAll({
        where: { topic_id: topicId },
        order: [['parent_page_id', 'ASC'], ['order', 'ASC'], ['id', 'ASC']],
      });
      return toPageTree(pages);
    },
  },
  {
    name: 'read_page',
    description: '读取页面内容',
    parameters: {
      type: 'object',
      properties: {
        page_id: { type: 'integer', description: '页面ID' },
      },
      required: ['page_id'],
    },
    execute: async (args, context) => {
      const pageId = Number(args.page_id);
      const page = await TopicPage.findByPk(pageId);
      if (!page || page.topic_id !== context.topicId) {
        throw new Error('Page not found');
      }
      return {
        id: page.id,
        topic_id: page.topic_id,
        title: page.title,
        content: page.content,
      };
    },
  },
  {
    name: 'grep',
    description: '在专题内容中搜索关键词',
    parameters: {
      type: 'object',
      properties: {
        topic_id: { type: 'integer', description: '专题ID' },
        keyword: { type: 'string', description: '搜索关键词' },
      },
      required: ['topic_id', 'keyword'],
    },
    execute: async (args, context) => {
      const topicId = Number(args.topic_id || context.topicId);
      const keyword = String(args.keyword || '').trim();
      if (!keyword) return [];
      await ensureTopicAccess(topicId);
      // Escape LIKE special characters: %, _ and \
      const escapedKeyword = keyword.replace(/[%_\\]/g, '\\$&');
      const pages = await TopicPage.findAll({
        where: {
          topic_id: topicId,
          content: {
            [Op.like]: `%${escapedKeyword}%`,
          },
        },
        order: [['id', 'ASC']],
      });
      return pages.map((page) => {
        const idx = page.content.toLowerCase().indexOf(keyword.toLowerCase());
        const start = Math.max(0, idx - 80);
        const end = idx === -1 ? 160 : Math.min(page.content.length, idx + keyword.length + 80);
        return {
          page_id: page.id,
          title: page.title,
          snippet: page.content.slice(start, end),
        };
      });
    },
  },
];

const buildingTools: AgentTool[] = [
  ...learningTools,
  {
    name: 'write_file',
    description: '写入页面 Markdown 内容（直接落库）',
    parameters: {
      type: 'object',
      properties: {
        page_id: { type: 'integer', description: '页面ID' },
        content: { type: 'string', description: 'Markdown 内容' },
      },
      required: ['page_id', 'content'],
    },
    execute: async (args, context) => {
      await ensureBuildingAccess(context.topicId, context);
      const pageId = Number(args.page_id);
      const page = await TopicPage.findByPk(pageId);
      if (!page || page.topic_id !== context.topicId) {
        throw new Error('Page not found');
      }
      page.content = String(args.content ?? '');
      await page.save();
      return { page_id: page.id, updated: true };
    },
  },
  {
    name: 'new_file',
    description: '创建新页面（直接落库）',
    parameters: {
      type: 'object',
      properties: {
        topic_id: { type: 'integer', description: '专题ID' },
        title: { type: 'string', description: '页面标题' },
        parent_page_id: { type: 'integer', description: '父页面ID（可选）' },
      },
      required: ['topic_id', 'title'],
    },
    execute: async (args, context) => {
      const topicId = Number(args.topic_id || context.topicId);
      await ensureBuildingAccess(topicId, context);
      const parentId = args.parent_page_id ? Number(args.parent_page_id) : null;
      const maxOrderPage = await TopicPage.findOne({
        where: { topic_id: topicId, parent_page_id: parentId },
        order: [['order', 'DESC']],
      });
      const page = await TopicPage.create({
        topic_id: topicId,
        title: String(args.title),
        content: '',
        parent_page_id: parentId,
        order: maxOrderPage ? maxOrderPage.order + 1 : 0,
      });
      return { page_id: page.id, topic_id: page.topic_id, title: page.title };
    },
  },
];

export const getLearningTools = () => learningTools;
export const getBuildingTools = () => buildingTools;

export const findTool = (name: string, tools: AgentTool[]) => tools.find((tool) => tool.name === name);

export type { AgentTool, ToolContext };
