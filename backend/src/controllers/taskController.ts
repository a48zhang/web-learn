import { Request, Response } from 'express';
import { Task, Topic, User } from '../models';

export const createTask = async (req: Request, res: Response) => {
  try {
    const { id: topicId } = req.params;
    const { title, description } = req.body;
    const userId = (req as any).user.id;

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
      created_at: new Date(),
      updated_at: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: task.id.toString(),
        topicId: task.topic_id.toString(),
        title: task.title,
        description: task.description,
        createdBy: task.created_by.toString(),
        createdAt: task.created_at.toISOString(),
        updatedAt: task.updated_at.toISOString(),
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

export const getTasksForTopic = async (req: Request, res: Response) => {
  try {
    const { id: topicId } = req.params;

    // Verify topic exists
    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
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
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
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
