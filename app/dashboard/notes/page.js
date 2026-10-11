"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { useRefresh } from "@/components/RefreshProvider";
import ConfirmModal from "@/components/ConfirmModal";

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB") + " - " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function NotesPage() {
  const { user } = useAuth();
  const { showLoading, hideLoading, showToast } = useUI();
  const { registerHandler } = useRefresh();

  const [notes, setNotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    setNotes(data || []);
  }, [user]);

  useEffect(() => { loadNotes(); }, [loadNotes]);
  useEffect(() => registerHandler(loadNotes), [registerHandler, loadNotes]);

  function openAdd() { setEditId(null); setContent(""); setTags([]); setTagInput(""); setShowModal(true); }
  function openEdit(n) { setEditId(n.id); setContent(n.content); setTags(n.tags || []); setTagInput(""); setShowModal(true); }

  function addTag(raw) {
    const t = (raw || "").trim().replace(/^#/, "");
    if (!t) return;
    setTags((prev) => (prev.includes(t) || prev.length >= 10 ? prev : [...prev, t]));
    setTagInput("");
  }
  function removeTag(t) { setTags((prev) => prev.filter((x) => x !== t)); }
  function onTagKeyDown(e) {
    if (e.key === "Enter" || e.key === "," || e.key === "،") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !content.trim()) return;
    setSubmitting(true);
    showLoading();
    // أي نص مكتوب في خانة التاغ ولم يُضَف بعد نضيفه تلقائيًا
    const pending = tagInput.trim().replace(/^#/, "");
    const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;
    let error;
    if (editId) {
      ({ error } = await supabase.from("notes").update({ content: content.trim(), tags: finalTags, updated_at: new Date().toISOString() }).eq("id", editId).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("notes").insert({ user_id: user.id, content: content.trim(), tags: finalTags }));
    }
    hideLoading();
    setSubmitting(false);
    if (error) { showToast("حدث خطأ.", "error"); return; }
    showToast(editId ? "تم تعديل الملاحظة بنجاح." : "تمت إضافة الملاحظة بنجاح.", "success");
    setShowModal(false);
    loadNotes();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    showLoading();
    const { error } = await supabase.from("notes").delete().eq("id", confirmDelete.id).eq("user_id", user.id);
    hideLoading();
    setConfirmDelete(null);
    if (error) { showToast("حدث خطأ أثناء الحذف.", "error"); return; }
    showToast("تم حذف الملاحظة بنجاح.", "success");
    loadNotes();
  }

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags || [])));
  const visibleNotes = activeTag ? notes.filter((n) => (n.tags || []).includes(activeTag)) : notes;

  return (
    <>
      <div className="section-header">
        <h3>📝 ملاحظاتي</h3>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ إضافة ملاحظة</button>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter">
          <label htmlFor="tag-filter-select">🏷️ التاغ</label>
          <select id="tag-filter-select" value={activeTag || ""} onChange={(e) => setActiveTag(e.target.value || null)}>
            <option value="">كل الملاحظات</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        </div>
      )}

      <div className="notes-grid">
        {notes.length === 0 && <div className="empty-state" style={{ gridColumn: "1/-1" }}>لا توجد ملاحظات بعد. أضف ملاحظتك الأولى!</div>}
        {notes.length > 0 && visibleNotes.length === 0 && <div className="empty-state" style={{ gridColumn: "1/-1" }}>لا توجد ملاحظات بهذا التاغ.</div>}
        {visibleNotes.map((n) => (
          <div key={n.id} className="note-card">
            {(n.tags || []).length > 0 && (
              <div className="note-tags">
                {n.tags.map((t) => (
                  <span key={t} className="tag-chip small" onClick={() => setActiveTag(t)}>#{t}</span>
                ))}
              </div>
            )}
            <div className="note-text">{n.content}</div>
            <div className="note-date">🕒 {formatDate(n.updated_at || n.created_at)}</div>
            <div className="note-actions">
              <button onClick={() => openEdit(n)}>✏️ تعديل</button>
              <button onClick={() => setConfirmDelete(n)}>🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? "تعديل الملاحظة" : "إضافة ملاحظة"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>نص الملاحظة</label>
                <textarea style={{ minHeight: 140 }} value={content} onChange={(e) => setContent(e.target.value)} required autoFocus />
              </div>
              <div className="field">
                <label>التاغات (اختياري)</label>
                <div className="tag-input-box">
                  {tags.map((t) => (
                    <span key={t} className="tag-chip small">
                      #{t}
                      <button type="button" className="tag-remove" onClick={() => removeTag(t)} aria-label="حذف التاغ">×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKeyDown}
                    onBlur={() => addTag(tagInput)}
                    placeholder={tags.length ? "" : "اكتب تاغ واضغط Enter"}
                  />
                </div>
                {allTags.filter((t) => !tags.includes(t)).length > 0 && (
                  <select className="tag-pick" value="" onChange={(e) => { if (e.target.value) addTag(e.target.value); }}>
                    <option value="">+ اختر من تاغاتك السابقة</option>
                    {allTags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t}>#{t}</option>)}
                  </select>
                )}
                <div className="field-hint">أو اكتب تاغًا جديدًا واضغط Enter أو فاصلة (مثال: رياضيات، مهم)</div>
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
          title="حذف الملاحظة"
          message="هل أنت متأكد من حذف هذه الملاحظة؟"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
