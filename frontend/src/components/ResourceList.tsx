import type { Resource } from '@web-learn/shared';
import { resourceApi } from '../services/api';

interface ResourceListProps {
  resources: Resource[];
  canDelete?: boolean;
  onDelete?: (resourceId: string) => void;
  onDownload?: (resource: Resource) => void;
}

function ResourceList({ resources, canDelete = false, onDelete, onDownload }: ResourceListProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return (
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'video':
        return (
          <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'link':
        return (
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'document': return '文档';
      case 'video': return '视频';
      case 'link': return '链接';
      case 'other': return '其他';
      default: return type;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'document': return 'bg-blue-100 text-blue-800';
      case 'video': return 'bg-purple-100 text-purple-800';
      case 'link': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownload = (resource: Resource) => {
    if (onDownload) {
      onDownload(resource);
      return;
    }

    if (resource.type === 'link') {
      window.open(resource.uri, '_blank');
      return;
    }

    const token = localStorage.getItem('auth_token');

    fetch(resourceApi.downloadUrl(resource.id), {
      headers: token ? {
        'Authorization': `Bearer ${token}`,
      } : undefined,
    })
      .then(response => {
        if (response.headers.get('content-type')?.includes('application/json')) {
          response.json().then(data => {
            if (data.success && data.data?.uri) {
              window.open(data.data.uri, '_blank');
            }
          });
          return;
        }
        response.blob().then(blob => {
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = resource.title || 'download';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(a);
        });
      })
      .catch(error => console.error('Download error:', error));
  };

  if (resources.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">学习资源</h3>
        <div className="text-gray-500 text-center py-8">
          暂无资源
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">学习资源</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map((resource) => (
          <div key={resource.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getTypeIcon(resource.type)}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {resource.title || '未命名资源'}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(resource.uploadedAt).toLocaleString()}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2 ${getTypeBadgeClass(resource.type)}`}>
                    {getTypeText(resource.type)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleDownload(resource)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-3 rounded-md transition-colors"
              >
                {resource.type === 'link' ? '打开链接' : '下载'}
              </button>
              {canDelete && onDelete && (
                <button
                  onClick={() => onDelete(resource.id)}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1.5 px-3 rounded-md transition-colors"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ResourceList;
