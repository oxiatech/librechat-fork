import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import './locales/i18n';
// Split-11 §7: dispatch between Mode 1 (LibreChat's App) and Mode 2
// (Mode2App) at the React root. RootDispatcher reads
// /api/oxia/config once at boot, lazy-imports the right branch,
// and fails-closed to Mode 1 if the config endpoint is unreachable.
// Mode 1 bundles stay free of @oxia/sdk-mode2 — verified by
// e2e/mode1/regression.spec.ts's entry-chunk grep.
import { RootDispatcher } from './RootDispatcher';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <ApiErrorBoundaryProvider>
    <RootDispatcher />
  </ApiErrorBoundaryProvider>,
);
