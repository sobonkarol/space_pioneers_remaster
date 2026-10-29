import type { Resources } from '../api/types';

/** Liczba calkowita z kropka jako separatorem tysiecy (styl klasycznych gier przegladarkowych). */
export function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '0';
  const n = Math.floor(value);
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Czas trwania: "2d 3h 04m 05s" (pomija zerowe wiodace jednostki). */
export function duration(totalSeconds: number): string {
  let s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (x: number) => x.toString().padStart(2, '0');
  if (d > 0) return `${d}d ${h}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/** Data i godzina w formacie dd.mm.rrrr gg:mm:ss (czas lokalny przegladarki). */
export function dateTime(iso: string | Date | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p = (x: number) => x.toString().padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function clockTime(d: Date): string {
  const p = (x: number) => x.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function covers(have: Resources, cost: Resources): boolean {
  return have.metal >= cost.metal && have.crystal >= cost.crystal && have.tritium >= cost.tritium;
}

export function scale(r: Resources, f: number): Resources {
  return { metal: r.metal * f, crystal: r.crystal * f, tritium: r.tritium * f };
}

export function totalOf(r: Resources): number {
  return r.metal + r.crystal + r.tritium;
}

/** Liczba z pola tekstowego - akceptuje kropki tysiecy i "k" (tysiace). */
export function parseAmount(text: string): number {
  const cleaned = text.trim().toLowerCase().replace(/\./g, '').replace(/\s/g, '');
  if (!cleaned) return 0;
  const k = cleaned.endsWith('k');
  const n = Number(k ? cleaned.slice(0, -1) : cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(k ? n * 1000 : n);
}
