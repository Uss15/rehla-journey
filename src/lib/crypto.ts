// أدوات التشفير وتوليد الأكواد. تعمل على المتصفح والخادم (Web Crypto + Node).

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// كود من 12 رقماً عشوائياً مقاوم للتخمين (تشفيرياً).
export function generateCardCode(): string {
  const arr = new Uint32Array(3);
  crypto.getRandomValues(arr);
  // كل عدد ~4 مليار، نأخذ منه 4 أرقام => 12 رقم إجمالاً
  const part = (n: number) => (n % 10000).toString().padStart(4, "0");
  return `${part(arr[0])}${part(arr[1])}${part(arr[2])}`;
}

export function formatCardCode(code: string): string {
  return code.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3");
}