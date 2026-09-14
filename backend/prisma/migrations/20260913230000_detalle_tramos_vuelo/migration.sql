-- Antes sólo se guardaba el precio sumado y la aerolínea de la IDA, así que la UI
-- no podía explicar qué vuelo se toma de vuelta. La ida y la vuelta se cotizan en
-- dos búsquedas separadas de Sky Scrapper (son dos pasajes distintos), así que
-- cada tramo necesita su propio precio, aerolínea, duración, escalas y llegada.
ALTER TABLE "opciones_vuelo"
  ADD COLUMN "aerolinea_vuelta"     VARCHAR,
  ADD COLUMN "precio_ida"           DECIMAL(12,2),
  ADD COLUMN "precio_vuelta"        DECIMAL(12,2),
  ADD COLUMN "duracion_ida"         INTEGER,
  ADD COLUMN "duracion_vuelta"      INTEGER,
  ADD COLUMN "escalas_ida"          INTEGER,
  ADD COLUMN "escalas_vuelta"       INTEGER,
  ADD COLUMN "llegada_ida"          TIMESTAMP(6),
  ADD COLUMN "llegada_vuelta"       TIMESTAMP(6);
