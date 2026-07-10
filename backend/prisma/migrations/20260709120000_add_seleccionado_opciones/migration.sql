-- Marca la opción de vuelo / alojamiento elegida por el usuario para un viaje.
-- Es la que el cálculo de presupuesto suma a monto_vuelos / monto_alojamiento.
ALTER TABLE "opciones_vuelo"
  ADD COLUMN "seleccionado" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "opciones_alojamiento"
  ADD COLUMN "seleccionado" BOOLEAN NOT NULL DEFAULT false;
