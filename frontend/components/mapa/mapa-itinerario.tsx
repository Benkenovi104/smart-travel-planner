'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';

import { formatHora } from '@/lib/format';
import { colorDia } from './colors';
import type { Itinerario } from '@/lib/types/models';

type Punto = {
  id: number;
  lat: number;
  lng: number;
  nombre: string;
  numeroDia: number;
  hora: string | null;
  color: string;
  indice: number;
};

function iconoNumerado(color: string, n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;font-size:12px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ puntos }: { puntos: Punto[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    const bounds = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [puntos, map]);
  return null;
}

export default function MapaItinerario({
  itinerario,
  diaSeleccionado,
}: {
  itinerario: Itinerario;
  diaSeleccionado?: number | null;
}) {
  // Puntos y rutas por día (solo actividades con coordenadas).
  const { puntos, rutas } = useMemo(() => {
    const puntos: Punto[] = [];
    const rutas: { color: string; coords: [number, number][] }[] = [];

    itinerario.dias.forEach((dia, i) => {
      // El color se calcula con el índice global para que cada día conserve su
      // color aunque se filtre.
      if (diaSeleccionado != null && dia.numeroDia !== diaSeleccionado) return;
      const color = colorDia(i);
      const conCoords = dia.actividades.filter(
        (a) => a.lugar.lat != null && a.lugar.lng != null,
      );
      const coords: [number, number][] = [];
      conCoords.forEach((a, idx) => {
        const lat = a.lugar.lat!;
        const lng = a.lugar.lng!;
        puntos.push({
          id: a.id,
          lat,
          lng,
          nombre: a.lugar.nombre,
          numeroDia: dia.numeroDia,
          hora: formatHora(a.horaInicio),
          color,
          indice: idx + 1,
        });
        coords.push([lat, lng]);
      });
      if (coords.length >= 2) rutas.push({ color, coords });
    });

    return { puntos, rutas };
  }, [itinerario, diaSeleccionado]);

  const centro: [number, number] = puntos.length
    ? [puntos[0].lat, puntos[0].lng]
    : [0, 0];

  return (
    <MapContainer
      center={centro}
      zoom={13}
      scrollWheelZoom
      // `isolate` contiene los z-index internos de Leaflet para que dropdowns y
      // diálogos (portalizados) puedan mostrarse por encima del mapa.
      className="isolate h-[520px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {rutas.map((r, i) => (
        <Polyline
          key={i}
          positions={r.coords}
          pathOptions={{ color: r.color, weight: 3, opacity: 0.7 }}
        />
      ))}
      {puntos.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={iconoNumerado(p.color, p.indice)}
        >
          <Popup>
            <div className="space-y-0.5">
              <p className="font-medium">{p.nombre}</p>
              <p className="text-xs text-neutral-500">
                Día {p.numeroDia}
                {p.hora ? ` · ${p.hora}` : ''}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds puntos={puntos} />
    </MapContainer>
  );
}
