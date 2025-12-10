import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  type?: 'error' | 'success' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, type = 'info' }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    error: 'bg-red-500',
    success: 'bg-green-500',
    info: 'bg-gray-800'
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg ${bgColors[type]} text-white text-sm font-medium animate-slide-up flex items-center gap-2`}>
      {type === 'error' && <span>⚠️</span>}
      {message}
    </div>
  );
};