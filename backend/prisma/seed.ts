import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const intereses = [
  'Arte y museos',
  'Gastronomía',
  'Aventura y deportes extremos',
  'Naturaleza y ecoturismo',
  'Historia y arqueología',
  'Playa y relax',
  'Vida nocturna',
  'Compras',
  'Arquitectura',
  'Fotografía',
  'Deportes',
  'Música y festivales',
  'Bienestar y spa',
  'Senderismo y trekking',
  'Cultura local',
  'Parques temáticos',
  'Turismo rural',
  'Cruceros',
  'Turismo de lujo',
  'Voluntariado',
];

async function main() {
  console.log('Sembrando intereses...');

  for (const nombre of intereses) {
    await prisma.interes.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  console.log(`✓ ${intereses.length} intereses insertados/verificados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
