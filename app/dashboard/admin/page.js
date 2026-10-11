"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUI } from "@/components/UIProvider";
import { useRefresh } from "@/components/RefreshProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { timeAgo, isOnlineNow } from "@/lib/timeAgo";
import { deviceLabel, EVENT_LABEL } from "@/lib/device";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
}

export default function AdminPage() {
  const { showToast } = useUI();
  const { registerHandler } = useRefresh();
  const [tab, setTab] = useState("users");
  const [state, setState] = useState("loading"); // loading | ok | forbidden | error
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [pwTarget, setPwTarget] = useState(null);
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsReady, setLogsReady] = useState(true);
  const [logSearch, setLogSearch] = useState("");
  const [logEvent, setLogEvent] = useState("all");

  const loadUsers = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) { setState("error"); return; }
    const res = await fetch("/api/admin/users", { headers });
    if (res.status === 403 || res.status === 401) { setState("forbidden"); return; }
    if (!res.ok) { setState("error"); return; }
    const json = await res.json();
    setUsers(json.users || []);
    setState("ok");
  }, []);

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from("community_reports")
      .select("id, created_at, post_id, comment_id, community_posts(id, question, author_name), community_comments(id, content, author_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setReports(data || []);
  }, []);

  const loadLogs = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/admin/logs", { headers });
    if (!res.ok) return;
    const json = await res.json().catch(() => ({}));
    setLogs(json.logs || []);
    setLogsReady(json.ready !== false);
  }, []);

  const loadAll = useCallback(() => { loadUsers(); loadReports(); loadLogs(); }, [loadUsers, loadReports, loadLogs]);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => registerHandler(loadAll), [registerHandler, loadAll]);

  async function handleSetPassword(e) {
    e.preventDefault();
    if (saving || !pwTarget) return;
    if (pw.length < 6) { showToast("كلمة المرور 6 أحرف على الأقل.", "error"); return; }
    const headers = await authHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch("/api/admin/users", { method: "POST", headers, body: JSON.stringify({ action: "set_password", userId: pwTarget.id, password: pw }) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { showToast(json.error || "تعذّر تغيير كلمة المرور.", "error"); return; }
    showToast("تم تغيير كلمة المرور.", "success");
    setPwTarget(null); setPw("");
  }

  async function handleDeleteContent() {
    if (!confirmDelete) return;
    const r = confirmDelete;
    setConfirmDelete(null);
    const table = r.post_id ? "community_posts" : "community_comments";
    const id = r.post_id || r.comment_id;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { showToast("تعذّر الحذف. تأكد من تشغيل تحديث V1.04.", "error"); return; }
    showToast("تم حذف المحتوى.", "success");
    loadReports();
  }

  async function dismissReport(r) {
    const { error } = await supabase.from("community_reports").delete().eq("id", r.id);
    if (error) { showToast("تعذّر حذف البلاغ.", "error"); return; }
    loadReports();
  }

  if (state === "forbidden") return <div className="empty-state">هذه الصفحة للأدمن فقط.</div>;
  if (state === "error") return <div className="empty-state">تعذّر تحميل البيانات. تأكد من تشغيل تحديث قاعدة البيانات V1.04.</div>;

  const q = search.trim().toLowerCase();
  const shown = q ? users.filter((u) => `${u.name} ${u.login}`.toLowerCase().includes(q)) : users;
  const onlineCount = users.filter((u) => isOnlineNow(u.last_seen_at)).length;

  return (
    <>
      <div className="section-header">
        <h3>🛡️ المطور</h3>
      </div>

      <div className="admin-tabs">
        <button type="button" className={"tag-chip" + (tab === "users" ? " active" : "")} onClick={() => setTab("users")}>الحسابات ({users.length})</button>
        <button type="button" className={"tag-chip" + (tab === "logs" ? " active" : "")} onClick={() => setTab("logs")}>سجل الدخول ({logs.length})</button>
        <button type="button" className={"tag-chip" + (tab === "reports" ? " active" : "")} onClick={() => setTab("reports")}>البلاغات ({reports.length})</button>
      </div>

      {tab === "users" && (
        <>
          <div className="admin-summary">🟢 متصل الآن: <b>{onlineCount}</b> · إجمالي الحسابات: <b>{users.length}</b></div>
          <div className="filters-bar">
            <input type="text" placeholder="🔍 ابحث بالاسم أو اسم المستخدم..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {state === "loading" && <div className="empty-state">جارٍ التحميل...</div>}
          <div className="admin-list">
            {shown.map((u) => (
              <div key={u.id} className="admin-user">
                <span className="post-avatar">{(u.name || "؟").trim().charAt(0)}</span>
                <div className="admin-user-info">
                  <div className="admin-user-name">
                    <b>{u.name}</b>
                    {u.is_admin && <span className="badge accent">أدمن</span>}
                  </div>
                  <div className="admin-user-login" dir="ltr">{u.has_username ? "@" : ""}{u.login}</div>
                  <div className="admin-user-meta">
                    <span className={"presence" + (isOnlineNow(u.last_seen_at) ? " on" : "")} />
                    آخر ظهور: {isOnlineNow(u.last_seen_at) ? "متصل الآن" : timeAgo(u.last_seen_at || u.last_sign_in_at)}
                    <span className="dot-sep">·</span>
                    سجّل: {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </div>
                  <div className="admin-user-device">
                    📱 {u.last_device ? deviceLabel(u.last_device) : "الجهاز: لم يُسجَّل بعد"}
                    {u.last_device?.ip && <span dir="ltr"> · IP {u.last_device.ip}</span>}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPwTarget(u); setPw(""); }}>🔑 كلمة المرور</button>
              </div>
            ))}
            {state === "ok" && shown.length === 0 && <div className="empty-state">لا توجد نتائج.</div>}
          </div>
        </>
      )}

      {tab === "logs" && (() => {
        const lq = logSearch.trim().toLowerCase();
        const shownLogs = logs.filter((l) =>
          (logEvent === "all" || l.event === logEvent) &&
          (!lq || `${l.name} ${l.login} ${l.ip || ""} ${deviceLabel(l)}`.toLowerCase().includes(lq))
        );
        return (
          <>
            {!logsReady && <div className="empty-state">سجل الدخول غير مفعّل بعد. شغّل ملف supabase-v1.05.sql في Supabase.</div>}
            {logsReady && (
              <>
                <div className="filters-bar">
                  <input type="text" placeholder="🔍 ابحث بالاسم أو الجهاز أو IP..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
                  <select value={logEvent} onChange={(e) => setLogEvent(e.target.value)}>
                    <option value="all">كل الأحداث</option>
                    <option value="login">تسجيل دخول</option>
                    <option value="open">فتح التطبيق</option>
                  </select>
                </div>
                <div className="admin-list">
                  {shownLogs.length === 0 && <div className="empty-state">لا توجد سجلات.</div>}
                  {shownLogs.map((l) => (
                    <div key={l.id} className="admin-user">
                      <span className="post-avatar">{(l.name || "؟").trim().charAt(0)}</span>
                      <div className="admin-user-info">
                        <div className="admin-user-name">
                          <b>{l.name}</b>
                          <span className={"badge " + (l.event === "login" ? "accent" : "muted")}>{EVENT_LABEL[l.event] || l.event}</span>
                        </div>
                        <div className="admin-user-login" dir="ltr">@{l.login}</div>
                        <div className="admin-user-device">📱 {deviceLabel(l)}</div>
                        <div className="admin-user-meta">
                          <span dir="ltr">{new Date(l.created_at).toLocaleString("en-GB")}</span>
                          <span className="dot-sep">·</span>
                          {timeAgo(l.created_at)}
                          {l.ip && <><span className="dot-sep">·</span><span dir="ltr">IP {l.ip}</span></>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}

      {tab === "reports" && (
        <div className="admin-list">
          {reports.length === 0 && <div className="empty-state">لا توجد بلاغات 🎉</div>}
          {reports.map((r) => {
            const post = r.community_posts;
            const comment = r.community_comments;
            const kind = r.post_id ? "منشور" : "رد";
            const author = post?.author_name || comment?.author_name || "—";
            const text = post?.question || comment?.content || "(تم حذف المحتوى)";
            return (
              <div key={r.id} className="admin-report">
                <div className="admin-report-head"><span className="badge muted">{kind}</span> <b>{author}</b> <small>{timeAgo(r.created_at)}</small></div>
                <div className="admin-report-text">{text}</div>
                <div className="admin-report-actions">
                  {(post || comment) && <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(r)}>🗑️ حذف المحتوى</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismissReport(r)}>تجاهل البلاغ</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pwTarget && (
        <div className="modal-overlay" onClick={() => setPwTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>كلمة مرور جديدة</h3>
            <p className="community-intro">للحساب: <b>{pwTarget.name}</b> ({pwTarget.login})</p>
            <form onSubmit={handleSetPassword}>
              <div className="field">
                <label>كلمة المرور الجديدة</label>
                <input type="text" dir="ltr" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} maxLength={72} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setPwTarget(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="حذف المحتوى المُبلَّغ عنه"
          message={confirmDelete.post_id ? "سيُحذف المنشور وكل الردود عليه. هل أنت متأكد؟" : "سيُحذف هذا الرد. هل أنت متأكد؟"}
          onConfirm={handleDeleteContent}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
