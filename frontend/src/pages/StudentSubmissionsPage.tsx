import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { submissionApi, reviewApi, API_ORIGIN } from '../services/api';
import { LoadingOverlay } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import ReviewDisplay from '../components/ReviewDisplay';
import type { Review, SubmissionWithContext } from '@web-learn/shared';

function StudentSubmissionsPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Map<string, Review>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await submissionApi.getMySubmissions();
        setSubmissions(data || []);

        const reviewEntries = await Promise.all(
          (data || []).map(async (submission) => {
            try {
              const review = await reviewApi.getBySubmission(submission.id);
              return [submission.id, review] as const;
            } catch {
              return null;
            }
          })
        );

        setReviews(new Map(reviewEntries.filter((entry): entry is readonly [string, Review] => entry !== null)));
      } catch (err: any) {
        console.error('Fetch my submissions error:', err);
        setError(err.response?.data?.error || '获取我的提交失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const reviewedCount = useMemo(
    () => submissions.filter((submission) => reviews.has(submission.id)).length,
    [submissions, reviews]
  );

  if (loading) {
    return <LoadingOverlay message="加载我的提交中..." />;
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
              <h1 className="text-2xl font-bold text-gray-900">我的提交</h1>
              <p className="text-gray-600 mt-1">查看你已提交的任务，并确认哪些内容已经收到教师反馈。</p>
            </div>
            <div className="text-sm text-gray-500">
              共 {submissions.length} 份提交，已收到 {reviewedCount} 条反馈
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-red-700 mb-1">加载失败</h2>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!error && submissions.length === 0 ? (
          <EmptyState
            icon="task"
            title="你还没有提交任何任务"
            description="先去浏览专题并完成任务，提交后就能在这里查看记录。"
            action={{
              label: '去浏览专题',
              onClick: () => navigate('/topics'),
            }}
          />
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const review = reviews.get(submission.id);
              return (
                <div key={submission.id} className="bg-white shadow rounded-lg p-6 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {submission.task?.title || '未命名任务'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {submission.task?.topic?.title ? `所属专题：${submission.task.topic.title}` : '未关联专题信息'}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      提交于 {new Date(submission.submittedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>

                  {submission.content && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">提交内容</h3>
                      <div className="bg-gray-50 rounded-md p-4 text-gray-700 whitespace-pre-wrap">
                        {submission.content}
                      </div>
                    </div>
                  )}

                  {submission.fileUrl && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">附件</h3>
                      <a
                        href={`${API_ORIGIN}${submission.fileUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        查看已提交文件
                      </a>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">反馈状态</h3>
                    {review ? (
                      <ReviewDisplay review={review} />
                    ) : (
                      <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-3 text-gray-500">
                        教师暂未给出反馈
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentSubmissionsPage;
