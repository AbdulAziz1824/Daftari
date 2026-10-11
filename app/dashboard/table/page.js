"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { useRefresh } from "@/components/RefreshProvider";
import ConfirmModal from "@/components/ConfirmModal";

const REMINDER_PRESETS = [
  { value: 1, label: "يوم واحد" },
  { value: 3, label: "3 أيام" },
  { value: 7, label: "أسبوع" },
  { value: 14, label: "أسبوعين" },
];

function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T" + (timeStr || "23:59:00"));
  return isNaN(d.getTime()) ? null : d;
}

export default function TablePage() {
  const { user } = useAuth();
  const { showLoading, hideLoading, showToast } = useUI();
  const { registerHandler } = useRefresh();

  const [exams, setExams] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reminderDays, setReminderDays] = useState([]);
  const [customReminderDate, setCustomReminderDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadExams = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("exams").select("*").eq("user_id", user.id);
    const now = new Date();
    const processed = (data || []).map((ex) => {
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

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => registerHandler(loadExams), [registerHandler, loadExams]);

  function openAdd() {
    setName(""); setDate(""); setTime(""); setReminderDays([]); setCustomReminderDate(""); setError("");
    setShowModal(true);
  }

  function toggleReminder(val) {
    setReminderDays((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!name.trim() || !date) { setError("الرجاء إدخال اسم الاختبار والتاريخ."); return; }

    let finalReminders = [...reminderDays];
    if (customReminderDate) {
      const diff = Math.round((new Date(date) - new Date(customReminderDate)) / 86400000);
      if (diff > 0) finalReminders.push(diff);
    }

    setSubmitting(true);
    showLoading();
    const { error: insertError } = await supabase.from("exams").insert({
      user_id: user.id, name: name.trim(), exam_date: date, exam_time: time || null,
      reminder_days: finalReminders.join(","),
    });
    hideLoading();
    setSubmitting(false);
    if (insertError) { setError("حدث خطأ أثناء إضافة الاختبار."); return; }
    showToast("تمت إضافة الاختبار بنجاح.", "success");
    setShowModal(false);
    loadExams();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    showLoading();
    const { error } = await supabase.from("exams").delete().eq("id", confirmDelete.id).eq("user_id", user.id);
    hideLoading();
    setConfirmDelete(null);
    if (error) { showToast("حدث خطأ أثناء الحذف.", "error"); return; }
    showToast("تم حذف الاختبار بنجاح.", "success");
    loadExams();
  }

  return (
    <>
      <div className="section-header">
        <h3>🗓️ جدولي</h3>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ إضافة اختبار</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>اسم الاختبار</th><th>التاريخ</th><th>الوقت</th><th>الأيام المتبقية</th><th></th></tr></thead>
          <tbody>
            {exams.length === 0 && <tr><td colSpan={5} className="empty-state">لا توجد اختبارات بعد. أضف اختبارك الأول.</td></tr>}
            {exams.map((ex) => (
              <tr key={ex.id}>
                <td>{ex.name}</td>
                <td>{new Date(ex.exam_date).toLocaleDateString("en-GB")}</td>
                <td>{ex.exam_time || "—"}</td>
                <td>{ex.finished
                  ? <span className="badge muted">انتهى الاختبار</span>
                  : <span className="badge accent">متبقي {ex.remainingDays} يومًا</span>}</td>
                <td><button style={{ background: "none", border: "none", color: "var(--text-muted)" }} onClick={() => setConfirmDelete(ex)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>إضافة اختبار جديد</h3>
            <form onSubmit={handleSubmit}>
              <div className="field"><label>اسم الاختبار</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="field"><label>التاريخ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div className="field"><label>الوقت (اختياري)</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              <div className="field">
                <label>تذكير قبل الاختبار</label>
                <div className="checkbox-chip-group">
                  {REMINDER_PRESETS.map((r) => (
                    <div className="checkbox-chip" key={r.value}>
                      <input type="checkbox" id={`rem-${r.value}`} checked={reminderDays.includes(r.value)} onChange={() => toggleReminder(r.value)} />
                      <label htmlFor={`rem-${r.value}`}>{r.label}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>أو حدد تاريخ تذكير مخصص (اختياري)</label>
                <input type="date" value={customReminderDate} onChange={(e) => setCustomReminderDate(e.target.value)} />
                <div className="field-hint">إذا حددت تاريخًا هنا، سيصلك تذكير في ذلك اليوم بالتحديد.</div>
              </div>
              <div className="error-text">{error}</div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="حذف الاختبار"
          message={`هل تريد حذف اختبار "${confirmDelete.name}"؟`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
