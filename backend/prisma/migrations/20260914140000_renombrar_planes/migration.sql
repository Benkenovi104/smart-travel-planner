-- Los planes pagos pasan a llamarse Base y Premium (antes Medio e Ilimitado).
--
-- RENAME VALUE cambia la etiqueta del enum sin tocar las filas: las suscripciones
-- que estaban en MEDIO o ILIMITADO quedan en BASE o PREMIUM automáticamente, sin
-- UPDATE. Es reversible renombrando al revés.
ALTER TYPE "Plan" RENAME VALUE 'MEDIO' TO 'BASE';
ALTER TYPE "Plan" RENAME VALUE 'ILIMITADO' TO 'PREMIUM';
