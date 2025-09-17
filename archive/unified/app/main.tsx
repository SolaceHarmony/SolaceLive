import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyHFTokenFromStorage } from '../audio/whisperx/utils/hfAuth'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { logger } from '../utils/logger'

// Initialize HF token
applyHFTokenFromStorage()

// Initialize logger
logger.info('Main', 'Application starting', {
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString(),
  url: window.location.href
});

// Add keyboard shortcut for downloading logs
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    logger.downloadLogs();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary componentName="App">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
