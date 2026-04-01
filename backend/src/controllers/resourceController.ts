import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Resource, Topic, User } from '../models';
import path from 'path';
import fs from 'fs';
import { config } from '../utils/config';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload resource to topic
export const uploadResource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id } = req.params;
    const topicId = parseInt(id, 10);

    if (isNaN(topicId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid topic ID',
      });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }

    // Check access: only teacher who created the topic can upload
    if (req.user.role !== 'teacher' || topic.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const { type, title } = req.body;
    let uri: string;

    if (type === 'link') {
      // For links, uri is provided in body
      if (!req.body.uri) {
        return res.status(400).json({
          success: false,
          error: 'URI is required for link type',
        });
      }
      uri = req.body.uri;
    } else {
      // For file types, check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'File is required for document/video/other types',
        });
      }
      uri = `/uploads/${req.file.filename}`;
    }

    const resource = await Resource.create({
      topic_id: topicId,
      owner_id: req.user.id,
      type: type as 'document' | 'video' | 'link' | 'other',
      title: title || req.file?.originalname || undefined,
      uri,
    });

    res.status(201).json({
      success: true,
      data: {
        id: resource.id.toString(),
        topicId: resource.topic_id.toString(),
        ownerId: resource.owner_id.toString(),
        type: resource.type,
        title: resource.title,
        uri: resource.uri,
        uploadedAt: resource.uploaded_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get resources for topic
export const getResources = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id } = req.params;
    const topicId = parseInt(id, 10);

    if (isNaN(topicId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid topic ID',
      });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }

    // Check access
    if (req.user.role === 'student' && topic.status !== 'published') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (req.user.role === 'teacher' && topic.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const resources = await Resource.findAll({
      where: { topic_id: topicId },
      include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'email'] }],
      order: [['uploaded_at', 'DESC']],
    });

    const formattedResources = resources.map((resource) => {
      const resourceWithOwner = resource as any;
      return {
        id: resource.id.toString(),
        topicId: resource.topic_id.toString(),
        ownerId: resource.owner_id.toString(),
        owner: resourceWithOwner.owner ? {
          id: resourceWithOwner.owner.id.toString(),
          username: resourceWithOwner.owner.username,
          email: resourceWithOwner.owner.email,
        } : undefined,
        type: resource.type,
        title: resource.title,
        uri: resource.uri,
        uploadedAt: resource.uploaded_at.toISOString(),
      };
    });

    res.json({
      success: true,
      data: formattedResources,
    });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Download resource
export const downloadResource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id } = req.params;
    const resourceId = parseInt(id, 10);

    if (isNaN(resourceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resource ID',
      });
    }

    const resource = await Resource.findByPk(resourceId, {
      include: [{ model: Topic, as: 'topic' }],
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
    }

    const resourceWithTopic = resource as any;
    const topic = resourceWithTopic.topic;

    // Check access
    if (req.user.role === 'student' && topic.status !== 'published') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (req.user.role === 'teacher' && topic.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // If it's a link, redirect
    if (resource.type === 'link') {
      return res.json({
        success: true,
        data: { uri: resource.uri },
      });
    }

    // For file types, send the file
    const filePath = path.join(process.cwd(), resource.uri);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    res.download(filePath, resource.title || path.basename(filePath));
  } catch (error) {
    console.error('Download resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Delete resource (owner/teacher only)
export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id } = req.params;
    const resourceId = parseInt(id, 10);

    if (isNaN(resourceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resource ID',
      });
    }

    const resource = await Resource.findByPk(resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
    }

    // Check ownership
    if (resource.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Delete file if it's not a link
    if (resource.type !== 'link' && resource.uri.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), resource.uri);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await resource.destroy();

    res.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
