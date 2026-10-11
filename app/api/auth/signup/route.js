import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeUsername, isValidUsername } from "@/lib/username";

export const dynamic = "force-dynamic";

// إنشاء حساب باسم مستخدم (بدون بريد). نولّد بريدًا داخليًا عشوائيًا لا يستخدمه أحد،
// ويُربط باسم المستخدم في جدول usernames. الدخول يتم باسم المستخدم + كلمة المرور.
const EMAIL_DOMAIN = process.env.USERNAME_EMAIL_DOMAIN || "gmail.com";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = normalizeUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 1 || name.length > 50) {
    return Response.json({ error: "اكتب اسمك (حتى 50 حرفًا)." }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return Response.json({ error: "اسم المستخدم من 3 إلى 20 حرفًا (حروف وأرقام و _ . -) بدون مسافات." }, { status: 400 });
  }
  if (password.length < 6 || password.length > 72) {
    return Response.json({ error: "كلمة المرور من 6 إلى 72 حرفًا." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: taken } = await admin.from("usernames").select("user_id").eq("username_lower", username).maybeSingle();
  if (taken) return Response.json({ error: "اسم المستخدم مستخدم، اختر اسمًا آخر." }, { status: 409 });

  const loginEmail = `u${crypto.randomBytes(12).toString("hex")}@${EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createError || !created?.user) {
    console.error("createUser failed:", createError?.message);
    return Response.json({ error: "تعذّر إنشاء الحساب. حاول مرة أخرى أو تواصل مع الدعم." }, { status: 500 });
  }

  const { error: mapError } = await admin.from("usernames").insert({
    user_id: created.user.id,
    username,
    username_lower: username,
    login_email: loginEmail,
  });
  if (mapError) {
    // تعارض لحظي (شخص أخذ الاسم قبلك) أو الجدول غير موجود: نلغي الحساب الناقص
    await admin.auth.admin.deleteUser(created.user.id);
    const dup = mapError.code === "23505";
    return Response.json(
      { error: dup ? "اسم المستخدم مستخدم، اختر اسمًا آخر." : "تعذّر إنشاء الحساب. تأكد من تشغيل تحديث قاعدة البيانات V1.04." },
      { status: dup ? 409 : 500 }
    );
  }

  return Response.json({ success: true, email: loginEmail });
}
