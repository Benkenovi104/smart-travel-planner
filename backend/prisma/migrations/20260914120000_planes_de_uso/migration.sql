-- Sistema de planes de uso (ver docs/PLANES.md y docs/IMPLEMENTACION_PLANES.md, fase 1).
--
-- - `suscripciones`: plan de cada usuario vinculado a la suscripción de Mercado Pago.
--   Un usuario SIN suscripción vigente está en el plan Gratis: no se crea una fila
--   para eso, así que los usuarios existentes no necesitan migrarse.
-- - `pagos_suscripcion`: cada cobro confirmado. `mp_payment_id` es único porque
--   Mercado Pago puede mandar la misma notificación más de una vez.
-- - `consumos`: cada acción que cuenta para los límites. `id_viaje` NO tiene FK a
--   `viajes` a propósito: el borrado de viajes es físico y, si el consumo cayera en
--   cascada, crear y borrar viajes devolvería el cupo.
--
-- `usuarios.fecha_registro` pasa a ser obligatoria: es el ancla del período del plan
-- Gratis. El registro ya la completa siempre; el UPDATE cubre bases con filas viejas
-- (una local, la de otro integrante) donde el SET NOT NULL fallaría a la mitad.

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('GRATIS', 'MEDIO', 'ILIMITADO');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('PENDIENTE', 'ACTIVA', 'EN_GRACIA', 'CANCELADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoConsumo" AS ENUM ('CREAR_VIAJE', 'GENERAR_ITINERARIO', 'REGENERAR_ITINERARIO', 'BUSCAR_ALOJAMIENTO', 'BUSCAR_VUELOS', 'OPTIMIZAR_DIA');

-- Completar fechas vacías antes de volver obligatoria la columna
UPDATE "usuarios" SET "fecha_registro" = CURRENT_TIMESTAMP WHERE "fecha_registro" IS NULL;

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "fecha_registro" SET NOT NULL,
ALTER COLUMN "fecha_registro" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "suscripciones" (
    "id_suscripcion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "plan" "Plan" NOT NULL,
    "estado" "EstadoSuscripcion" NOT NULL,
    "mp_preapproval_id" VARCHAR,
    "dia_ancla" TIMESTAMP(6) NOT NULL,
    "vigente_desde" TIMESTAMP(6),
    "vigente_hasta" TIMESTAMP(6),
    "cancelada_en" TIMESTAMP(6),
    "creada_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id_suscripcion")
);

-- CreateTable
CREATE TABLE "pagos_suscripcion" (
    "id_pago" SERIAL NOT NULL,
    "id_suscripcion" INTEGER NOT NULL,
    "mp_payment_id" VARCHAR NOT NULL,
    "estado" VARCHAR NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "periodo_desde" TIMESTAMP(6) NOT NULL,
    "periodo_hasta" TIMESTAMP(6) NOT NULL,
    "creado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_suscripcion_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "consumos" (
    "id_consumo" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_viaje" INTEGER,
    "tipo" "TipoConsumo" NOT NULL,
    "creado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_pkey" PRIMARY KEY ("id_consumo")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_mp_preapproval_id_key" ON "suscripciones"("mp_preapproval_id");

-- CreateIndex
CREATE INDEX "suscripciones_id_usuario_estado_idx" ON "suscripciones"("id_usuario", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_suscripcion_mp_payment_id_key" ON "pagos_suscripcion"("mp_payment_id");

-- CreateIndex
CREATE INDEX "pagos_suscripcion_id_suscripcion_idx" ON "pagos_suscripcion"("id_suscripcion");

-- CreateIndex
CREATE INDEX "consumos_id_usuario_tipo_creado_en_idx" ON "consumos"("id_usuario", "tipo", "creado_en");

-- CreateIndex
CREATE INDEX "consumos_id_viaje_tipo_idx" ON "consumos"("id_viaje", "tipo");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_id_suscripcion_fkey" FOREIGN KEY ("id_suscripcion") REFERENCES "suscripciones"("id_suscripcion") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consumos" ADD CONSTRAINT "consumos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
