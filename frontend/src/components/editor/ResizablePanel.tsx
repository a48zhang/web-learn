import { Fragment } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

export { Panel, PanelGroup, PanelResizeHandle };

export interface PanelConfig {
  id: string;
  minSize: number;
  defaultSize?: number;
  collapsible?: boolean;
  header: React.ReactNode;
  headerRight?: React.ReactNode;
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
        <Fragment key={panel.id}>
          {index > 0 && (
            <PanelResizeHandle
              key={`handle-${panel.id}`}
              className="w-1 flex items-center justify-center shrink-0 group cursor-col-resize hover:bg-[#007acc] transition-colors h-full bg-[#1e1e1e] border-r border-[#2b2b2b]"
            >
            </PanelResizeHandle>
          )}
          <Panel
            id={panel.id}
            minSize={panel.minSize}
            defaultSize={panel.defaultSize}
            collapsible={panel.collapsible}
          >
            <div className="flex flex-col h-full bg-[#1e1e1e]">
              {panel.header && (
                <div className="h-[35px] bg-[#252526] flex items-center justify-between shrink-0 select-none relative z-10 w-full">
                  <div className="flex h-full min-w-0 max-w-full">
                    <div className="h-full px-4 flex items-center bg-[#1e1e1e] border-t border-t-[#007acc] text-[12px] text-white tracking-wide truncate whitespace-nowrap overflow-hidden">
                      {panel.header}
                    </div>
                    <div className="h-full w-4 bg-[#2d2d2d] border-b border-[#1e1e1e] shrink-0" />
                  </div>
                  <div className="h-full bg-[#2d2d2d] border-b border-[#1e1e1e] flex-1 flex justify-end tracking-wider">
                    {panel.headerRight}
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-hidden relative z-0">
                {panel.content}
              </div>
            </div>
          </Panel>
        </Fragment>
      ))}
    </PanelGroup>
  );
}
