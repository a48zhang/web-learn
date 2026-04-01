import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic, User } from '../models';

// Create a new topic (teacher only)
export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        error: 'Only teachers can create topics',
      });
    }

    const { title, description, deadline } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    const topic = await Topic.create({
      title,
      description,
      created_by: req.user.id,
      deadline: deadline ? new Date(deadline) : undefined,
      status: 'draft',
    });

    res.status(201).json({
      success: true,
      data: {
        id: topic.id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: topic.created_by.toString(),
        status: topic.status,
        deadline: topic.deadline ? topic.deadline.toISOString() : undefined,
        createdAt: topic.created_at.toISOString(),
        updatedAt: topic.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get topic list (filtered by role)
export const getTopics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    let topics;

    if (req.user.role === 'teacher') {
      // Teacher sees their own topics
      topics = await Topic.findAll({
        where: { created_by: req.user.id },
        include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    } else {
      // Student sees published topics (for now, we'll enhance this later with enrollment)
      topics = await Topic.findAll({
        where: { status: 'published' },
        include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    }

    const formattedTopics = topics.map((topic) => {
      const topicWithCreator = topic as any; // Type assertion for association
      return {
        id: topic.id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: topic.created_by.toString(),
        creator: topicWithCreator.creator ? {
          id: topicWithCreator.creator.id.toString(),
          username: topicWithCreator.creator.username,
          email: topicWithCreator.creator.email,
        } : undefined,
        status: topic.status,
        deadline: topic.deadline ? topic.deadline.toISOString() : undefined,
        createdAt: topic.created_at.toISOString(),
        updatedAt: topic.updated_at.toISOString(),
      };
    });

    res.json({
      success: true,
      data: formattedTopics,
    });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get topic detail
export const getTopicById = async (req: AuthRequest, res: Response) => {
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

    const topic = await Topic.findByPk(topicId, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }

    // Check access: teacher who created it, or student (only if published)
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

    const topicWithCreator = topic as any; // Type assertion for association
    res.json({
      success: true,
      data: {
        id: topic.id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: topic.created_by.toString(),
        creator: topicWithCreator.creator ? {
          id: topicWithCreator.creator.id.toString(),
          username: topicWithCreator.creator.username,
          email: topicWithCreator.creator.email,
        } : undefined,
        status: topic.status,
        deadline: topic.deadline ? topic.deadline.toISOString() : undefined,
        createdAt: topic.created_at.toISOString(),
        updatedAt: topic.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get topic by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update topic (owner only)
export const updateTopic = async (req: AuthRequest, res: Response) => {
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

    if (topic.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const { title, description, deadline } = req.body;

    if (title !== undefined) topic.title = title;
    if (description !== undefined) topic.description = description;
    if (deadline !== undefined) topic.deadline = deadline ? new Date(deadline) : undefined;

    await topic.save();

    res.json({
      success: true,
      data: {
        id: topic.id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: topic.created_by.toString(),
        status: topic.status,
        deadline: topic.deadline ? topic.deadline.toISOString() : undefined,
        createdAt: topic.created_at.toISOString(),
        updatedAt: topic.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update topic status (publish/close)
export const updateTopicStatus = async (req: AuthRequest, res: Response) => {
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

    if (topic.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const { status } = req.body;

    if (!['draft', 'published', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    topic.status = status as 'draft' | 'published' | 'closed';
    await topic.save();

    res.json({
      success: true,
      data: {
        id: topic.id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: topic.created_by.toString(),
        status: topic.status,
        deadline: topic.deadline ? topic.deadline.toISOString() : undefined,
        createdAt: topic.created_at.toISOString(),
        updatedAt: topic.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update topic status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
