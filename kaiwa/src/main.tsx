import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CoursesProvider } from './context/CoursesContext';
import { preventStickyButtonFocus } from './utils/preventStickyButtonFocus';

// Chặn lỗi "nút bị dính" trong toàn app - xem giải thích chi tiết trong
// utils/preventStickyButtonFocus.ts.
preventStickyButtonFocus();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CoursesProvider>
      <App />
    </CoursesProvider>
  </StrictMode>,
);