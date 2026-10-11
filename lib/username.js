// قواعد اسم المستخدم (تعمل في المتصفح والخادم)
// 3 إلى 20 حرفًا: حروف (عربي أو إنجليزي) وأرقام و _ و . و -  بدون مسافات
export const USERNAME_RE = /^[\p{L}\p{N}_.\-]{3,20}$/u;

export function normalizeUsername(raw) {
  return String(raw ?? "").trim().normalize("NFKC").toLowerCase();
}

export function isValidUsername(normalized) {
  return USERNAME_RE.test(normalized);
}
