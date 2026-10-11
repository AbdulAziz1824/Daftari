"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { HomeIcon, FolderIcon, NoteIcon, TableIcon, SettingsIcon, LogoutIcon, RefreshIcon, SunIcon, MoonIcon, PhoneIcon, UsersIcon, SparkIcon, InstallIcon, HeadsetIcon, ShieldIcon } from "@/components/Icons";
import SupportModal from "@/components/SupportModal";
import InstallGuideModal from "@/components/InstallGuideModal";
import { APP_VERSION } from "@/lib/version";
import { getGreeting } from "@/lib/greeting";
import { logDevice } from "@/lib/logDevice";
import { RefreshProvider, useRefresh } from "@/components/RefreshProvider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "الرئيسية", icon: HomeIcon },
  { href: "/dashboard/files", label: "ملفاتي", icon: FolderIcon },
  { href: "/dashboard/notes", label: "ملاحظاتي", icon: NoteIcon },
  { href: "/dashboard/table", label: "جدولي", icon: TableIcon },
  { href: "/dashboard/community", label: "المجتمع", icon: UsersIcon },
  { href: "/dashboard/fazaa", label: "الفزعة", icon: SparkIcon },
  { href: "/dashboard/settings", label: "الإعدادات", icon: SettingsIcon },
];
const DEV_ITEM = { href: "/dashboard/admin", label: "المطور", icon: ShieldIcon };
const REFRESH_EVERY_MS = 5 * 60 * 1000; // تحديث تلقائي كل 5 دقائق

export default function DashboardLayout({ children }) {
  return (
    <RefreshProvider>
      <DashboardInner>{children}</DashboardInner>
    </RefreshProvider>
  );
}

function DashboardInner({ children }) {
  const { user, profile, loading, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { triggerRefresh } = useRefresh();
  const [clock, setClock] = useState({ date: "--/--/----", time: "--:--:--" });
  const [greeting, setGreeting] = useState(getGreeting());
  const [installOpen, setInstallOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [theme, setTheme] = useState(null); // null = لم يُقرأ بعد (لتجنب وميض الوضع)
  const [lastUpdate, setLastUpdate] = useState("—");
  const [supportOpen, setSupportOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const navItems = isAdmin ? [...NAV_ITEMS, DEV_ITEM] : NAV_ITEMS;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setClock({ date: now.toLocaleDateString("en-GB"), time: now.toLocaleTimeString("en-GB") });
      setGreeting(getGreeting(now));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // آخر ظهور: نسجّل وجود المستخدم كل دقيقة أثناء فتح التطبيق
    if (!user) return;
    const ping = () => {
      if (document.visibilityState === "hidden") return;
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id).then(() => {}, () => {});
    };
    ping();
    const timer = setInterval(ping, 60000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", ping); };
  }, [user]);

  useEffect(() => {
    // سجل الجهاز: مرة واحدة لكل جلسة تبويب (يلتقط من لم يسجّل دخوله من جديد)
    if (!user) return;
    try { if (sessionStorage.getItem("fazaa_logged")) return; } catch {}
    supabase.auth.getSession().then(({ data }) => logDevice("open", data?.session?.access_token));
  }, [user]);

  useEffect(() => {
    // هل التطبيق مفتوح كتطبيق مثبّت؟ (لإخفاء زر التثبيت)
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setInstalled(!!standalone);
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("fazaa_theme") : null;
    setTheme(saved === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.body.classList.toggle("light-theme", theme === "light");
    // لون شريط الحالة في الجوال/التطبيق المثبّت يتبع الوضع
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#0a1f16");
  }, [theme]);

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }, [pathname, refreshTick]);

  // تحديث تلقائي كل 5 دقائق (يعيد تحميل بيانات الصفحة الحالية فقط)
  useEffect(() => {
    const t = setInterval(() => {
      triggerRefresh();
      setRefreshTick((x) => x + 1);
    }, REFRESH_EVERY_MS);
    return () => clearInterval(t);
  }, [triggerRefresh]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("fazaa_theme", next);
  }

  function manualRefresh() {
    triggerRefresh();
    setRefreshTick((x) => x + 1);
  }

  if (loading || !user) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Image src="/logo-small.png" alt="فزعة" width={38} height={38} />
          <h2>فزعة</h2>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                <Icon /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="support-btn" onClick={() => setSupportOpen(true)}>
            <PhoneIcon className="svg-icon sm" /> الدعم الفني
          </button>
          <button className="btn btn-danger btn-block" onClick={signOut}>تسجيل الخروج</button>
          <div className="app-version">{APP_VERSION}</div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-right">
            <div className="live-clock">
              <span>{clock.date}</span>
              <span className="time">{clock.time}</span>
            </div>
            <span className="greeting">{greeting}، <b>{profile?.name || "—"}</b></span>
          </div>
          <div className="topbar-left">
            <div className="refresh-group">
              <div className="last-update">
                <span>آخر تحديث: <b>{lastUpdate}</b></span>
                <span style={{ fontSize: 10.5 }}>يتحدث تلقائيًا كل 5 دقائق</span>
              </div>
              <button className="refresh-btn" onClick={manualRefresh} title="تحديث"><RefreshIcon /></button>
            </div>
            {!installed && <button className="icon-btn" onClick={() => setInstallOpen(true)} title="تثبيت التطبيق" aria-label="تثبيت التطبيق"><InstallIcon /></button>}
            <button className="icon-btn" onClick={() => setSupportOpen(true)} title="الدعم الفني" aria-label="الدعم الفني"><HeadsetIcon /></button>
            <button className="theme-switch" onClick={toggleTheme} title="تبديل الوضع">
              <span className="switch-dot">{theme === "light" ? <SunIcon /> : <MoonIcon />}</span>
              <span className="switch-label">{theme === "light" ? "فاتح" : "داكن"}</span>
            </button>
            <button className="icon-btn logout-red" onClick={signOut} title="تسجيل الخروج"><LogoutIcon /></button>
          </div>
        </header>

        <div className="content">{children}</div>
      </div>

      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              <Icon className="svg-icon sm" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
      {installOpen && <InstallGuideModal onClose={() => setInstallOpen(false)} />}
    </div>
  );
}
