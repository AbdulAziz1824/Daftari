import crypto from "crypto";

// تشفير مفاتيح الذكاء الاصطناعي قبل حفظها في قاعدة البيانات (AES-256-GCM).
// المفتاح السري AI_KEY_SECRET يُضاف في Vercel فقط ولا يُخزَّن في الكود.
function getKey() {
  const secret = process.env.AI_KEY_SECRET;
  if (!secret || secret.length < 16) throw new Error("AI_KEY_SECRET_MISSING");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload) {
  const [iv, tag, enc] = String(payload).split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
