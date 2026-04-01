import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { submissionApi } from '../services/api';
import type { Submission, CreateSubmissionDto } from '@web-learn/shared';

interface SubmissionFormProps {
  taskId: string;
  onSubmitSuccess: (submission: Submission) => void;
  onSubmitError: (error: string) => void;
  onCancel: () => void;
}

function SubmissionForm({ taskId, onSubmitSuccess, onSubmitError, onCancel }: SubmissionFormProps) {
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm<CreateSubmissionDto>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: CreateSubmissionDto) => {
    try {
      setError(null);

      const formData = new FormData();
      if (data.content) {
        formData.append('content', data.content);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (!data.content && !selectedFile) {
        setError('请输入内容或上传文件');
        return;
      }

      const submission = await submissionApi.submit(taskId, formData);
      reset();
      setSelectedFile(null);
      onSubmitSuccess(submission);
    } catch (err: any) {
      console.error('Submit task error:', err);
      const errorMsg = err.response?.data?.error || '提交任务失败';
      setError(errorMsg);
      onSubmitError(errorMsg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          提交内容
        </label>
        <textarea
          {...register('content')}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="请输入提交内容"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          上传文件
        </label>
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {selectedFile && (
          <p className="mt-1 text-sm text-gray-600">
            已选择: {selectedFile.name}
          </p>
        )}
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
          {isSubmitting ? '提交中...' : '提交'}
        </button>
      </div>
    </form>
  );
}

export default SubmissionForm;
