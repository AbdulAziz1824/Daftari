export const SYSTEM_PROMPT =
  "أنت «الفزعة»، مساعد دراسي ذكي داخل تطبيق مراجعة. أجب بالعربية الفصحى المبسطة ما لم يطلب المستخدم لغة أخرى. " +
  "اشرح الأسئلة خطوة بخطوة بإيجاز ووضوح، ولخّص الملاحظات، وساعد في تنظيم المراجعة. إذا لم تكن متأكدًا فاذكر ذلك بصراحة.";

export const PROVIDER_IDS = ["openai", "anthropic", "gemini"];
export const MODEL_RE = /^[A-Za-z0-9._:\-]{1,80}$/;

export const PROVIDER_DEFAULT_MODEL = {
  openai: "chat-latest",
  anthropic: "claude-haiku-4-5-20251001",
  gemini: "gemini-3.8-flash",
};

async function postJson(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || `HTTP ${res.status}`;
      throw new Error(String(msg).slice(0, 300));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// messages: [{ role: "user" | "assistant", content: "..." }]
export async function callProvider({ provider, apiKey, model, messages, maxTokens = 4096 }) {
  if (provider === "openai") {
    const json = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        max_completion_tokens: maxTokens,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }
    );
    return json?.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const json = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      { model, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages }
    );
    return (json?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  }

  if (provider === "gemini") {
    const json = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
      }
    );
    return (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  }

  throw new Error("مزوّد غير معروف");
}
