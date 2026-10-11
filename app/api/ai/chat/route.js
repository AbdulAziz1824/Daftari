import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/serverAuth";
import { decryptSecret } from "@/lib/aiCrypto";
import { PROVIDER_IDS, callProvider } from "@/lib/aiProviders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: "غير مصرح. سجّل الدخول من جديد." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const provider = body.provider;
  if (!PROVIDER_IDS.includes(provider)) return Response.json({ error: "مزوّد غير صحيح." }, { status: 400 });

  // ننظّف المحادثة: آخر 20 رسالة فقط، وكل رسالة حتى 4000 حرف
  const raw = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  const messages = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "اكتب رسالة أولًا." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("ai_connections")
    .select("model, encrypted_key")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();
  if (!row) return Response.json({ error: "هذا المزوّد غير مربوط. اربطه أولًا." }, { status: 400 });

  let apiKey;
  try {
    apiKey = decryptSecret(row.encrypted_key);
  } catch {
    return Response.json({ error: "تعذّر قراءة المفتاح المحفوظ. أعد ربط المزوّد." }, { status: 500 });
  }

  try {
    const reply = await callProvider({ provider, apiKey, model: row.model, messages });
    return Response.json({ reply: reply || "(لا يوجد رد)" });
  } catch (e) {
    return Response.json({ error: `خطأ من المزوّد: ${e.message}` }, { status: 502 });
  }
}
