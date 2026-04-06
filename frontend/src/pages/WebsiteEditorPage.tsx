import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Topic, WebsiteStats } from '@web-learn/shared';
import { topicApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast, useToastStore } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { LoadingOverlay } from '../components/Loading';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';

function WebsiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { setMeta } = useLayoutMeta();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [stats, setStats] = useState<WebsiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeTimeoutRef = useRef<number | null>(null);

  const canEdit = user?.role === 'teacher' && topic?.createdBy === user.id;

  useEffect(() => {
    if (!topic?.websiteUrl) return;
    setIframeLoading(true);
    setIframeError(false);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
    iframeTimeoutRef.current = window.setTimeout(() => {
      setIframeLoading(false);
      setIframeError(true);
    }, 15000);
    return () => {
      if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
    };
  }, [topic?.websiteUrl, iframeKey]);

  const handleReloadIframe = () => {
    setIframeLoading(true);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  };

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
    const segments: BreadcrumbSegment[] = [
      { label: '首页', to: '/dashboard' },
      { label: '专题列表', to: '/topics' },
      ...(topic ? [{ label: topic.title, to: `/topics/${topic.id}` }] : [{ label: '编辑中...' }]),
      { label: '编辑' },
    ];
    setMeta({
      pageTitle: topic ? `网站编辑：${topic.title}` : '编辑中...',
      breadcrumbSegments: segments,
      sideNavSlot: null,
    });
  }, [topic, setMeta]);

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
    const loadingId = toast.loading('上传中...');
    try {
      await topicApi.uploadWebsite(id, file);
      await refresh(id);
      useToastStore.getState().removeToast(loadingId);
      toast.success('上传成功');
    } catch (err: unknown) {
      useToastStore.getState().removeToast(loadingId);
      toast.error('上传失败: ' + getApiErrorMessage(err, '上传失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = () => {
    confirmActionRef.current = async () => {
      if (!id || !canEdit) return;
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
    setConfirmOpen(true);
  };

  if (loading) {
    return <LoadingOverlay message="加载网站编辑器中..." />;
  }

  if (error || !topic) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-gray-700">{error || '专题不存在'}</div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-gray-700">你没有编辑该专题的权限</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">网站编辑：{topic.title}</h1>

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
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDeleteRequest}
              disabled={submitting || !topic.websiteUrl}
              className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
            >
              删除网站
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {topic.websiteUrl ? (
            <div className="relative">
              {iframeLoading && !iframeError && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-200 overflow-hidden z-10">
                  <div className="h-full bg-blue-500 animate-pulse w-1/2" />
                </div>
              )}
              {iframeError ? (
                <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-gray-500">
                  <p className="text-lg">网站加载失败</p>
                  <p className="text-sm text-gray-400">请检查网站地址或稍后再试</p>
                  <button
                    type="button"
                    onClick={handleReloadIframe}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm transition-colors"
                  >
                    重新加载
                  </button>
                </div>
              ) : (
                <iframe
                  key={iframeKey}
                  title={topic.title}
                  src={topic.websiteUrl}
                  className="w-full h-[70vh] border-0"
                  onLoad={() => {
                    setIframeLoading(false);
                    setIframeError(false);
                    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
                  }}
                  onError={() => {
                    setIframeLoading(false);
                    setIframeError(true);
                    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
                  }}
                />
              )}
            </div>
          ) : (
            <div className="h-[40vh] flex items-center justify-center text-gray-500">暂无预览内容</div>
          )}
        </div>
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
            <p className="text-sm text-gray-600">确定删除已上传的网站？此操作不可恢复。</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  confirmActionRef.current?.();
                }}
                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebsiteEditorPage;
