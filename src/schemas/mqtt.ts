import { z } from 'zod'

// Payload MQTT (sama dengan backend, lihat PRD 3.5)
export const telemetrySchema = z.object({
  soil_moisture: z.number().min(0).max(100),
  temperature: z.number().min(-50).max(80),
  humidity: z.number().min(0).max(100),
  ts: z.number().int().positive(),
})

export const pumpStatusSchema = z.object({
  pump_status: z.enum(['ON', 'OFF']),
  ts: z.number().int().positive(),
  request_id: z.string().optional(),
})

export const deviceStatusSchema = z.object({
  online: z.boolean(),
})
