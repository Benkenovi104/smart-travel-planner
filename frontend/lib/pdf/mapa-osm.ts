/**
 * Arma una imagen estática del mapa componiendo tiles de OpenStreetMap en un
 * canvas, para poder incrustarla en el PDF.
 *
 * Por qué no un servicio de mapas estáticos: Google Static Maps es un SKU
 * aparte que hoy no está habilitado en el proyecto, y llamarlo desde el browser
 * expondría la API key de Places. Los tiles de OSM salen del mismo lugar que ya
 * usa Leaflet en la app, sin key y con `Access-Control-Allow-Origin: *`, que es
 * lo que permite exportar el canvas sin que quede "tainted".
 *
 * Por qué no una captura del Leaflet que ya está en pantalla: el mapa puede no
 * estar montado (vive en otra pestaña de la página) y html2canvas sobre tiles
 * de otro origen es frágil. Componer los tiles a mano da un resultado
 * predecible y funciona con el mapa cerrado.
 */

const TILE = 256;
const ZOOM_MAX = 16;
const ZOOM_MIN = 2;
/** Margen en píxeles para que ningún marcador quede pegado al borde. */
const PADDING = 48;

export interface PuntoMapa {
  lat: number;
  lng: number;
  /** Se dibuja dentro del pin. Pensado para el número de orden. */
  etiqueta?: string;
}

function lonAX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z);
}

function latAY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

/** El zoom más cercano en el que todos los puntos entran en el lienzo. */
function zoomQueEntra(
  puntos: PuntoMapa[],
  ancho: number,
  alto: number,
): number {
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  for (let z = ZOOM_MAX; z > ZOOM_MIN; z--) {
    const w = (lonAX(maxLng, z) - lonAX(minLng, z)) * TILE;
    const h = (latAY(minLat, z) - latAY(maxLat, z)) * TILE;
    if (w <= ancho - PADDING && h <= alto - PADDING) return z;
  }
  return ZOOM_MIN;
}

function cargarTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Sin esto el canvas queda tainted y `toDataURL` tira SecurityError.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    // Un tile que no carga deja un hueco gris, no rompe el PDF entero.
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function dibujarPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  etiqueta?: string,
) {
  const r = 11;

  ctx.beginPath();
  ctx.arc(x, y - r, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0284c7';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // La puntita que apoya en la coordenada real.
  ctx.beginPath();
  ctx.moveTo(x - 5, y - r + 7);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x + 5, y - r + 7);
  ctx.closePath();
  ctx.fillStyle = '#0284c7';
  ctx.fill();

  if (etiqueta) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(etiqueta, x, y - r);
  }
}

/**
 * Devuelve el mapa como data URL PNG, o `null` si no hay puntos con
 * coordenadas o el navegador no puede exportar el canvas.
 */
export async function generarMapaPNG(
  puntos: PuntoMapa[],
  ancho = 1000,
  alto = 560,
): Promise<string | null> {
  const validos = puntos.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  if (validos.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, ancho, alto);

  // Con un solo punto no hay bounds que encuadrar: se elige un zoom de barrio.
  const z =
    validos.length === 1 ? 14 : zoomQueEntra(validos, ancho, alto);

  const centroX =
    (Math.min(...validos.map((p) => lonAX(p.lng, z))) +
      Math.max(...validos.map((p) => lonAX(p.lng, z)))) /
    2;
  const centroY =
    (Math.min(...validos.map((p) => latAY(p.lat, z))) +
      Math.max(...validos.map((p) => latAY(p.lat, z)))) /
    2;

  // Píxel mundial de la esquina superior izquierda del lienzo.
  const origenX = centroX * TILE - ancho / 2;
  const origenY = centroY * TILE - alto / 2;

  const maxTile = Math.pow(2, z);
  const desdeX = Math.floor(origenX / TILE);
  const hastaX = Math.floor((origenX + ancho) / TILE);
  const desdeY = Math.floor(origenY / TILE);
  const hastaY = Math.floor((origenY + alto) / TILE);

  const pendientes: Promise<void>[] = [];
  for (let tx = desdeX; tx <= hastaX; tx++) {
    for (let ty = desdeY; ty <= hastaY; ty++) {
      // Fuera del mundo por arriba o por abajo no hay tile; a los lados envuelve.
      if (ty < 0 || ty >= maxTile) continue;
      const x = ((tx % maxTile) + maxTile) % maxTile;
      const url = `https://tile.openstreetmap.org/${z}/${x}/${ty}.png`;
      pendientes.push(
        cargarTile(url).then((img) => {
          if (img) {
            ctx.drawImage(img, tx * TILE - origenX, ty * TILE - origenY);
          }
        }),
      );
    }
  }
  await Promise.all(pendientes);

  for (const p of validos) {
    dibujarPin(
      ctx,
      lonAX(p.lng, z) * TILE - origenX,
      latAY(p.lat, z) * TILE - origenY,
      p.etiqueta,
    );
  }

  // La licencia de OSM exige atribución visible donde se muestre el mapa.
  const credito = '© OpenStreetMap contributors';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const w = ctx.measureText(credito).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(ancho - w - 12, alto - 22, w + 12, 22);
  ctx.fillStyle = '#374151';
  ctx.fillText(credito, ancho - 6, alto - 5);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    // Si algún tile llegó sin CORS el canvas queda tainted: mejor PDF sin mapa
    // que PDF que no se genera.
    return null;
  }
}
