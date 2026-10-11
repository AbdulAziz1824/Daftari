"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUI } from "@/components/UIProvider";
import ConfirmModal from "@/components/ConfirmModal";

const PROVIDERS = [
  {
    id: "openai", name: "ChatGPT", maker: "OpenAI", defaultModel: "chat-latest",
    models: ["chat-latest", "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-6-astra"],
    keyUrl: "platform.openai.com/api-keys",
  },
  {
    id: "anthropic", name: "Claude", maker: "Anthropic", defaultModel: "claude-haiku-4-5-20251001",
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-5-5", "claude-opus-5-5"],
    keyUrl: "console.anthropic.com/settings/keys",
  },
  {
    id: "gemini", name: "Gemini", maker: "Google", defaultModel: "gemini-3.8-flash",
    models: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"],
    keyUrl: "aistudio.google.com/apikey",
  },
];
const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
const STARTERS = ["اشرح لي هذا السؤال خطوة بخطوة", "لخّص لي هذا النص في نقاط", "اختبرني بخمسة أسئلة عن موضوع..."];

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
}

export default function FazaaAIPage() {
  const { showToast } = useUI();
  const [connections, setConnections] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [form, setForm] = useState({ provider: "openai", apiKey: "", model: "" });
  const [saving, setSaving] = useState(false);
  const [chats, setChats] = useState({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(null);
  const endRef = useRef(null);

  const loadConnections = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/ai/connections", { headers });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const list = json.connections || [];
      setConnections(list);
      setActive((cur) => (cur && list.some((c) => c.provider === cur) ? cur : (list[0]?.provider || null)));
      if (list.length === 0) setShowManage(true);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chats, sending, active]);

  const messages = (active && chats[active]) || [];

  async function handleConnect(e) {
    e.preventDefault();
    if (saving) return;
    const headers = await authHeaders();
    if (!headers) { showToast("انتهت الجلسة. سجّل الدخول من جديد.", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/ai/connections", {
        method: "POST", headers,
        body: JSON.stringify({ provider: form.provider, apiKey: form.apiKey, model: form.model || byId[form.provider].defaultModel }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(json.error || "تعذّر الربط.", "error"); return; }
      showToast(`تم ربط ${byId[form.provider].name} بنجاح.`, "success");
      setForm((f) => ({ ...f, apiKey: "" }));
      setActive(form.provider);
      setShowManage(false);
      loadConnections();
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    const provider = confirmUnlink;
    setConfirmUnlink(null);
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(`/api/ai/connections?provider=${provider}`, { method: "DELETE", headers });
    if (!res.ok) { showToast("تعذّر فك الربط.", "error"); return; }
    showToast("تم فك الربط وحذف المفتاح.", "success");
    setChats((c) => ({ ...c, [provider]: [] }));
    loadConnections();
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || sending || !active) return;
    const headers = await authHeaders();
    if (!headers) { showToast("انتهت الجلسة. سجّل الدخول من جديد.", "error"); return; }
    const next = [...messages, { role: "user", content }];
    setChats((c) => ({ ...c, [active]: next }));
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers, body: JSON.stringify({ provider: active, messages: next }) });
      const json = await res.json().catch(() => ({}));
      const reply = res.ok ? json.reply : `⚠️ ${json.error || "حدث خطأ غير متوقع."}`;
      setChats((c) => ({ ...c, [active]: [...next, { role: "assistant", content: reply, error: !res.ok }] }));
    } catch {
      setChats((c) => ({ ...c, [active]: [...next, { role: "assistant", content: "⚠️ تعذّر الاتصال. تحقق من الإنترنت.", error: true }] }));
    } finally {
      setSending(false);
    }
  }

  const sel = byId[form.provider];

  return (
    <>
      <div className="section-header">
        <h3>✨ الفزعة</h3>
        {connections.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowManage((s) => !s)}>{showManage ? "إخفاء الربط" : "⚙️ إدارة الربط"}</button>
        )}
      </div>
      <p className="community-intro">اربط حسابك في ChatGPT أو Claude أو Gemini واستخدمه هنا. الربط يبقى محفوظًا في كل مرة تدخل.</p>

      {showManage && (
        <div className="settings-card">
          <h4>🔗 ربط مزوّد ذكاء اصطناعي</h4>

          {connections.length > 0 && (
            <div className="linked-list">
              {connections.map((c) => (
                <div key={c.provider} className="account-info-row">
                  <span>✅ {byId[c.provider]?.name} <small style={{ color: "var(--text-muted)" }}>({c.model} · ••••{c.key_hint})</small></span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmUnlink(c.provider)}>فك الربط</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleConnect} style={{ marginTop: 14 }}>
            <div className="provider-tabs">
              {PROVIDERS.map((p) => (
                <button type="button" key={p.id} className={"tag-chip" + (form.provider === p.id ? " active" : "")} onClick={() => setForm({ provider: p.id, apiKey: "", model: "" })}>{p.name}</button>
              ))}
            </div>
            <div className="field">
              <label>مفتاح API الخاص بـ {sel.name}</label>
              <input type="password" dir="ltr" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="الصق المفتاح هنا" required />
              <div className="field-hint">تحصل عليه من: <span dir="ltr">{sel.keyUrl}</span></div>
            </div>
            <div className="field">
              <label>النموذج</label>
              <input type="text" dir="ltr" list={`models-${sel.id}`} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={sel.defaultModel} />
              <datalist id={`models-${sel.id}`}>{sel.models.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "جارٍ الاختبار..." : "اختبار وحفظ الربط"}</button>
          </form>

          <div className="field-hint" style={{ marginTop: 14, lineHeight: 1.9 }}>
            🔒 المفتاح يُحفظ مشفّرًا على الخادم ولا يظهر مرة ثانية. 💳 مفتاح API يختلف عن اشتراك ChatGPT Plus أو Claude Pro، ويُحاسَب استخدامك على حسابك عند المزوّد.
          </div>
        </div>
      )}

      {loaded && connections.length > 0 && (
        <div className="chat-box">
          <div className="provider-tabs">
            {connections.map((c) => (
              <button type="button" key={c.provider} className={"tag-chip" + (active === c.provider ? " active" : "")} onClick={() => setActive(c.provider)}>{byId[c.provider]?.name}</button>
            ))}
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <div style={{ fontSize: 34 }}>✨</div>
                <p>اسألني عن أي شيء في مراجعتك</p>
                <div className="starter-list">
                  {STARTERS.map((s) => <button type="button" key={s} className="tag-chip" onClick={() => setInput(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"chat-msg " + (m.role === "user" ? "user" : "bot") + (m.error ? " err" : "")}>{m.content}</div>
            ))}
            {sending && <div className="chat-msg bot typing">جارٍ التفكير...</div>}
            <div ref={endRef} />
          </div>

          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 900) { e.preventDefault(); send(); } }}
              placeholder="اكتب رسالتك..."
              rows={1}
              maxLength={4000}
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>إرسال</button>
          </form>
          {messages.length > 0 && (
            <button type="button" className="chat-clear" onClick={() => setChats((c) => ({ ...c, [active]: [] }))}>🧹 مسح المحادثة</button>
          )}
        </div>
      )}

      {confirmUnlink && (
        <ConfirmModal
          title="فك الربط"
          message={`سيُحذف مفتاح ${byId[confirmUnlink]?.name} المحفوظ. هل أنت متأكد؟`}
          onConfirm={handleUnlink}
          onCancel={() => setConfirmUnlink(null)}
        />
      )}
    </>
  );
}
