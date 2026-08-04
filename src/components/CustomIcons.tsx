import React from 'react';

export const ScreenShareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="18" height="12" rx="2" />
    <path d="M12 13V6" />
    <path d="m8 9 4-4 4 4" />
    <path d="M2 19h20" />
  </svg>
);

export const ChatIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M7.5 7.5h9" />
    <path d="M7.5 10.5h9" />
    <path d="M7.5 13.5h5.5" />
  </svg>
);
