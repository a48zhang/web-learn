import { Response } from 'express';
import type { Express } from 'express';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { Topic } from '../models';
import { sequelize } from '../utils/database';
import { getStorageService } from '../services/storageService';
import { extractZipToTempDir, uploadDirToOSS, cleanupTempDir } from '../utils/zipUtils';

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
  filesSnapshot: (() => { try { return topic.files_snapshot ? JSON.parse(topic.files_snapshot) : null; } catch { return null; } })(),
  chatHistory: (() => { try { return topic.chat_history ? JSON.parse(topic.chat_history) : null; } catch { return null; } })(),
  publishedUrl: topic.published_url ?? null,
  shareLink: topic.share_link ?? null,
  editors: topic.editors ?? [],
  createdAt: topic.createdAt.toISOString(),
  updatedAt: topic.updatedAt.toISOString(),
});

const parseTopicId = (id: string) => {
  const parsed = parseInt(id, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const hasTopicEditAccess = (topic: any, req: AuthRequest) =>
  req.user && (topic.editors?.includes(req.user.id.toString()) || req.user.role === 'admin');

const hasTopicViewAccess = (topic: any, req: AuthRequest) =>
  topic.status === 'published' || hasTopicEditAccess(topic, req);

const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const hasHtmlEntryInZipBuffer = async (buffer: Buffer): Promise<boolean> => {
  const { fromBuffer } = await import('yauzl');
  return new Promise((resolve) => {
    fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) { resolve(false); return; }
      zipfile.readEntry();
      zipfile.on('entry', (entry: { fileName: string }) => {
        const name = entry.fileName.toLowerCase();
        if (name.endsWith('.html') || name.endsWith('.htm')) {
          zipfile.close();
          resolve(true);
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on('end', () => resolve(false));
    });
  });
};

const validateUploadedZip = async (file?: Express.Multer.File | null) => {
  if (!file) {
    return { ok: false, error: 'ZIP file is required' } as const;
  }
  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    return { ok: false, error: 'Only ZIP files are supported' } as const;
  }
  if (!file.buffer || file.buffer.length < 4) {
    return { ok: false, error: 'Invalid ZIP file format' } as const;
  }
  const header = file.buffer.subarray(0, 4);
  if (!header.equals(ZIP_MAGIC_BYTES)) {
    return { ok: false, error: 'Invalid ZIP file format' } as const;
  }
  if (!(await hasHtmlEntryInZipBuffer(file.buffer))) {
    return { ok: false, error: 'ZIP must contain at least one HTML file' } as const;
  }
  return { ok: true } as const;
};

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

    const topic = await Topic.create({
      title,
      description,
      type: 'website',
      website_url: null,
      created_by: req.user.id,
      status: 'draft',
      editors: [req.user.id.toString()],
    });

    return res.status(201).json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Create topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get topic list
export const getTopics = async (req: AuthRequest | any, res: Response) => {
  try {
    const topics = await Topic.findAll({
      where: {},
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

    const topic = await Topic.findByPk(topicId);
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

    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId);
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
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }
    const topic = await Topic.findByPk(topicId);
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
    const topicId = parseTopicId(req.params.id);
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId);
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

    return res.json({ success: true, data: { id: topic.id.toString() } });
  } catch (error) {
    console.error('Delete topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const uploadWebsite = async (req: AuthRequest, res: Response) => {
  const { id: topicIdStr } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, error: '请选择要上传的 ZIP 文件' });
  }

  // validateUploadedZip checks magic bytes AND HTML entry presence
  const validation = await validateUploadedZip(req.file);
  if (!validation.ok) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const topic = await Topic.findByPk(topicIdStr);
  if (!topic) {
    return res.status(404).json({ success: false, error: '专题不存在' });
  }
  if (!hasTopicEditAccess(topic, req)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  const storageService = getStorageService();
  let tempDir: string | undefined;

  try {
    // Step 1: Extract ZIP to a temporary directory
    const extractResult = await extractZipToTempDir(req.file.buffer);
    tempDir = extractResult.tempDir;

    // Step 2: Clean up old OSS content (if any)
    const oldPrefix = `topics/${topicIdStr}/`;
    try {
      await storageService.deleteDir(oldPrefix);
    } catch {
      // ignore if already empty
    }

    // Step 3: Upload all files to OSS
    const websiteUrl = await uploadDirToOSS(extractResult.tempDir, Number(topicIdStr), storageService);

    // Step 4: Update database
    await topic.update({ website_url: websiteUrl });

    return res.json({ success: true, data: websiteUrl });
  } catch (err) {
    console.error('uploadWebsite error:', err);

    // 回滚：清理刚上传的 OSS 文件
    try {
      const rollbackPrefix = `topics/${topicIdStr}/`;
      await storageService.deleteDir(rollbackPrefix);
    } catch (rollbackErr) {
      console.error('Failed to rollback OSS upload:', rollbackErr);
    }

    return res.status(500).json({ success: false, error: '上传失败，请重试' });
  } finally {
    // Step 5: Clean up temporary files (regardless of success/failure)
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
};

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
      return res.status(404).json({ success: false, error: '专题不存在' });
    }
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const storageService = getStorageService();
    const prefix = `topics/${topicId}/`;

    // 先更新数据库，再删 OSS（DB 失败则返回错误；OSS 删除失败只打印警告）
    await topic.update({ website_url: null });

    try {
      await storageService.deleteDir(prefix);
    } catch (ossErr) {
      console.warn(`[deleteWebsite] OSS cleanup failed for topics/${topicId}/:`, ossErr);
    }

    return res.json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Delete website error:', error);
    return res.status(500).json({ success: false, error: '删除失败，请重试' });
  }
};

export const getWebsiteStats = async (req: AuthRequest, res: Response) => {
  const { id: topicIdStr } = req.params;

  const topic = await Topic.findByPk(topicIdStr);
  if (!topic) {
    return res.status(404).json({ success: false, error: '专题不存在' });
  }
  if (!hasTopicEditAccess(topic, req)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  const storageService = getStorageService();
  const prefix = `topics/${topicIdStr}/`;

  try {
    const files = await storageService.listFiles(prefix);
    let totalSize = 0;
    for (const key of files) {
      try {
        totalSize += await storageService.getSize(key);
      } catch {
        // ignore individual errors
      }
    }

    return res.json({
      success: true,
      data: {
        fileCount: files.length,
        totalSize,
      },
    });
  } catch (err) {
    console.error('getWebsiteStats error:', err);
    return res.status(500).json({
      success: false,
      error: '获取网站统计信息失败',
    });
  }
};

export const saveFilesSnapshot = async (req: AuthRequest, res: Response) => {
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
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { files } = req.body;
    if (!files || typeof files !== 'object') {
      return res.status(400).json({ success: false, error: 'files object is required' });
    }
    await topic.update({ files_snapshot: JSON.stringify(files) });
    return res.json({ success: true, message: 'Snapshot saved' });
  } catch (error) {
    console.error('saveFilesSnapshot error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const saveChatHistory = async (req: AuthRequest, res: Response) => {
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
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }
    await topic.update({ chat_history: JSON.stringify(messages) });
    return res.json({ success: true, message: 'Chat history saved' });
  } catch (error) {
    console.error('saveChatHistory error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
