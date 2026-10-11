"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUI } from "@/components/UIProvider";
import SupportModal from "@/components/SupportModal";
import InstallGuideModal from "@/components/InstallGuideModal";
import { APP_VERSION } from "@/lib/version";
import { logDevice } from "@/lib/logDevice";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const router = useRouter();
  const { showToast } = useUI();

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const id = identifier.trim();
    let email = id;
    // اسم المستخدم (بدون @) نحوّله لبريده الداخلي، أما الحسابات القديمة فتدخل ببريدها
    if (!id.includes("@")) {
      const res = await fetch("/api/auth/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id }),
      }).catch(() => null);
      if (!res || !res.ok) {
        setSubmitting(false);
        setError(res && res.status !== 404 ? "تعذّر الاتصال، حاول مرة أخرى." : "اسم المستخدم أو كلمة المرور غير صحيحة.");
        return;
      }
      email = (await res.json()).email;
    }
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
      return;
    }
    logDevice("login", signInData?.session?.access_token);
    showToast("تم تسجيل الدخول بنجاح.", "success");
    router.replace("/dashboard");
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <button type="button" className="install-pill" onClick={() => setInstallOpen(true)}>
          📲 تثبيت التطبيق على جوالك
        </button>
        <div className="auth-logo">
          <Image src="/logo-small.png" alt="فزعة" width={64} height={64} />
          <h1>فزعة</h1>
          <p>راجع بذكاء، وتابع مواعيدك بثقة</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>اسم المستخدم</label>
            <input type="text" dir="ltr" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div className="field">
            <label>كلمة المرور</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="error-text">{error}</div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
        <div className="switch-line">
          ليس لديك حساب؟ <Link href="/signup">إنشاء حساب جديد</Link>
        </div>
        <div className="auth-support">
          <button type="button" className="support-link" onClick={() => setSupportOpen(true)}>
            🎧 الدعم الفني
          </button>
        </div>
        <div className="app-version" style={{ textAlign: "center", marginTop: 12 }}>{APP_VERSION}</div>
      </div>

      {installOpen && <InstallGuideModal onClose={() => setInstallOpen(false)} />}
      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </div>
  );
}
