"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { APP_VERSION } from "@/lib/version";

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { showLoading, hideLoading, showToast } = useUI();
  const router = useRouter();

  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifEmail, setNotifEmail] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setNotifEnabled(!!profile.notifications_enabled);
      setNotifEmail(profile.notification_email || user?.email || "");
    }
  }, [profile, user]);

  async function handleAccountSubmit(e) {
    e.preventDefault();
    if (savingAccount || !name.trim()) return;
    if (newPassword && newPassword.length < 6) { showToast("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.", "error"); return; }
    if (newPassword && newPassword !== confirmPassword) { showToast("كلمتا المرور غير متطابقتين.", "error"); return; }

    setSavingAccount(true);
    showLoading();
    const { error: profileError } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
    let passwordError = null;
    if (newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      passwordError = error;
    }
    hideLoading();
    setSavingAccount(false);
    if (profileError || passwordError) { showToast("حدث خطأ أثناء تحديث الحساب.", "error"); return; }
    showToast("تم تحديث بيانات الحساب بنجاح.", "success");
    setNewPassword(""); setConfirmPassword("");
    refreshProfile();
  }

  async function handleNotifSubmit() {
    if (savingNotif) return;
    if (notifEnabled && (!notifEmail || !notifEmail.includes("@"))) { showToast("الرجاء إدخال بريد إلكتروني صحيح.", "error"); return; }
    if (notifEnabled && "Notification" in window && Notification.permission === "default") Notification.requestPermission();

    setSavingNotif(true);
    showLoading();
    const { error } = await supabase.from("profiles").update({
      notifications_enabled: notifEnabled, notification_email: notifEmail,
    }).eq("id", user.id);
    hideLoading();
    setSavingNotif(false);
    if (error) { showToast("حدث خطأ أثناء حفظ الإعدادات.", "error"); return; }
    showToast(notifEnabled ? "تم تفعيل التذكيرات بنجاح." : "تم إيقاف التذكيرات.", "success");
    refreshProfile();
  }

  async function handleDeleteAccount() {
    showLoading();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    // يحذف بياناته (الملفات/الأسئلة/الملاحظات/الاختبارات) تلقائيًا بسبب ON DELETE CASCADE في قاعدة البيانات
    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    hideLoading();
    setConfirmDeleteAccount(false);
    if (!res.ok) { showToast("حدث خطأ أثناء حذف الحساب.", "error"); return; }
    showToast("تم حذف الحساب نهائيًا.", "success");
    await signOut();
    router.replace("/login");
  }

  return (
    <>
      <div className="section-header"><h3>⚙️ الإعدادات</h3></div>

      <div className="settings-card">
        <h4>👤 حسابي</h4>
        <div className="account-info-row"><span>البريد الإلكتروني</span><span>{user?.email}</span></div>
        <form onSubmit={handleAccountSubmit} style={{ marginTop: 16 }}>
          <div className="field"><label>الاسم</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label>كلمة مرور جديدة (اتركها فارغة إن لم ترد تغييرها)</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <div className="field"><label>تأكيد كلمة المرور الجديدة</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary" disabled={savingAccount}>حفظ التعديلات</button>
        </form>
      </div>

      <div className="settings-card">
        <h4>🔔 تذكيرات الاختبارات</h4>
        <div className="toggle-row" style={{ marginBottom: 18 }}>
          <span>تفعيل التذكيرات عبر البريد الإلكتروني والإشعارات</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={notifEnabled} onChange={(e) => setNotifEnabled(e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="field">
          <label>بريدك الإلكتروني (لإرسال التذكيرات إليه)</label>
          <input type="email" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} />
        </div>
        <div className="field-hint" style={{ marginBottom: 16 }}>
          البريد الإلكتروني يصلك حتى لو كان الموقع مغلقًا تمامًا. إشعار المتصفح يعمل فقط أثناء فتحك للموقع فعليًا.
        </div>
        <button type="button" className="btn btn-primary" onClick={handleNotifSubmit} disabled={savingNotif}>حفظ الإعدادات</button>
      </div>

      <div className="settings-card">
        <h4>ℹ️ عن التطبيق</h4>
        <div className="account-info-row"><span>رقم الإصدار</span><b dir="ltr">{APP_VERSION}</b></div>
      </div>

      <div className="settings-card danger-card">
        <h4>⚠️ حذف الحساب</h4>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>سيتم حذف حسابك وجميع ملفاتك وأسئلتك وملاحظاتك واختباراتك نهائيًا. هذا الإجراء لا يمكن التراجع عنه.</p>
        <button type="button" className="btn btn-danger" onClick={() => setConfirmDeleteAccount(true)}>حذف الحساب نهائيًا</button>
      </div>

      {confirmDeleteAccount && (
        <ConfirmModal
          title="حذف الحساب نهائيًا"
          message="سيتم حذف حسابك وكل بياناتك نهائيًا ولا يمكن التراجع. هل أنت متأكد؟"
          onConfirm={handleDeleteAccount}
          onCancel={() => setConfirmDeleteAccount(false)}
        />
      )}
    </>
  );
}
