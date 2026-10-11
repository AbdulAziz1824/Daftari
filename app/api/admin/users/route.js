import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// قائمة كل الحسابات مع آخر ظهور
export async function GET(request) {
  const ctx = await requireAdmin(request);
  if (ctx.response) return ctx.response;
  const { admin } = ctx;

  const users = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return Response.json({ error: "تعذّر تحميل الحسابات." }, { status: 500 });
    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < 200) break;
  }

  const [{ data: profiles }, { data: names }, { data: admins }] = await Promise.all([
    admin.from("profiles").select("*"),
    admin.from("usernames").select("user_id, username"),
    admin.from("admins").select("user_id"),
  ]);
  // آخر جهاز استخدمه كل حساب (من سجل الدخول). إذا لم يُشغَّل تحديث V1.05 نتجاهل الخطأ.
  const lastDeviceById = {};
  const { data: logRows } = await admin
    .from("login_logs")
    .select("user_id, ip, device_type, os, browser, model, standalone, created_at")
    .order("created_at", { ascending: false })
    .limit(3000);
  for (const l of logRows || []) if (!lastDeviceById[l.user_id]) lastDeviceById[l.user_id] = l;

  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const usernameById = Object.fromEntries((names || []).map((n) => [n.user_id, n.username]));
  const adminIds = new Set((admins || []).map((a) => a.user_id));

  const rows = users.map((u) => {
    const p = profileById[u.id] || {};
    return {
      id: u.id,
      name: p.name || "—",
      login: usernameById[u.id] || u.email || "—",
      has_username: !!usernameById[u.id],
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      last_seen_at: p.last_seen_at || null,
      is_admin: adminIds.has(u.id),
      last_device: lastDeviceById[u.id] || null,
    };
  });
  rows.sort((a, b) => new Date(b.last_seen_at || b.last_sign_in_at || b.created_at) - new Date(a.last_seen_at || a.last_sign_in_at || a.created_at));
  return Response.json({ users: rows });
}

// تعيين كلمة مرور جديدة لحساب (مفيد لحسابات اسم المستخدم لأنها بدون استرجاع بالبريد)
export async function POST(request) {
  const ctx = await requireAdmin(request);
  if (ctx.response) return ctx.response;
  const { admin } = ctx;

  const body = await request.json().catch(() => ({}));
  if (body.action !== "set_password") return Response.json({ error: "طلب غير معروف" }, { status: 400 });
  const userId = typeof body.userId === "string" ? body.userId : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: "حساب غير صحيح" }, { status: 400 });
  if (password.length < 6 || password.length > 72) return Response.json({ error: "كلمة المرور من 6 إلى 72 حرفًا." }, { status: 400 });

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return Response.json({ error: "تعذّر تغيير كلمة المرور." }, { status: 500 });
  return Response.json({ success: true });
}
