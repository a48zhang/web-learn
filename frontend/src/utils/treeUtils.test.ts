import { describe, it, expect } from 'vitest';
import { findNodePath } from './treeUtils';
import type { TopicPageTreeNode } from '@web-learn/shared';

function node(id: string, children: TopicPageTreeNode[] = []): TopicPageTreeNode {
  return { id, title: `Page ${id}`, content: '', order: 0, parentPageId: null, topicId: 't1', children, createdAt: '', updatedAt: '' };
}

describe('findNodePath', () => {
  it('returns null for empty tree', () => {
    expect(findNodePath([], 'x')).toBeNull();
  });

  it('returns null if node not found', () => {
    const tree = [node('a'), node('b')];
    expect(findNodePath(tree, 'z')).toBeNull();
  });

  it('returns path of length 1 for root node', () => {
    const tree = [node('a'), node('b')];
    const result = findNodePath(tree, 'a');
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('a');
  });

  it('returns path from root to nested child', () => {
    const child = node('c');
    const parent = node('b', [child]);
    const root = node('a', [parent]);
    const tree = [root];
    const result = findNodePath(tree, 'c');
    expect(result).toHaveLength(3);
    expect(result!.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns path for a direct child of root', () => {
    const child = node('b');
    const root = node('a', [child]);
    const result = findNodePath([root], 'b');
    expect(result).toHaveLength(2);
    expect(result!.map(n => n.id)).toEqual(['a', 'b']);
  });
});
