// وقت نسبي بالعربي: "منذ 5 دقائق"
export function timeAgo(iso) {
  if (!iso) return "لم يظهر بعد";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `منذ ${day} يوم`;
  return new Date(iso).toLocaleDateString("en-GB");
}

// متصل الآن = ظهر خلال آخر دقيقتين
export function isOnlineNow(iso) {
  return !!iso && Date.now() - new Date(iso).getTime() < 2 * 60 * 1000;
}
