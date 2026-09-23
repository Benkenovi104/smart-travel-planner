import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import {
  formatFecha,
  formatMoney,
  formatHora,
  diasEntre,
} from '@/lib/format';
import type {
  Viaje,
  Itinerario,
  Presupuesto,
  OpcionVuelo,
  OpcionAlojamiento,
} from '@/lib/types/models';

// react-pdf no usa el CSS de la app: hay que redefinir todo. Se mantiene la
// paleta (sky-600 de acento, slates para el texto) para que el PDF se vea de la
// misma familia que la pantalla, pero en claro, que es lo que se imprime bien.
const AZUL = '#0284c7';
const TINTA = '#0f172a';
const GRIS = '#64748b';
const LINEA = '#e2e8f0';

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    color: TINTA,
    fontFamily: 'Helvetica',
  },
  h1: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  subtitulo: { fontSize: 11, color: GRIS, marginTop: 4 },
  seccion: { marginTop: 18 },
  h2: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: AZUL,
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
    paddingBottom: 4,
    marginBottom: 10,
  },
  fila: { flexDirection: 'row' },
  datos: { flexDirection: 'row', flexWrap: 'wrap' },
  dato: { width: '25%', marginBottom: 8 },
  etiqueta: { fontSize: 8, color: GRIS, textTransform: 'uppercase' },
  valor: { fontSize: 10, marginTop: 2 },
  // 200pt es lo que deja entrar el presupuesto en la misma página sin partirlo.
  mapa: { width: '100%', height: 200, objectFit: 'cover', borderRadius: 4 },
  tramo: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINEA,
    borderRadius: 4,
    padding: 10,
  },
  tramoTitulo: { fontSize: 9, color: GRIS, textTransform: 'uppercase' },
  aerolinea: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  linea: { fontSize: 9, color: GRIS, marginTop: 2 },
  dia: { marginBottom: 14 },
  diaTitulo: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f1f5f9',
    padding: 5,
    borderRadius: 3,
  },
  actividad: {
    flexDirection: 'row',
    marginTop: 6,
    paddingLeft: 6,
  },
  hora: { width: 68, fontSize: 9, color: GRIS },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: LINEA,
    marginTop: 4,
    paddingTop: 6,
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  vacio: { fontSize: 9, color: GRIS, fontStyle: 'italic' },
  pie: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: GRIS,
  },
});

export interface DatosResumen {
  viaje: Viaje;
  itinerario?: Itinerario | null;
  presupuesto?: Presupuesto | null;
  vuelo?: OpcionVuelo | null;
  alojamiento?: OpcionAlojamiento | null;
  mapaPNG?: string | null;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.dato}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

function Tramo({
  titulo,
  aerolinea,
  salida,
  llegada,
  escalas,
  precio,
}: {
  titulo: string;
  aerolinea: string | null;
  salida: string | null;
  llegada: string | null;
  escalas: number | null;
  precio: number | null;
}) {
  return (
    <View style={s.tramo}>
      <Text style={s.tramoTitulo}>{titulo}</Text>
      <Text style={s.aerolinea}>{aerolinea ?? 'Sin aerolínea'}</Text>
      <Text style={s.linea}>Sale: {formatFecha(salida)}</Text>
      <Text style={s.linea}>Llega: {formatFecha(llegada)}</Text>
      <Text style={s.linea}>
        {escalas === 0 ? 'Directo' : `${escalas ?? '?'} escala(s)`}
        {precio != null ? ` · ${formatMoney(precio)}` : ''}
      </Text>
    </View>
  );
}

export function ResumenPDF({
  viaje,
  itinerario,
  presupuesto,
  vuelo,
  alojamiento,
  mapaPNG,
}: DatosResumen) {
  const noches = diasEntre(viaje.fechaInicio, viaje.fechaFin);
  const dias = itinerario?.dias ?? [];

  return (
    <Document
      title={`Viaje a ${viaje.destinoPrincipal}`}
      author="Smart Travel Planner"
    >
      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.h1}>{viaje.destinoPrincipal}</Text>
          <Text style={s.subtitulo}>
            Desde {viaje.origen} · {formatFecha(viaje.fechaInicio)} al{' '}
            {formatFecha(viaje.fechaFin)}
          </Text>
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>El viaje</Text>
          <View style={s.datos}>
            <Dato etiqueta="Duración" valor={`${noches ?? '?'} noches`} />
            <Dato
              etiqueta="Viajeros"
              valor={`${viaje.cantidadPersonas ?? 1}`}
            />
            <Dato etiqueta="Estado" valor={viaje.estado ?? '—'} />
            <Dato
              etiqueta="Presupuesto"
              valor={formatMoney(viaje.presupuestoTotal)}
            />
          </View>
          {viaje.intereses.length > 0 && (
            <Text style={s.linea}>
              Intereses: {viaje.intereses.map((i) => i.nombre).join(', ')}
            </Text>
          )}
        </View>

        {mapaPNG && (
          <View style={s.seccion}>
            <Text style={s.h2}>Mapa</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el Image de react-pdf no acepta alt */}
            <Image style={s.mapa} src={mapaPNG} />
          </View>
        )}

        <View style={s.seccion}>
          <Text style={s.h2}>Vuelos</Text>
          {vuelo ? (
            <View>
              <View style={[s.fila, { gap: 10 }]}>
                <Tramo
                  titulo="Ida"
                  aerolinea={vuelo.ida.aerolinea ?? vuelo.aerolinea}
                  salida={vuelo.ida.salida ?? vuelo.fechaSalida}
                  llegada={vuelo.ida.llegada}
                  escalas={vuelo.ida.escalas}
                  precio={vuelo.ida.precio}
                />
                {vuelo.vuelta && (
                  <Tramo
                    titulo="Vuelta"
                    aerolinea={vuelo.vuelta.aerolinea}
                    salida={vuelo.vuelta.salida ?? vuelo.fechaRegreso}
                    llegada={vuelo.vuelta.llegada}
                    escalas={vuelo.vuelta.escalas}
                    precio={vuelo.vuelta.precio}
                  />
                )}
              </View>
              <Text style={[s.linea, { marginTop: 6 }]}>
                Total ida y vuelta para el grupo: {formatMoney(vuelo.precio)}
              </Text>
            </View>
          ) : (
            <Text style={s.vacio}>No hay vuelo seleccionado.</Text>
          )}
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Alojamiento</Text>
          {alojamiento ? (
            <View>
              <Text style={s.aerolinea}>
                {alojamiento.nombre ?? 'Sin nombre'}
              </Text>
              {alojamiento.direccion && (
                <Text style={s.linea}>{alojamiento.direccion}</Text>
              )}
              <Text style={s.linea}>
                {alojamiento.precioPorNoche != null
                  ? `${formatMoney(alojamiento.precioPorNoche)} por noche`
                  : 'Tarifa a consultar'}
                {alojamiento.rating != null
                  ? ` · ${alojamiento.rating} de calificación`
                  : ''}
              </Text>
            </View>
          ) : (
            <Text style={s.vacio}>No hay alojamiento seleccionado.</Text>
          )}
        </View>

        {presupuesto && (
          // wrap={false}: la tabla es corta y partida al medio entre dos páginas
          // se vuelve ilegible.
          <View style={s.seccion} wrap={false}>
            <Text style={s.h2}>Presupuesto estimado</Text>
            {(
              [
                ['Vuelos', presupuesto.vuelos],
                ['Alojamiento', presupuesto.alojamiento],
                ['Actividades', presupuesto.actividades],
                ['Comidas', presupuesto.comidas],
                ['Transporte local', presupuesto.transporteLocal],
              ] as const
            ).map(([nombre, monto]) => (
              <View key={nombre} style={s.totalFila}>
                <Text>{nombre}</Text>
                <Text>{formatMoney(monto)}</Text>
              </View>
            ))}
            <View style={s.total}>
              <Text style={s.bold}>Total</Text>
              <Text style={s.bold}>{formatMoney(presupuesto.total)}</Text>
            </View>
          </View>
        )}

        <View style={s.pie} fixed>
          <Text>Smart Travel Planner</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>

      {dias.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.h1}>Itinerario</Text>
          <View style={s.seccion}>
            {dias.map((dia) => (
              // `wrap={false}` mantiene el día entero en una página mientras
              // entre; si no, un día largo se parte y se lee peor.
              <View key={dia.id} style={s.dia} wrap={false}>
                <Text style={s.diaTitulo}>
                  Día {dia.numeroDia} · {formatFecha(dia.fecha)}
                  {dia.costoEstimado != null
                    ? ` · ${formatMoney(dia.costoEstimado)}`
                    : ''}
                </Text>
                {dia.actividades.length === 0 ? (
                  <Text style={[s.vacio, { marginTop: 6, paddingLeft: 6 }]}>
                    Sin actividades.
                  </Text>
                ) : (
                  dia.actividades.map((a) => (
                    <View key={a.id} style={s.actividad}>
                      <Text style={s.hora}>
                        {formatHora(a.horaInicio) ?? '—'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text>{a.lugar.nombre}</Text>
                        <Text style={s.linea}>
                          {[
                            a.tipo,
                            a.lugar.direccion,
                            a.costoEstimado != null
                              ? formatMoney(a.costoEstimado)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>

          <View style={s.pie} fixed>
            <Text>Smart Travel Planner</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} de ${totalPages}`
              }
            />
          </View>
        </Page>
      )}
    </Document>
  );
}
