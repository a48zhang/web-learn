import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentRuntime } from '../../agent/useAgentRuntime';
import { useAgentStore } from '../../stores/useAgentStore';

export default function AgentChat() {
  const { runAgentLoop } = useAgentRuntime();
  const visibleMessages = useAgentStore((s) => s.visibleMessages);
  const runState = useAgentStore((s) => s.runState);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, runState.isRunning]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || runState.isRunning) return;
    setInput('');
    await runAgentLoop(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getToolStatusText = () => {
    if (!runState.currentToolName) return null;
    const toolLabels: Record<string, string> = {
      list_files: '列出文件',
      read_file: '读取文件',
      write_file: '写入文件',
      create_file: '创建文件',
      delete_file: '删除文件',
      move_file: '移动文件',
    };
    const label = toolLabels[runState.currentToolName] || runState.currentToolName;
    return runState.currentToolPath ? `正在${label}：${runState.currentToolPath}` : `正在执行：${label}`;
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-300">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleMessages.length === 0 && (
          <div className="text-sm text-zinc-500 text-center py-8">
            <p>描述你想要创建的网站</p>
            <p className="mt-2">Agent会询问你的偏好，然后帮你生成代码</p>
          </div>
        )}
        {visibleMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-zinc-800 border border-zinc-700 mr-8'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content || ''}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}
        {runState.isRunning && (
          <div className="text-xs text-zinc-500 space-y-1">
            {getToolStatusText() ? (
              <p className="text-zinc-400">{getToolStatusText()}</p>
            ) : (
              <p>Agent思考中...</p>
            )}
          </div>
        )}
        {runState.error && (
          <p className="text-xs text-red-400">{runState.error}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-700 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          placeholder="描述你想要的网站，或上传文件作为参考..."
          disabled={runState.isRunning}
        />
        <button
          onClick={handleSend}
          disabled={runState.isRunning || !input.trim()}
          className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm disabled:opacity-50 transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
