"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { useRefresh } from "@/components/RefreshProvider";
import ConfirmModal from "@/components/ConfirmModal";

const STATUS_OPTIONS = ["لم أراجعه", "تمت مراجعته", "أحتاج مراجعة"];
const DIFF_OPTIONS = ["سهل", "متوسط", "صعب"];

function difficultyClass(level) {
  if (level === "سهل") return "diff-easy";
  if (level === "صعب") return "diff-hard";
  if (level === "متوسط") return "diff-medium";
  return "";
}
function statusClass(status) {
  if (status === "تمت مراجعته") return "status-done";
  if (status === "أحتاج مراجعة") return "status-needs";
  return "status-pending";
}

const emptyForm = { id: null, question: "", answer: "", explanation: "", difficulty: "", status: "لم أراجعه", imageFile: null, imagePreview: "", removeImage: false };

export default function FolderDetailPage() {
  const { folderId } = useParams();
  const searchParams = useSearchParams();
  const folderName = searchParams.get("name") || "—";
  const router = useRouter();

  const { user, profile } = useAuth();
  const { showLoading, hideLoading, showToast } = useUI();
  const { registerHandler } = useRefresh();

  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadQuestions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("user_id", user.id)
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });
    setQuestions(data || []);
  }, [user, folderId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => registerHandler(loadQuestions), [registerHandler, loadQuestions]);

  const filtered = questions.filter((q) => {
    const s = search.trim().toLowerCase();
    const matchesSearch = !s || q.question?.toLowerCase().includes(s) || q.answer?.toLowerCase().includes(s);
    const matchesStatus = !filterStatus || q.status === filterStatus;
    const matchesDiff = !filterDifficulty || q.difficulty === filterDifficulty;
    return matchesSearch && matchesStatus && matchesDiff;
  });

  function openAdd() {
    setForm(emptyForm);
    setShowModal(true);
  }
  function openEdit(q) {
    setForm({
      id: q.id, question: q.question, answer: q.answer || "", explanation: q.explanation || "",
      difficulty: q.difficulty || "", status: q.status || "لم أراجعه",
      imageFile: null, imagePreview: q.image_url || "", removeImage: false,
    });
    setShowModal(true);
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { showToast("حجم الصورة كبير جدًا (الحد الأقصى 4 ميجابايت).", "error"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, imageFile: file, imagePreview: ev.target.result, removeImage: false }));
    reader.readAsDataURL(file);
  }

  async function uploadImageIfNeeded() {
    if (!form.imageFile) return null;
    const ext = form.imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, form.imageFile);
    if (error) throw error;
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !form.question.trim()) return;
    setSubmitting(true);
    showLoading();
    try {
      let imageUrl = form.id ? (questions.find((q) => q.id === form.id)?.image_url || null) : null;
      if (form.removeImage) imageUrl = null;
      const uploaded = await uploadImageIfNeeded();
      if (uploaded) imageUrl = uploaded;

      const payload = {
        question: form.question.trim(), answer: form.answer.trim(), explanation: form.explanation.trim(),
        difficulty: form.difficulty, status: form.status, image_url: imageUrl,
      };

      if (form.id) {
        const { error } = await supabase.from("questions").update(payload).eq("id", form.id).eq("user_id", user.id);
        if (error) throw error;
        showToast("تم تعديل السؤال بنجاح.", "success");
      } else {
        const { error } = await supabase.from("questions").insert({ ...payload, user_id: user.id, folder_id: folderId });
        if (error) throw error;
        showToast("تمت إضافة السؤال بنجاح.", "success");
      }
      setShowModal(false);
      loadQuestions();
    } catch (err) {
      showToast("حدث خطأ: " + err.message, "error");
    } finally {
      hideLoading();
      setSubmitting(false);
    }
  }

  async function changeStatus(q, next) {
    if (!next || next === q.status) return;
    const previous = q.status;
    // تحديث فوري في الواجهة، ثم حفظ في قاعدة البيانات
    setQuestions((list) => list.map((x) => (x.id === q.id ? { ...x, status: next } : x)));
    const { error } = await supabase.from("questions").update({ status: next }).eq("id", q.id).eq("user_id", user.id);
    if (error) {
      setQuestions((list) => list.map((x) => (x.id === q.id ? { ...x, status: previous } : x)));
      showToast("حدث خطأ أثناء تغيير الحالة.", "error");
    }
  }

  async function shareToCommunity(q) {
    const { data: existing } = await supabase.from("community_posts").select("id").eq("user_id", user.id).eq("source_question_id", q.id).limit(1);
    if (existing && existing.length > 0) { showToast("هذا السؤال مشارك في المجتمع مسبقًا.", "info"); return; }
    const { error } = await supabase.from("community_posts").insert({
      user_id: user.id,
      author_name: profile?.name || "مستخدم",
      question: q.question,
      image_url: q.image_url || null,
      source_question_id: q.id,
    });
    if (error) { showToast("تعذّرت المشاركة. تأكد من تشغيل تحديث قاعدة البيانات V1.03.", "error"); return; }
    showToast("تمت مشاركة السؤال في المجتمع (بدون الإجابة).", "success");
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    showLoading();
    const { error } = await supabase.from("questions").delete().eq("id", confirmDelete.id).eq("user_id", user.id);
    hideLoading();
    setConfirmDelete(null);
    if (error) { showToast("حدث خطأ أثناء الحذف.", "error"); return; }
    showToast("تم حذف السؤال بنجاح.", "success");
    loadQuestions();
  }

  return (
    <>
      <span className="back-link" onClick={() => router.push("/dashboard/files")}>→ رجوع إلى الملفات</span>
      <div className="section-header">
        <h3>📁 {folderName}</h3>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ إضافة سؤال</button>
      </div>

      <div className="filters-bar">
        <input type="text" placeholder="🔍 ابحث في الأسئلة..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
          <option value="">كل المستويات</option>
          {DIFF_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="questions-grid">
        {filtered.length === 0 && <div className="empty-state" style={{ gridColumn: "1/-1" }}>لا توجد أسئلة مطابقة.</div>}
        {filtered.map((q) => (
          <div key={q.id} className="question-card">
            {q.image_url && <img className="q-img" src={q.image_url} alt="صورة السؤال" />}
            <div className="q-text">{q.question}</div>
            {q.answer && <div className="q-answer">✅ {q.answer}</div>}
            {q.explanation && <div className="q-explain">💡 {q.explanation}</div>}
            <div className="q-meta">
              {q.difficulty && <span className={"badge " + difficultyClass(q.difficulty)}>{q.difficulty}</span>}
            </div>
            <div className="q-status-row">
              <label>الحالة</label>
              <select
                className={"status-select " + statusClass(q.status)}
                value={q.status || "لم أراجعه"}
                onChange={(e) => changeStatus(q, e.target.value)}
              >
                {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div className="q-actions">
              <button onClick={() => openEdit(q)}>✏️ تعديل</button>
              <button onClick={() => shareToCommunity(q)}>📢 مشاركة</button>
              <button onClick={() => setConfirmDelete(q)}>🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id ? "تعديل السؤال" : "إضافة سؤال جديد"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>نص السؤال</label>
                <textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required />
              </div>
              <div className="field">
                <label>صورة (اختياري)</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {form.imagePreview && (
                  <div style={{ marginTop: 10 }}>
                    <img src={form.imagePreview} alt="" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 10 }} />
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}
                      onClick={() => setForm({ ...form, imageFile: null, imagePreview: "", removeImage: true })}>
                      إزالة الصورة
                    </button>
                  </div>
                )}
              </div>
              <div className="field"><label>الإجابة الصحيحة</label><textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
              <div className="field"><label>شرح السؤال</label><textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></div>
              <div className="field">
                <label>مستوى الصعوبة (اختياري)</label>
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="">بدون تحديد</option>
                  {DIFF_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>حالة المراجعة</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
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
          title="حذف السؤال"
          message="هل أنت متأكد من حذف هذا السؤال؟"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
