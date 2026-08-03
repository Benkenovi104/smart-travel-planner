import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * RapidAPI responde 429 cuando se agota la cuota del plan (el free tier de Sky
 * Scrapper son 20 requests al mes, y cada búsqueda de vuelos gasta 4).
 *
 * Sin esto el llamador sólo ve el `null`/`[]` con el que degradan los clientes,
 * y al usuario le llega "No se pudo resolver el origen o destino", que manda a
 * buscar el problema en el destino en vez de en la cuota.
 */
export function lanzarSiSinCuota(res: Response, api: string): void {
  if (res.status !== 429) return;

  throw new HttpException(
    `Se agotó la cuota de la API de ${api}. Volvé a intentar más adelante.`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
