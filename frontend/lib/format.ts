const FECHA_FMT = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const FECHA_HORA_FMT = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const NUM_FMT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatFecha(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? FECHA_FMT.format(d) : '—';
}

export function formatFechaHora(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? FECHA_HORA_FMT.format(d) : '—';
}

export function formatRango(
  inicio: string | null | undefined,
  fin: string | null | undefined,
): string {
  const a = formatFecha(inicio);
  const b = formatFecha(fin);
  if (a === '—' && b === '—') return '—';
  return `${a} → ${b}`;
}

/** Cantidad de noches entre dos fechas (para presupuesto/alojamiento). */
export function diasEntre(
  inicio: string | null | undefined,
  fin: string | null | undefined,
): number | null {
  const a = parse(inicio);
  const b = parse(fin);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$ ${NUM_FMT.format(n)}`;
}

/** Recorta un horario "HH:mm:ss" o ISO a "HH:mm". */
export function formatHora(hora: string | null | undefined): string | null {
  if (!hora) return null;
  const match = hora.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}
