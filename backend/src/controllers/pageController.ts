import { Op } from 'sequelize';
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic, TopicPage } from '../models';

const normalizeId = (rawId: string) => {
  const id = parseInt(rawId, 10);
  return Number.isNaN(id) ? null : id;
};

const formatPage = (page: TopicPage) => ({
  id: page.id.toString(),
  topicId: page.topic_id.toString(),
  title: page.title,
  content: page.content,
  parentPageId: page.parent_page_id ? page.parent_page_id.toString() : null,
  order: page.order,
  createdAt: page.createdAt.toISOString(),
  updatedAt: page.updatedAt.toISOString(),
});

const toTree = (pages: TopicPage[]) => {
  const nodes = pages.map((page) => ({ ...formatPage(page), children: [] as any[] }));
  const map = new Map<number, (typeof nodes)[number]>();
  for (const node of nodes) map.set(parseInt(node.id, 10), node);

  const roots: typeof nodes = [];
  for (const node of nodes) {
    if (node.parentPageId) {
      const parent = map.get(parseInt(node.parentPageId, 10));
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

const assertTopicWritableByUser = async (topicId: number, req: AuthRequest) => {
  const topic = await Topic.findByPk(topicId);
  if (!topic) return { status: 404, error: 'Topic not found' } as const;
  if (topic.type !== 'knowledge') return { status: 400, error: 'Only knowledge topics support pages' } as const;
  if (!req.user || req.user.role !== 'teacher' || topic.created_by !== req.user.id) {
    return { status: 403, error: 'Access denied' } as const;
  }
  return { topic } as const;
};

export const createPage = async (req: AuthRequest, res: Response) => {
  try {
    const topicId = normalizeId(req.params.id);
    if (!topicId) return res.status(400).json({ success: false, error: 'Invalid topic ID' });

    const auth = await assertTopicWritableByUser(topicId, req);
    if ('error' in auth) return res.status(auth.status).json({ success: false, error: auth.error });

    const { title, content = '', parent_page_id } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const parentId = parent_page_id ? Number(parent_page_id) : null;
    if (parentId) {
      const parent = await TopicPage.findByPk(parentId);
      if (!parent || parent.topic_id !== topicId) {
        return res.status(400).json({ success: false, error: 'Invalid parent_page_id' });
      }
    }

    const maxOrderPage = await TopicPage.findOne({
      where: {
        topic_id: topicId,
        parent_page_id: parentId,
      },
      order: [['order', 'DESC']],
    });

    const page = await TopicPage.create({
      topic_id: topicId,
      title,
      content,
      parent_page_id: parentId,
      order: maxOrderPage ? maxOrderPage.order + 1 : 0,
    });

    return res.status(201).json({ success: true, data: formatPage(page) });
  } catch (error) {
    console.error('Create page error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getPagesByTopic = async (req: Request, res: Response) => {
  try {
    const topicId = normalizeId(req.params.id);
    if (!topicId) return res.status(400).json({ success: false, error: 'Invalid topic ID' });

    const topic = await Topic.findByPk(topicId);
    if (!topic || topic.status !== 'published') {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (topic.type !== 'knowledge') {
      return res.status(400).json({ success: false, error: 'Only knowledge topics have pages' });
    }

    const pages = await TopicPage.findAll({
      where: { topic_id: topicId },
      order: [
        ['parent_page_id', 'ASC'],
        ['order', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({ success: true, data: toTree(pages) });
  } catch (error) {
    console.error('Get pages by topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getPageById = async (req: Request, res: Response) => {
  try {
    const pageId = normalizeId(req.params.id);
    if (!pageId) return res.status(400).json({ success: false, error: 'Invalid page ID' });

    const page = await TopicPage.findByPk(pageId);
    if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

    const topic = await Topic.findByPk(page.topic_id);
    if (!topic || topic.status !== 'published') {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    return res.json({ success: true, data: formatPage(page) });
  } catch (error) {
    console.error('Get page by id error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updatePage = async (req: AuthRequest, res: Response) => {
  try {
    const pageId = normalizeId(req.params.id);
    if (!pageId) return res.status(400).json({ success: false, error: 'Invalid page ID' });

    const page = await TopicPage.findByPk(pageId);
    if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

    const auth = await assertTopicWritableByUser(page.topic_id, req);
    if ('error' in auth) return res.status(auth.status).json({ success: false, error: auth.error });

    const { title, content, parent_page_id } = req.body;
    if (title !== undefined) page.title = title;
    if (content !== undefined) page.content = content;

    if (parent_page_id !== undefined) {
      const parentId = parent_page_id ? Number(parent_page_id) : null;
      if (parentId === page.id) {
        return res.status(400).json({ success: false, error: 'parent_page_id cannot equal page id' });
      }
      if (parentId) {
        const parent = await TopicPage.findByPk(parentId);
        if (!parent || parent.topic_id !== page.topic_id) {
          return res.status(400).json({ success: false, error: 'Invalid parent_page_id' });
        }
      }
      page.parent_page_id = parentId;
    }

    await page.save();
    return res.json({ success: true, data: formatPage(page) });
  } catch (error) {
    console.error('Update page error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deletePage = async (req: AuthRequest, res: Response) => {
  try {
    const pageId = normalizeId(req.params.id);
    if (!pageId) return res.status(400).json({ success: false, error: 'Invalid page ID' });

    const page = await TopicPage.findByPk(pageId);
    if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

    const auth = await assertTopicWritableByUser(page.topic_id, req);
    if ('error' in auth) return res.status(auth.status).json({ success: false, error: auth.error });

    const queue: number[] = [page.id];
    const toDelete = new Set<number>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (toDelete.has(current)) continue;
      toDelete.add(current);
      const children = await TopicPage.findAll({ where: { parent_page_id: current }, attributes: ['id'] });
      for (const child of children) queue.push(child.id);
    }

    await TopicPage.destroy({ where: { id: { [Op.in]: Array.from(toDelete) } } });
    return res.json({ success: true, data: { deleted: Array.from(toDelete).map((id) => id.toString()) } });
  } catch (error) {
    console.error('Delete page error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const reorderPages = async (req: AuthRequest, res: Response) => {
  try {
    const topicId = normalizeId(req.params.id);
    if (!topicId) return res.status(400).json({ success: false, error: 'Invalid topic ID' });

    const auth = await assertTopicWritableByUser(topicId, req);
    if ('error' in auth) return res.status(auth.status).json({ success: false, error: auth.error });

    const { pages } = req.body as {
      pages?: Array<{ id: number | string; order: number; parent_page_id?: number | string | null }>;
    };
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, error: 'pages is required' });
    }

    const ids = pages.map((p) => Number(p.id)).filter((id) => !Number.isNaN(id));
    const existing = await TopicPage.findAll({ where: { id: { [Op.in]: ids }, topic_id: topicId } });
    if (existing.length !== ids.length) {
      return res.status(400).json({ success: false, error: 'One or more pages are invalid' });
    }

    for (const item of pages) {
      const page = existing.find((p) => p.id === Number(item.id));
      if (!page) continue;
      page.order = item.order;
      page.parent_page_id =
        item.parent_page_id === undefined
          ? page.parent_page_id
          : item.parent_page_id === null
            ? null
            : Number(item.parent_page_id);
      await page.save();
    }

    const updated = await TopicPage.findAll({
      where: { topic_id: topicId },
      order: [
        ['parent_page_id', 'ASC'],
        ['order', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({ success: true, data: toTree(updated) });
  } catch (error) {
    console.error('Reorder pages error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
