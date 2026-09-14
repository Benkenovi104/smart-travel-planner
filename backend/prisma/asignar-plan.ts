/**
 * Asigna un plan a mano, sin pasar por Mercado Pago. Sirve para desarrollar,
 * probar y hacer demos de cada plan, y para dar planes de cortesía.
 *
 *   npm run plan:asignar -- <email> <GRATIS|MEDIO|ILIMITADO>
 *
 * El plan asignado no vence (`vigente_hasta` queda en null). Pasar a GRATIS da de
 * baja las suscripciones asignadas a mano.
 *
 * **Nunca toca una suscripción cobrada por Mercado Pago:** si la diera de baja
 * acá, Mercado Pago le seguiría cobrando al usuario. Esa se cancela desde la app.
 */
import { PrismaClient } from '../generated/prisma/client.js';
import { EstadoSuscripcion, Plan } from '../generated/prisma/enums.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const PLANES = Object.values(Plan);
const CON_ACCESO: EstadoSuscripcion[] = [
  EstadoSuscripcion.ACTIVA,
  EstadoSuscripcion.EN_GRACIA,
  EstadoSuscripcion.CANCELADA,
];

async function main() {
  const [email, planArg] = process.argv.slice(2);
  const plan = planArg?.toUpperCase() as Plan;

  if (!email || !PLANES.includes(plan)) {
    console.error(
      'Uso: npm run plan:asignar -- <email> <GRATIS|MEDIO|ILIMITADO>',
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id_usuario: true },
    });
    if (!usuario) {
      console.error(`No existe un usuario con el email ${email}.`);
      process.exitCode = 1;
      return;
    }
    const { id_usuario } = usuario;

    const cobradas = await prisma.suscripcion.findMany({
      where: {
        id_usuario,
        mp_preapproval_id: { not: null },
        estado: { in: [EstadoSuscripcion.ACTIVA, EstadoSuscripcion.EN_GRACIA] },
      },
      select: { id_suscripcion: true, plan: true },
    });
    if (cobradas.length > 0) {
      const detalle = cobradas
        .map((s) => `#${s.id_suscripcion} (${s.plan})`)
        .join(', ');
      console.error(
        `${email} tiene una suscripción cobrada por Mercado Pago: ${detalle}. ` +
          'Cancelala desde la app antes de asignar un plan a mano.',
      );
      process.exitCode = 1;
      return;
    }

    const ahora = new Date();
    await prisma.$transaction(async (tx) => {
      // Dar de baja lo asignado a mano antes, para no dejar dos planes superpuestos.
      await tx.suscripcion.updateMany({
        where: { id_usuario, mp_preapproval_id: null, estado: { in: CON_ACCESO } },
        data: { estado: EstadoSuscripcion.VENCIDA, vigente_hasta: ahora },
      });

      if (plan !== Plan.GRATIS) {
        await tx.suscripcion.create({
          data: {
            id_usuario,
            plan,
            estado: EstadoSuscripcion.ACTIVA,
            dia_ancla: ahora,
            vigente_desde: ahora,
            vigente_hasta: null,
          },
        });
      }
    });

    console.log(
      plan === Plan.GRATIS
        ? `${email} quedó en el plan GRATIS.`
        : `${email} quedó en el plan ${plan} (asignado a mano, sin vencimiento).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
