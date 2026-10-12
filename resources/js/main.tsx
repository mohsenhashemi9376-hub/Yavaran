import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { enablePersianDigits } from './utils/persianizeDom';
import { enableResponsiveTables } from './utils/responsiveTables';
import { enableSheetGestures } from './utils/sheetGestures';
import { enableScrollTopOnNavigate } from './utils/scrollTopOnNavigate';

// بازیابی خودکار موقعیت اسکرول مرورگر با رندر دیرهنگام داده‌ها تداخل می‌کند و صفحه می‌پرد
try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch { /* ignore */ }

enablePersianDigits();
enableResponsiveTables();
enableSheetGestures();
enableScrollTopOnNavigate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
