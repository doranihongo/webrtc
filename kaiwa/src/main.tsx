import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CoursesProvider } from './context/CoursesContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CoursesProvider>
      <App />
    </CoursesProvider>
  </StrictMode>,
);