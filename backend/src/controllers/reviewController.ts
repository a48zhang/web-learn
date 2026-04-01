import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Review, Submission, User, Task, Topic } from '../models';

// Create a review for a submission (teacher only)
export const createReview = async (req: AuthRequest, res: Response) => {
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
        error: 'Only teachers can create reviews',
      });
    }

    const { id } = req.params;
    const submissionId = parseInt(id, 10);

    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission ID',
      });
    }

    const { score, feedback } = req.body;

    // Check if submission exists
    const submission = await Submission.findByPk(submissionId, {
      include: [
        { model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] },
      ],
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    // Check if teacher owns the topic
    const submissionWithTask = submission as any;
    if (submissionWithTask.task?.topic?.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      where: { submission_id: submissionId },
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        error: 'Review already exists for this submission',
      });
    }

    const review = await Review.create({
      submission_id: submissionId,
      reviewer_id: req.user.id,
      score,
      feedback,
    });

    res.status(201).json({
      success: true,
      data: {
        id: review.id.toString(),
        submissionId: review.submission_id.toString(),
        reviewerId: review.reviewer_id.toString(),
        score: review.score ? Number(review.score) : undefined,
        feedback: review.feedback,
        reviewedAt: review.reviewed_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get review for a submission
export const getReviewBySubmissionId = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const { id } = req.params;
    const submissionId = parseInt(id, 10);

    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission ID',
      });
    }

    const review = await Review.findOne({
      where: { submission_id: submissionId },
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'email'] },
        { model: Submission, as: 'submission' },
      ],
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    const reviewWithAssoc = review as any;

    // Check access: either the reviewer, the student who submitted, or topic owner
    const submission = reviewWithAssoc.submission;
    const hasAccess =
      review.reviewer_id === req.user.id ||
      submission.student_id === req.user.id;

    if (!hasAccess && req.user.role === 'teacher') {
      // Check if teacher owns the topic
      const fullSubmission = await Submission.findByPk(submissionId, {
        include: [
          { model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] },
        ],
      });
      const fullSubmissionWithTask = fullSubmission as any;
      if (fullSubmissionWithTask?.task?.topic?.created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
    } else if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: {
        id: review.id.toString(),
        submissionId: review.submission_id.toString(),
        reviewerId: review.reviewer_id.toString(),
        reviewer: reviewWithAssoc.reviewer ? {
          id: reviewWithAssoc.reviewer.id.toString(),
          username: reviewWithAssoc.reviewer.username,
          email: reviewWithAssoc.reviewer.email,
        } : undefined,
        score: review.score ? Number(review.score) : undefined,
        feedback: review.feedback,
        reviewedAt: review.reviewed_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update a review
export const updateReview = async (req: AuthRequest, res: Response) => {
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
        error: 'Only teachers can update reviews',
      });
    }

    const { id } = req.params;
    const reviewId = parseInt(id, 10);

    if (isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review ID',
      });
    }

    const review = await Review.findByPk(reviewId, {
      include: [
        { model: Submission, as: 'submission', include: [{ model: Task, as: 'task', include: [{ model: Topic, as: 'topic' }] }] },
      ],
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    // Check if teacher is the reviewer
    if (review.reviewer_id !== req.user.id) {
      // Also check if teacher owns the topic
      const reviewWithSubmission = review as any;
      if (reviewWithSubmission.submission?.task?.topic?.created_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
    }

    const { score, feedback } = req.body;

    if (score !== undefined) review.score = score;
    if (feedback !== undefined) review.feedback = feedback;

    await review.save();

    res.json({
      success: true,
      data: {
        id: review.id.toString(),
        submissionId: review.submission_id.toString(),
        reviewerId: review.reviewer_id.toString(),
        score: review.score ? Number(review.score) : undefined,
        feedback: review.feedback,
        reviewedAt: review.reviewed_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
