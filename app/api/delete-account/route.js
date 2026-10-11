import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  }

  // نتحقق من هوية المستخدم عبر رمز الجلسة (anon key كافٍ للتحقق فقط)
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await verifier.auth.getUser(token);
  if (userError || !userData?.user) {
    return Response.json({ error: "جلسة غير صالحة" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
