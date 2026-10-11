"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useRefresh } from "@/components/RefreshProvider";
import { getGreeting } from "@/lib/greeting";

function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T" + (timeStr || "23:59:00"));
  return isNaN(d.getTime()) ? null : d;
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const { registerHandler } = useRefresh();
  const [greeting, setGreeting] = useState(getGreeting());
  const [stats, setStats] = useState({ total: 0, reviewed: 0, needsReview: 0, completion: 0 });
  const [exams, setExams] = useState([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: questions } = await supabase.from("questions").select("status").eq("user_id", user.id);
    const { data: examsData } = await supabase.from("exams").select("*").eq("user_id", user.id);

    const total = questions?.length || 0;
    const reviewed = questions?.filter((q) => q.status === "تمت مراجعته").length || 0;
    const needsReview = questions?.filter((q) => q.status === "أحتاج مراجعة").length || 0;
    const completion = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    setStats({ total, reviewed, needsReview, completion });

    const now = new Date();
    const processed = (examsData || []).map((ex) => {
      const dt = combineDateTime(ex.exam_date, ex.exam_time);
      let remainingDays = null, finished = false;
      if (dt) {
        const diff = dt.getTime() - now.getTime();
        if (diff <= 0) finished = true; else remainingDays = Math.ceil(diff / 86400000);
      }
      return { ...ex, remainingDays, finished };
    }).sort((a, b) => {
      if (a.finished && !b.finished) return 1;
      if (!a.finished && b.finished) return -1;
      return (a.remainingDays || 0) - (b.remainingDays || 0);
    });
    setExams(processed);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setGreeting(getGreeting()); }, []);
  useEffect(() => registerHandler(loadData), [registerHandler, loadData]);

  return (
    <>
      <div className="welcome-card">
        <div className="welcome-title">{greeting}، <b>{profile?.name || ""}</b> 👋</div>
        <div className="welcome-sub">أهلًا بك في فزعة، راجع بذكاء وتابع مواعيدك بثقة.</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">إجمالي الأسئلة</div></div>
        <div className="stat-card accent"><div className="stat-value">{stats.reviewed}</div><div className="stat-label">تمت مراجعتها</div></div>
        <div className="stat-card warning"><div className="stat-value">{stats.needsReview}</div><div className="stat-label">تحتاج مراجعة</div></div>
        <div className="stat-card accent"><div className="stat-value">{stats.completion}%</div><div className="stat-label">نسبة الإنجاز</div></div>
      </div>

      <section className="section">
        <div className="section-header"><h3>🗓️ مواعيد الاختبارات</h3></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>اسم الاختبار</th><th>التاريخ</th><th>الوقت</th><th>الأيام المتبقية</th></tr></thead>
            <tbody>
              {exams.length === 0 && (
                <tr><td colSpan={4} className="empty-state">لا توجد اختبارات مضافة بعد.</td></tr>
              )}
              {exams.map((ex) => (
                <tr key={ex.id}>
                  <td>{ex.name}</td>
                  <td>{new Date(ex.exam_date).toLocaleDateString("en-GB")}</td>
                  <td>{ex.exam_time || "—"}</td>
                  <td>{ex.finished
                    ? <span className="badge muted">انتهى الاختبار</span>
                    : <span className="badge accent">متبقي {ex.remainingDays} يومًا</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    
    </>
  );
}
