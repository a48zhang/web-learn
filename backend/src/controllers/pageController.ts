import { Op } from 'sequelize';
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic, TopicPage } from '../models';
import { sequelize } from '../utils/database';

const ROOT_PARENT_KEY = 'root';

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
  if (!topic) return { ok: false, status: 404, error: 'Topic not found' } as const;
  if (topic.type !== 'knowledge') return { ok: false, status: 400, error: 'Only knowledge topics support pages' } as const;
  if (!req.user || req.user.role !== 'teacher' || topic.created_by !== req.user.id) {
    return { ok: false, status: 403, error: 'Access denied' } as const;
  }
  return { ok: true, topic } as const;
};

export const createPage = async (req: AuthRequest, res: Response) => {
  try {
    const topicId = normalizeId(req.params.id);
    if (!topicId) return res.status(400).json({ success: false, error: 'Invalid topic ID' });

    const auth = await assertTopicWritableByUser(topicId, req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

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
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    const authReq = req as AuthRequest;
    const canViewPrivate =
      authReq.user &&
      (authReq.user.role === 'admin' ||
        (authReq.user.role === 'teacher' && authReq.user.id === topic.created_by));
    if (topic.status !== 'published' && !canViewPrivate) {
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
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    const authReq = req as AuthRequest;
    const canViewPrivate =
      authReq.user &&
      (authReq.user.role === 'admin' ||
        (authReq.user.role === 'teacher' && authReq.user.id === topic.created_by));
    if (topic.status !== 'published' && !canViewPrivate) {
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
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

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
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

    const deletedIds = await sequelize.transaction(async (transaction) => {
      const queue: number[] = [page.id];
      const toDelete = new Set<number>();
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (toDelete.has(current)) continue;
        toDelete.add(current);
        const children = await TopicPage.findAll({
          where: { parent_page_id: current },
          attributes: ['id'],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        for (const child of children) queue.push(child.id);
      }
      const ids = Array.from(toDelete);
      await TopicPage.destroy({
        where: { id: { [Op.in]: ids } },
        transaction,
      });
      return ids;
    });

    return res.json({ success: true, data: { deleted: deletedIds.map((id) => id.toString()) } });
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
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

    const { pages } = req.body as {
      pages?: Array<{ id: number | string; order: number; parent_page_id?: number | string | null }>;
    };
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, error: 'pages is required' });
    }

    const ids = pages.map((p) => Number(p.id)).filter((id) => !Number.isNaN(id));
    if (ids.length !== pages.length || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'One or more pages are invalid' });
    }
    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ success: false, error: 'Duplicate page ids are not allowed' });
    }

    const existing = await TopicPage.findAll({ where: { id: { [Op.in]: ids }, topic_id: topicId } });
    if (existing.length !== ids.length) {
      return res.status(400).json({ success: false, error: 'One or more pages are invalid' });
    }

    const existingMap = new Map(existing.map((page) => [page.id, page]));
    for (const item of pages) {
      if (!Number.isInteger(item.order) || item.order < 0) {
        return res.status(400).json({ success: false, error: 'order must be a non-negative integer' });
      }
      if (item.parent_page_id !== undefined && item.parent_page_id !== null) {
        const parentId = Number(item.parent_page_id);
        if (!Number.isInteger(parentId) || !existingMap.has(parentId)) {
          return res.status(400).json({ success: false, error: 'One or more parent_page_id are invalid' });
        }
        if (parentId === Number(item.id)) {
          return res.status(400).json({ success: false, error: 'parent_page_id cannot equal page id' });
        }
      }
    }

    const parentToOrders = new Map<string, Set<number>>();
    for (const item of pages) {
      const parentKey = item.parent_page_id === null || item.parent_page_id === undefined
        ? ROOT_PARENT_KEY
        : String(item.parent_page_id);
      const orders = parentToOrders.get(parentKey) ?? new Set<number>();
      if (orders.has(item.order)) {
        return res.status(400).json({ success: false, error: 'Duplicate order within same parent is not allowed' });
      }
      orders.add(item.order);
      parentToOrders.set(parentKey, orders);
    }

    await sequelize.transaction(async (transaction) => {
      const lockedPages = await TopicPage.findAll({
        where: { id: { [Op.in]: ids }, topic_id: topicId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const lockedMap = new Map(lockedPages.map((page) => [page.id, page]));

      for (const item of pages) {
        const page = lockedMap.get(Number(item.id));
        if (!page) continue;
        page.order = item.order;
        page.parent_page_id =
          item.parent_page_id === undefined
            ? page.parent_page_id
            : item.parent_page_id === null
              ? null
              : Number(item.parent_page_id);
        await page.save({ transaction });
      }
    });

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
