import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// يتحقق من المستخدم عبر توكن الجلسة المرسل من المتصفح (Authorization: Bearer ...)
export async function getUserFromRequest(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// يتحقق أن الطالب مسجّل دخوله ومسجّل كأدمن في جدول admins
export async function requireAdmin(request) {
  const user = await getUserFromRequest(request);
  if (!user) return { response: Response.json({ error: "غير مصرح" }, { status: 401 }) };
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) return { response: Response.json({ error: "هذه الصفحة للأدمن فقط" }, { status: 403 }) };
  return { user, admin };
}
