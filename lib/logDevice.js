// يسجّل الدخول/الجهاز في الخادم. لا يعطّل التطبيق أبدًا إذا فشل.
export function logDevice(event, accessToken) {
  try {
    if (!accessToken || typeof window === "undefined") return;
    const standalone =
      !!window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    sessionStorage.setItem("fazaa_logged", "1");
    fetch("/api/auth/log", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event, standalone }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
