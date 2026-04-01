import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { taskApi } from '../services/api';
import type { Task, CreateTaskDto } from '@web-learn/shared';

interface TaskCreateProps {
  topicId: string;
  onTaskCreated: (task: Task) => void;
  onCancel: () => void;
}

function TaskCreate({ topicId, onTaskCreated, onCancel }: TaskCreateProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CreateTaskDto>();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: CreateTaskDto) => {
    try {
      setError(null);
      const task = await taskApi.create(topicId, data);
      reset();
      onTaskCreated(task);
    } catch (err: any) {
      console.error('Create task error:', err);
      setError(err.response?.data?.error || '创建任务失败');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            任务标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('title', {
              required: '请输入任务标题',
              maxLength: {
                value: 200,
                message: '标题不能超过200个字符',
              },
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="请输入任务标题"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            任务描述
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="请输入任务描述"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? '创建中...' : '创建任务'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TaskCreate;
