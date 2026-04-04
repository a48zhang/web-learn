import { Op } from 'sequelize';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic, User } from '../models';
import { config } from '../utils/config';
import { sequelize } from '../utils/database';

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

const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const resolveUploadPath = (filename: string) => {
  const safeName = path.basename(filename);
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid upload filename');
  }
  return path.join(config.uploadsDir, safeName);
};

const hasHtmlEntryInZip = (filePath: string) => {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    let offset = 0;
    while (offset < stat.size - 30) {
      const header = Buffer.alloc(4);
      fs.readSync(fd, header, 0, 4, offset);
      if (!header.equals(ZIP_MAGIC_BYTES)) {
        offset += 1;
        continue;
      }
      const localHeader = Buffer.alloc(30);
      fs.readSync(fd, localHeader, 0, 30, offset);
      const fileNameLength = localHeader.readUInt16LE(26);
      const extraLength = localHeader.readUInt16LE(28);
      if (fileNameLength <= 0) {
        offset += 4;
        continue;
      }
      const fileNameBuffer = Buffer.alloc(fileNameLength);
      fs.readSync(fd, fileNameBuffer, 0, fileNameLength, offset + 30);
      const filename = fileNameBuffer.toString('utf8').toLowerCase();
      if (filename.endsWith('.html') || filename.endsWith('.htm')) {
        return true;
      }
      const compressedSize = localHeader.readUInt32LE(18);
      offset += 30 + fileNameLength + extraLength + compressedSize;
    }
  } finally {
    fs.closeSync(fd);
  }
  return false;
};

const validateUploadedZip = async (file?: Express.Multer.File | null) => {
  if (!file) {
    return { ok: false, error: 'ZIP file is required' } as const;
  }
  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    return { ok: false, error: 'Only ZIP files are supported' } as const;
  }
  const uploadedPath = resolveUploadPath(file.filename);
  const fd = fs.openSync(uploadedPath, 'r');
  try {
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    if (!header.equals(ZIP_MAGIC_BYTES)) {
      return { ok: false, error: 'Invalid ZIP file format' } as const;
    }
  } finally {
    fs.closeSync(fd);
  }
  if (!hasHtmlEntryInZip(uploadedPath)) {
    return { ok: false, error: 'ZIP must contain at least one HTML file' } as const;
  }
  return { ok: true } as const;
};

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

// Get topic list (public for published, teachers also see own drafts/closed)
export const getTopics = async (req: AuthRequest | any, res: Response) => {
  try {
    const { type } = req.query as { type?: string };

    const basePublished: any = { status: 'published' };
    if (type === 'knowledge' || type === 'website') {
      basePublished.type = type;
    }

    let where: any = basePublished;
    if (req.user?.role === 'teacher') {
      const own: any = { created_by: req.user.id };
      if (type === 'knowledge' || type === 'website') {
        own.type = type;
      }
      where = { [Op.or]: [basePublished, own] };
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

// Get topic detail (public for published, owner/admin can see non-published)
export const getTopicById = async (req: AuthRequest | any, res: Response) => {
  try {
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
    });
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    if (
      topic.status !== 'published' &&
      !(req.user?.role === 'teacher' && req.user.id === topic.created_by) &&
      req.user?.role !== 'admin'
    ) {
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

export const deleteTopic = async (req: AuthRequest, res: Response) => {
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

    await sequelize.transaction(async (transaction) => {
      await Topic.destroy({ where: { id: topic.id }, transaction });
    });

    if (topic.website_url?.startsWith('/uploads/')) {
      const filename = topic.website_url.slice('/uploads/'.length);
      const fullPath = resolveUploadPath(filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    return res.json({ success: true, data: { id: topic.id.toString() } });
  } catch (error) {
    console.error('Delete topic error:', error);
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
    const validateResult = await validateUploadedZip(req.file);
    if (!validateResult.ok) {
      if (req.file) {
        const uploadPath = resolveUploadPath(req.file.filename);
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath);
        }
      }
      return res.status(400).json({ success: false, error: validateResult.error });
    }

    const previousWebsiteUrl = topic.website_url;
    topic.website_url = `/uploads/${req.file!.filename}`;
    await sequelize.transaction(async (transaction) => {
      await topic.save({ transaction });
    });

    if (previousWebsiteUrl?.startsWith('/uploads/')) {
      const previousPath = resolveUploadPath(previousWebsiteUrl.slice('/uploads/'.length));
      const currentPath = resolveUploadPath(req.file!.filename);
      if (fs.existsSync(previousPath) && previousPath !== currentPath) {
        fs.unlinkSync(previousPath);
      }
    }
    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    if (req.file) {
      const uploadPath = resolveUploadPath(req.file.filename);
      if (fs.existsSync(uploadPath)) {
        fs.unlinkSync(uploadPath);
      }
    }
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

    const currentWebsiteUrl = topic.website_url;
    topic.website_url = null;
    await sequelize.transaction(async (transaction) => {
      await topic.save({ transaction });
    });

    if (currentWebsiteUrl?.startsWith('/uploads/')) {
      const filename = currentWebsiteUrl.slice('/uploads/'.length);
      const fullPath = resolveUploadPath(filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
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
      const fullPath = resolveUploadPath(filename);
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
