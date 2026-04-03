import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic, User } from '../models';
import { config } from '../utils/config';

const formatTopic = (topic: any) => ({
  id: topic.id.toString(),
  title: topic.title,
  description: topic.description,
  type: topic.type,
  websiteUrl: topic.website_url ?? null,
  createdBy: topic.created_by.toString(),
  creator: topic.creator
    ? {
      id: topic.creator.id.toString(),
      username: topic.creator.username,
      email: topic.creator.email,
    }
    : undefined,
  status: topic.status,
  createdAt: topic.createdAt.toISOString(),
  updatedAt: topic.updatedAt.toISOString(),
});

const parseTopicId = (id: string) => {
  const parsed = parseInt(id, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const ensureTopicOwner = (topic: any, req: AuthRequest) =>
  req.user && req.user.role === 'teacher' && topic.created_by === req.user.id;

// Create a new topic (teacher only)
export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Only teachers can create topics' });
    }

    const { title, description, type = 'knowledge', website_url, websiteUrl } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const normalizedType = type === 'website' ? 'website' : 'knowledge';
    const normalizedWebsiteUrl = website_url ?? websiteUrl ?? null;

    if (normalizedType === 'knowledge' && normalizedWebsiteUrl) {
      return res
        .status(400)
        .json({ success: false, error: 'Knowledge topics cannot set website_url' });
    }

    const topic = await Topic.create({
      title,
      description,
      type: normalizedType,
      website_url: normalizedType === 'website' ? normalizedWebsiteUrl : null,
      created_by: req.user.id,
      status: 'draft',
    });

    return res.status(201).json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Create topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get topic list (public published)
export const getTopics = async (req: AuthRequest | any, res: Response) => {
  try {
    const where: any = { status: 'published' };
    const { type } = req.query as { type?: string };
    if (type === 'knowledge' || type === 'website') {
      where.type = type;
    }

    const topics = await Topic.findAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
      order: [['created_at', 'DESC']],
    });

    return res.json({
      success: true,
      data: topics.map((topic) => formatTopic(topic)),
    });
  } catch (error) {
    console.error('Get topics error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get topic detail (public published)
export const getTopicById = async (req: AuthRequest | any, res: Response) => {
  try {
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
    });
    if (!topic || topic.status !== 'published') {
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

    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { title, description, type, website_url, websiteUrl } = req.body;
    if (title !== undefined) topic.title = title;
    if (description !== undefined) topic.description = description;
    if (type !== undefined) topic.type = type === 'website' ? 'website' : 'knowledge';
    if (website_url !== undefined || websiteUrl !== undefined) {
      topic.website_url = website_url ?? websiteUrl ?? null;
    }
    if (topic.type === 'knowledge') {
      topic.website_url = null;
    }

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
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
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

export const uploadWebsite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (topic.type !== 'website') {
      return res
        .status(400)
        .json({ success: false, error: 'Only website topics support website uploads' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'ZIP file is required' });
    }

    topic.website_url = `/uploads/${req.file.filename}`;
    await topic.save();
    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Upload website error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateWebsite = uploadWebsite;

export const deleteWebsite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (topic.website_url?.startsWith('/uploads/')) {
      const filename = topic.website_url.slice('/uploads/'.length);
      const fullPath = path.join(config.uploadsDir, filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    topic.website_url = null;
    await topic.save();
    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Delete website error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getWebsiteStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (!ensureTopicOwner(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    let totalSize = 0;
    let fileCount = 0;
    if (topic.website_url?.startsWith('/uploads/')) {
      const filename = topic.website_url.slice('/uploads/'.length);
      const fullPath = path.join(config.uploadsDir, filename);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        totalSize = stat.size;
        fileCount = 1;
      }
    }

    return res.json({
      success: true,
      data: {
        topicId: topic.id.toString(),
        fileCount,
        totalSize,
        uploadedAt: topic.website_url ? topic.updatedAt.toISOString() : undefined,
        websiteUrl: topic.website_url ?? null,
      },
    });
  } catch (error) {
    console.error('Get website stats error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
