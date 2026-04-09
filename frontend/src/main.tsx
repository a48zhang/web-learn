import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Import all agent tools to register them at app startup
import './agent/tools/listFiles';
import './agent/tools/readFile';
import './agent/tools/writeFile';
import './agent/tools/createFile';
import './agent/tools/deleteFile';
import './agent/tools/moveFile';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
