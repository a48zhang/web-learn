import { useEffect, useState } from 'react';
import { submissionApi, reviewApi, API_ORIGIN } from '../services/api';
import type { Submission, Review } from '@web-learn/shared';
import ReviewForm from './ReviewForm';
import ReviewDisplay from './ReviewDisplay';

interface SubmissionListProps {
  taskId: string;
  isTeacher?: boolean;
}

function SubmissionList({ taskId, isTeacher = false }: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Map<string, Review>>(new Map());
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await submissionApi.getByTask(taskId);
        setSubmissions(data || []);

        // Fetch reviews for all submissions
        const reviewMap = new Map<string, Review>();
        await Promise.all(
          (data || []).map(async (submission) => {
            try {
              const review = await reviewApi.getBySubmission(submission.id);
              reviewMap.set(submission.id, review);
            } catch (err) {
              // Review doesn't exist yet, that's okay
            }
          })
        );
        setReviews(reviewMap);
      } catch (err: any) {
        console.error('Fetch submissions error:', err);
        setError(err.response?.data?.error || '获取提交列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [taskId]);

  const handleReviewSuccess = (review: Review) => {
    setReviews(prev => new Map(prev.set(review.submissionId, review)));
    setShowReviewForm(null);
  };

  const toggleSubmission = (submissionId: string) => {
    setExpandedSubmission(expandedSubmission === submissionId ? null : submissionId);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无提交
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const hasReview = reviews.has(submission.id);
        const review = reviews.get(submission.id);
        const isExpanded = expandedSubmission === submission.id;

        return (
          <div key={submission.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Submission Header - Click to expand */}
            <div
              className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleSubmission(submission.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">
                      {(submission as any).student?.username || '学生'}
                    </h4>
                    {hasReview && review?.score !== undefined && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        review.score >= 90 ? 'bg-green-100 text-green-800' :
                        review.score >= 70 ? 'bg-blue-100 text-blue-800' :
                        review.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {review.score.toFixed(2)}分
                      </span>
                    )}
                    {hasReview && review?.score === undefined && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        已评价
                      </span>
                    )}
                  </div>
                  {(submission as any).student?.email && (
                    <p className="text-sm text-gray-500">
                      {(submission as any).student.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    提交于 {new Date(submission.submittedAt).toLocaleDateString()}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                {/* Submission Content */}
                {submission.content && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-1">提交内容</h5>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-md">
                      {submission.content}
                    </p>
                  </div>
                )}

                {submission.fileUrl && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-1">附件</h5>
                    <a
                      href={`${API_ORIGIN}${submission.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      下载文件
                    </a>
                  </div>
                )}

                {/* Review Section */}
                <div className="border-t border-gray-200 pt-4">
                  {isTeacher ? (
                    <>
                      {hasReview && !showReviewForm ? (
                        <div className="space-y-4">
                          {review && <ReviewDisplay review={review} />}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowReviewForm(submission.id);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            编辑评价
                          </button>
                        </div>
                      ) : (
                        <ReviewForm
                          submissionId={submission.id}
                          existingReview={review}
                          onSuccess={handleReviewSuccess}
                          onCancel={() => setShowReviewForm(null)}
                        />
                      )}
                    </>
                  ) : (
                    hasReview && review && <ReviewDisplay review={review} />
                  )}

                  {isTeacher && !hasReview && !showReviewForm && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReviewForm(submission.id);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      添加评价
                    </button>
                  )}

                  {!isTeacher && !hasReview && (
                    <div className="text-center py-4 text-gray-500">
                      暂无评价
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SubmissionList;
