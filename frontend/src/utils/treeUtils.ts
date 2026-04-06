import type { TopicPageTreeNode } from '@web-learn/shared';

export function flattenPages(nodes: TopicPageTreeNode[]): TopicPageTreeNode[] {
  const result: TopicPageTreeNode[] = [];
  const walk = (node: TopicPageTreeNode) => {
    result.push(node);
    node.children
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach(walk);
  };
  nodes
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach(walk);
  return result;
}

export function findNode(nodes: TopicPageTreeNode[], id: string): TopicPageTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Returns the path from root to the node with the given id (inclusive),
 * or null if not found.
 * Example: findNodePath(tree, 'c') -> [root, parent, nodeC]
 */
export function findNodePath(nodes: TopicPageTreeNode[], id: string): TopicPageTreeNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findNodePath(node.children, id);
    if (childPath) return [node, ...childPath];
  }
  return null;
}

export function findFirstPage(nodes: TopicPageTreeNode[]): TopicPageTreeNode | null {
  const sorted = nodes.slice().sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;
  const first = sorted[0];
  if (first.children.length > 0) {
    return findFirstPage([first.children.slice().sort((a, b) => a.order - b.order)[0]]) || first;
  }
  return first;
}
