import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import type { Layout } from 'react-resizable-panels';

export { Panel, PanelGroup, PanelResizeHandle };

export interface PanelConfig {
  id: string;
  minSize: number;
  defaultSize?: number;
  collapsible?: boolean;
  header: React.ReactNode;
  content: React.ReactNode;
}

interface EditorPanelGroupProps {
  panels: PanelConfig[];
  direction?: 'horizontal' | 'vertical';
  onLayoutChange?: (sizes: number[]) => void;
}

export function EditorPanelGroup({ panels, direction = 'horizontal', onLayoutChange }: EditorPanelGroupProps) {
  return (
    <PanelGroup
      orientation={direction}
      onLayoutChanged={(layout: Layout) => onLayoutChange?.(Object.values(layout))}
      className="h-full"
    >
      {panels.map((panel, index) => (
        <>
          {index > 0 && (
            <PanelResizeHandle
              key={`handle-${panel.id}`}
              className="w-1 bg-zinc-700 hover:bg-blue-500 transition-colors cursor-col-resize shrink-0"
            />
          )}
          <Panel
            key={panel.id}
            id={panel.id}
            minSize={panel.minSize}
            defaultSize={panel.defaultSize}
            collapsible={panel.collapsible}
          >
            <div className="flex flex-col h-full bg-zinc-900">
              <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-3 text-xs text-zinc-400 font-medium shrink-0">
                {panel.header}
              </div>
              <div className="flex-1 overflow-hidden">
                {panel.content}
              </div>
            </div>
          </Panel>
        </>
      ))}
    </PanelGroup>
  );
}
