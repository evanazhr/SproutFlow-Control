# PRD Frontend: Smart Plant Watering Dashboard (v1.1)

> Dokumen ini selaras dengan `PRD-backend.md`. Bagian **3. Kontrak Bersama** identik di kedua dokumen; jika ada perubahan, ubah di keduanya.

## 1. Ringkasan

Aplikasi web untuk memantau kondisi tanaman secara real-time dan mengontrol pompa penyiram otomatis.

- **Monitoring** (semua user login): `soil_moisture`, `temperature`, `humidity`, `pump_status`, plus riwayat.
- **Kontrol pompa** (hanya `admin`): dikirim ke backend lewat REST; backend yang mem-publish ke MQTT.

**Di luar cakupan v1:** manajemen role lewat UI (admin diatur manual di database), notifikasi push, multi-perangkat di UI (data model sudah siap), firmware.

## 2. Tech Stack

| Kebutuhan | Pilihan |
|---|---|
| Framework & routing | TanStack Start (atau Vite) + TanStack Router |
| Data fetching & cache | TanStack Query |
| Tabel riwayat | TanStack Table |
| Form (settings) | TanStack Form + Zod |
| Auth client | Better Auth client (`better-auth/react`) |
| MQTT (subscribe only) | `mqtt` (mqtt.js) via WebSocket |
| UI & chart | Tailwind + shadcn/ui + Recharts |

## 3. Kontrak Bersama (Frontend ↔ Backend)

### 3.1 Konvensi API
- Base URL: `VITE_API_URL` (contoh `https://api.domain.com`). Semua endpoint aplikasi berawalan `/api`.
- Auth memakai **httpOnly cookie** dari Better Auth. Semua request frontend memakai `credentials: 'include'`.
- Format sukses: `{ "data": ..., "meta": { ... } }` (`meta` hanya untuk pagination).
- Format error: `{ "error": { "code": "FORBIDDEN", "message": "..." } }`.
- Kode error: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).
- Waktu memakai **ISO 8601 UTC** di REST (`2026-11-16T10:00:00Z`); payload MQTT memakai `ts` unix detik.

### 3.2 Role
Hanya dua role: `user` dan `admin`. Disimpan di kolom `user.role` (default `user`), diubah manual di database. Role dikirim ke frontend lewat objek session.

| Fitur | `user` | `admin` |
|---|---|---|
| Dashboard monitoring | ✅ | ✅ |
| `/history` | ✅ | ✅ |
| Kontrol pompa | ❌ | ✅ |
| `/settings` (lihat & ubah) | ❌ | ✅ |

### 3.3 Autentikasi (Better Auth, Google OAuth)
- Handler Better Auth dipasang di backend pada `/api/auth/*`.
- Login: `authClient.signIn.social({ provider: "google", callbackURL: FRONTEND_URL + "/dashboard" })`.
- Session: `authClient.getSession()` / `useSession()` mengembalikan `user: { id, name, email, image, role }`.
- Logout: `authClient.signOut()`.

### 3.4 Endpoint REST

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/health` | publik | Cek layanan hidup |
| GET | `/api/devices` | login | Daftar perangkat |
| GET | `/api/devices/:id` | login | Detail + pembacaan terakhir + status pompa |
| GET | `/api/devices/:id/readings` | login | Riwayat sensor |
| GET | `/api/devices/:id/pump-logs` | login | Riwayat perintah/aktivitas pompa |
| POST | `/api/devices/:id/pump` | **admin** | Kirim perintah pompa |
| GET | `/api/devices/:id/settings` | **admin** | Ambil pengaturan |
| PUT | `/api/devices/:id/settings` | **admin** | Ubah pengaturan |

**`GET /api/devices/:id`**
```json
{
  "data": {
    "id": "plant-001",
    "name": "Tanaman Teras",
    "online": true,
    "latest": { "soil_moisture": 42, "temperature": 29.5, "humidity": 70, "recorded_at": "2026-11-16T10:00:00Z" },
    "pump_status": "OFF"
  }
}
```

**`GET /api/devices/:id/readings`** — query: `from`, `to` (ISO), `interval` (`raw` | `5m` | `1h`, default `raw`), `page`, `limit` (default 50, maks 200).
```json
{
  "data": [{ "soil_moisture": 42, "temperature": 29.5, "humidity": 70, "recorded_at": "2026-11-16T10:00:00Z" }],
  "meta": { "page": 1, "limit": 50, "total": 1200 }
}
```

**`GET /api/devices/:id/pump-logs`** — query: `from`, `to`, `page`, `limit`.
```json
{
  "data": [{
    "id": "uuid", "command": "ON", "status": "confirmed",
    "triggered_by": { "type": "user", "id": "u1", "name": "Evan" },
    "created_at": "2026-11-16T10:00:00Z", "confirmed_at": "2026-11-16T10:00:02Z"
  }],
  "meta": { "page": 1, "limit": 50, "total": 20 }
}
```
`status`: `sent` | `confirmed` | `timeout`. `triggered_by.type`: `user` | `auto`.

**`POST /api/devices/:id/pump`**
```json
// request
{ "command": "ON" }   // "ON" | "OFF"
// response 202
{ "data": { "request_id": "uuid", "command": "ON", "status": "sent" } }
```
`202` artinya perintah sudah diteruskan ke MQTT, **bukan** pompa sudah menyala. Konfirmasi datang lewat topic `pump/status`.

**`PUT /api/devices/:id/settings`**
```json
{ "moisture_threshold": 35 }
```

### 3.5 MQTT
Topic memakai prefix `plant` (`MQTT_TOPIC_PREFIX`). Topic dan payload ini **asumsi**; sesuaikan dengan firmware lalu ubah di kedua dokumen.

| Topic | Publisher | Subscriber | QoS | Retain |
|---|---|---|---|---|
| `plant/{device_id}/telemetry` | perangkat | frontend, backend | 0 | tidak |
| `plant/{device_id}/pump/status` | perangkat | frontend, backend | 1 | **ya** |
| `plant/{device_id}/pump/set` | backend | perangkat | 1 | tidak |
| `plant/{device_id}/status` (opsional, LWT) | perangkat | frontend, backend | 1 | ya |

Payload:
```json
// telemetry
{ "soil_moisture": 42, "temperature": 29.5, "humidity": 70, "ts": 1731700000 }
// pump/status
{ "pump_status": "ON", "ts": 1731700002 }
// pump/set (backend -> perangkat)
{ "command": "ON", "request_id": "uuid" }
// status (LWT)
{ "online": true }
```
- `soil_moisture` dan `humidity`: persen (0–100). `temperature`: °C.
- `pump_status` nilai `ON` | `OFF`. Perangkat sebaiknya menyertakan kembali `request_id` pada `pump/status` jika merespons perintah tertentu (opsional).
- Akun MQTT frontend: **subscribe only** (ACL broker). Hanya backend yang boleh publish ke `pump/set`.

### 3.6 Alur Kontrol Pompa
```
Admin klik toggle → POST /api/devices/:id/pump → backend cek role → publish pump/set
Perangkat menjalankan pompa → publish pump/status (retained) → frontend & backend menerima
Backend menandai pump_logs.status = confirmed; frontend mengubah badge pump_status
Jika tidak ada konfirmasi dalam 10 detik → pump_logs.status = timeout
```

## 4. Autentikasi di Frontend
- Route guard memakai `beforeLoad` TanStack Router: tanpa session → redirect `/login`; non-admin ke route admin → redirect `/dashboard`.
- Hook `useAuth()` membungkus `useSession()` dan mengekspos `user`, `isAdmin`, `isPending`.
- `401` → redirect `/login`; `403` → toast "Anda tidak memiliki izin".
- Logout: `signOut()`, putuskan koneksi MQTT, `queryClient.clear()`.
- Pengecekan role di UI hanya untuk pengalaman pengguna; otorisasi sebenarnya di backend.

## 5. Halaman

### `/login`
Tombol "Login dengan Google", state loading, pesan error jika callback gagal.

### `/dashboard`
- Kartu **soil_moisture** (gauge %, warna sesuai ambang kering/ideal/basah), **temperature** (°C), **humidity** (%), **pump_status** (badge ON/OFF).
- Data awal dari `GET /api/devices/:id` (agar tidak kosong sebelum pesan MQTT pertama), lalu diperbarui real-time dari MQTT.
- Chart tren 3 sensor (1 jam / 24 jam / 7 hari) dari `/readings` (`interval` menyesuaikan rentang).
- Indikator koneksi MQTT (Connected / Reconnecting / Disconnected) dan "terakhir diperbarui".
- Tanda **Offline** jika tidak ada telemetry > 30 detik atau `status.online = false`.
- **Panel kontrol pompa:**
  - `admin`: toggle ON/OFF, dialog konfirmasi, state *pending* setelah `202` sampai `pump_status` berubah; jika 10 detik tanpa konfirmasi → toast error "Perangkat tidak merespons".
  - `user`: panel *read-only* dengan keterangan "Hanya admin yang dapat mengontrol pompa".

### `/history`
Tabel (TanStack Table) dengan dua tab: **Sensor** (`/readings`) dan **Aktivitas Pompa** (`/pump-logs`). Pagination server-side, filter tanggal. Dapat diakses semua user login.

### `/settings` (admin only)
Form ambang batas `moisture_threshold` (0–100) via TanStack Form + Zod, simpan dengan `PUT /api/devices/:id/settings`.

## 6. Integrasi MQTT di Frontend
- Satu koneksi singleton (provider), auto-reconnect dengan backoff, dibuat setelah login dan ditutup saat logout.
- Subscribe `telemetry`, `pump/status`, dan `status` untuk `VITE_DEVICE_ID`.
- Setiap pesan divalidasi dengan Zod, lalu ditulis ke TanStack Query cache (`setQueryData`) pada key perangkat agar sinkron dengan data REST.
- Pesan tidak valid diabaikan dan dicatat di console (dev).

## 7. Environment Variables

```env
# URL backend Express.js
VITE_API_URL=http://localhost:4000

# URL MQTT broker via WebSocket
VITE_MQTT_URL=ws://localhost:9001      # produksi: wss://...
VITE_MQTT_USERNAME=viewer              # akun read-only
VITE_MQTT_PASSWORD=
VITE_MQTT_TOPIC_PREFIX=plant           # harus sama dengan backend
VITE_DEVICE_ID=plant-001
```
Semua `VITE_*` terlihat di browser, jadi jangan simpan secret di sini. Sediakan `.env.example` dan validasi env saat startup dengan Zod (`src/env.ts`).

## 8. Struktur Folder
```
src/
├── routes/        # login, dashboard, history, settings
├── components/    # SensorCard, MoistureGauge, PumpToggle, RoleGate, ConnectionBadge
├── hooks/         # useAuth, useMqttTelemetry, usePumpControl, useDevice
├── lib/           # auth-client.ts, api.ts, mqtt.ts, queryClient.ts
├── schemas/       # Zod: payload MQTT & respons API
└── env.ts
```

## 9. Non-Fungsional
- Responsif (mobile-first).
- Update real-time tampil < 1 detik setelah pesan MQTT diterima.
- Loading skeleton, empty state, dan error state di semua data.
- Aksesibilitas dasar (kontras, label ARIA pada toggle).

## 10. Kriteria Penerimaan
- [ ] Hanya user yang login Google yang dapat mengakses aplikasi.
- [ ] Empat data (`soil_moisture`, `temperature`, `humidity`, `pump_status`) tampil dan ter-update real-time.
- [ ] Data awal dashboard muncul sebelum pesan MQTT pertama.
- [ ] `user` hanya dapat melihat data dan riwayat; panel kontrol read-only.
- [ ] `admin` dapat mengirim perintah pompa; UI berubah setelah konfirmasi `pump_status`, atau menampilkan error setelah 10 detik.
- [ ] Request admin oleh non-admin menghasilkan `403` dan toast yang sesuai.
- [ ] Kredensial MQTT frontend tidak punya izin publish.
- [ ] URL API dan MQTT hanya dibaca dari `.env`.
- [ ] Logout memutus sesi dan koneksi MQTT.

## 11. Dependensi pada Backend
Endpoint di 3.4, handler Better Auth di `/api/auth/*`, field `role` pada session, CORS dengan `credentials: true` untuk origin frontend, dan penyimpanan data sensor/log pompa. Lihat `PRD-backend.md`.

## 12. Pertanyaan Terbuka
1. Format topic dan payload MQTT final dari firmware?
2. Mode **auto** dijalankan di perangkat atau backend? (v1 mengasumsikan hanya ambang batas disimpan; eksekusi auto belum dispesifikasikan.)
3. Frontend dan backend akan di domain yang sama induknya (mis. `app.` dan `api.`) agar cookie aman?
