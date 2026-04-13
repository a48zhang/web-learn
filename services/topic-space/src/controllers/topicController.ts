import { Response } from 'express';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { Topic } from '../models';
import { sequelize } from '../utils/database';
import { getStorageService } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';

const formatTopic = (topic: any) => ({
  id: topic.id,
  title: topic.title,
  description: topic.description,
  type: topic.type,
  createdBy: topic.created_by,
  status: topic.status,
  publishedUrl: topic.published_url ?? null,
  shareLink: topic.share_link ?? null,
  editors: topic.editors ?? [],
  createdAt: topic.createdAt.toISOString(),
  updatedAt: topic.updatedAt.toISOString(),
});

const hasTopicEditAccess = (topic: any, req: AuthRequest) =>
  req.user && (topic.editors?.includes(String(req.user.id)) || req.user.role === 'admin');

const hasTopicViewAccess = (topic: any, req: AuthRequest) =>
  topic.status === 'published' || hasTopicEditAccess(topic, req);

// Create a new topic
export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const userId = req.user.id;
    const topic = await Topic.create({
      id: uuidv4(),
      title,
      description,
      type: 'website',
      created_by: userId,
      status: 'draft',
      editors: [userId],
    });

    return res.status(201).json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Create topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get topic list (published for everyone, editors/admin also see draft/closed)
export const getTopics = async (req: AuthRequest | any, res: Response) => {
  try {
    const topics = await Topic.findAll({
      order: [['created_at', 'DESC']],
    });

    let filtered = topics;
    if (req.user?.role !== 'admin') {
      const uid = req.user ? String(req.user.id) : null;
      filtered = topics.filter(
        (t) => t.status === 'published' || (uid && t.editors?.includes(uid))
      );
    }

    return res.json({
      success: true,
      data: filtered.map((topic) => formatTopic(topic)),
    });
  } catch (error) {
    console.error('Get topics error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get topic detail (public for published, owner/admin can see non-published)
export const getTopicById = async (req: AuthRequest | any, res: Response) => {
  try {
    const topic = await Topic.findByPk(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!hasTopicViewAccess(topic, req as AuthRequest)) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Get topic by ID error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Update topic (owner only)
export const updateTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const topic = await Topic.findByPk(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { title, description } = req.body;

    if (title !== undefined) topic.title = title;
    if (description !== undefined) topic.description = description;

    await topic.save();
    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Update topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Update topic status (publish/close)
export const updateTopicStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const topic = await Topic.findByPk(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { status } = req.body;
    if (!['draft', 'published', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    topic.status = status as 'draft' | 'published' | 'closed';
    await topic.save();
    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Update topic status error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const topic = await Topic.findByPk(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // C3: clean up OSS content before deleting the DB record
    const storageService = getStorageService();
    const ossPrefix = `topics/${topic.id}/`;
    try {
      await storageService.deleteDir(ossPrefix);
    } catch (err) {
      console.warn(`[deleteTopic] Failed to delete OSS files for topic ${topic.id}:`, err);
      // continue with DB deletion regardless of OSS failure
    }

    await sequelize.transaction(async (transaction) => {
      await Topic.destroy({ where: { id: topic.id }, transaction });
    });

    return res.json({ success: true, data: { id: topic.id } });
  } catch (error) {
    console.error('Delete topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
