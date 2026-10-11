"use client";
import { useEffect, useState } from "react";

const IOS_STEPS = [
  {
    img: "/install/step1.jpg",
    title: "افتح قائمة المتصفح",
    text: "افتح الموقع في متصفح Safari، ثم اضغط على زر القائمة (الثلاث خطوط) أسفل الشاشة.",
  },
  {
    img: "/install/step2.jpg",
    title: "اختر مشاركة (Share)",
    text: "من القائمة التي ستظهر اضغط على خيار Share.",
  },
  {
    img: "/install/step3.jpg",
    title: "أضف إلى الشاشة الرئيسية",
    text: "مرّر للأسفل واختر Add to Home Screen ثم اضغط إضافة، وسيظهر التطبيق على شاشة جوالك.",
  },
];

export default function InstallGuideModal({ onClose }) {
  const [tab, setTab] = useState("ios");
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // أندرويد/كروم: لو المتصفح جاهز للتثبيت المباشر نعرض زر "تثبيت الآن"
    const check = () => setCanInstall(!!window.__fazaaInstallPrompt);
    check();
    window.addEventListener("fazaa-install-ready", check);
    if (/android/i.test(navigator.userAgent)) setTab("android");
    return () => window.removeEventListener("fazaa-install-ready", check);
  }, []);

  async function installNow() {
    const evt = window.__fazaaInstallPrompt;
    if (!evt) return;
    evt.prompt();
    await evt.userChoice.catch(() => {});
    window.__fazaaInstallPrompt = null;
    setCanInstall(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box install-modal" onClick={(e) => e.stopPropagation()}>
        <h3>📲 تثبيت التطبيق على جوالك</h3>
        <p className="install-intro">ثبّت فزعة على شاشة جوالك الرئيسية لتفتحه مثل أي تطبيق.</p>

        <div className="install-tabs">
          <button type="button" className={"install-tab" + (tab === "ios" ? " active" : "")} onClick={() => setTab("ios")}>آيفون (iPhone)</button>
          <button type="button" className={"install-tab" + (tab === "android" ? " active" : "")} onClick={() => setTab("android")}>أندرويد</button>
        </div>

        {tab === "ios" && (
          <div className="install-steps">
            {IOS_STEPS.map((step, i) => (
              <div className="install-step" key={step.img}>
                <div className="install-step-head">
                  <span className="install-step-num">{i + 1}</span>
                  <b>{step.title}</b>
                </div>
                <p>{step.text}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={step.img} alt={step.title} loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {tab === "android" && (
          <div className="install-steps">
            {canInstall && (
              <button type="button" className="btn btn-primary btn-block" onClick={installNow}>📲 تثبيت التطبيق الآن</button>
            )}
            <div className="install-step">
              <div className="install-step-head"><span className="install-step-num">1</span><b>افتح الموقع في Chrome</b></div>
              <p>افتح رابط الموقع في متصفح Google Chrome.</p>
            </div>
            <div className="install-step">
              <div className="install-step-head"><span className="install-step-num">2</span><b>افتح القائمة</b></div>
              <p>اضغط على النقاط الثلاث (⋮) أعلى الشاشة.</p>
            </div>
            <div className="install-step">
              <div className="install-step-head"><span className="install-step-num">3</span><b>أضف إلى الشاشة الرئيسية</b></div>
              <p>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، ثم أكّد.</p>
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>تم</button>
        </div>
      </div>
    </div>
  );
}
