# Penambah Followers Saluran WhatsApp

Modul ke-22 D4Tech Hub. Melanjutkan modul *Reaction Saluran WhatsApp* (pool API gratis)
ke arah penambahan pengikut saluran.

> **Prinsip modul ini: tidak ada angka palsu.** Setiap jalur benar-benar menekan tombol
> **Ikuti** dari akun WhatsApp asli. Jumlah pengikut dibaca ulang dari halaman publik
> WhatsApp sebelum & sesudah order, sehingga kenaikan bisa dibuktikan (atau jujur
> dinyatakan belum terbaca).

---

## 1. Hasil riset API gratis (diverifikasi, bukan asumsi)

| Jalur | Jenis | Biaya | Endpoint / cara pakai | Status verifikasi |
| --- | --- | --- | --- | --- |
| **WAHA** (WhatsApp HTTP API) | Open source, self-hosted | Rp 0 | `POST /api/{session}/channels/{invite}/follow` | Endpoint ada di source `src/api/channels.controller.ts` (repo `devlikeapro/waha`) |
| **Followdeh** | SMM panel ber-API | Kredit gratis (1 kredit / 30 menit, maks 30/bulan) | `POST https://www.followdeh.com/api/v1` → `action=services/add/status/balance` | Dokumentasi resmi `/en/api/docs`; paket "Free WhatsApp Channel Members" ada di halaman free service |
| **SMM.ist** | SMM panel | Free trial channel members | `POST https://smm.ist/api/v2` → API v2 standar | Dokumentasi resmi `/api` (termasuk `action=add`, `status`, `balance`) |
| **Panel kustom** | API v2 / api_id | Sesuai panel Anda | URL + API key diisi sendiri | Format standar PerfectPanel `key/action/service/link/quantity` |
| **Quantaps free form** | Form manual | Rp 0 | 1–25 followers per permintaan, tanpa API key | Halaman resmi free service; **tidak ada API publik**, jadi app hanya menyiapkan tautan & jumlah |

### Catatan penting hasil riset

1. **WhatsApp tidak menyediakan API resmi untuk Channels** — halaman resmi Meta
   menyatakan Channels tidak punya API otomasi. Semua otomasi di sini memakai
   protokol WhatsApp Web (WAHA/Baileys) atau panel pihak ketiga.
2. **Tidak ada "node WAHA publik" gratis** yang bisa dipakai bebas tanpa menautkan
   nomor. WAHA bersifat *self-hosted*; karena itu modul ini menyediakan penautan
   nomor lewat **QR / pairing code** langsung dari halaman modul.
3. Panel "gratis" umunya memberi **kredit/trial**, bukan follower tanpa batas.
   Modul ini menampilkan status kredit secara jujur.
4. Follow dari satu nomor yang terlalu agresif berisiko dibatasi WhatsApp. Gunakan
   jumlah kecil (10–50) dan beri jeda.

---

## 2. Arsitektur

```
public/index.html#view-followers        UI modul (form, bukti, konfigurasi, riwayat)
public/followersClient.js               Logika klien (vanilla JS, tanpa dependensi)
src/followerPool.js                     Parser link, probe publik, relay WAHA, adapter SMM,
                                        failover otomatis, riwayat order, health-check
server.js  (/api/followers/*)           Endpoint REST
src/store.js                            followerOrders + followerConfig di data/db.json
```

### Alur eksekusi

```
link saluran ──► parseChannelLink()  ──► probePublicChannel()   (angka SEBELUM)
                       │
                       ▼
              pilih jalur (auto / manual)
        ┌──────────────┴───────────────┐
        ▼                              ▼
   WAHA follow                    SMM panel order
 POST …/channels/{invite}/follow  action=add (service dicari otomatis)
        │                              │
        └──────────────┬───────────────┘
                       ▼
          probePublicChannel(force)  (angka SESUDAH)
                       ▼
        delta = sesudah − sebelum  →  verified = delta > 0
                       ▼
              simpan order + riwayat
```

### Pemilihan layanan panel otomatis

`scoreService()` memberi skor pada katalog layanan:

- `+3` bila nama/kategori memuat `channel`
- `+2` bila memuat `follower|member|pengikut|subscriber`
- `−3` bila memuat `reaction|poll|view|group` (agar tidak salah beli)
- hanya layanan WhatsApp (`serviceFilter`) yang dipertimbangkan

Layanan dengan skor tertinggi dan tarif termurah dipilih, lalu jumlah order
di-clamp ke `min`/`max` layanan tersebut.

---

## 3. API

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/followers/channels` | Daftar jalur + status kesiapan (tanpa membocorkan key) |
| POST | `/api/followers/config` | Simpan URL/API key WAHA, Followdeh, SMM.ist, panel kustom |
| GET | `/api/followers/health?force=1` | Health-check paralel semua jalur |
| POST | `/api/followers/inspect` | Validasi tautan + baca nama & jumlah pengikut publik |
| POST | `/api/followers/order` | Jalankan penambahan followers (auto-failover) |
| GET | `/api/followers/orders` | Riwayat order |
| DELETE | `/api/followers/orders` | Bersihkan riwayat |
| POST | `/api/followers/orders/:id/refresh` | Cek ulang bukti + status panel |
| GET | `/api/followers/waha/status` | Status sesi WAHA |
| POST | `/api/followers/waha/connect` | Buat/nyalakan sesi + QR atau pairing code |

Contoh:

```bash
curl -X POST http://localhost:3000/api/followers/order \
  -H 'Content-Type: application/json' \
  -d '{"link":"https://whatsapp.com/channel/0029Va…","quantity":20,"channelId":"auto"}'
```

Respons memuat `order.proof` (`before`, `after`, `delta`), `notes` yang menjelaskan
hasil secara jujur, dan `attempts` berisi jalur yang dicoba.

---

## 4. Konfigurasi

Disimpan di `data/db.json` (server-side, bukan peramban). API key **tidak pernah**
dikirim balik ke klien; UI hanya menampilkan versi ter-mask (`TES••••456`).

### WAHA mandiri (jalur gratis tanpa batas)

```bash
docker run -it --rm \
  -p 3000:3000 \
  -e WHATSAPP_DEFAULT_ENGINE=GOWS \
  -e WAHA_API_KEY=rahasiaanda \
  --name waha \
  devlikeapro/waha
```

1. Isi **Base URL** WAHA (mis. `http://IP-VPS:3000`) + API key di modul.
2. Tekan **Tautkan Nomor**.
   - Isi **Nomor WhatsApp untuk pairing** → dapat kode 8 digit → masukkan di
     WhatsApp → Perangkat Tertaut → *Tautkan dengan nomor telepon*.
   - Atau kosongkan nomor → pindai QR yang muncul.
3. Setelah status `WORKING`, jalankan order.

Variabel lingkungan yang didukung: `WAHA_BASE_URL`, `WAHA_SESSION`, `WAHA_API_KEY`,
`WAHA_PAIRING_PHONE`, `FOLLOWDEH_API_KEY`, `SMM_IST_API_KEY`, `SMM_API_URL`,
`SMM_API_KEY`, `SMM_API_ID`, `SMM_SECRET_KEY`.

### Followdeh / SMM.ist

Buat akun gratis → ambil API key di dashboard → tempel di **Konfigurasi**.
Modul akan mencari layanan WhatsApp Channel Followers secara otomatis.

---

## 5. Batasan yang perlu diketahui

- Halaman publik WhatsApp (og:description) bisa saja tidak memuat angka pengikut
  untuk sebagian saluran; pada kasus itu `delta` bernilai `null` dan UI menyatakan
  bahwa kenaikan belum bisa dibuktikan otomatis.
- Hitungan pengikut WhatsApp diperbarui bertahap; gunakan **Cek ulang** setelah
  beberapa menit.
- Serverless (Vercel) tidak menyimpan `data/db.json` secara permanen — gunakan
  Render/Docker/VPS untuk riwayat & konfigurasi persisten.
- Modul ini tidak meminta password, OTP WhatsApp, maupun akses admin saluran.
  Hanya tautan saluran publik.
