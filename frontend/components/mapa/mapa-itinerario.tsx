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

import { formatHora, formatMoney } from '@/lib/format';
import { colorDia } from './colors';
import type { Itinerario, OpcionAlojamiento } from '@/lib/types/models';

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

/**
 * El hotel no es una parada de un día: se distingue de las actividades con forma
 * de gota, tamaño mayor y un ícono de cama en vez de un número.
 */
function iconoHotel() {
  const cama = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px 9999px 9999px 2px;transform:rotate(-45deg);background:#0f172a;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"><div style="transform:rotate(45deg);display:flex">${cama}</div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -34],
  });
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 });
  }, [coords, map]);
  return null;
}

export default function MapaItinerario({
  itinerario,
  diaSeleccionado,
  hotel,
}: {
  itinerario: Itinerario;
  diaSeleccionado?: number | null;
  /** Alojamiento elegido, con coordenadas. Se muestra en todos los días. */
  hotel?: OpcionAlojamiento | null;
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

  const hotelLat = hotel?.lat ?? null;
  const hotelLng = hotel?.lng ?? null;

  // El hotel entra en el encuadre para que nunca quede fuera de pantalla. Las
  // deps son primitivas: con el objeto `hotel` el fitBounds correría en cada render.
  const coordsParaEncuadre = useMemo(() => {
    const c: [number, number][] = puntos.map((p) => [p.lat, p.lng]);
    if (hotelLat != null && hotelLng != null) c.push([hotelLat, hotelLng]);
    return c;
  }, [puntos, hotelLat, hotelLng]);

  const centro: [number, number] = coordsParaEncuadre[0] ?? [0, 0];

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
      {hotel && hotelLat != null && hotelLng != null && (
        <Marker position={[hotelLat, hotelLng]} icon={iconoHotel()} zIndexOffset={1000}>
          <Popup>
            <div className="space-y-0.5">
              <p className="font-medium">{hotel.nombre ?? 'Tu alojamiento'}</p>
              <p className="text-xs text-neutral-500">
                Tu alojamiento
                {hotel.precioPorNoche != null &&
                  ` · ${formatMoney(hotel.precioPorNoche)} / noche`}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
      <FitBounds coords={coordsParaEncuadre} />
    </MapContainer>
  );
}
