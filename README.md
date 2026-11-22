# D4Tech Hub v4.0 — Super-App 21 Tools Kreator, AI & Siber Gratis

**D4Tech Hub v4.0** adalah portal *Super-App* berbasis **Node.js + Express** yang dilengkapi **PWA (Installable App)**, **Deep-Link per Tool (`?tool=<slug>`)**, **Pin Tool Favorit (⭐)**, **Alur Kerja Berantai 1-Klik**, serta **21 Tools Digital Gratis** dengan sistem *Multi-Gateway & Multi-GPU Failover*.

TikTok Resmi: **[@df4tch_](https://www.tiktok.com/@df4tch_?_r=1&_t=ZS-9Ba2kp7R5gG)**

---

## 🚀 Fitur Platform Baru di v4.0
- **📲 PWA Installable App**: Pasang **D4Tech Hub** langsung ke layar utama HP Android, iPhone, maupun PC seperti aplikasi native.
- **🔗 Deep-Link per Tool (`?tool=...`)**: Bagikan link spesifik langsung ke satu tool (misal `/?tool=emojimix`, `/?tool=8d`, `/?tool=dracin`).
- **⚡ Alur Kerja Berantai 1-Klik**:
  - *YouTube MP3* &rarr; **Studio Audio 8D / Slowed + Reverb**
  - *Studio Narator Dracin* &rarr; **Studio Audio 8D**
  - *AI Penjernih Foto HD (Remini)* &rarr; **Hapus Background / Pasfoto**
  - *Pendeteksi Judul Lagu FYP (Shazam)* &rarr; **YouTube MP3 Downloader**
- **⭐ Pin Favorit & `Ctrl + K` Quick Search**: Sematkan tool favorit ke barisan paling atas dan cari cepat lewat keyboard.

---

## ✨ Daftar Lengkap 21 Tools Gratis

### 🔥 Sosmed & Musik
1. **Reaction Saluran WhatsApp (Multi-Gateway VIP Pool)** — Kirim multi-emoji reaction ke postingan Saluran WA.
2. **YouTube ke MP3 Multi-Kualitas (`64`–`320 kbps`)** — Konversi link/pencarian lagu YouTube ke MP3 Hi-Fi.
3. **Downloader TikTok & Sosmed HD** — Unduh video TikTok tanpa watermark, slide foto, MP3, & Reels.
4. **Pendeteksi Judul Lagu FYP (AI Shazam)** — Lacak judul lagu, penyanyi, & album dari potongan audio/video TikTok.
5. **Stalker TikTok & Saluran WA** — Cek statistik lengkap akun TikTok & info pengikut Saluran WA.

### 🤖 AI & Foto HD
6. **AI Roaster & Cek Aura TikTok** — Roasting profil TikTok bergaya netizen Indonesia & ekspor Kartu Skor Aura PNG.
7. **AI Penjernih Foto HD (Remini)** — Pertajam wajah/foto buram ke HD lengkap dengan *Before/After Slider*.
8. **AI Image Generator HD** — Buat gambar/ilustrasi dari teks dalam rasio `1:1`, `9:16`, atau `16:9`.
9. **AI Hapus Background & Pasfoto** — Hapus latar foto otomatis & ganti warna Transparan / Merah / Biru Pasfoto.
10. **AI Perangkum Video YouTube, Transkrip & Thumbnail 4K** — Ringkas isi video YouTube otomatis ke Bahasa Indonesia, salin transkrip penuh, & unduh Thumbnail `MaxRes 4K`.

### 🎧 Audio & Kreator Konten
11. **Studio Audio 8D, Slowed + Reverb & Bass** — Efek audio *live* di browser + *Neon Visualizer* & ekspor `.wav` HD.
12. **Studio Narator Alur Cerita Dracin + BGM & AI TTS** — Suara narator viral khas rekap Drama China (+ musik latar otomatis), suara AI Gemini natural, & 7 bahasa MP3.
13. **Emoji Mix Kitchen & Brat Viral Maker** — Gabungkan 2 emoji pilihan menjadi 1 stiker PNG transparan resmi ala Google Emoji Kitchen + generator sampul teks Brat viral.
14. **Stiker Komentar TikTok & Fake Chat** — Gelembung komentar TikTok transparan, Quoted WA, & Chat iPhone.
15. **Struk Kasir Estetik & Kartu Lirik Lagu** — Generator *Receiptify* ber-barcode & *Spotify Lyrics Card*.

### 🕵️ Siber, Dokumen & Game
16. **Kompresor Foto Target KB & Konverter Format** — Perkecil ukuran foto tepat di bawah batas syarat pendaftaran (`<100KB / <200KB / <500KB`) & konversi `JPG / WebP / PNG` (100% lokal).
17. **Gabung Multi-Foto ke PDF Dokumen** — Satukan foto tugas, KTP, atau berkas lamaran menjadi satu file PDF A4 rapi langsung di perangkatmu tanpa upload server.
18. **Kalkulator Target Winrate (WR) Mobile Legends** — Hitung jumlah kemenangan beruntun (*win streak*) menuju target WR impian.
19. **Detektif Username OSINT (16 Platform)** — Pindai keberadaan username serentak di 16 platform populer.
20. **Pixel Vault (Steganografi Foto)** — Sembunyikan & enkripsi pesan rahasia di dalam piksel gambar PNG.
21. **Scanner Link Anti-Phishing, Shortlink & QR Logo** — Bongkar *redirect* link mencurigakan + lacak GeoIP server, buat *shortlink*, & QR Code ber-logo tengah.

---

## 🛠️ Cara Menjalankan & Deploy

```bash
npm install
npm start
```
Aplikasi berjalan di `http://0.0.0.0:3000` dan siap di-deploy ke **Vercel**, **Render**, **Railway**, atau **Docker**.

---

## ⚙️ Konfigurasi Lingkungan (opsional — app jalan normal tanpa ini)

Salin `.env.example` menjadi `.env` (lokal) atau isi di dashboard Vercel/Render.

| Variabel | Fungsi |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Persistensi eksternal (Upstash Redis REST). Tanpa ini data disimpan ke file (`data/db.json`, ephemeral di Vercel). |
| `REDIS_KEY` | Kunci Redis (default `d4tech:db:v1`). |
| `SENTRY_DSN` | Error monitoring backend (+ beacon `/api/client-error` dari frontend). Tanpa DSN: no-op. |
| `SENTRY_ENVIRONMENT` / `SENTRY_TRACES_SAMPLE_RATE` | Environment Sentry & sample rate tracing (default `0`). |
| `APP_URL` | URL publik (canonical + `sitemap.xml`). Default: deteksi dari host request. |
| `POOL_HEALTH_TTL_MS` | TTL cache dashboard status pool (default 30000). |

### Endpoint operasional baru
- `GET /api/health` — JSON liveness/readiness: uptime, versi, status DB (redis/file + latency), ringkasan pool gateway, status Sentry. `200` bila aplikasi+DB sehat, `503` bila tidak.
- `GET /api/health/pool[?refresh=1]` — detail 4 gateway pool gratis (cache 30 dtk, single-flight). Dipakai halaman **Status Server** (`/?tool=status`).
- `POST /api/client-error` — beacon error frontend → Sentry/log server.
- `GET /sitemap.xml` & `GET /robots.txt` — SEO; `<title>`/meta/JSON-LD di-inject server per `?tool=<slug>`.

### Perubahan arsitektur v4.3
- **Persistensi Redis (opsional)**: `src/store.js` kini in-memory + write-through async ke Redis/file; `store.ensureLoaded()` di-await middleware `/api/*` (aman untuk cold start serverless). Mutasi route menunggu `store.flush()` sebelum merespons.
- **Lazy-load per tool**: bundle `extraToolsClient.js` (~97 KB, 15 tool) hanya diunduh saat tool terkait dibuka; shell inti (`app.js` + `tools.js` dengan `defer`) muat lebih dulu.
- **SEO per tool**: 21 slug + alias; SPA fallback menyuntik `<title>`, description/OG/Twitter meta, canonical, dan JSON-LD `WebApplication`.
