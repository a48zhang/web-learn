import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

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
}

export function EditorPanelGroup({ panels, direction = 'horizontal' }: EditorPanelGroupProps) {
  return (
    <PanelGroup
      orientation={direction}
      className="h-full min-h-0"
    >
      {panels.map((panel, index) => (
        <>
          {index > 0 && (
            <PanelResizeHandle
              key={`handle-${panel.id}`}
              className="w-3 flex items-center justify-center shrink-0 group cursor-col-resize"
            >
              <div className="w-1 bg-zinc-700 group-hover:bg-blue-500 transition-colors h-full" />
            </PanelResizeHandle>
          )}
          <Panel
            key={panel.id}
            id={panel.id}
            minSize={panel.minSize}
            defaultSize={panel.defaultSize}
            collapsible={panel.collapsible}
          >
            <div className="flex flex-col h-full bg-zinc-900">
              <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-3 text-xs text-zinc-400 font-medium shrink-0 select-none">
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
