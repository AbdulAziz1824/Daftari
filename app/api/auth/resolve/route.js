import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeUsername, isValidUsername } from "@/lib/username";

export const dynamic = "force-dynamic";

// يحوّل اسم المستخدم إلى البريد الداخلي (العشوائي) لتسجيل الدخول.
// البريد الداخلي لا يخص أحدًا ولا يصله أي بريد، فلا يضر إظهاره.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  if (!isValidUsername(username)) return Response.json({ error: "غير موجود" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const { data } = await admin.from("usernames").select("login_email").eq("username_lower", username).maybeSingle();
  if (!data) return Response.json({ error: "غير موجود" }, { status: 404 });
  return Response.json({ email: data.login_email });
}
