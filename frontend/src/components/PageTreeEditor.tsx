import type { TopicPageTreeNode } from '@web-learn/shared';

interface PageTreeEditorProps {
  pages: TopicPageTreeNode[];
  selectedPageId?: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentPageId?: string | null) => void;
  onDeletePage: (pageId: string) => void;
  deletingPageId?: string | null;
}

function PageEditorNode({
  node,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  deletingPageId,
  depth,
}: {
  node: TopicPageTreeNode;
  selectedPageId?: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentPageId?: string | null) => void;
  onDeletePage: (pageId: string) => void;
  deletingPageId?: string | null;
  depth: number;
}) {
  const isActive = selectedPageId === node.id;
  const isPendingDelete = deletingPageId === node.id;
  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded-md ${
          isActive ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <button
          type="button"
          onClick={() => onSelectPage(node.id)}
          className="flex-1 text-left text-sm text-gray-800"
        >
          {node.title}
        </button>
        <button
          type="button"
          onClick={() => onCreatePage(node.id)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          +子页
        </button>
        <button
          type="button"
          onClick={() => onDeletePage(node.id)}
          className="text-xs text-red-600 hover:text-red-700"
        >
          {isPendingDelete ? '待确认' : '删除'}
        </button>
      </div>
      {node.children
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((child) => (
          <PageEditorNode
            key={child.id}
            node={child}
            selectedPageId={selectedPageId}
            onSelectPage={onSelectPage}
            onCreatePage={onCreatePage}
            onDeletePage={onDeletePage}
            deletingPageId={deletingPageId}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function PageTreeEditor({
  pages,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  deletingPageId,
}: PageTreeEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">页面结构</h3>
        <button
          type="button"
          onClick={() => onCreatePage(null)}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
        >
          +新页面
        </button>
      </div>
      <div className="space-y-1">
        {pages.length === 0 ? (
          <p className="text-sm text-gray-500">暂无页面</p>
        ) : (
          pages
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((page) => (
              <PageEditorNode
                key={page.id}
                node={page}
                selectedPageId={selectedPageId}
                onSelectPage={onSelectPage}
                onCreatePage={onCreatePage}
                onDeletePage={onDeletePage}
                deletingPageId={deletingPageId}
                depth={0}
              />
            ))
        )}
      </div>
    </div>
  );
}

export default PageTreeEditor;
