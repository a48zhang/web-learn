import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Resource, Topic, User, TopicMember } from '../models';
import path from 'path';
import fs from 'fs';
import { config } from '../utils/config';

if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

const validResourceTypes = new Set(['document', 'video', 'link', 'other']);
const safeUrlProtocols = new Set(['http:', 'https:']);

const toResourceUri = (resourceId: number | string) => `/api/resources/${resourceId}/download`;
const getStoredFilePath = (storedFilename: string) => path.join(config.uploadsDir, storedFilename);

const formatResourceUri = (resource: { id: number; type: string; uri: string }) => {
  if (resource.type === 'link') {
    return resource.uri;
  }

  return toResourceUri(resource.id);
};

const validateResourcePayload = (type: unknown, title: unknown, uri?: unknown) => {
  if (typeof type !== 'string' || !validResourceTypes.has(type)) {
    return 'Resource type must be one of document, video, link, or other';
  }

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return 'Title must be a non-empty string when provided';
  }

  if (type === 'link') {
    if (typeof uri !== 'string' || !uri.trim()) {
      return 'URI is required for link type';
    }

    try {
      const parsed = new URL(uri);
      if (!safeUrlProtocols.has(parsed.protocol)) {
        return 'Link URI must use http or https';
      }
    } catch {
      return 'Link URI must be a valid URL';
    }
  }

  return null;
};

export const uploadResource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const topicId = parseInt(req.params.id, 10);
    if (isNaN(topicId)) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    if (req.user.role !== 'teacher' || topic.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { type, title } = req.body;
    const validationError = validateResourcePayload(type, title, req.body.uri);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    if (type !== 'link' && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'File is required for document/video/other types',
      });
    }

    const resource = await Resource.create({
      topic_id: topicId,
      owner_id: req.user.id,
      type,
      title: typeof title === 'string' ? title.trim() : req.file?.originalname || undefined,
      uri: type === 'link' ? req.body.uri.trim() : req.file!.filename,
    });

    res.status(201).json({
      success: true,
      data: {
        id: resource.id.toString(),
        topicId: resource.topic_id.toString(),
        ownerId: resource.owner_id.toString(),
        type: resource.type,
        title: resource.title,
        uri: formatResourceUri(resource),
        uploadedAt: resource.uploaded_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload resource error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error && error.message === 'Unsupported file type'
        ? 'Unsupported file type'
        : 'Internal server error',
    });
  }
};

export const getResources = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const topicId = parseInt(req.params.id, 10);
    if (isNaN(topicId)) {
      return res.status(400).json({ success: false, error: 'Invalid topic ID' });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    // Check access
    if (req.user.role === 'admin') {
      // Admin can access all resources
    } else if (req.user.role === 'teacher') {
      // Teacher can upload to their own topics
      if (topic.created_by !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else {
      // Student must have joined the topic
      if (topic.status !== 'published') {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const membership = await TopicMember.findOne({
        where: { topic_id: topicId, user_id: req.user.id },
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const resources = await Resource.findAll({
      where: { topic_id: topicId },
      include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'email'] }],
      order: [['uploaded_at', 'DESC']],
    });

    res.json({
      success: true,
      data: resources.map((resource) => {
        const resourceWithOwner = resource as any;
        return {
          id: resource.id.toString(),
          topicId: resource.topic_id.toString(),
          ownerId: resource.owner_id.toString(),
          owner: resourceWithOwner.owner
            ? {
                id: resourceWithOwner.owner.id.toString(),
                username: resourceWithOwner.owner.username,
                email: resourceWithOwner.owner.email,
              }
            : undefined,
          type: resource.type,
          title: resource.title,
          uri: formatResourceUri(resource),
          uploadedAt: resource.uploaded_at.toISOString(),
        };
      }),
    });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const downloadResource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const resourceId = parseInt(req.params.id, 10);
    if (isNaN(resourceId)) {
      return res.status(400).json({ success: false, error: 'Invalid resource ID' });
    }

    const resource = await Resource.findByPk(resourceId, {
      include: [{ model: Topic, as: 'topic' }],
    });

    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    const topic = (resource as any).topic;

    // Check access
    if (req.user.role === 'admin') {
      // Admin can download all resources
    } else if (req.user.role === 'teacher') {
      // Teacher can download from their own topics
      if (topic.created_by !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else {
      // Student must have joined the topic
      if (topic.status !== 'published') {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const membership = await TopicMember.findOne({
        where: { topic_id: topic.id, user_id: req.user.id },
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    if (resource.type === 'link') {
      return res.json({ success: true, data: { uri: resource.uri } });
    }

    const filePath = getStoredFilePath(resource.uri);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.download(filePath, resource.title || path.basename(filePath));
  } catch (error) {
    console.error('Download resource error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const resourceId = parseInt(req.params.id, 10);
    if (isNaN(resourceId)) {
      return res.status(400).json({ success: false, error: 'Invalid resource ID' });
    }

    const resource = await Resource.findByPk(resourceId);
    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    if (resource.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (resource.type !== 'link') {
      const filePath = getStoredFilePath(resource.uri);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await resource.destroy();

    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

