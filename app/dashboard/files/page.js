"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useUI } from "@/components/UIProvider";
import { useRefresh } from "@/components/RefreshProvider";
import ConfirmModal from "@/components/ConfirmModal";

export default function FilesPage() {
  const { user } = useAuth();
  const { showLoading, hideLoading, showToast } = useUI();
  const { registerHandler } = useRefresh();
  const router = useRouter();

  const [folders, setFolders] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const loadFolders = useCallback(async () => {
    if (!user) return;
    const { data: foldersData } = await supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const { data: questionsData } = await supabase.from("questions").select("folder_id").eq("user_id", user.id);
    const counts = {};
    (questionsData || []).forEach((q) => { counts[q.folder_id] = (counts[q.folder_id] || 0) + 1; });
    setFolders((foldersData || []).map((f) => ({ ...f, count: counts[f.id] || 0 })));
  }, [user]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => registerHandler(loadFolders), [registerHandler, loadFolders]);

  async function handleAddFolder(e) {
    e.preventDefault();
    if (submitting || !newFolderName.trim()) return;
    setSubmitting(true);
    showLoading();
    const { error } = await supabase.from("folders").insert({ user_id: user.id, name: newFolderName.trim() });
    hideLoading();
    setSubmitting(false);
    if (error) { showToast("حدث خطأ أثناء إضافة الملف.", "error"); return; }
    showToast("تمت إضافة الملف بنجاح.", "success");
    setNewFolderName("");
    setShowAddModal(false);
    loadFolders();
  }

  function openRename(folder) {
    setRenameTarget(folder);
    setRenameValue(folder.name);
  }

  async function handleRenameFolder(e) {
    e.preventDefault();
    const newName = renameValue.trim();
    if (submitting || !renameTarget || !newName) return;
    if (newName === renameTarget.name) { setRenameTarget(null); return; }
    setSubmitting(true);
    showLoading();
    const { error } = await supabase.from("folders").update({ name: newName }).eq("id", renameTarget.id).eq("user_id", user.id);
    hideLoading();
    setSubmitting(false);
    if (error) { showToast("حدث خطأ أثناء تعديل اسم الملف.", "error"); return; }
    showToast("تم تعديل اسم الملف بنجاح.", "success");
    setRenameTarget(null);
    loadFolders();
  }

  async function handleDeleteFolder() {
    if (!confirmDelete) return;
    showLoading();
    const { error } = await supabase.from("folders").delete().eq("id", confirmDelete.id).eq("user_id", user.id);
    hideLoading();
    setConfirmDelete(null);
    if (error) { showToast("حدث خطأ أثناء حذف الملف.", "error"); return; }
    showToast("تم حذف الملف وجميع أسئلته.", "success");
    loadFolders();
  }

  return (
    <>
      <div className="section-header">
        <h3>📁 ملفاتي</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ إضافة ملف</button>
      </div>

      <div className="folder-grid">
        {folders.length === 0 && <div className="empty-state" style={{ gridColumn: "1/-1" }}>لا توجد ملفات بعد. أنشئ ملفك الأول (مثل: قدرات).</div>}
        {folders.map((f) => (
          <div key={f.id} className="folder-card" onClick={() => router.push(`/dashboard/files/${f.id}?name=${encodeURIComponent(f.name)}`)}>
            <button className="folder-del" title="حذف" onClick={(e) => { e.stopPropagation(); setConfirmDelete(f); }}>🗑️</button>
            <button className="folder-edit" title="تعديل الاسم" onClick={(e) => { e.stopPropagation(); openRename(f); }}>✏️</button>
            <div style={{ fontSize: 36 }}>📁</div>
            <div className="folder-name">{f.name}</div>
            <div className="folder-count">{f.count} سؤال</div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>إضافة ملف جديد</h3>
            <form onSubmit={handleAddFolder}>
              <div className="field">
                <label>اسم الملف (مثال: قدرات، تحصيلي)</label>
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>تعديل اسم الملف</h3>
            <form onSubmit={handleRenameFolder}>
              <div className="field">
                <label>اسم الملف</label>
                <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setRenameTarget(null)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="حذف الملف"
          message={`سيتم حذف "${confirmDelete.name}" وجميع أسئلته نهائيًا. متابعة؟`}
          onConfirm={handleDeleteFolder}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
