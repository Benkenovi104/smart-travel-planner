/** Paleta por día del mapa. Sin dependencias (para no arrastrar Leaflet al bundle). */
export const DAY_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

export function colorDia(indice: number): string {
  return DAY_COLORS[indice % DAY_COLORS.length];
}
