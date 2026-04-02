import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Topic, User, TopicMember } from '../models';
import { sequelize } from '../utils/database';

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

    const userId = req.user.id;
    const topic = await sequelize.transaction(async (t) => {
      const newTopic = await Topic.create({
        title,
        description,
        created_by: userId,
        deadline: deadline ? new Date(deadline) : undefined,
        status: 'draft',
      }, { transaction: t });

      // Automatically add the teacher as a topic member
      await TopicMember.create({
        topic_id: newTopic.id,
        user_id: userId,
      }, { transaction: t });

      return newTopic;
    });

    res.status(201).json({
      success: true,
      data: {
        id: topic.id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: topic.created_by.toString(),
        status: topic.status,
        deadline: topic.deadline ? (typeof topic.deadline === 'string' ? topic.deadline : topic.deadline.toISOString().split('T')[0]) : undefined,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
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

    if (req.user.role === 'admin') {
      // Admin sees all topics
      topics = await Topic.findAll({
        include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    } else if (req.user.role === 'teacher') {
      // Teacher sees their own topics
      topics = await Topic.findAll({
        where: { created_by: req.user.id },
        include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    } else {
      // Student sees all published topics, with membership info
      topics = await Topic.findAll({
        where: { status: 'published' },
        include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });

      // Get student's memberships
      const memberships = await TopicMember.findAll({
        where: { user_id: req.user.id },
        attributes: ['topic_id'],
      });
      const joinedTopicIds = new Set(memberships.map((m) => m.topic_id));

      // Add hasJoined flag to each topic
      // Note: hasJoined is a computed property not in the model definition
      topics = topics.map((topic) => {
        (topic as any).hasJoined = joinedTopicIds.has(topic.id);
        return topic;
      });
    }

    const formattedTopics = topics.map((topic) => {
      // Sequelize association 'creator' is not statically typed
      // Using type assertion to access the joined user data
      const topicWithCreator = topic as any;
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
        deadline: topic.deadline ? (typeof topic.deadline === 'string' ? topic.deadline : topic.deadline.toISOString().split('T')[0]) : undefined,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
        hasJoined: topicWithCreator.hasJoined,
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

    // Check access: admin, teacher who created it, or student who joined
    if (req.user.role === 'admin') {
      // Admin can access all topics
    } else if (req.user.role === 'teacher') {
      // Teacher can access their own topics
      if (topic.created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
    } else {
      // Student must have joined the topic and it must be published
      if (topic.status !== 'published') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      const membership = await TopicMember.findOne({
        where: { topic_id: topicId, user_id: req.user.id },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You have not joined this topic.',
        });
      }
    }

    // Sequelize association 'creator' is not statically typed
    // Using type assertion to access the joined user data
    const topicWithCreator = topic as any;
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
        deadline: topic.deadline ? (typeof topic.deadline === 'string' ? topic.deadline : topic.deadline.toISOString().split('T')[0]) : undefined,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
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
        deadline: topic.deadline ? (typeof topic.deadline === 'string' ? topic.deadline : topic.deadline.toISOString().split('T')[0]) : undefined,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
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
        deadline: topic.deadline ? (typeof topic.deadline === 'string' ? topic.deadline : topic.deadline.toISOString().split('T')[0]) : undefined,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
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

// Join a topic (student only)
export const joinTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    // Only students can join topics
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can join topics',
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

    // Topic must be published for students to join
    if (topic.status !== 'published') {
      return res.status(403).json({
        success: false,
        error: 'Cannot join a topic that is not published',
      });
    }

    // Check if already joined
    const existingMembership = await TopicMember.findOne({
      where: { topic_id: topicId, user_id: req.user.id },
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error: 'Already joined this topic',
      });
    }

    // Create membership
    await TopicMember.create({
      topic_id: topicId,
      user_id: req.user.id,
    });

    res.json({
      success: true,
      data: {
        message: 'Successfully joined the topic',
      },
    });
  } catch (error) {
    console.error('Join topic error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
