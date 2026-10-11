"use client";

export default function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p style={{ color: "var(--text-secondary)" }}>{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>إلغاء</button>
          <button className="btn btn-danger" onClick={onConfirm}>حذف</button>
        </div>
      </div>
    </div>
  );
}
