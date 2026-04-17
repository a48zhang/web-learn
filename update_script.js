const fs = require('fs');
const filePath = 'frontend/src/components/AgentChatContent.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldString = `{message.tools && message.tools.length > 0 && (
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/5">
            {message.tools.map((tool, i) => {
              const ToolIcon = tool.state === 'running' ? (
                <svg className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : tool.state === 'error' ? (
                <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              );

              const toolPath = tool.args?.path || tool.args?.oldPath || tool.args?.newPath || '';
              const desc = toolPath ? \`${getToolActionText(tool.name)}: ${toolPath.split('/').pop()}\` : getToolActionText(tool.name);

              return (
                <details key={\`tool-${tool.id}-${i}\`} className="group group-tool">
                  <summary className="flex items-center gap-2 px-3 py-2 bg-zinc-950/20 hover:bg-zinc-950/40 border border-zinc-800/50 rounded-lg cursor-pointer transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
                    {ToolIcon}
                    <span className={\`text-[13px] font-medium flex-1 \${tool.state === 'error' ? 'text-red-400/90' : 'text-zinc-300'}\`}>
                      {desc}
                    </span>
                    <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                      {tool.state === 'running'
                        ? <span className="animate-pulse">执行中...</span>
                        : tool.state === 'success'
                          ? <span className="text-emerald-500/80">已完成</span>
                          : <span className="text-red-500/80">失败</span>
                      }
                      <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="mt-1 flex flex-col gap-2 relative">
                    <div className="p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-lg text-[12px] font-mono text-zinc-400 overflow-x-auto custom-scrollbar">
                      <div className="text-zinc-500 mb-1 font-sans text-[11px]">工具参数</div>
                      <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap word-break-all">
                        {JSON.stringify(tool.args, null, 2)}
                      </pre>
                    </div>
                    {tool.result && (
                      <div className={\`p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-lg text-[12px] font-mono overflow-x-auto custom-scrollbar \${tool.state === 'error' ? 'text-red-400' : 'text-zinc-400'}\`}>
                        <div className="text-zinc-500 mb-1 font-sans text-[11px]">执行结果</div>
                        <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap word-break-all">
                          {tool.result}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}`;

const newString = `{message.tools && message.tools.length > 0 && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-white/5 w-full">
            {message.tools.map((tool, i) => {
              const ToolIcon = tool.state === 'running' ? (
                <svg className="w-3 h-3 text-blue-400/80 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : tool.state === 'error' ? (
                <svg className="w-3 h-3 text-red-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-emerald-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              );

              const toolPath = tool.args?.path || tool.args?.oldPath || tool.args?.newPath || '';
              const desc = toolPath ? \`\${getToolActionText(tool.name)}: \${toolPath.split('/').pop()}\` : getToolActionText(tool.name);

              return (
                <details key={\`tool-\${tool.id}-\${i}\`} className="group group-tool">
                  <summary className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 rounded-md cursor-pointer transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
                    {ToolIcon}
                    <span className={\`text-[11px] font-medium flex-1 truncate \${tool.state === 'error' ? 'text-red-400/90' : 'text-zinc-400'}\`}>
                      {desc}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 shrink-0">
                      {tool.state === 'running' 
                        ? <span className="animate-pulse">执行中...</span>
                        : tool.state === 'success' 
                          ? <span className="text-emerald-500/70">已完成</span>
                          : <span className="text-red-500/70">失败</span>
                      }
                      <svg className="w-3 h-3 transition-transform group-open:rotate-180 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="mt-1 flex flex-col gap-1 relative px-0.5">
                    <div className="p-2 bg-zinc-950/50 border border-zinc-800/40 rounded-md text-[11px] font-mono text-zinc-400 overflow-x-auto custom-scrollbar">
                      <div className="text-zinc-500 mb-1 font-sans text-[10px] uppercase tracking-wider">Params</div>
                      <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-all leading-relaxed">
                        {JSON.stringify(tool.args, null, 2)}
                      </pre>
                    </div>
                    {tool.result && (
                      <div className={\`p-2 bg-zinc-950/50 border border-zinc-800/40 rounded-md text-[11px] font-mono overflow-x-auto custom-scrollbar \${tool.state === 'error' ? 'text-red-400/90' : 'text-zinc-400'}\`}>
                        <div className="text-zinc-500 mb-1 font-sans text-[10px] uppercase tracking-wider">Output</div>
                        <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-all leading-relaxed">
                          {tool.result}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}`;

// Quick regex to handle any whitespace differences
const regexStart = /\{message\.tools && message\.tools\.length > 0 && \([\s\S]*?<\/div>\s*\)\}/;
content = content.replace(regexStart, newString);

const regexOldIndicator = /\{\/\* Tool Activity Indicator \*\/\}[\s\S]*?\{\/\* Thinking Indicator \*\/\}/;
const newIndicator = `{/* Thinking Indicator */}`;
content = content.replace(regexOldIndicator, newIndicator);

fs.writeFileSync(filePath, content);
