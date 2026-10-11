import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/serverAuth";
import { encryptSecret } from "@/lib/aiCrypto";
import { PROVIDER_IDS, MODEL_RE, PROVIDER_DEFAULT_MODEL, callProvider } from "@/lib/aiProviders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return Response.json({ error: "غير مصرح. سجّل الدخول من جديد." }, { status: 401 });
}

// قائمة المزوّدين المربوطين (لا نرجّع المفتاح أبدًا، فقط آخر 4 أحرف)
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("ai_connections")
    .select("provider, model, key_hint, created_at")
    .eq("user_id", user.id);
  if (error) return Response.json({ error: "تعذّر تحميل الربط." }, { status: 500 });
  return Response.json({ connections: data || [] });
}

// ربط مزوّد جديد: نختبر المفتاح أولًا ثم نحفظه مشفّرًا
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const provider = body.provider;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const model = (typeof body.model === "string" && body.model.trim()) || PROVIDER_DEFAULT_MODEL[provider];

  if (!PROVIDER_IDS.includes(provider)) return Response.json({ error: "مزوّد غير صحيح." }, { status: 400 });
  if (apiKey.length < 10 || apiKey.length > 400 || /\s/.test(apiKey)) {
    return Response.json({ error: "المفتاح غير صالح. انسخه كاملًا بدون مسافات." }, { status: 400 });
  }
  if (!MODEL_RE.test(model)) return Response.json({ error: "اسم النموذج غير صالح." }, { status: 400 });

  let encrypted;
  try {
    encrypted = encryptSecret(apiKey);
  } catch (e) {
    if (e.message === "AI_KEY_SECRET_MISSING") {
      return Response.json({ error: "لم يتم إعداد المتغير AI_KEY_SECRET في Vercel بعد." }, { status: 500 });
    }
    return Response.json({ error: "تعذّر تشفير المفتاح." }, { status: 500 });
  }

  // اختبار سريع للتأكد أن المفتاح والنموذج يعملان
  try {
    await callProvider({ provider, apiKey, model, messages: [{ role: "user", content: "قل: تم" }], maxTokens: 512 });
  } catch (e) {
    return Response.json({ error: `فشل الاتصال بالمزوّد: ${e.message}` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("ai_connections").upsert(
    { user_id: user.id, provider, model, encrypted_key: encrypted, key_hint: apiKey.slice(-4) },
    { onConflict: "user_id,provider" }
  );
  if (error) return Response.json({ error: "تعذّر حفظ الربط." }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  const provider = new URL(request.url).searchParams.get("provider");
  if (!PROVIDER_IDS.includes(provider)) return Response.json({ error: "مزوّد غير صحيح." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("ai_connections").delete().eq("user_id", user.id).eq("provider", provider);
  if (error) return Response.json({ error: "تعذّر فك الربط." }, { status: 500 });
  return Response.json({ success: true });
}
