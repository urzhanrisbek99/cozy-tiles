import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { watchScreen } from '@/shared/lib/viewport';
import { App } from './App';
import './styles/index.css';

watchScreen();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
