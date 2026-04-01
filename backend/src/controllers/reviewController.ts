import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Review, Submission, User, Task, Topic } from '../models';

const parseValidatedScore = (score: unknown) => {
  if (score === undefined || score === null || score === '') {
    return undefined;
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
    return null;
  }

  return numericScore;
};

const validateReviewPayload = (score: unknown, feedback: unknown) => {
  const validatedScore = parseValidatedScore(score);
  if (validatedScore === null) {
    return { error: 'Score must be a number between 0 and 100' };
  }

  if (feedback !== undefined && feedback !== null && typeof feedback !== 'string') {
    return { error: 'Feedback must be a string when provided' };
  }

  return {
    score: validatedScore,
    feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
  };
};

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Only teachers can create reviews' });
    }

    const submissionId = parseInt(req.params.id, 10);
    if (isNaN(submissionId)) {
      return res.status(400).json({ success: false, error: 'Invalid submission ID' });
    }

    const payload = validateReviewPayload(req.body.score, req.body.feedback);
    if (payload.error) {
      return res.status(400).json({ success: false, error: payload.error });
    }

    const submission = await Submission.findByPk(submissionId, {
      include: [{ model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] }],
    });

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    if ((submission as any).task?.topic?.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const existingReview = await Review.findOne({ where: { submission_id: submissionId } });
    if (existingReview) {
      return res.status(409).json({ success: false, error: 'Review already exists for this submission' });
    }

    const review = await Review.create({
      submission_id: submissionId,
      reviewer_id: req.user.id,
      score: payload.score,
      feedback: payload.feedback,
    });

    res.status(201).json({
      success: true,
      data: {
        id: review.id.toString(),
        submissionId: review.submission_id.toString(),
        reviewerId: review.reviewer_id.toString(),
        score: review.score !== undefined && review.score !== null ? Number(review.score) : undefined,
        feedback: review.feedback,
        reviewedAt: review.reviewed_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getReviewBySubmissionId = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const submissionId = parseInt(req.params.id, 10);
    if (isNaN(submissionId)) {
      return res.status(400).json({ success: false, error: 'Invalid submission ID' });
    }

    const review = await Review.findOne({
      where: { submission_id: submissionId },
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'email'] },
        { model: Submission, as: 'submission' },
      ],
    });

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const reviewWithAssoc = review as any;
    const submission = reviewWithAssoc.submission;
    const hasDirectAccess = review.reviewer_id === req.user.id || submission.student_id === req.user.id;

    if (!hasDirectAccess && req.user.role === 'teacher') {
      const fullSubmission = await Submission.findByPk(submissionId, {
        include: [{ model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] }],
      });
      if ((fullSubmission as any)?.task?.topic?.created_by !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    } else if (!hasDirectAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({
      success: true,
      data: {
        id: review.id.toString(),
        submissionId: review.submission_id.toString(),
        reviewerId: review.reviewer_id.toString(),
        reviewer: reviewWithAssoc.reviewer
          ? {
              id: reviewWithAssoc.reviewer.id.toString(),
              username: reviewWithAssoc.reviewer.username,
              email: reviewWithAssoc.reviewer.email,
            }
          : undefined,
        score: review.score !== undefined && review.score !== null ? Number(review.score) : undefined,
        feedback: review.feedback,
        reviewedAt: review.reviewed_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Only teachers can update reviews' });
    }

    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID' });
    }

    const payload = validateReviewPayload(req.body.score, req.body.feedback);
    if (payload.error) {
      return res.status(400).json({ success: false, error: payload.error });
    }

    const review = await Review.findByPk(reviewId, {
      include: [{ model: Submission, as: 'submission', include: [{ model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] }] }],
    });

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    if (review.reviewer_id !== req.user.id && (review as any).submission?.task?.topic?.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (payload.score !== undefined) review.score = payload.score;
    if (payload.feedback !== undefined) review.feedback = payload.feedback;

    await review.save();

    res.json({
      success: true,
      data: {
        id: review.id.toString(),
        submissionId: review.submission_id.toString(),
        reviewerId: review.reviewer_id.toString(),
        score: review.score !== undefined && review.score !== null ? Number(review.score) : undefined,
        feedback: review.feedback,
        reviewedAt: review.reviewed_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
