// إنشاء حساب مطور (أدمن) بدون الحاجة لصفحة التسجيل.
// التشغيل (من مجلد المشروع، ويحتاج ملف .env.local فيه مفاتيح Supabase):
//   node --env-file=.env.local scripts/create-dev-admin.mjs DEV2090 "كلمة-المرور" "المطور"
// لو الحساب موجود: يحدّث كلمة المرور ويتأكد أنه أدمن.
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const [rawUser, password, displayName = "المطور"] = process.argv.slice(2);
if (!rawUser || !password) {
  console.error('الاستخدام: node --env-file=.env.local scripts/create-dev-admin.mjs <username> <password> ["الاسم"]');
  process.exit(1);
}
if (password.length < 6 || password.length > 72) { console.error("كلمة المرور من 6 إلى 72 حرفًا."); process.exit(1); }

const username = rawUser.trim().normalize("NFKC").toLowerCase();
if (!/^[\p{L}\p{N}_.\-]{3,20}$/u.test(username)) { console.error("اسم المستخدم غير صالح."); process.exit(1); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("ناقص NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY في .env.local"); process.exit(1); }

const admin = createClient(url, key, { auth: { persistSession: false } });
const EMAIL_DOMAIN = process.env.USERNAME_EMAIL_DOMAIN || "gmail.com";

let userId;
const { data: existing } = await admin.from("usernames").select("user_id").eq("username_lower", username).maybeSingle();

if (existing) {
  userId = existing.user_id;
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) { console.error("تعذّر تحديث كلمة المرور:", error.message); process.exit(1); }
  console.log("الحساب موجود: تم تحديث كلمة المرور.");
} else {
  const loginEmail = `u${crypto.randomBytes(12).toString("hex")}@${EMAIL_DOMAIN}`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: loginEmail, password, email_confirm: true, user_metadata: { name: displayName },
  });
  if (error || !created?.user) { console.error("تعذّر إنشاء الحساب:", error?.message); process.exit(1); }
  userId = created.user.id;
  const { error: mapError } = await admin.from("usernames").insert({ user_id: userId, username: rawUser.trim(), username_lower: username, login_email: loginEmail });
  if (mapError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("تعذّر ربط اسم المستخدم (هل شغّلت V1.04؟):", mapError.message);
    process.exit(1);
  }
  console.log("تم إنشاء الحساب.");
}

const { error: adminError } = await admin.from("admins").upsert({ user_id: userId }, { onConflict: "user_id" });
if (adminError) { console.error("تعذّر جعل الحساب أدمن:", adminError.message); process.exit(1); }
console.log(`✅ ${username} أدمن الآن. سجّل دخول وبيظهر لك تبويب "المطور".`);
