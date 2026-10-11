"use client";
import { createContext, useContext, useState, useCallback } from "react";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const showLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
  const hideLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <UIContext.Provider value={{ showLoading, hideLoading, showToast }}>
      {children}
      {loadingCount > 0 && (
        <div className="loading-overlay"><div className="spinner"></div></div>
      )}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.type}>{t.message}</div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
