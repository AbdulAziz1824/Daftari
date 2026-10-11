import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { UIProvider } from "@/components/UIProvider";
import PWARegister from "@/components/PWARegister";

export const metadata = {
  title: "فزعة",
  description: "راجع بذكاء، وتابع مواعيدك بثقة",
  applicationName: "فزعة",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/logo.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "فزعة", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1f16",
};

// يطبّق الوضع المحفوظ (فاتح/داكن) قبل رسم الصفحة لتجنب الوميض، ويعمل في صفحة الدخول أيضًا
const themeInit = `try{if(localStorage.getItem("fazaa_theme")==="light"){document.body.classList.add("light-theme");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#ffffff");}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <AuthProvider>
          <UIProvider>{children}</UIProvider>
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
