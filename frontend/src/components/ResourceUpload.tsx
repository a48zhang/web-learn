import { useState } from 'react';
import type { Resource } from '@web-learn/shared';

interface ResourceUploadProps {
  topicId: string;
  onUploadSuccess: (resource: Resource) => void;
  onUploadError?: (error: string) => void;
}

function ResourceUpload({ topicId, onUploadSuccess, onUploadError }: ResourceUploadProps) {
  const [type, setType] = useState<'document' | 'video' | 'link' | 'other'>('document');
  const [title, setTitle] = useState('');
  const [uri, setUri] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;

    if (type === 'link' && !uri) {
      onUploadError?.('请输入链接地址');
      return;
    }

    if (type !== 'link' && !file) {
      onUploadError?.('请选择要上传的文件');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      if (title) formData.append('title', title);
      if (type === 'link') {
        formData.append('uri', uri);
      } else if (file) {
        formData.append('file', file);
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/topics/${topicId}/resources`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '上传失败');
      }

      onUploadSuccess(result.data);
      setType('document');
      setTitle('');
      setUri('');
      setFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const getTypeText = (t: string) => {
    switch (t) {
      case 'document': return '文档';
      case 'video': return '视频';
      case 'link': return '链接';
      case 'other': return '其他';
      default: return t;
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">上传资源</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">资源类型</label>
          <div className="flex flex-wrap gap-2">
            {(['document', 'video', 'link', 'other'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  type === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getTypeText(t)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            标题 <span className="text-gray-400">(可选)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入资源标题"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {type === 'link' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">链接地址</label>
            <input
              type="url"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择文件</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-gray-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <div>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mt-2">
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500">点击选择文件</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files && setFile(e.target.files[0])}
                      />
                    </label>
                    <p className="text-sm text-gray-500 mt-1">或拖拽文件到此处</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
        >
          {uploading ? '上传中...' : '上传资源'}
        </button>
      </form>
    </div>
  );
}

export default ResourceUpload;
