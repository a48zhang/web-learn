import { Request, Response } from 'express';
import { Submission, Task, Topic, User } from '../models';
import path from 'path';
import fs from 'fs';

export const submitTask = async (req: Request, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user.id;
    const user = (req as any).user;

    // Only students can submit
    if (user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can submit tasks',
      });
    }

    // Verify task exists
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if student already submitted
    const existingSubmission = await Submission.findOne({
      where: {
        task_id: parseInt(taskId),
        student_id: userId,
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted this task',
      });
    }

    let fileUrl: string | undefined;
    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
    }

    const submission = await Submission.create({
      task_id: parseInt(taskId),
      student_id: userId,
      content,
      file_url: fileUrl,
      submitted_at: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: submission.id.toString(),
        taskId: submission.task_id.toString(),
        studentId: submission.student_id.toString(),
        content: submission.content,
        fileUrl: submission.file_url,
        submittedAt: submission.submitted_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getSubmissionsForTask = async (req: Request, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const userId = (req as any).user.id;

    // Verify task exists and user is the task creator
    const task = await Task.findByPk(taskId, {
      include: [{ model: Topic, as: 'topic' }],
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    if (task.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not the owner of this task',
      });
    }

    const submissions = await Submission.findAll({
      where: { task_id: parseInt(taskId) },
      include: [
        { model: User, as: 'student', attributes: ['id', 'username', 'email'] },
      ],
      order: [['submitted_at', 'DESC']],
    });

    const transformedSubmissions = submissions.map((submission) => ({
      id: submission.id.toString(),
      taskId: submission.task_id.toString(),
      studentId: submission.student_id.toString(),
      content: submission.content,
      fileUrl: submission.file_url,
      submittedAt: submission.submitted_at.toISOString(),
      student: submission.student
        ? {
            id: submission.student.id.toString(),
            username: submission.student.username,
            email: submission.student.email,
          }
        : undefined,
    }));

    res.json({
      success: true,
      data: transformedSubmissions,
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getMySubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = (req as any).user;

    // Only students can view their submissions
    if (user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can view submissions',
      });
    }

    const submissions = await Submission.findAll({
      where: { student_id: userId },
      include: [
        { model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] },
      ],
      order: [['submitted_at', 'DESC']],
    });

    const transformedSubmissions = submissions.map((submission) => ({
      id: submission.id.toString(),
      taskId: submission.task_id.toString(),
      studentId: submission.student_id.toString(),
      content: submission.content,
      fileUrl: submission.file_url,
      submittedAt: submission.submitted_at.toISOString(),
      task: submission.task
        ? {
            id: submission.task.id.toString(),
            title: submission.task.title,
            topic: submission.task.topic
              ? {
                  id: submission.task.topic.id.toString(),
                  title: submission.task.topic.title,
                }
              : undefined,
          }
        : undefined,
    }));

    res.json({
      success: true,
      data: transformedSubmissions,
    });
  } catch (error) {
    console.error('Get my submissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
