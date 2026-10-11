export default function manifest() {
  return {
    id: "/",
    name: "فزعة",
    short_name: "فزعة",
    description: "راجع بذكاء، وتابع مواعيدك بثقة",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    background_color: "#05070a",
    theme_color: "#0a1f16",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "ملفاتي", url: "/dashboard/files" },
      { name: "ملاحظاتي", url: "/dashboard/notes" },
      { name: "جدولي", url: "/dashboard/table" },
    ],
  };
}
