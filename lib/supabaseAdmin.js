import { createClient } from "@supabase/supabase-js";

// تحذير: هذا الملف يستخدم المفتاح السري (Service Role) ويجب ألا يُستورد أبدًا
// داخل أي ملف يحمل "use client" أو يُرسل إلى المتصفح.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
