import { useState } from 'react';
import { useAgentStore } from '../../stores/useAgentStore';

const MODELS: Array<{ label: string; id: string }> = [
  { label: 'MiniMax', id: 'MiniMax-M2.7' },
  { label: 'Qwen', id: 'qwen3.6-plus' },
  { label: 'Doubao', id: 'doubao-seed-2.0-code' },
  { label: 'GPT-5.4', id: 'gpt-5.4' },
];

export default function AgentPanelHeaderRight() {
  const { model, setModel, visibleMessages, setVisibleMessages } = useAgentStore();
  const [showModelPicker, setShowModelPicker] = useState(false);

  const currentModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

  const handleClearChat = () => {
    setVisibleMessages([]);
  };

  return (
    <div className="flex items-center justify-end px-2 h-full gap-2">
      {/* Model Picker */}
      <div className="relative h-full flex items-center">
        <button
          type="button"
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="text-[11px] text-[#cccccc] hover:text-white flex items-center gap-1 px-1.5 py-1 rounded bg-[#333333] border border-[#2b2b2b] hover:bg-[#3e3e42] transition-colors h-[22px]"
          title="切换 AI 模型"
        >
          <span>{currentModel.label}</span>
          <svg className={`w-3 h-3 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showModelPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowModelPicker(false)}
            />
            <div className="absolute right-0 top-[28px] mt-1 w-36 bg-[#252526] border border-[#2b2b2b] rounded-md shadow-lg py-1 z-50">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${model === m.id ? 'text-white bg-[#007acc]' : 'text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Clear Chat */}
      {visibleMessages.length > 0 && (
        <button
          type="button"
          onClick={handleClearChat}
          className="text-[#858585] hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-[#333333] transition-colors outline-none"
          title="清空对话"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
