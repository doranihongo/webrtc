import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CoursesProvider } from './context/CoursesContext';
import { preventStickyButtonFocus } from './utils/preventStickyButtonFocus';
import { setupShareableAudioBridge } from './utils/shareableAudioBus';

// Chặn lỗi "nút bị dính" trong toàn app - xem giải thích chi tiết trong
// utils/preventStickyButtonFocus.ts.
preventStickyButtonFocus();

// Lộ window.__getShareableAudioTrack cho trang cha (client.js) gọi khi
// share màn hình - xem giải thích đầy đủ trong utils/shareableAudioBus.ts.
setupShareableAudioBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CoursesProvider>
      <App />
    </CoursesProvider>
  </StrictMode>,
);