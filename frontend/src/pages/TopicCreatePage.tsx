import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { topicApi } from '../services/api';
import type { CreateTopicDto } from '@web-learn/shared';
import { getApiErrorMessage } from '../utils/errors';

function TopicCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTopicDto>();

  const onSubmit = async (data: CreateTopicDto) => {
    setLoading(true);
    setError(null);

    try {
      const payload: CreateTopicDto = {
        title: data.title,
        description: data.description,
        type: data.type || 'knowledge',
      };
      await topicApi.create(payload);
      navigate('/topics');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '创建专题失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500 mb-2 inline-block">
            ← 返回专题列表
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">创建新专题</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                专题标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                {...register('title', {
                  required: '标题不能为空',
                  maxLength: { value: 200, message: '标题不能超过200个字符' },
                })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="请输入专题标题"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                专题描述
              </label>
              <textarea
                id="description"
                rows={5}
                {...register('description')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入专题描述"
              />
            </div>

            {/* Topic Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                专题类型
              </label>
              <select
                id="type"
                {...register('type')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="knowledge">知识库</option>
                <option value="website">网站</option>
              </select>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <Link
                to="/topics"
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '创建中...' : '创建专题'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TopicCreatePage;
