import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/serverAuth";
import { parseUserAgent } from "@/lib/device";

export const dynamic = "force-dynamic";

// يسجّل حدثًا (دخول / فتح التطبيق) مع الجهاز وعنوان IP. الكتابة من الخادم فقط.
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: "غير مصرح" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const event = body.event === "login" ? "login" : "open";
  const standalone = body.standalone === true;

  const ua = request.headers.get("user-agent") || "";
  const dev = parseUserAgent(ua);
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip = (fwd.split(",")[0] || request.headers.get("x-real-ip") || "").trim().slice(0, 64) || null;

  const admin = getSupabaseAdmin();

  // "فتح التطبيق": لا نكرر نفس الجهاز خلال 30 دقيقة
  if (event === "open") {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("login_logs").select("id").eq("user_id", user.id).eq("user_agent", dev.user_agent)
      .gte("created_at", since).limit(1);
    if (recent && recent.length) return Response.json({ success: true, skipped: true });
  }

  const { error } = await admin.from("login_logs").insert({
    user_id: user.id, event, ip, standalone,
    device_type: dev.device_type, os: dev.os, browser: dev.browser, model: dev.model, user_agent: dev.user_agent,
  });
  if (error) {
    console.error("login_logs insert failed:", error.message);
    return Response.json({ error: "تعذّر التسجيل" }, { status: 500 });
  }
  return Response.json({ success: true });
}
