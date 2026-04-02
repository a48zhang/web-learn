import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Task, Topic, User, TopicMember } from '../models';

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id: topicId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    // Verify topic exists and user is the owner
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }

    if (topic.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not the owner of this topic',
      });
    }

    const task = await Task.create({
      topic_id: parseInt(topicId),
      title,
      description,
      created_by: userId,
    });

    res.status(201).json({
      success: true,
      data: {
        id: task.id.toString(),
        topicId: task.topic_id.toString(),
        title: task.title,
        description: task.description,
        createdBy: task.created_by.toString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getTasksForTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id: topicId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify topic exists
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }

    // Check access
    if (userRole === 'admin') {
      // Admin can access all tasks
    } else if (userRole === 'teacher') {
      // Teacher can access tasks in their own topics
      if (topic.created_by !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
    } else {
      // Student must have joined the topic
      if (topic.status !== 'published') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      const membership = await TopicMember.findOne({
        where: { topic_id: parseInt(topicId), user_id: userId },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
    }

    const tasks = await Task.findAll({
      where: { topic_id: parseInt(topicId) },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const transformedTasks = tasks.map((task) => ({
      id: task.id.toString(),
      topicId: task.topic_id.toString(),
      title: task.title,
      description: task.description,
      createdBy: task.created_by.toString(),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data: transformedTasks,
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
