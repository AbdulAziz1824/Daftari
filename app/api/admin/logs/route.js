import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

// آخر 300 حدث دخول/فتح مع اسم صاحب الحساب والجهاز
export async function GET(request) {
  const ctx = await requireAdmin(request);
  if (ctx.response) return ctx.response;
  const { admin } = ctx;

  const { data: rows, error } = await admin
    .from("login_logs")
    .select("id, user_id, event, ip, device_type, os, browser, model, standalone, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return Response.json({ logs: [], ready: false });

  const ids = [...new Set((rows || []).map((r) => r.user_id))];
  let nameById = {}, loginById = {};
  if (ids.length) {
    const [{ data: profiles }, { data: names }] = await Promise.all([
      admin.from("profiles").select("id, name").in("id", ids),
      admin.from("usernames").select("user_id, username").in("user_id", ids),
    ]);
    nameById = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
    loginById = Object.fromEntries((names || []).map((n) => [n.user_id, n.username]));
  }

  const logs = (rows || []).map((r) => ({
    ...r,
    name: nameById[r.user_id] || "—",
    login: loginById[r.user_id] || "—",
  }));
  return Response.json({ logs, ready: true });
}
