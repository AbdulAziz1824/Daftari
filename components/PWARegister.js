"use client";
import { useEffect } from "react";

// تسجيل الـ Service Worker + حفظ حدث التثبيت (أندرويد) ليستخدمه زر "تثبيت"
export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e) => {
      e.preventDefault();
      window.__fazaaInstallPrompt = e;
      window.dispatchEvent(new Event("fazaa-install-ready"));
    };
    const onInstalled = () => { window.__fazaaInstallPrompt = null; };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
