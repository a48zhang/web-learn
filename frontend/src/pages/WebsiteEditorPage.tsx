import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Topic, WebsiteStats } from '@web-learn/shared';
import { topicApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';

function WebsiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [stats, setStats] = useState<WebsiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;

  const refresh = async (topicId: string) => {
    const topicData = await topicApi.getById(topicId);
    if (topicData.type !== 'website') {
      throw new Error('该专题不是网站类型');
    }
    setTopic(topicData);
    try {
      const stat = await topicApi.getWebsiteStats(topicId);
      setStats(stat);
    } catch {
      setStats(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        await refresh(id);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '加载失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleUpload = async (file: File) => {
    if (!id || !canEdit) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('仅支持 ZIP 文件');
      return;
    }
    setSubmitting(true);
    try {
      const updated = topic?.websiteUrl
        ? await topicApi.updateWebsite(id, file)
        : await topicApi.uploadWebsite(id, file);
      setTopic(updated);
      await refresh(id);
      toast.success('上传成功');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '上传失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !canEdit) return;
    if (!window.confirm('确定删除已上传网站？')) return;
    setSubmitting(true);
    try {
      const updated = await topicApi.deleteWebsite(id);
      setTopic(updated);
      await refresh(id);
      toast.success('删除成功');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除失败'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/topics" className="text-blue-600 hover:text-blue-500">
            ← 返回专题列表
          </Link>
          <div className="bg-white rounded-lg shadow p-6 mt-4 text-gray-700">{error || '专题不存在'}</div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <Link to={`/topics/${topic.id}`} className="text-blue-600 hover:text-blue-500">
            ← 返回专题
          </Link>
          <div className="bg-white rounded-lg shadow p-6 mt-4 text-gray-700">你没有编辑该专题的权限</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <Link to={`/topics/${topic.id}`} className="text-blue-600 hover:text-blue-500">
            ← 返回专题
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">网站编辑：{topic.title}</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">上传 ZIP 网站包</span>
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={submitting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
              className="mt-2 block w-full text-sm text-gray-700"
            />
          </label>
          <div className="text-sm text-gray-600">
            <p>文件数量：{stats?.fileCount ?? 0}</p>
            <p>总大小：{stats?.totalSize ?? 0} bytes</p>
            {stats?.uploadedAt && <p>上传时间：{new Date(stats.uploadedAt).toLocaleString('zh-CN')}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || !topic.websiteUrl}
              className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
            >
              删除网站
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {topic.websiteUrl ? (
            <iframe title={topic.title} src={topic.websiteUrl} className="w-full h-[70vh] border-0" />
          ) : (
            <div className="h-[40vh] flex items-center justify-center text-gray-500">暂无预览内容</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebsiteEditorPage;
