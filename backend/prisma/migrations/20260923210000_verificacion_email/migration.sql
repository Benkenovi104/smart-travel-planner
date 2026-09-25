-- Verificación del email al registrarse.
--
-- `email_verificado` arranca en `false` para las altas nuevas, pero las cuentas
-- que ya existen se marcan verificadas en la misma migración: la regla es para
-- adelante. Sin ese UPDATE, los 65 usuarios de la base (y las cuentas de prueba
-- que están en uso) quedarían encerrados sin haber hecho nada.
--
-- El código viaja hasheado, igual que el de reseteo: si se filtra la base, un
-- hash no sirve para verificar la cuenta de otro.

ALTER TABLE "usuarios"
  ADD COLUMN "email_verificado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verif_token_hash" VARCHAR,
  ADD COLUMN "verif_token_expira" TIMESTAMP(6);

UPDATE "usuarios" SET "email_verificado" = true;
