import { useState } from 'react';
import AgentChatContent from './AgentChatContent';

interface AIChatSidebarProps {
  topicId: string;
  title?: string;
}

function AIChatSidebar({ topicId, title = 'AI 助手' }: AIChatSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full px-4 py-3 shadow-lg"
      >
        {open ? '关闭助手' : title}
      </button>
      {open && (
        <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-zinc-900 border-l border-zinc-700 shadow-2xl z-50 flex flex-col">
          <AgentChatContent topicId={topicId} title={title} />
        </aside>
      )}
    </>
  );
}

export default AIChatSidebar;
