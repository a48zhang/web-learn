import type { TopicPageTreeNode } from '@web-learn/shared';

interface PageTreeNavProps {
  pages: TopicPageTreeNode[];
  selectedPageId?: string | null;
  onSelectPage: (pageId: string) => void;
}

function PageNode({
  node,
  selectedPageId,
  depth,
  onSelectPage,
}: {
  node: TopicPageTreeNode;
  selectedPageId?: string | null;
  depth: number;
  onSelectPage: (pageId: string) => void;
}) {
  const isActive = selectedPageId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelectPage(node.id)}
        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
          isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {node.title}
      </button>
      {node.children.length > 0 && (
        <div className="space-y-1 mt-1">
          {node.children
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((child) => (
              <PageNode
                key={child.id}
                node={child}
                selectedPageId={selectedPageId}
                depth={depth + 1}
                onSelectPage={onSelectPage}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function PageTreeNav({ pages, selectedPageId, onSelectPage }: PageTreeNavProps) {
  return (
    <div className="space-y-2">
      {pages.length === 0 ? (
        <p className="text-sm text-gray-500 px-2">暂无页面</p>
      ) : (
        pages
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((page) => (
            <PageNode
              key={page.id}
              node={page}
              selectedPageId={selectedPageId}
              depth={0}
              onSelectPage={onSelectPage}
            />
          ))
      )}
    </div>
  );
}

export default PageTreeNav;
