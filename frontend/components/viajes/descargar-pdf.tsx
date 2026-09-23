'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useViaje } from '@/lib/query/use-viajes';
import { useItinerario } from '@/lib/query/use-itinerario';
import { usePresupuesto } from '@/lib/query/use-presupuesto';
import { useVuelos, useAlojamiento } from '@/lib/query/use-reservas';
import { generarMapaPNG, type PuntoMapa } from '@/lib/pdf/mapa-osm';
import type { Itinerario, OpcionAlojamiento } from '@/lib/types/models';

/** Nombre de archivo sin acentos ni espacios, que viajan mal entre sistemas. */
function nombreArchivo(destino: string, fecha: string): string {
  const limpio = destino
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `viaje-${limpio || 'sin-destino'}-${fecha.slice(0, 10)}.pdf`;
}

/**
 * Los puntos del mapa: las actividades con coordenadas, numeradas en el orden
 * en que se visitan, más el hotel elegido si tiene ubicación.
 */
function puntosDe(
  itinerario: Itinerario | null | undefined,
  alojamiento: OpcionAlojamiento | null | undefined,
): PuntoMapa[] {
  const puntos: PuntoMapa[] = [];
  let n = 0;

  for (const dia of itinerario?.dias ?? []) {
    for (const act of dia.actividades) {
      const { lat, lng } = act.lugar;
      if (lat == null || lng == null) continue;
      n++;
      puntos.push({ lat, lng, etiqueta: String(n) });
    }
  }

  if (alojamiento?.lat != null && alojamiento.lng != null) {
    puntos.push({ lat: alojamiento.lat, lng: alojamiento.lng, etiqueta: 'H' });
  }

  return puntos;
}

export function DescargarPDF({ idViaje }: { idViaje: number }) {
  const [generando, setGenerando] = useState(false);

  // Todo esto ya está en caché: la página del viaje monta las mismas queries,
  // así que el botón no dispara pedidos nuevos ni gasta cuota de las APIs.
  const { data: viaje } = useViaje(idViaje);
  const { data: itinerario } = useItinerario(idViaje);
  const { data: presupuesto } = usePresupuesto(idViaje);
  const { data: vuelos } = useVuelos(idViaje);
  const { data: alojamientos } = useAlojamiento(idViaje);

  async function generar() {
    if (!viaje) return;
    setGenerando(true);

    try {
      const alojamiento = alojamientos?.find((a) => a.seleccionado) ?? null;
      const vuelo = vuelos?.find((v) => v.seleccionado) ?? null;

      // El mapa puede fallar (tiles caídos, sin red) sin que eso justifique
      // quedarse sin PDF: `generarMapaPNG` devuelve null y el documento lo omite.
      const mapaPNG = await generarMapaPNG(puntosDe(itinerario, alojamiento));

      // react-pdf pesa más de un mega. Se carga recién acá para no meterlo en
      // el bundle de una página que la mayoría abre sin descargar nada.
      const [{ pdf }, { ResumenPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./resumen-pdf'),
      ]);

      const blob = await pdf(
        <ResumenPDF
          viaje={viaje}
          itinerario={itinerario}
          presupuesto={presupuesto}
          vuelo={vuelo}
          alojamiento={alojamiento}
          mapaPNG={mapaPNG}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo(viaje.destinoPrincipal, viaje.fechaInicio);
      a.click();
      URL.revokeObjectURL(url);

      if (!mapaPNG) {
        toast.warning('El PDF se generó sin el mapa', {
          description: 'No se pudieron cargar los mapas. El resto está completo.',
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF', {
        description: 'Probá de nuevo en un momento.',
      });
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={() => void generar()}
      disabled={!viaje || generando}
    >
      {generando ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {generando ? 'Generando…' : 'Descargar PDF'}
    </Button>
  );
}
