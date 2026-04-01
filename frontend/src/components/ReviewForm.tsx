import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CreateReviewDto, Review } from '@web-learn/shared';
import { reviewApi } from '../services/api';

interface ReviewFormProps {
  submissionId: string;
  existingReview?: Review;
  onSuccess?: (review: Review) => void;
  onCancel?: () => void;
}

const ReviewForm = ({ submissionId, existingReview, onSuccess, onCancel }: ReviewFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateReviewDto>({
    defaultValues: existingReview ? {
      score: existingReview.score,
      feedback: existingReview.feedback,
    } : {},
  });

  const onSubmit = async (data: CreateReviewDto) => {
    setIsSubmitting(true);
    setError(null);

    try {
      let review: Review;
      if (existingReview) {
        review = await reviewApi.update(existingReview.id, data);
      } else {
        review = await reviewApi.create(submissionId, data);
      }
      onSuccess?.(review);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {existingReview ? '编辑评价' : '评价作业'}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="score" className="block text-sm font-medium text-gray-700 mb-1">
            分数 (0-100)
          </label>
          <input
            type="number"
            id="score"
            min="0"
            max="100"
            step="0.01"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.score ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
            } focus:outline-none focus:ring-2`}
            {...register('score', {
              min: { value: 0, message: '分数不能小于0' },
              max: { value: 100, message: '分数不能大于100' },
            })}
          />
          {errors.score && (
            <p className="mt-1 text-sm text-red-600">{errors.score.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-1">
            反馈意见
          </label>
          <textarea
            id="feedback"
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="请输入对学生作业的反馈意见..."
            {...register('feedback')}
          />
        </div>

        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '提交中...' : (existingReview ? '更新评价' : '提交评价')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;
