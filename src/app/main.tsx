import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { installClientErrorReporting } from '@/shared/lib';
import '@/app/styles/index.css';

// Before the first render, so a throw during start-up is reported rather than only logged.
installClientErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
