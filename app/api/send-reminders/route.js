import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T" + (timeStr || "23:59:00"));
  return isNaN(d.getTime()) ? null : d;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request) {
  // الحماية: لازم يكون CRON_SECRET معرّف في Vercel، والطلب يحمل نفس القيمة.
  // Vercel Cron يرسل الترويسة Authorization: Bearer <CRON_SECRET> تلقائيًا.
  // لا نعتمد على User-Agent لأنه يمكن تزويره.
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "غير مصرح" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const { data: exams } = await admin.from("exams").select("*");
  const { data: profiles } = await admin.from("profiles").select("*");
  const profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const now = new Date();
  let sentCount = 0;

  for (const exam of exams || []) {
    const profile = profilesById[exam.user_id];
    if (!profile || !profile.notifications_enabled || !profile.notification_email) continue;

    const examDateTime = combineDateTime(exam.exam_date, exam.exam_time);
    if (!examDateTime) continue;
    const diffDays = Math.ceil((examDateTime.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) continue;

    const reminderDays = String(exam.reminder_days || "")
      .split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));

    if (reminderDays.includes(diffDays) && resend) {
      try {
        await resend.emails.send({
          from: "فزعة <onboarding@resend.dev>",
          to: profile.notification_email,
          subject: `📚 تذكير باختبار: ${exam.name}`,
          html: `
            <div style="font-family: Tahoma, Arial; direction: rtl; text-align: right;">
              <h2>تذكير بموعد اختبار</h2>
              <p>مرحبًا ${escapeHtml(profile.name)}،</p>
              <p>لديك اختبار <b>${escapeHtml(exam.name)}</b> بتاريخ <b>${escapeHtml(exam.exam_date)}</b>${exam.exam_time ? ` الساعة <b>${escapeHtml(exam.exam_time)}</b>` : ""}.</p>
              <p>متبقي على الاختبار: <b>${diffDays} يوم</b>. بالتوفيق في المراجعة! 📖</p>
            </div>`,
        });
        sentCount++;
      } catch (e) {
        console.error("فشل إرسال بريد التذكير:", e);
      }
    }
  }

  return Response.json({ success: true, sent: sentCount });
}
