// تحليل نوع الجهاز من User-Agent (بدون مكتبات خارجية)
export function parseUserAgent(uaRaw) {
  const ua = String(uaRaw || "").slice(0, 400);
  let os = "";
  let model = "";
  let device_type = "desktop";

  if (/iPhone|iPod/.test(ua)) {
    device_type = "mobile";
    const m = ua.match(/OS (\d+)[_.](\d+)/);
    os = m ? `iOS ${m[1]}.${m[2]}` : "iOS";
    model = "iPhone";
  } else if (/iPad/.test(ua)) {
    device_type = "tablet";
    const m = ua.match(/OS (\d+)[_.](\d+)/);
    os = m ? `iPadOS ${m[1]}.${m[2]}` : "iPadOS";
    model = "iPad";
  } else if (/Android/.test(ua)) {
    device_type = /Mobile/.test(ua) ? "mobile" : "tablet";
    const v = ua.match(/Android (\d+(?:\.\d+)?)/);
    os = v ? `Android ${v[1]}` : "Android";
    const mm = ua.match(/Android [\d.]+;\s*([^;)]+)/);
    if (mm) model = mm[1].replace(/\s*Build\/.*$/, "").replace(/^wv$/, "").trim();
  } else if (/Windows NT/.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X (\d+)[_.](\d+)/);
    os = m ? `macOS ${m[1]}.${m[2]}` : "macOS";
  } else if (/CrOS/.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  let browser = "";
  const ver = (re) => { const m = ua.match(re); return m ? m[1] : ""; };
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = "Edge " + ver(/Edg(?:e|A|iOS)?\/(\d+)/);
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera " + ver(/OPR\/(\d+)/);
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet " + ver(/SamsungBrowser\/(\d+)/);
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = "Firefox " + ver(/(?:Firefox|FxiOS)\/(\d+)/);
  else if (/CriOS\/|Chrome\//.test(ua)) browser = "Chrome " + ver(/(?:CriOS|Chrome)\/(\d+)/);
  else if (/Safari\//.test(ua)) browser = "Safari " + ver(/Version\/(\d+)/);

  return { device_type, os, model, browser: browser.trim(), user_agent: ua.slice(0, 300) };
}

const TYPE_LABEL = { mobile: "جوال", tablet: "تابلت", desktop: "كمبيوتر" };

// نص جاهز للعرض: "جوال · Android 14 · SM-S918B · Chrome 126 · تطبيق مثبّت"
export function deviceLabel(d) {
  if (!d) return "جهاز غير معروف";
  const parts = [TYPE_LABEL[d.device_type] || "جهاز", d.os, d.model, d.browser].filter(Boolean);
  if (d.standalone) parts.push("تطبيق مثبّت");
  return parts.join(" · ");
}

export const EVENT_LABEL = { login: "تسجيل دخول", open: "فتح التطبيق" };
