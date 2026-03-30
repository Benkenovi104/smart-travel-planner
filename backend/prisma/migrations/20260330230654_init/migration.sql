-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR,
    "apellido" VARCHAR,
    "email" VARCHAR NOT NULL,
    "password_hash" VARCHAR NOT NULL,
    "fecha_registro" TIMESTAMP(6),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "perfil_viajero" (
    "id_perfil" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "ritmo_preferido" VARCHAR,
    "presupuesto_preferido" VARCHAR,
    "tipo_viajero" VARCHAR,

    CONSTRAINT "perfil_viajero_pkey" PRIMARY KEY ("id_perfil")
);

-- CreateTable
CREATE TABLE "intereses" (
    "id_interes" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,

    CONSTRAINT "intereses_pkey" PRIMARY KEY ("id_interes")
);

-- CreateTable
CREATE TABLE "usuario_intereses" (
    "id_usuario" INTEGER NOT NULL,
    "id_interes" INTEGER NOT NULL,
    "prioridad" INTEGER,

    CONSTRAINT "usuario_intereses_pkey" PRIMARY KEY ("id_usuario","id_interes")
);

-- CreateTable
CREATE TABLE "viajes" (
    "id_viaje" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "origen" VARCHAR NOT NULL,
    "destino_principal" VARCHAR NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "cantidad_personas" INTEGER,
    "presupuesto_total" DECIMAL(12,2),
    "estado" VARCHAR,
    "fecha_creacion" TIMESTAMP(6),

    CONSTRAINT "viajes_pkey" PRIMARY KEY ("id_viaje")
);

-- CreateTable
CREATE TABLE "viaje_intereses" (
    "id_viaje" INTEGER NOT NULL,
    "id_interes" INTEGER NOT NULL,
    "prioridad" INTEGER,

    CONSTRAINT "viaje_intereses_pkey" PRIMARY KEY ("id_viaje","id_interes")
);

-- CreateTable
CREATE TABLE "itinerarios" (
    "id_itinerario" SERIAL NOT NULL,
    "id_viaje" INTEGER NOT NULL,
    "fecha_generacion" TIMESTAMP(6),
    "tipo_generacion" VARCHAR,

    CONSTRAINT "itinerarios_pkey" PRIMARY KEY ("id_itinerario")
);

-- CreateTable
CREATE TABLE "dias_itinerario" (
    "id_dia_itinerario" SERIAL NOT NULL,
    "id_itinerario" INTEGER NOT NULL,
    "numero_dia" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "costo_estimado_dia" DECIMAL(12,2),

    CONSTRAINT "dias_itinerario_pkey" PRIMARY KEY ("id_dia_itinerario")
);

-- CreateTable
CREATE TABLE "lugares" (
    "id_lugar" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "ciudad" VARCHAR,
    "pais" VARCHAR,
    "direccion" VARCHAR,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "categoria" VARCHAR,
    "rating" DECIMAL(3,2),
    "precio_estimado" DECIMAL(12,2),
    "duracion_estimada_min" INTEGER,
    "horario_apertura" TIME(6),
    "horario_cierre" TIME(6),
    "fuente_api" VARCHAR,

    CONSTRAINT "lugares_pkey" PRIMARY KEY ("id_lugar")
);

-- CreateTable
CREATE TABLE "actividades_itinerario" (
    "id_actividad" SERIAL NOT NULL,
    "id_dia_itinerario" INTEGER NOT NULL,
    "id_lugar" INTEGER NOT NULL,
    "orden" INTEGER,
    "hora_inicio_estimada" TIME(6),
    "hora_fin_estimada" TIME(6),
    "tipo_actividad" VARCHAR,
    "costo_estimado" DECIMAL(12,2),
    "estado" VARCHAR,

    CONSTRAINT "actividades_itinerario_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id_presupuesto" SERIAL NOT NULL,
    "id_viaje" INTEGER NOT NULL,
    "monto_total" DECIMAL(12,2),
    "monto_vuelos" DECIMAL(12,2),
    "monto_alojamiento" DECIMAL(12,2),
    "monto_actividades" DECIMAL(12,2),
    "monto_comidas" DECIMAL(12,2),
    "monto_transporte_local" DECIMAL(12,2),

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id_presupuesto")
);

-- CreateTable
CREATE TABLE "gastos_estimados" (
    "id_gasto" SERIAL NOT NULL,
    "id_viaje" INTEGER NOT NULL,
    "categoria" VARCHAR,
    "descripcion" VARCHAR,
    "monto_estimado" DECIMAL(12,2),

    CONSTRAINT "gastos_estimados_pkey" PRIMARY KEY ("id_gasto")
);

-- CreateTable
CREATE TABLE "opciones_vuelo" (
    "id_vuelo" SERIAL NOT NULL,
    "id_viaje" INTEGER NOT NULL,
    "origen" VARCHAR,
    "destino" VARCHAR,
    "fecha_salida" TIMESTAMP(6),
    "fecha_regreso" TIMESTAMP(6),
    "aerolinea" VARCHAR,
    "precio" DECIMAL(12,2),
    "moneda" VARCHAR,
    "duracion_total" INTEGER,
    "url_referencia" VARCHAR,

    CONSTRAINT "opciones_vuelo_pkey" PRIMARY KEY ("id_vuelo")
);

-- CreateTable
CREATE TABLE "opciones_alojamiento" (
    "id_alojamiento" SERIAL NOT NULL,
    "id_viaje" INTEGER NOT NULL,
    "nombre" VARCHAR,
    "tipo" VARCHAR,
    "direccion" VARCHAR,
    "precio_por_noche" DECIMAL(12,2),
    "rating" DECIMAL(3,2),
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "url_referencia" VARCHAR,

    CONSTRAINT "opciones_alojamiento_pkey" PRIMARY KEY ("id_alojamiento")
);

-- CreateTable
CREATE TABLE "cambios_itinerario" (
    "id_cambio" SERIAL NOT NULL,
    "id_itinerario" INTEGER NOT NULL,
    "tipo_cambio" VARCHAR,
    "descripcion" VARCHAR,
    "fecha_cambio" TIMESTAMP(6),

    CONSTRAINT "cambios_itinerario_pkey" PRIMARY KEY ("id_cambio")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_viajero_id_usuario_key" ON "perfil_viajero"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "intereses_nombre_key" ON "intereses"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "itinerarios_id_viaje_key" ON "itinerarios"("id_viaje");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_id_viaje_key" ON "presupuestos"("id_viaje");

-- AddForeignKey
ALTER TABLE "perfil_viajero" ADD CONSTRAINT "perfil_viajero_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_intereses" ADD CONSTRAINT "usuario_intereses_id_interes_fkey" FOREIGN KEY ("id_interes") REFERENCES "intereses"("id_interes") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_intereses" ADD CONSTRAINT "usuario_intereses_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "viaje_intereses" ADD CONSTRAINT "viaje_intereses_id_interes_fkey" FOREIGN KEY ("id_interes") REFERENCES "intereses"("id_interes") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "viaje_intereses" ADD CONSTRAINT "viaje_intereses_id_viaje_fkey" FOREIGN KEY ("id_viaje") REFERENCES "viajes"("id_viaje") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "itinerarios" ADD CONSTRAINT "itinerarios_id_viaje_fkey" FOREIGN KEY ("id_viaje") REFERENCES "viajes"("id_viaje") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dias_itinerario" ADD CONSTRAINT "dias_itinerario_id_itinerario_fkey" FOREIGN KEY ("id_itinerario") REFERENCES "itinerarios"("id_itinerario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "actividades_itinerario" ADD CONSTRAINT "actividades_itinerario_id_dia_itinerario_fkey" FOREIGN KEY ("id_dia_itinerario") REFERENCES "dias_itinerario"("id_dia_itinerario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "actividades_itinerario" ADD CONSTRAINT "actividades_itinerario_id_lugar_fkey" FOREIGN KEY ("id_lugar") REFERENCES "lugares"("id_lugar") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_id_viaje_fkey" FOREIGN KEY ("id_viaje") REFERENCES "viajes"("id_viaje") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gastos_estimados" ADD CONSTRAINT "gastos_estimados_id_viaje_fkey" FOREIGN KEY ("id_viaje") REFERENCES "viajes"("id_viaje") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "opciones_vuelo" ADD CONSTRAINT "opciones_vuelo_id_viaje_fkey" FOREIGN KEY ("id_viaje") REFERENCES "viajes"("id_viaje") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "opciones_alojamiento" ADD CONSTRAINT "opciones_alojamiento_id_viaje_fkey" FOREIGN KEY ("id_viaje") REFERENCES "viajes"("id_viaje") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cambios_itinerario" ADD CONSTRAINT "cambios_itinerario_id_itinerario_fkey" FOREIGN KEY ("id_itinerario") REFERENCES "itinerarios"("id_itinerario") ON DELETE NO ACTION ON UPDATE NO ACTION;
