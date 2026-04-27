import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

export interface ActividadIA {
  nombre_lugar: string;
  ciudad: string;
  pais: string;
  categoria: string;
  tipo_actividad: string;
  hora_inicio: string;
  hora_fin: string;
  costo_estimado: number;
  duracion_minutos: number;
  descripcion: string;
}

export interface DiaIA {
  numero_dia: number;
  fecha: string;
  costo_estimado_dia: number;
  actividades: ActividadIA[];
}

export interface ItinerarioIA {
  dias: DiaIA[];
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async generarItinerario(params: {
    origen: string;
    destino: string;
    fecha_inicio: string;
    fecha_fin: string;
    cantidad_personas: number;
    presupuesto_total: number;
    intereses: string[];
    tipo_viajero?: string;
    ritmo_preferido?: string;
  }): Promise<ItinerarioIA> {
    const duracionDias = this.calcularDias(params.fecha_inicio, params.fecha_fin);

    const prompt = `Eres un experto planificador de viajes. Genera un itinerario detallado para el siguiente viaje.

DATOS DEL VIAJE:
- Origen: ${params.origen}
- Destino: ${params.destino}
- Fechas: del ${params.fecha_inicio} al ${params.fecha_fin} (${duracionDias} días)
- Personas: ${params.cantidad_personas}
- Presupuesto total: USD ${params.presupuesto_total}
- Intereses: ${params.intereses.length > 0 ? params.intereses.join(', ') : 'general'}
${params.tipo_viajero ? `- Tipo de viajero: ${params.tipo_viajero}` : ''}
${params.ritmo_preferido ? `- Ritmo preferido: ${params.ritmo_preferido}` : ''}

INSTRUCCIONES:
- Genera exactamente ${duracionDias} días de actividades
- Incluye 3-5 actividades por día
- Las actividades deben ser reales y existentes en ${params.destino}
- Considera el presupuesto total (USD ${params.presupuesto_total} para ${params.cantidad_personas} personas)
- Adapta el itinerario a los intereses indicados
- Incluye horarios realistas (considera tiempos de traslado)
- Incluye una mezcla de actividades: cultura, gastronomía, actividades principales

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta, sin texto adicional:
{
  "dias": [
    {
      "numero_dia": 1,
      "fecha": "YYYY-MM-DD",
      "costo_estimado_dia": 150,
      "actividades": [
        {
          "nombre_lugar": "Nombre del lugar",
          "ciudad": "Ciudad",
          "pais": "País",
          "categoria": "museo|restaurante|parque|monumento|hotel|transporte|otro",
          "tipo_actividad": "visita|comida|transporte|alojamiento|entretenimiento",
          "hora_inicio": "09:00",
          "hora_fin": "11:00",
          "costo_estimado": 20,
          "duracion_minutos": 120,
          "descripcion": "Descripción breve de la actividad"
        }
      ]
    }
  ]
}`;

    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Respuesta vacía de Gemini');

      return JSON.parse(text) as ItinerarioIA;
    } catch (error) {
      this.logger.error('Error al generar itinerario con Gemini', error);
      throw new InternalServerErrorException('No se pudo generar el itinerario. Intenta nuevamente.');
    }
  }

  private calcularDias(fechaInicio: string, fechaFin: string): number {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diff = fin.getTime() - inicio.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }
}
