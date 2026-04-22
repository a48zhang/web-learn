import { ReactNode } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

export { Panel, PanelGroup, PanelResizeHandle };

export interface PanelConfig {
  id: string;
  minSize: string | number;
  maxSize?: string | number;
  defaultSize?: string | number;
  collapsible?: boolean;
  onResize?: (panelSize: any) => void;
  panelRef?: React.RefObject<any>;
  header: React.ReactNode;
  headerRight?: React.ReactNode;
  content: React.ReactNode;
}

interface EditorPanelGroupProps {
  panels: PanelConfig[];
  direction?: 'horizontal' | 'vertical';
}

export function EditorPanelGroup({ panels, direction = 'horizontal' }: EditorPanelGroupProps) {
  const children: ReactNode[] = [];
  panels.forEach((panel, index) => {
    if (index > 0) {
      children.push(
        <PanelResizeHandle
          id={`handle-${panel.id}`}
          key={`handle-${panel.id}`}
          className="w-1.5 cursor-col-resize pointer-events-auto bg-gray-200 dark:bg-[#2b2b2b] hover:bg-blue-500 dark:hover:bg-[#007acc] shrink-0 transition-colors z-40 relative flex items-center justify-center"
        />
      );
    }
    children.push(
      <Panel
        key={panel.id}
        id={panel.id}
        minSize={panel.minSize}
        maxSize={panel.maxSize}
        defaultSize={panel.defaultSize}
        collapsible={panel.collapsible}
        onResize={panel.onResize}
        panelRef={panel.panelRef}
      >
        <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
          {panel.header && (
            <div className="h-[35px] bg-gray-100 dark:bg-[#252526] flex items-center justify-between shrink-0 select-none relative z-10 w-full border-b border-gray-200 dark:border-transparent">
              <div className="flex h-full min-w-0 max-w-full">
                <div className="h-full px-4 flex items-center bg-white dark:bg-[#1e1e1e] border-t-[2px] border-t-blue-500 dark:border-t-[#007acc] text-[12px] text-gray-700 dark:text-white tracking-wide truncate whitespace-nowrap overflow-hidden">
                  {panel.header}
                </div>
                <div className="h-full w-4 bg-gray-200 dark:bg-[#2d2d2d] border-b border-gray-100 dark:border-[#1e1e1e] shrink-0" />
              </div>
              <div className="h-full bg-gray-200 dark:bg-[#2d2d2d] border-b border-gray-100 dark:border-[#1e1e1e] flex-1 flex justify-end tracking-wider">
                {panel.headerRight}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden relative z-0">
            {panel.content}
          </div>
        </div>
      </Panel>
    );
  });

  return (
    <PanelGroup
      orientation={direction}
      className="h-full w-full min-h-0 flex"
    >
      {children}
    </PanelGroup>
  );
}
