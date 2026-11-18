import { z } from 'zod'

// Semua nilai punya default localhost agar dev & build tetap jalan tanpa .env;
// produksi wajib diisi via .env (lihat .env.example).
const envSchema = z.object({
  VITE_API_URL: z.string().default('http://localhost:4000'),
  VITE_MQTT_URL: z.string().default('ws://localhost:9001'),
  VITE_MQTT_USERNAME: z.string().default('viewer'),
  VITE_MQTT_PASSWORD: z.string().default(''),
  VITE_MQTT_TOPIC_PREFIX: z.string().default('plant'),
  VITE_DEVICE_ID: z.string().default('plant-001'),
})

const parsed = envSchema.safeParse(import.meta.env)
if (!parsed.success) {
  console.error('Konfigurasi environment tidak valid:', parsed.error.issues)
  throw new Error('Konfigurasi environment tidak valid — cek .env')
}

export const env = parsed.data
