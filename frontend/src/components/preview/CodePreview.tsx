import { useEditorStore } from '@/stores/useEditorStore';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { useThemeStore } from '@/stores/useThemeStore';

function getFileExtension(path: string | null): string {
  if (!path) return '';
  return path.split('.').pop()?.toLowerCase() || '';
}

function getLanguageExtension(ext: string) {
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })];
    case 'html':
      return [html()];
    case 'css':
    case 'scss':
    case 'less':
      return [css()];
    case 'json':
      return [json()];
    case 'md':
      return [markdown()];
    default:
      return [];
  }
}

export function CodePreview() {
  const { activePreviewContent, activeFile } = useEditorStore();
  const { theme } = useThemeStore();

  if (!activePreviewContent || !activeFile) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <p>请选择文件以查看代码预览</p>
      </div>
    );
  }

  const ext = getFileExtension(activeFile);
  const extensions = getLanguageExtension(ext);

  return (
    <div className="h-full w-full">
      <CodeMirror
        value={activePreviewContent}
        height="100%"
        theme={theme === 'dark' ? vscodeDark : 'light'}
        extensions={extensions}
        readOnly
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          searchKeymap: true,
          foldKeymap: true,
          completionKeymap: false,
          lintKeymap: true,
        }}
      />
    </div>
  );
}
