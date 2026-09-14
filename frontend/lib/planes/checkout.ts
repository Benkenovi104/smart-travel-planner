/**
 * El id de la suscripción que se está pagando, guardado antes de mandar al usuario
 * a Mercado Pago. Es un respaldo: el backend ya lo agrega a la URL de retorno,
 * pero si volviera sin él, la página de resultado lo recupera de acá.
 *
 * `sessionStorage` puede no estar disponible (algunos modos privados): en ese
 * caso se ignora y queda solo el dato de la URL.
 */
const CLAVE = 'stp_suscripcion_en_curso';

export function guardarSuscripcionEnCurso(id: number) {
  try {
    sessionStorage.setItem(CLAVE, String(id));
  } catch {
    // Sin almacenamiento: alcanza con el id de la URL de retorno.
  }
}

export function leerSuscripcionEnCurso(): string | null {
  try {
    return sessionStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function olvidarSuscripcionEnCurso() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que limpiar.
  }
}
