// تحية حسب وقت الجهاز: صباحًا / ظهرًا وعصرًا / مساءً
export function getGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "صباح الخير";
  if (h >= 12 && h < 17) return "مرحبًا";
  return "مساء الخير";
}
