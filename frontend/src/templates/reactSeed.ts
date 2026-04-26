/**
 * Fixed React seed scaffold for WebContainer.
 *
 * One import provides the complete default project snapshot for a brand-new
 * topic.  Every new website editor starts from this minimal React 18 +
 * TypeScript + Vite scaffold instead of an empty filesystem.
 *
 * File paths are root-relative (e.g. `package.json`, `src/main.tsx`) — the
 * WebContainer init helper prepends `/home/project/` at runtime.
 *
 * IMPORTANT: keep contents generic and neutral so that later build-agent
 * prompts can freely reshape the project.  Do NOT bake product-specific UI
 * into any file.
 */

export const reactSeed: Record<string, string> = {
  // ---------------------------------------------------------------------------
  // package.json — React 18, Vite 5, TypeScript 5 (deterministic patch versions)
  // ---------------------------------------------------------------------------
  'package.json': JSON.stringify(
    {
      name: 'my-app',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '18.2.0',
        'react-dom': '18.2.0',
      },
      devDependencies: {
        '@types/react': '18.2.55',
        '@types/react-dom': '18.2.19',
        '@vitejs/plugin-react': '4.2.1',
        typescript: '5.4.2',
        vite: '5.1.6',
      },
    },
    null,
    2,
  ),

  // ---------------------------------------------------------------------------
  // Vite config
  // ---------------------------------------------------------------------------
  'vite.config.ts': [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    '',
    'export default defineConfig({',
    '  plugins: [react()],',
    '  server: {',
    "    host: 'localhost',",
    '    port: 5173,',
    '  },',
    '});',
    '',
  ].join('\n'),

  // ---------------------------------------------------------------------------
  // TypeScript config
  // ---------------------------------------------------------------------------
  'tsconfig.json': JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    },
    null,
    2,
  ),

  'tsconfig.node.json': JSON.stringify(
    {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
      },
      include: ['vite.config.ts'],
    },
    null,
    2,
  ),

  // ---------------------------------------------------------------------------
  // HTML entry point
  // ---------------------------------------------------------------------------
  'index.html': [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    <title>My App</title>',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '    <script type="module" src="/src/main.tsx"></script>',
    '  </body>',
    '</html>',
    '',
  ].join('\n'),

  // ---------------------------------------------------------------------------
  // src/ — application source
  // ---------------------------------------------------------------------------
  'src/vite-env.d.ts': [
    '/// <reference types="vite/client" />',
    '',
  ].join('\n'),

  'src/main.tsx': [
    "import { StrictMode } from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import App from './App';",
    "import './index.css';",
    '',
    "createRoot(document.getElementById('root')!).render(",
    '  <StrictMode>',
    '    <App />',
    '  </StrictMode>,',
    ');',
    '',
  ].join('\n'),

  'src/App.tsx': [
    "function App() {",
    "  return (",
    "    <div style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>",
    "      <h1>Hello, world</h1>",
    "      <p>Edit <code>src/App.tsx</code> and save to reload.</p>",
    "    </div>",
    "  );",
    "}",
    "",
    "export default App;",
    "",
  ].join('\n'),

  'src/index.css': [
    ':root {',
    '  color: #1f2937;',
    '  background: #ffffff;',
    '}',
    '',
    'body {',
    '  margin: 0;',
    '  color: inherit;',
    '  background: inherit;',
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',",
    "    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;",
    '  -webkit-font-smoothing: antialiased;',
    '  -moz-osx-font-smoothing: grayscale;',
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    '    color: #f9fafb;',
    '    background: #111827;',
    '  }',
    '}',
    '',
    'code {',
    "  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;",
    '}',
    '',
  ].join('\n'),
};
