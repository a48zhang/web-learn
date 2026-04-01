import { Review } from '@web-learn/shared';

interface ReviewDisplayProps {
  review: Review;
}

const ReviewDisplay = ({ review }: ReviewDisplayProps) => {
  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'text-gray-500';
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">教师评价</h3>
        <div className="text-sm text-gray-500">
          {new Date(review.reviewedAt).toLocaleDateString('zh-CN')}
        </div>
      </div>

      <div className="space-y-4">
        {/* Score */}
        <div className="flex items-center gap-4">
          <span className="text-gray-700 font-medium">分数:</span>
          <span className={`text-2xl font-bold ${getScoreColor(review.score)}`}>
            {review.score !== undefined ? `${review.score.toFixed(2)}/100` : '暂无分数'}
          </span>
        </div>

        {/* Feedback */}
        <div>
          <h4 className="text-gray-700 font-medium mb-2">反馈意见:</h4>
          {review.feedback ? (
            <div className="bg-gray-50 rounded-md p-4 text-gray-700 whitespace-pre-wrap">
              {review.feedback}
            </div>
          ) : (
            <p className="text-gray-500 italic">暂无反馈意见</p>
          )}
        </div>

        {/* Reviewer info (if available in the review object) */}
        {(review as any).reviewer && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              评价人: {(review as any).reviewer.username || (review as any).reviewer.email}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewDisplay;
