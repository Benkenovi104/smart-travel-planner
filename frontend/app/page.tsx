import { redirect } from 'next/navigation';

// La raíz no tiene contenido propio: el guard (proxy.ts) decide a dónde va el
// usuario según haya sesión o no. Redirigimos al dashboard como destino natural.
export default function Home() {
  redirect('/dashboard');
}
