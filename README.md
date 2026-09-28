# AI Chat — Omnichannel CRM SaaS

Platform SaaS omnichannel CRM untuk menyatukan **WhatsApp Business API,
WhatsApp unofficial (OneSender & StarSender), Instagram DM, Facebook Messenger, AI chatbot, multi-agent inbox, CRM contact,
broadcast, template message, API, webhook, dan n8n integration** dalam satu
dashboard.

> **Status: Part 12** — Lengkap dari Part 1–11 plus **Super Admin
> Dashboard**: role platform `SUPER_ADMIN` (flag pada user, terpisah dari
> MemberRole), overview platform (workspace/user/messages/channel/revenue),
> kelola user/workspace/subscription/channel/invoice, suspend workspace
> (ditegakkan di middleware), impersonate placeholder + audit log, abuse
> report management, serta webhook & system/error log viewer. Semua aksi
> admin tercatat ke `admin_audit_logs`; token channel tidak pernah
> ditampilkan.

---

## 🧱 Tech Stack

| Layer        | Teknologi |
|--------------|-----------|
| Frontend     | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Motion.dev, Lucide, TanStack Query, Zustand, Recharts |
| Backend API  | Golang, Echo, PostgreSQL (pgx), Redis, JWT, go-playground/validator |
| Worker       | Golang, Redis-backed job queue |
| Database     | PostgreSQL 16 · SQLC (typed query codegen) |
| Infra lokal  | Docker Compose (Postgres, Redis, MinIO opsional) |

## 📂 Struktur Monorepo

```
aichat-omni/
├── apps/
│   ├── web/        → Next.js frontend
│   ├── api/        → Golang backend API (REST + JWT)
│   └── worker/     → Golang background worker (job queue)
├── packages/
│   └── shared/     → Tipe TypeScript bersama
├── docker-compose.yml
└── package.json    → pnpm workspace root
```

## ✅ Prasyarat

- **Node.js** ≥ 20 dan **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Go** ≥ 1.23
- **Docker** + Docker Compose (untuk Postgres & Redis lokal)
- Opsional: [`golang-migrate`](https://github.com/golang-migrate/migrate) &
  [`sqlc`](https://sqlc.dev) CLI

---

## 🚀 Menjalankan Project Secara Lokal

### 1. Clone & install dependency frontend

```bash
pnpm install
```

### 2. Jalankan infrastruktur (PostgreSQL + Redis)

```bash
docker compose up -d postgres redis
```

> Database: `aichat` · user/pass: `aichat` / `aichat` · port `5432`
> Redis pada port `6379`.

### 3. Siapkan environment file

```bash
# Backend API
cp apps/api/.env.example apps/api/.env

# Worker
cp apps/worker/.env.example apps/worker/.env

# Frontend
cp apps/web/.env.example apps/web/.env.local
```

### 4. Jalankan database migration

**Opsi A — pakai `psql` langsung** (jalankan berurutan):

```bash
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000001_init.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000002_workspaces.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000003_inbox.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000004_crm.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000005_whatsapp.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000006_templates.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000007_broadcasts.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000008_ai.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000009_developer_api.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000010_billing.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000011_admin.up.sql
psql "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  -f apps/api/migrations/000012_wa_gateways.up.sql
```

> Migration `000010` juga **men-seed 3 paket harga** (FREE/BASIC/LITE)
> secara idempotent — jadi katalog langsung tersedia setelah migrate.
> `go run ./cmd/seed` mempromosikan `owner@demo.aichat.id` menjadi
> **SUPER_ADMIN** sehingga panel `/admin` langsung bisa diakses.

**Opsi B — pakai `golang-migrate`:**

```bash
migrate -path apps/api/migrations \
  -database "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" up
```

### 5. Seed user demo

```bash
cd apps/api
go mod tidy          # sekali saja, untuk mengunduh dependency
go run ./cmd/seed
```

### 6. Jalankan Backend API

```bash
cd apps/api
go run ./cmd/api
# → API listening on :8080
```

### 7. Jalankan Worker (terminal terpisah)

```bash
cd apps/worker
go mod tidy
go run ./cmd/worker
```

### 8. Jalankan Frontend (terminal terpisah)

```bash
pnpm dev:web
# → http://localhost:3000
```

Buka **http://localhost:3000** — Anda akan diarahkan ke halaman login.

---

## 👤 Akun Demo

Setelah `go run ./cmd/seed`, gunakan akun berikut. Password **semua** akun:
`Password123!`

Seed Part 2 membuat satu **Demo Workspace** berisi keempat akun di bawah
sebagai member, plus 3 channel contoh (WhatsApp/Instagram/Messenger).

| Role di workspace | Email                    |
|-------------------|--------------------------|
| OWNER             | `owner@demo.aichat.id`   |
| ADMIN             | `admin@demo.aichat.id`   |
| AGENT             | `agent@demo.aichat.id`   |
| VIEWER            | `viewer@demo.aichat.id`  |

> Halaman login sudah terisi otomatis dengan akun OWNER untuk kemudahan demo.

---

## 🔌 API Endpoints

| Method | Endpoint                                   | Min role | Keterangan |
|--------|--------------------------------------------|----------|------------|
| GET    | `/health`                                  | —        | Health check |
| POST   | `/api/v1/auth/register`                    | —        | Buat user + workspace pertama |
| POST   | `/api/v1/auth/login`                       | —        | Login |
| POST   | `/api/v1/auth/refresh`                     | —        | Rotasi refresh token |
| POST   | `/api/v1/auth/logout`                      | auth     | Revoke refresh token |
| GET    | `/api/v1/auth/me`                          | auth     | Profil user |
| POST   | `/api/v1/workspaces`                       | auth     | Buat workspace baru |
| GET    | `/api/v1/workspaces`                       | auth     | Workspace milik user |
| GET    | `/api/v1/workspaces/:id`                   | VIEWER   | Detail workspace |
| PATCH  | `/api/v1/workspaces/:id`                   | ADMIN    | Update branding |
| DELETE | `/api/v1/workspaces/:id`                   | OWNER    | Hapus workspace |
| GET    | `/api/v1/workspaces/:id/overview`          | VIEWER   | Metrik dashboard |
| GET    | `/api/v1/workspaces/:id/members`           | VIEWER   | Anggota + undangan |
| POST   | `/api/v1/workspaces/:id/invite`            | ADMIN    | Undang anggota via email |
| DELETE | `/api/v1/workspaces/:id/members/:memberId` | ADMIN    | Hapus anggota |
| GET    | `/api/v1/workspaces/:id/channels`          | VIEWER   | Daftar channel |
| POST   | `/api/v1/workspaces/:id/channels`          | ADMIN    | Tambah channel |
| PATCH  | `/api/v1/channels/:id`                     | ADMIN    | Update channel |
| DELETE | `/api/v1/channels/:id`                     | ADMIN    | Hapus channel |
| GET    | `/api/v1/workspaces/:id/conversations`     | AGENT    | Daftar percakapan inbox |
| GET    | `/api/v1/conversations/:id`                | AGENT    | Detail percakapan + kontak + tag |
| PATCH  | `/api/v1/conversations/:id/status`         | AGENT    | Ubah status (open/pending/resolved/spam) |
| PATCH  | `/api/v1/conversations/:id/assign`         | AGENT    | Assign / unassign agent |
| GET    | `/api/v1/conversations/:id/messages`       | AGENT    | List pesan + reset unread |
| POST   | `/api/v1/conversations/:id/messages`       | AGENT    | Kirim pesan outbound |
| GET    | `/api/v1/conversations/:id/notes`          | AGENT    | List catatan internal |
| POST   | `/api/v1/conversations/:id/notes`          | AGENT    | Tambah catatan internal |
| GET    | `/ws?workspace_id=…&token=…`               | AGENT    | WebSocket realtime inbox |
| GET    | `/api/v1/workspaces/:id/contacts`          | VIEWER   | List kontak (search, channel, tag, created_after, limit, offset) |
| POST   | `/api/v1/workspaces/:id/contacts`          | AGENT    | Tambah kontak |
| GET    | `/api/v1/workspaces/:id/contacts/duplicates` | AGENT  | Deteksi duplikat phone/email |
| POST   | `/api/v1/workspaces/:id/contacts/import`   | AGENT    | Import CSV (multipart `file`) |
| GET    | `/api/v1/workspaces/:id/contacts/export`   | VIEWER   | Export CSV |
| GET    | `/api/v1/contacts/:id`                     | VIEWER   | Detail kontak + tag + timeline |
| PATCH  | `/api/v1/contacts/:id`                     | AGENT    | Update kontak |
| DELETE | `/api/v1/contacts/:id`                     | AGENT    | Hapus kontak |
| POST   | `/api/v1/contacts/:id/tags`                | AGENT    | Lampirkan tag |
| DELETE | `/api/v1/contacts/:id/tags/:tagId`         | AGENT    | Lepas tag |
| POST   | `/api/v1/contacts/:id/merge`               | ADMIN    | Merge ke kontak lain |
| GET/POST/DELETE | `/api/v1/workspaces/:id/tags[/:tagId]`     | AGENT | Tag CRUD |
| GET/POST/DELETE | `/api/v1/workspaces/:id/segments[/:segmentId]` | mixed | Segment + rules |
| GET    | `/api/webhooks/whatsapp`                   | (public) | Meta verify handshake (`hub.verify_token`) |
| POST   | `/api/webhooks/whatsapp`                   | (public) | Meta inbound + status callbacks (HMAC-SHA256) |
| GET    | `/api/v1/workspaces/:id/channels/whatsapp` | VIEWER   | Webhook URL + setup info |
| POST   | `/api/v1/workspaces/:id/channels/whatsapp/connect` | ADMIN | Hubungkan / rotasi credential WhatsApp |
| POST   | `/api/v1/channels/whatsapp/send`           | (auth)   | Kirim pesan WhatsApp eksplisit |
| GET    | `/api/webhooks/instagram`                  | (public) | Instagram verify handshake |
| POST   | `/api/webhooks/instagram`                  | (public) | Instagram inbound + delivery (HMAC) |
| GET    | `/api/v1/workspaces/:id/channels/instagram` | VIEWER  | Webhook URL + setup info |
| POST   | `/api/v1/workspaces/:id/channels/instagram/connect` | ADMIN | Connect Instagram Business Account |
| POST   | `/api/v1/channels/instagram/send`          | (auth)   | Kirim DM Instagram eksplisit |
| GET    | `/api/webhooks/messenger`                  | (public) | Messenger verify handshake |
| POST   | `/api/webhooks/messenger`                  | (public) | Messenger inbound + delivery (HMAC) |
| GET    | `/api/v1/workspaces/:id/channels/messenger` | VIEWER  | Webhook URL + setup info |
| POST   | `/api/v1/workspaces/:id/channels/messenger/connect` | ADMIN | Connect Facebook Page |
| POST   | `/api/v1/channels/messenger/send`          | (auth)   | Kirim Messenger eksplisit |
| GET/POST | `/api/v1/workspaces/:id/quick-replies`              | VIEWER/AGENT | List + create quick reply |
| PATCH/DELETE | `/api/v1/workspaces/:id/quick-replies/:replyId` | AGENT | Edit / hapus quick reply |
| GET/POST | `/api/v1/workspaces/:id/templates`                  | VIEWER/AGENT | List + create template |
| GET/PATCH/DELETE | `/api/v1/workspaces/:id/templates/:templateId` | VIEWER/AGENT | View / edit / hapus template |
| POST   | `/api/v1/workspaces/:id/templates/:templateId/submit` | ADMIN | Submit ke Meta (placeholder) |
| POST   | `/api/v1/workspaces/:id/templates/:templateId/use`    | AGENT | Render body + log usage |
| GET/POST | `/api/v1/workspaces/:id/interactive-messages`       | VIEWER/AGENT | List + create interactive |
| GET/PATCH/DELETE | `/api/v1/workspaces/:id/interactive-messages/:interactiveId` | mixed | Detail / edit / hapus |
| GET/POST | `/api/v1/workspaces/:id/broadcasts` | VIEWER/ADMIN | List + create campaign |
| GET    | `/api/v1/workspaces/:id/broadcasts/:campaignId` | VIEWER | Detail + recipients + logs |
| POST   | `/api/v1/workspaces/:id/broadcasts/:campaignId/schedule` | ADMIN | Schedule / launch sekarang |
| POST   | `/api/v1/workspaces/:id/broadcasts/:campaignId/cancel`   | ADMIN | Cancel campaign |
| GET    | `/api/v1/workspaces/:id/ai-agent`          | VIEWER   | Konfigurasi agent AI (lazy-create default) |
| PATCH  | `/api/v1/workspaces/:id/ai-agent`          | ADMIN    | Update agent — selalu reset `prompt_approved=false` |
| POST   | `/api/v1/workspaces/:id/ai-agent/approve`  | ADMIN    | Setujui system prompt saat ini (bot bisa membalas) |
| POST   | `/api/v1/workspaces/:id/ai-agent/reject`   | ADMIN    | Tolak prompt (bot tetap diam) |
| GET    | `/api/v1/workspaces/:id/ai-agent/reviews`  | VIEWER   | Riwayat review prompt |
| GET    | `/api/v1/workspaces/:id/knowledge`         | VIEWER   | List dokumen knowledge base |
| POST   | `/api/v1/workspaces/:id/knowledge`         | ADMIN    | Artikel manual atau URL (JSON `content`) |
| POST   | `/api/v1/workspaces/:id/knowledge/upload`  | ADMIN    | Upload .txt/.md/.pdf (multipart `file`, maks 5MB) |
| GET    | `/api/v1/workspaces/:id/knowledge/search`  | AGENT    | Cari chunk berdasarkan query (debug RAG) |
| DELETE | `/api/v1/workspaces/:id/knowledge/:docId`  | ADMIN    | Hapus dokumen + chunk |
| POST   | `/api/v1/workspaces/:id/ai/playground`     | AGENT    | Uji prompt + RAG tanpa mengirim apapun |
| GET    | `/api/v1/workspaces/:id/ai/logs`           | ADMIN    | 100 bot reply log terakhir |
| GET    | `/api/v1/workspaces/:id/api-keys`          | ADMIN    | Daftar API key (hash, prefix saja) |
| POST   | `/api/v1/workspaces/:id/api-keys`          | ADMIN    | Buat API key (plaintext sekali) |
| GET    | `/api/v1/workspaces/:id/api-keys/usage`    | ADMIN    | Log penggunaan Public API |
| DELETE | `/api/v1/api-keys/:id`                      | ADMIN    | Cabut (revoke) API key |
| GET    | `/api/v1/workspaces/:id/webhook-endpoints` | ADMIN    | Daftar webhook endpoint |
| POST   | `/api/v1/workspaces/:id/webhook-endpoints` | ADMIN    | Buat webhook endpoint (+ secret) |
| PATCH  | `/api/v1/webhook-endpoints/:id`            | ADMIN    | Edit endpoint |
| DELETE | `/api/v1/webhook-endpoints/:id`            | ADMIN    | Hapus endpoint |
| POST   | `/api/v1/webhook-endpoints/:id/rotate-secret` | ADMIN | Rotasi HMAC secret |
| POST   | `/api/v1/webhook-endpoints/:id/test`       | ADMIN    | Kirim payload test |
| GET    | `/api/v1/webhook-endpoints/:id/deliveries` | VIEWER   | Log pengiriman webhook |
| GET    | `/api/v1/webhook-events`                   | auth     | Katalog event yang tersedia |
| POST   | `/api/v1/public/messages/send`             | API key  | Kirim pesan teks |
| POST   | `/api/v1/public/messages/template`         | API key  | Kirim pesan dari template |
| GET    | `/api/v1/public/contacts`                  | API key  | Daftar kontak |
| POST   | `/api/v1/public/contacts`                  | API key  | Buat kontak |
| GET    | `/api/v1/public/conversations`             | API key  | Daftar percakapan |
| GET    | `/api/v1/public/conversations/:id/messages`| API key  | Daftar pesan percakapan |
| GET    | `/api/v1/plans`                            | (public) | Katalog paket harga |
| GET    | `/api/v1/workspaces/:id/billing`           | VIEWER   | Subscription + plan aktif |
| POST   | `/api/v1/workspaces/:id/billing/change-plan` | OWNER  | Ganti paket (dummy + Midtrans placeholder) |
| GET    | `/api/v1/workspaces/:id/usage`             | VIEWER   | Usage vs limit paket |
| GET    | `/api/v1/workspaces/:id/invoices`          | ADMIN    | Riwayat invoice |
| GET    | `/api/v1/admin/overview`                   | SUPER_ADMIN | Statistik platform |
| GET    | `/api/v1/admin/users`                      | SUPER_ADMIN | Semua user (search) |
| GET    | `/api/v1/admin/workspaces`                 | SUPER_ADMIN | Semua workspace |
| GET    | `/api/v1/admin/subscriptions`              | SUPER_ADMIN | Semua subscription |
| GET    | `/api/v1/admin/channels`                   | SUPER_ADMIN | Semua channel (tanpa token) |
| GET    | `/api/v1/admin/logs`                       | SUPER_ADMIN | System log (`?type=webhook` untuk webhook) |
| GET    | `/api/v1/admin/audit-logs`                 | SUPER_ADMIN | Audit trail admin |
| GET    | `/api/v1/admin/reports`                    | SUPER_ADMIN | Abuse report |
| POST   | `/api/v1/admin/workspaces/:id/suspend`     | SUPER_ADMIN | Suspend / aktifkan workspace |
| POST   | `/api/v1/admin/reports/:id/resolve`        | SUPER_ADMIN | Resolve / dismiss laporan |
| POST   | `/api/v1/admin/users/:id/impersonate`      | SUPER_ADMIN | Impersonate (placeholder + audit) |

Autentikasi memakai **JWT access token** (15 menit) + **refresh token** opaque
(7 hari, ter-hash di database). Setiap route workspace-scoped melewati
middleware yang memverifikasi keanggotaan + role pada `workspace_members`
(isolasi tenant). Credential channel dienkripsi **AES-256-GCM** saat disimpan
dan tidak pernah dikembalikan dalam bentuk asli.

## 🗄️ SQLC

`apps/api/sqlc.yaml` + `apps/api/sql/` sudah disiapkan. Untuk meng-generate
kode query typed:

```bash
cd apps/api
sqlc generate     # output → internal/db/
```

> Pada Part 1 layer repository menggunakan `pgx` langsung agar project bisa
> langsung dijalankan tanpa codegen. SQL pada `sql/queries/` adalah sumber
> kebenaran yang sama dan siap dipakai begitu Anda mengadopsi output sqlc.

---

## 🧪 Testing & CI

```bash
# Unit test (tanpa infrastruktur)
cd apps/api    && go test ./...
cd apps/worker && go test ./...

# Integration test (butuh Postgres yang sudah di-migrate + Redis)
cd apps/api && \
  TEST_DATABASE_URL="postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable" \
  TEST_REDIS_URL="redis://localhost:6379/15" \
  go test ./...

# Frontend
pnpm --filter web lint && pnpm --filter web exec tsc --noEmit
```

GitHub Actions (`.github/workflows/ci.yml`) menjalankan semua langkah di
atas (termasuk integration test dengan service Postgres + Redis) pada
setiap push ke `main` dan setiap pull request.

## 🔒 Hardening Keamanan

- **Isolasi tenant** — guard workspace (`RequireWorkspaceRole`,
  `RequireChannelRole`, `RequireWebhookRole`, …) menghentikan request
  sepenuhnya saat akses ditolak; handler tidak pernah dijalankan untuk
  non-member, role yang kurang, atau workspace yang ditangguhkan.
- **Workspace suspended** dibekukan di semua pintu masuk: dashboard (JWT),
  Public API (API key), dan WebSocket.
- **Validasi konfigurasi produksi** — dengan `APP_ENV=production` API
  menolak start bila `JWT_SECRET` / `CHANNEL_ENCRYPTION_KEY` masih default
  atau < 32 karakter, `WHATSAPP_APP_SECRET` / `META_APP_SECRET` kosong
  (signature webhook Meta tidak terverifikasi), atau `INBOX_DEMO_ECHO=true`.
- **Proteksi SSRF webhook** — URL webhook ke localhost, jaringan privat,
  atau metadata cloud ditolak saat disimpan dan diblokir saat pengiriman
  (dicek setelah resolusi DNS, termasuk redirect). Aktif default di
  produksi; atur `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` hanya untuk dev
  (mis. n8n lokal).
- **Brute-force login** — rate limit per IP untuk login/register dan
  lockout sementara per email setelah `LOGIN_MAX_FAILURES` gagal login
  (`429` + header `Retry-After`). Waktu respons login tidak membocorkan
  apakah email terdaftar.
- **Rotasi refresh token atomik** — satu refresh token hanya bisa ditukar
  sekali, bahkan untuk request yang bersamaan.
- **HTTP** — batas ukuran body (`MAX_BODY_SIZE`), security header
  (`nosniff`, `X-Frame-Options`), `ReadHeaderTimeout` anti-slowloris, dan
  `X-Forwarded-For` hanya dipercaya dari proxy di jaringan privat/loopback.
  Jika ada CDN/load balancer ber-IP publik di depan API (mis. Cloudflare),
  daftarkan rentang IP-nya di `TRUSTED_PROXIES` agar rate limit melihat IP
  klien yang sebenarnya.

## 🌐 Deployment ke VPS (ringkasan)

Target: Ubuntu 22.04/24.04 + Nginx + Certbot + systemd.

1. **Build artefak**
   ```bash
   # API & worker
   cd apps/api    && go build -o bin/api ./cmd/api
   cd apps/worker && go build -o bin/worker ./cmd/worker
   # Frontend
   pnpm build:web
   ```
2. **systemd** untuk `api`, `worker`, dan `web` (lihat `deploy/` di part
   berikutnya — contoh unit file).
3. **Nginx** sebagai reverse proxy: `/` → Next.js (`:3000`),
   `/api` & `/ws` → Golang API (`:8080`).
4. **Certbot** untuk SSL: `certbot --nginx -d app.domainanda.com`.
5. PostgreSQL & Redis berjalan sebagai service pada VPS yang sama atau
   terpisah.

---

## 📲 Meta WhatsApp Cloud API setup

1. **Buat Meta App** — buka https://developers.facebook.com → My Apps →
   *Create App* → pilih **Business**. Setelah app dibuat, buka tab
   *Add products* dan tambahkan **WhatsApp**.
2. **Catat ID dari Meta** — dari menu WhatsApp → *API Setup* ambil:
   - `Phone number ID`
   - `WhatsApp Business Account ID`
   - **Access token** (sementara 24 jam, atau buat *System User* dengan
     permission `whatsapp_business_messaging` + `whatsapp_business_management`
     untuk token permanen).
3. **Set webhook di Meta** — masih di tab *Configuration*:
   - Callback URL: `https://your-domain.com/api/webhooks/whatsapp`
     (untuk dev: gunakan tunnel seperti `ngrok http 8080` atau
     `cloudflared tunnel`, lalu pakai URL HTTPS yang dihasilkan).
   - Verify Token: nilai yang sama dengan `WHATSAPP_VERIFY_TOKEN` di
     `apps/api/.env`. Default dev: `dev-whatsapp-verify-token`.
   - Subscribe ke field **messages** (mencakup inbound + status callbacks).
4. **Salin App Secret** (Settings → Basic) ke `WHATSAPP_APP_SECRET` agar
   `X-Hub-Signature-256` divalidasi tiap request webhook.
5. **Connect dari aplikasi** — login → menu *Channel* → *Tambah channel* →
   pilih **WhatsApp Business**, isi 4 field di atas → *Hubungkan ke Meta*.
   Kanal akan langsung tersimpan dengan status `pending` dan flip ke
   `connected` saat webhook pertama tiba.
6. **Tes kirim/terima** — kirim pesan dari nomor pribadi Anda ke nomor
   WhatsApp Business. Pesan akan muncul di **Inbox** secara realtime
   beserta entry baru di tabel `webhook_logs` (audit). Balas dari composer
   inbox — message akan terkirim via Cloud API dengan retry otomatis pada
   kegagalan transient.

> **Production:** ganti **semua** `*_change-me` di `.env`, terminate TLS
> di Nginx (Certbot), dan pastikan `BASE_URL` mengarah ke domain HTTPS
> agar webhook URL yang ditampilkan di UI benar.

## 📱 WhatsApp Unofficial Gateway (OneSender & StarSender)

Selain WhatsApp Cloud API resmi, nomor WhatsApp biasa bisa dihubungkan
lewat gateway **unofficial** (berbasis WhatsApp Web) — tanpa verifikasi
Meta Business. Menu **Channel → Tambah channel → WA OneSender / WA
StarSender** (atau `/dashboard/channels/wa-gateway`).

| | OneSender | StarSender V3 |
|---|---|---|
| Kirim | `POST {instance}/api/v1/messages` | `POST https://api.starsender.online/api/send` |
| Auth | `Authorization: Bearer <API key>` | `Authorization: <Device API Key>` |
| Credential | URL instance + API key | Device API Key (menu Device) |

**Setup**

1. Scan QR WhatsApp di dashboard gateway sampai device online.
2. Hubungkan di AI Chat: isi API key (dan URL instance untuk OneSender).
   Nomor device opsional — dipakai sebagai label & untuk re-key channel
   yang sama.
3. Salin **Webhook URL** yang ditampilkan ke pengaturan webhook
   gateway (pesan masuk). Formatnya
   `{BASE_URL}/api/webhooks/wa-gateway/{channel_id}/{token}` — gateway
   tidak menandatangani webhook, jadi token acak 256-bit per channel di
   URL itulah autentikasinya. Token bisa diganti kapan saja (URL lama
   langsung mati).
4. Klik **Kirim pesan tes**. Status channel menjadi `connected` saat kirim
   atau webhook pertama berhasil, `error` (dengan pesan dari gateway)
   bila gagal.

**Perilaku**

- Terintegrasi penuh: Inbox (balas dari dashboard), AI auto-reply,
  broadcast (lewat worker), Public API `/public/messages/send`, event
  webhook keluar (`message.received`, `message.sent`, …).
- Kontak dibagi dengan channel WhatsApp resmi (kunci: nomor internasional),
  jadi satu pelanggan = satu kontak. Nomor lokal `08…` otomatis menjadi
  `628…`.
- Pesan grup dan pesan yang dikirim dari device sendiri (`from_me`)
  diabaikan; webhook yang dikirim ulang oleh gateway di-dedupe berdasarkan
  message id.
- Parser webhook toleran terhadap variasi nama field antar versi gateway
  (`from`/`sender`/`remoteJid`, `message`/`text`/`caption`, `file`/
  `media_url`, dll.). Payload mentah selalu tersimpan di `webhook_logs`
  untuk debugging.
- Nomor gateway dihitung ke limit paket `whatsapp_numbers` bersama nomor
  Cloud API.
- URL instance OneSender berasal dari tenant, sehingga diperlakukan seperti
  URL webhook: host privat/localhost diblokir di produksi (lihat
  `WEBHOOK_ALLOW_PRIVATE_TARGETS`).

> ⚠️ Gateway unofficial melanggar ketentuan WhatsApp; nomor dapat
> diblokir bila dipakai spam. Gunakan `rate_per_minute` broadcast yang
> rendah dan kirim hanya ke kontak yang sudah opt-in.

## 📷 Instagram + Messenger Meta App setup

Keduanya berbagi **satu Meta App** (boleh sama dengan app WhatsApp, atau
app terpisah — bebas). Yang penting App Secret-nya benar.

### Persiapan umum

1. **Meta App** — buka https://developers.facebook.com → My Apps →
   *Create App* (Business). Catat **App Secret** (Settings → Basic) ke
   `META_APP_SECRET` di `.env`.
2. **Tunnel HTTPS** untuk dev: `ngrok http 8080` lalu pakai URL HTTPS
   sebagai `BASE_URL`. Webhook Meta wajib HTTPS.

### Instagram DM

1. Akun Instagram Anda harus **Business / Creator** dan **ter-link ke
   Facebook Page**. Pengaturan: IG mobile → Settings → Account → Branded
   content / Linked accounts.
2. Tambah produk **Instagram** di Meta App → permintaan permission
   `instagram_basic`, `instagram_manage_messages`, `pages_show_list`,
   `pages_messaging`.
3. **Generate Page Access Token** untuk Facebook Page tertaut (Graph API
   Explorer → pilih app → pilih page → tambah scope di atas).
4. Ambil **Instagram Business Account ID**:
   `GET /<PAGE_ID>?fields=instagram_business_account&access_token=PAGE_TOKEN`.
5. Di Meta App → **Webhooks** → object **Instagram** → Callback URL:
   `https://your-domain.com/api/webhooks/instagram` · Verify Token:
   `INSTAGRAM_VERIFY_TOKEN` dari `.env` · subscribe field **messages**.
6. Connect dari aplikasi: menu *Channel* → klik kartu *Instagram DM*.
   Form akan otomatis pindah ke `/dashboard/channels/instagram` — isi
   IG Business ID + Page Access Token → *Hubungkan ke Meta*.

### Facebook Messenger

1. Tambah produk **Messenger** di Meta App.
2. **Add or Remove Pages** → pilih FB Page yang ingin di-handle →
   *Generate Token*. Salin **Page Access Token**.
3. Di Meta App → **Webhooks** → object **Page** → Callback URL:
   `https://your-domain.com/api/webhooks/messenger` · Verify Token:
   `MESSENGER_VERIFY_TOKEN` dari `.env` · subscribe field **messages**.
4. **Subscribe page** to webhook
   (`POST /<PAGE_ID>/subscribed_apps?access_token=PAGE_TOKEN`
   `&subscribed_fields=messages`).
5. Connect dari aplikasi: menu *Channel* → klik kartu *Messenger* →
   isi Page ID + Page Access Token → *Hubungkan Page*.

## 🛡️ Super Admin Dashboard (Part 12)

Panel platform di **`/admin`** (tema gelap, terpisah dari dashboard tenant).
Hanya dapat diakses oleh user dengan flag **`SUPER_ADMIN`** — sebuah role
*platform-level* pada `users.is_super_admin`, berbeda dari `MemberRole`
(OWNER/ADMIN/AGENT/VIEWER) yang ber-skop workspace.

### Keamanan

- **`RequireSuperAdmin`** middleware memuat user dari DB dan memvalidasi
  flag pada **setiap** request admin. Non-admin mendapat `404` (panel
  disembunyikan, bukan sekadar `403`).
- **Semua aksi admin dicatat** ke `admin_audit_logs` (actor, action, target,
  metadata, IP) — suspend, impersonate, resolve report.
- **Token channel tidak pernah** di-select/ditampilkan; admin hanya melihat
  flag `has_credentials`.
- Middleware front-end (`/admin/:path*`) memantulkan tamu ke `/login`;
  layout admin memantulkan non-super-admin ke `/dashboard`.

### Fitur

- **Overview** — total workspace, user, messages, active channel, revenue
  (sum invoice paid), suspended count, open reports, distribusi paket,
  pendaftaran terbaru.
- **Users / Workspaces / Subscriptions / Channels** — listing cross-tenant
  dengan pencarian.
- **Suspend workspace** — `suspended_at` ditegakkan di `WorkspaceMiddleware`
  (semua request workspace yang ditangguhkan → `403 workspace_suspended`).
- **Impersonate** — *placeholder* yang mengembalikan referensi non-fungsional
  + mencatat audit log (desain token berlingkup terbatas menyusul).
- **Abuse reports** — kelola status open/reviewing/resolved/dismissed.
- **Log viewer** — system/error log (`system_logs`, diisi oleh HTTP error
  handler untuk 5xx), webhook delivery log, dan audit log.

> Tabel baru: `admin_audit_logs`, `abuse_reports`, `system_logs`, plus
> `users.is_super_admin` dan `workspaces.suspended_at/suspension_reason`.

## 💳 Billing SaaS + Pricing + Plan Limits (Part 11)

### Paket

| Paket | Harga | Team | Knowledge | WA # | History | API | n8n | AI |
|-------|-------|------|-----------|------|---------|-----|-----|----|
| FREE  | Rp0/selamanya | 2 | 0 | 1 | 7 hari  | ✗ | ✗ | ✗ |
| BASIC | Rp25.000/bln  | 3 | 0 | 1 | 30 hari | ✓ | ✓ | ✗ |
| LITE  | Rp49.000/bln  | 5 | 5 | 1 | 90 hari | ✓ | ✓ | ✓ |

> Angka limit di-seed di `000010_billing.up.sql` (kolom `limits` JSONB) dan
> bebas disesuaikan tanpa perubahan skema. `-1` = unlimited, `0` = fitur
> dimatikan. Nilai team-member untuk FREE/BASIC tidak disebut eksplisit di
> spesifikasi; dipilih 2/3 sebagai default yang masuk akal.

### Subscription

Satu subscription per workspace (lazy-create FREE/active saat pertama kali
billing diakses). Status: **trial · active · past_due · cancelled**. Saat
`past_due`/`cancelled`, entitlement otomatis turun ke FREE.

### Plan-limit helper (backend)

`services.PlanGuard` mengimplementasikan `PlanEnforcer` dan disuntikkan ke
service yang relevan via `SetPlanEnforcer` (nil = tanpa billing → allow).
Titik penegakan:

- **Team member** → `MemberService.Invite` (limit kursi)
- **Knowledge document** → `KnowledgeService.Ingest` (fitur AI + limit dok)
- **AI chatbot** → `AIAgentService.Save` (gate saat mengaktifkan bot)
- **API access** → `APIKeyService.Create` (gate pembuatan key)
- **n8n integration** → `WebhookService.Create` (gate pembuatan endpoint)
- **WhatsApp number** → `WhatsAppService.Connect` (limit nomor baru)
- **Message retention** → `MessageService.List` + public API (filter pesan
  lebih lama dari window paket)

Pelanggaran limit/fitur dipetakan ke **HTTP 402 Payment Required** dengan
pesan ajakan upgrade.

### Pembayaran (Midtrans placeholder)

`internal/midtrans` adalah klien **placeholder**: `change-plan` ke paket
berbayar menghasilkan transaksi "settlement" instan + invoice berstatus
`paid`. Set `MIDTRANS_SERVER_KEY` untuk integrasi Snap asli (ganti body
`CreateTransaction`; alur billing sudah berbicara dengan interface ini).

### Usage dashboard

`GET /usage` menghitung pemakaian live (team, knowledge, WA number, pesan
dalam window, API calls 30 hari) dan menulis snapshot harian ke
`usage_records` (upsert per hari per metrik).

## 🔑 Developer API + Webhooks + n8n (Part 10)

### Public API (API-key authenticated)

Mounted under **`/api/v1/public/`** (dipisah dari route dashboard ber-JWT
agar tidak bentrok, mis. `/conversations/:id/messages`). Workspace dikenali
otomatis dari API key — tidak ada `:workspaceId` di URL.

```bash
curl -X POST http://localhost:8080/api/v1/public/messages/send \
  -H "Authorization: Bearer aic_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{ "channel_id": "<uuid>", "to": "6281234567890", "body": "Halo!" }'
```

- **Keamanan key:** hanya **SHA-256 hash** yang disimpan; plaintext
  ditampilkan **sekali** saat dibuat lalu tidak bisa dipulihkan. Prefix
  (`aic_xxxx`) disimpan untuk identifikasi di dashboard.
- **Rate limit:** fixed-window per key di Redis (default `120/menit`,
  `API_RATE_LIMIT_PER_MINUTE`). Melebihi → `429` + header `Retry-After`.
  Bila Redis tumbang, middleware **fail-open** agar API tidak ikut mati.
- **Usage log:** tiap request dicatat (method, path, status, latency, IP)
  ke `api_usage_logs` untuk feed aktivitas di dashboard.
- **Tenant isolation:** setiap resource yang diakses via id (mis.
  `conversations/:id/messages`) diverifikasi miliknya workspace key →
  `403` bila bukan.

### Webhooks (outbound)

Endpoint berlangganan satu atau lebih dari **7 event**:
`message.received`, `message.sent`, `message.delivered`,
`conversation.created`, `conversation.resolved`, `contact.created`,
`broadcast.completed`.

- **Signature:** tiap delivery ditandatangani **HMAC-SHA256** atas raw
  body, dikirim di header `X-AIChat-Signature: sha256=<hex>`. Header
  `X-AIChat-Event` + `X-AIChat-Delivery` (id unik, sama lintas retry untuk
  dedupe) juga disertakan.
- **Retry:** backoff eksponensial (2s → 10s → 30s → 2m → 10m, 5 percobaan)
  pada kegagalan jaringan / status non-2xx. Tiap percobaan dicatat ke
  `webhook_delivery_logs`.
- **Pengiriman async:** worker-pool di proses API (`WEBHOOK_WORKERS`,
  `WEBHOOK_QUEUE_SIZE`) — request bisnis tidak pernah menunggu HTTP webhook.
- **`broadcast.completed`** di-emit oleh **proses worker** (yang menandai
  campaign selesai) lewat emitter mandiri — modul terpisah, tabel sama.

Envelope yang dikirim:

```json
{
  "id": "uuid",
  "event": "message.received",
  "workspace_id": "uuid",
  "occurred_at": "2026-05-21T08:30:00Z",
  "data": { /* objek message/contact/conversation/broadcast */ }
}
```

### n8n

Menu **Developer → n8n Integration** memandu: buat node Webhook di n8n →
salin Production URL → daftarkan sebagai webhook endpoint di AI Chat →
pilih event → **Test**. Halaman menyediakan contoh payload, contoh
workflow JSON yang bisa di-import, dan snippet verifikasi signature di
Function node n8n.

## 🤖 AI Chatbot + Knowledge Base (Part 9)

### Provider

`AI_PROVIDER=mock` (default) — deterministic, no-network. Berguna untuk
demo + tes E2E tanpa API key. Embedding di-derive dari SHA-256 dari teks
sehingga retrieval tetap berfungsi.

`AI_PROVIDER=openai` — pakai OpenAI Chat Completions + Embeddings.

```bash
AI_PROVIDER=openai
AI_API_KEY=sk-...              # server-side only
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_EMBED_MODEL=text-embedding-3-small
AI_CHUNK_SIZE=800
```

> `AI_API_KEY` tidak pernah dikirim ke frontend. Backend yang menahan key
> dan melakukan semua panggilan LLM. Jika `AI_PROVIDER=openai` tapi key
> kosong, app akan fallback ke `mock` dengan warning di log startup
> (bukan crash) supaya UI tetap dapat dipakai untuk demo.

### Setup flow

1. Buka **AI Chatbot** di sidebar → atur nama, tone, language, system
   prompt, fallback, confidence threshold, dan channel mana yang
   menerima auto-reply.
2. Setiap **Save** akan mereset `prompt_approved=false`. Admin harus
   menekan **Setujui** untuk mengaktifkan bot. Audit-log ada di tab
   yang sama.
3. Buka **Knowledge Base** → unggah `.txt`/`.md`/`.pdf` (maks 5MB) atau
   tambah artikel manual / URL. Pipeline (ingest → chunk → embed →
   store) jalan synchronous; status berubah ke **Siap** saat selesai.
4. Buka **AI Playground** untuk menguji prompt + RAG. Hasil menampilkan
   confidence, model, knowledge chunks yang dipakai, dan apakah akan
   handoff. **Tidak ada side effect**: tidak menulis ke conversation,
   tidak mengirim pesan.

### Behavior pada inbound nyata

Setelah inbound (WhatsApp/IG/Messenger) tersimpan + di-broadcast WS,
`AIReplyService.MaybeReply` mengecek (semua harus lulus):

- `agent.enabled` AND `agent.prompt_approved`
- `conversation.ai_disabled = false` (di-set true otomatis saat human
  membalas → human takeover memang harus menghentikan bot)
- `conversation.assigned_agent_id = null` (belum dipegang human)
- `channel_id` ada di `enabled_channel_ids` (atau allow-list kosong)

Lalu generate jawaban via LLM + RAG. Jika confidence < threshold dan
`handoff_enabled = true`, conversation di-set ke `pending` +
`ai_disabled=true`, fallback message dikirim ke pelanggan, dan
`bot_reply_logs.handed_off=true`.

### Vector store

Implementasi default menyimpan embedding sebagai Postgres `real[]` +
melakukan cosine similarity di Go. Bekerja sangat baik untuk knowledge
base ≤ ~10k chunk per workspace. Untuk skala lebih besar, swap
`ai.VectorStore` ke implementasi pgvector tanpa menyentuh service code.

## 🧭 Roadmap

- **Part 1 ✅** — Monorepo, auth, dashboard, RBAC, seed.
- **Part 2 ✅** — Workspace CRUD + switcher + branding, manajemen tim &
  undangan, channel management dengan credential terenkripsi, isolasi tenant.
- **Part 3 ✅** — Unified Inbox realtime (WebSocket hub, 3-kolom, filter,
  search, send message, assign, internal note, status, typing, presence).
- **Part 4 ✅** — CRM Contact Management: list/filter/search, detail +
  timeline (aktivitas + pesan), CRUD, tag editor, import/export CSV,
  deteksi duplikat + merge, segment berbasis aturan.
- **Part 5 ✅** — WhatsApp Cloud API: connect, webhook verify + HMAC,
  inbound/outbound + status callbacks, media download, retry, push WS.
- **Part 6 ✅** — Instagram DM + Facebook Messenger via Meta Messenger
  Platform: connect, webhook verify + HMAC, inbound + status, send dengan
  retry, multi-deliverer dispatcher, inbox handler `message.updated`.
- **Part 7 ✅** — Templates + Quick Reply + Interactive Messages: editor
  template dengan variabel + reply buttons + live preview, submit/approve
  placeholder, use-in-inbox dengan log usage, shortcut quick-reply
  auto-expand di composer, builder reply-buttons/list/carousel.
- **Part 8 ✅** — Broadcast campaign + worker: Redis queue + Go worker
  (rate limit per channel, retry, status updates), audience all/tag/
  segment/CSV, analytics live, scheduling + cancel.
- **Part 9 ✅** — AI Chatbot + Knowledge Base: agent per workspace,
  review-then-approve workflow, knowledge base (upload + manual + URL)
  dengan RAG (chunk + embed + cosine in-Go), auto-reply pada inbound
  semua channel, confidence threshold + handoff, human takeover
  menonaktifkan bot per conversation, bot reply log + playground,
  provider pluggable (mock/openai) tanpa expose API key ke frontend.
- **Part 10 ✅** — Developer API + Webhooks + n8n: API key management
  (hash-only, plaintext sekali), Public REST API dengan rate limit Redis
  + usage log, webhook endpoint management (7 event, HMAC-SHA256, retry
  backoff, delivery log), halaman API docs + panduan n8n (payload +
  workflow JSON + tombol test).
- **Part 11 ✅** — Billing SaaS + Pricing + Plan Limits: katalog 3 paket
  (di-seed migration), pricing page publik, billing dashboard (pilih paket
  dummy + status subscription), usage dashboard, invoice placeholder,
  Midtrans payment placeholder, plan-limit helper backend yang menegakkan
  team member / knowledge / API / n8n / AI / retensi history / nomor WA.
- **Part 12 ✅** — Super Admin Dashboard: role platform SUPER_ADMIN,
  overview platform, kelola user/workspace/subscription/channel/invoice,
  suspend workspace (ditegakkan di middleware), impersonate placeholder +
  audit log, abuse report management, webhook & system/error log viewer.
- **Part 13 ✅** — WhatsApp unofficial gateway: OneSender & StarSender
  sebagai channel baru (inbox, AI auto-reply, broadcast, public API,
  webhook masuk ber-token), plus hardening keamanan (lihat 🔒).
- **Part 14** — Multi-bahasa, analytics lanjutan, mobile app.
