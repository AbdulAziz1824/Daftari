"use client";
import { PhoneIcon } from "@/components/Icons";

export default function SupportModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>🎧 الدعم الفني</h3>
        <div className="account-info-row">
          <span>الجوال</span>
          <a href="tel:0505883807" style={{ color: "var(--accent)", fontWeight: 700, direction: "ltr" }}>0505883807</a>
        </div>
        <div className="account-info-row">
          <span>البريد</span>
          <a href="mailto:Fpss1863@gmail.com" style={{ color: "var(--accent)", fontWeight: 700, direction: "ltr" }}>Fpss1863@gmail.com</a>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-block" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
