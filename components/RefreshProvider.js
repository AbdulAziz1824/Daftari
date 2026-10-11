"use client";
import { createContext, useContext, useRef, useCallback } from "react";

const RefreshContext = createContext(null);

export function RefreshProvider({ children }) {
  const handlerRef = useRef(null);

  // كل صفحة (الرئيسية/ملفاتي/ملاحظاتي/جدولي) تسجّل دالة تحميل بياناتها هنا
  const registerHandler = useCallback((fn) => {
    handlerRef.current = fn;
    return () => { if (handlerRef.current === fn) handlerRef.current = null; };
  }, []);

  const triggerRefresh = useCallback(() => {
    if (handlerRef.current) handlerRef.current();
  }, []);

  return (
    <RefreshContext.Provider value={{ registerHandler, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
