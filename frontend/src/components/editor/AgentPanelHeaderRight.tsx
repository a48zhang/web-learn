import { useState } from 'react';
import { useAgentStore } from '../../stores/useAgentStore';

const MODELS: Array<{ label: string; id: string; desc: string; logoUrl: string }> = [
  {
    label: 'MiniMax M2.7',
    id: 'MiniMax-M2.7',
    desc: 'MiniMax的通用推理模型，上下文理解与速度的极佳平衡',
    logoUrl: 'https://avatars.githubusercontent.com/u/194880281?v=4'
  },
  {
    label: 'Qwen 3',
    id: 'qwen3',
    desc: '通义千问推理模型，长逻辑和编程能力卓越',
    logoUrl: 'https://avatars.githubusercontent.com/u/141221163?v=4'
  },
  {
    label: 'Doubao Seed Code',
    id: 'doubao-seed-2.0-code',
    desc: '火山引擎提供，针对代码生成深度优化',
    logoUrl: 'https://avatars.githubusercontent.com/u/67365215?v=4'
  },
  {
    label: 'GPT-5.4',
    id: 'gpt-5.4',
    desc: 'OpenAI的高阶系统规划、逻辑推理与编码模型',
    logoUrl: 'https://avatars.githubusercontent.com/u/14957082?v=4'
  },
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
          className="text-[11px] text-[#cccccc] hover:text-white flex items-center gap-1.5 px-1.5 py-1 rounded bg-[#333333] border border-[#2b2b2b] hover:bg-[#3e3e42] transition-colors h-[22px]"
          title="切换 AI 模型"
        >
          <img 
            src={currentModel.logoUrl} 
            alt={currentModel.label} 
            className="w-[14px] h-[14px] rounded-sm object-contain" 
          />
          <span>{currentModel.label}</span>
          <svg className={`w-3 h-3 text-[#858585] transition-transform ${showModelPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showModelPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowModelPicker(false)}
            />
            <div className="absolute right-0 top-[28px] mt-1 w-[260px] bg-[#252526] border border-[#3c3c3c] rounded shadow-xl py-1.5 z-50 flex flex-col gap-0.5">
              <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-[#858585] font-semibold border-b border-[#3c3c3c] mb-1">
                选择代理使用的语言模型
              </div>
              {MODELS.map((m) => {
                const isActive = model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                    className={`w-full flex items-start gap-3 px-3 py-2 transition-colors border-l-2 text-left ${
                      isActive ? 'bg-[#04395e] border-[#007acc]' : 'border-transparent hover:bg-[#2a2d2e]'
                    }`}
                  >
                    {/* Logo Area */}
                    <div className="w-8 h-8 rounded-md shrink-0 mt-0.5 shadow-sm bg-white overflow-hidden flex items-center justify-center p-0.5">
                      <img 
                        src={m.logoUrl} 
                        alt={m.label} 
                        className="w-full h-full object-contain rounded-sm" 
                        loading="lazy" 
                      />
                    </div>
                    {/* Text Area */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className={`text-[12px] font-medium leading-none ${isActive ? 'text-white' : 'text-[#cccccc]'}`}>
                        {m.label}
                      </span>
                      <span className="text-[10px] text-[#858585] mt-1.5 leading-[1.35] max-w-full">
                        {m.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
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
