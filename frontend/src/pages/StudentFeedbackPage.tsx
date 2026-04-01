import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { submissionApi, reviewApi } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import ReviewDisplay from '../components/ReviewDisplay';
import type { Review, SubmissionWithContext } from '@web-learn/shared';

function StudentFeedbackPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ submission: SubmissionWithContext; review: Review }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const submissions = await submissionApi.getMySubmissions();
        const results = await Promise.all(
          submissions.map(async (submission) => {
            try {
              const review = await reviewApi.getBySubmission(submission.id);
              return { submission, review };
            } catch {
              return null;
            }
          })
        );

        setItems(results.filter((item): item is { submission: SubmissionWithContext; review: Review } => item !== null));
      } catch (err: any) {
        console.error('Fetch my feedback error:', err);
        setError(err.response?.data?.error || '获取我的反馈失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const averageScore = useMemo(() => {
    const scored = items.filter((item) => item.review.score !== undefined);
    if (scored.length === 0) return null;
    const total = scored.reduce((sum, item) => sum + (item.review.score || 0), 0);
    return (total / scored.length).toFixed(2);
  }, [items]);

  if (loading) {
    return <LoadingOverlay message="加载我的反馈中..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-500 mb-2 inline-block">
            ← 返回控制台
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">我的反馈</h1>
              <p className="text-gray-600 mt-1">集中查看教师已经返回的评分和反馈意见。</p>
            </div>
            <div className="text-sm text-gray-500">
              已收到 {items.length} 条反馈{averageScore ? `，平均分 ${averageScore}` : ''}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-red-700 mb-1">加载失败</h2>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!error && items.length === 0 ? (
          <EmptyState
            icon="document"
            title="暂时还没有反馈"
            description="提交任务后，教师完成评分与反馈时会显示在这里。"
            action={{
              label: '查看我的提交',
              onClick: () => navigate('/my-submissions'),
            }}
          />
        ) : (
          <div className="space-y-4">
            {items.map(({ submission, review }) => (
              <div key={submission.id} className="bg-white shadow rounded-lg p-6 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{submission.task?.title || '未命名任务'}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {submission.task?.topic?.title ? `所属专题：${submission.task.topic.title}` : '未关联专题信息'}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    提交于 {new Date(submission.submittedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <ReviewDisplay review={review} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentFeedbackPage;
