import { Request, Response } from 'express';
import { Submission, Task, Topic, User, TopicMember } from '../models';
import path from 'path';
import fs from 'fs';
import { config } from '../utils/config';

const endOfDeadlineDay = (deadline: string | Date) => {
  const date = new Date(deadline);
  date.setHours(23, 59, 59, 999);
  return date;
};

const toSubmissionFileUri = (submissionId: number | string) => `/api/submissions/${submissionId}/attachment`;
const getSubmissionFilePath = (storedFilename: string) => path.join(config.uploadsDir, storedFilename);

export const submitTask = async (req: Request, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user.id;
    const user = (req as any).user;

    if (user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can submit tasks',
      });
    }

    const task = await Task.findByPk(taskId, {
      include: [{ model: Topic, as: 'topic' }],
    });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const topic = (task as any).topic;
    if (!topic || topic.status !== 'published') {
      return res.status(403).json({
        success: false,
        error: 'Task submissions are only allowed for published topics',
      });
    }

    // Check if student has joined the topic
    const membership = await TopicMember.findOne({
      where: { topic_id: topic.id, user_id: userId },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'You must join the topic before submitting tasks',
      });
    }

    if (topic.deadline && endOfDeadlineDay(topic.deadline) < new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Submission deadline has passed',
      });
    }

    if ((!content || !String(content).trim()) && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Submission content or attachment is required',
      });
    }

    const existingSubmission = await Submission.findOne({
      where: {
        task_id: parseInt(taskId, 10),
        student_id: userId,
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted this task',
      });
    }

    const submission = await Submission.create({
      task_id: parseInt(taskId, 10),
      student_id: userId,
      content: typeof content === 'string' ? content.trim() : content,
      file_url: req.file?.filename,
      submitted_at: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: submission.id.toString(),
        taskId: submission.task_id.toString(),
        studentId: submission.student_id.toString(),
        content: submission.content,
        fileUrl: submission.file_url ? toSubmissionFileUri(submission.id) : undefined,
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

    const task = await Task.findByPk(taskId, {
      include: [{ model: Topic, as: 'topic' }],
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (task.created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You are not the owner of this task' });
    }

    const submissions = await Submission.findAll({
      where: { task_id: parseInt(taskId, 10) },
      include: [{ model: User, as: 'student', attributes: ['id', 'username', 'email'] }],
      order: [['submitted_at', 'DESC']],
    });

    res.json({
      success: true,
      data: submissions.map((submission) => ({
        id: submission.id.toString(),
        taskId: submission.task_id.toString(),
        studentId: submission.student_id.toString(),
        content: submission.content,
        fileUrl: submission.file_url ? toSubmissionFileUri(submission.id) : undefined,
        submittedAt: submission.submitted_at.toISOString(),
        student: submission.student
          ? {
              id: submission.student.id.toString(),
              username: submission.student.username,
              email: submission.student.email,
            }
          : undefined,
      })),
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getMySubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = (req as any).user;

    if (user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can view submissions',
      });
    }

    const submissions = await Submission.findAll({
      where: { student_id: userId },
      include: [{ model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] }],
      order: [['submitted_at', 'DESC']],
    });

    res.json({
      success: true,
      data: submissions.map((submission) => ({
        id: submission.id.toString(),
        taskId: submission.task_id.toString(),
        studentId: submission.student_id.toString(),
        content: submission.content,
        fileUrl: submission.file_url ? toSubmissionFileUri(submission.id) : undefined,
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
      })),
    });
  } catch (error) {
    console.error('Get my submissions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const downloadSubmissionAttachment = async (req: Request, res: Response) => {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const user = (req as any).user;

    if (isNaN(submissionId)) {
      return res.status(400).json({ success: false, error: 'Invalid submission ID' });
    }

    const submission = await Submission.findByPk(submissionId, {
      include: [{ model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] }],
    });

    if (!submission || !submission.file_url) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    const topic = submission.task?.topic;
    const isOwnerStudent = user.role === 'student' && submission.student_id === user.id;
    const isTeacherOwner = user.role === 'teacher' && topic?.created_by === user.id;

    if (!isOwnerStudent && !isTeacherOwner) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const filePath = getSubmissionFilePath(submission.file_url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    res.download(filePath, path.basename(filePath));
  } catch (error) {
    console.error('Download submission attachment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
