# NUGGET — Full Deploy Tutorial

Panduan lengkap dari nol sampai Pulse nyala data Robinhood Chain asli.
Ikutin urut. Estimasi total: ~20–30 menit.

Yang lo butuh sebelum mulai:
- Node.js 20+ dan npm (cek: `node -v`)
- Git
- Akun: **GitHub**, **Supabase**, **Bitquery**, **Vercel** (semua free tier)

---

## LANGKAH 0 — Peta besarnya dulu

Biar lo nggak ngoding buta, ini alur datanya:

```
Bitquery (data RHC)  →  GitHub Actions (cron 5 menit)  →  Supabase (simpan rollup)  →  Vercel (tampilin)
```

- **GitHub** = tempat code + yang jalanin worker tiap 5 menit
- **Supabase** = database
- **Bitquery** = sumber data pool
- **Vercel** = website-nya

Lo bakal setup dari kanan ke kiri kebalik: taro code → Supabase → Bitquery → GitHub → Vercel.

---

## LANGKAH 1 — Struktur folder (udah jadi, tinggal paham)

Unzip `nugget.zip`. Isinya begini — JANGAN ubah susunannya, semua path saling ngandelin:

```
nugget/
├── package.json              ← daftar dependency + perintah (npm run ...)
├── tsconfig.json             ← config TypeScript
├── next.config.mjs           ← config Next.js
├── .env.example              ← TEMPLATE env. Copy jadi .env buat lokal
├── .gitignore                ← nahan .env & node_modules biar nggak ke-push
├── README.md                 ← ringkasan
├── DEPLOY.md                 ← file ini
│
├── supabase/                 ← SQL yang lo paste ke Supabase
│   ├── schema.sql            ← bikin semua tabel + RLS
│   └── prune.sql             ← auto-hapus data lama + keepalive (pg_cron)
│
├── src/                      ← BACKEND (worker ingest, jalan di GitHub Actions)
│   ├── lib/
│   │   ├── types.ts          ← tipe data bersama
│   │   └── pulse.ts          ← INTI: bucketing 5m, velocity, range health
│   └── ingest/
│       ├── config.ts         ← baca env
│       ├── run.ts            ← ENTRYPOINT worker (yang dipanggil cron)
│       ├── supabase.ts       ← nulis ke database
│       ├── tvl.ts            ← ambil TVL (GeckoTerminal) buat est. APR
│       └── adapters/
│           ├── types.ts      ← kontrak adapter (interface)
│           ├── index.ts      ← pilih adapter (bitquery / mock)
│           ├── bitquery.ts   ← ADAPTER ASLI (← titik yg perlu lo confirm)
│           └── mock.ts       ← data palsu buat tes lokal
│
├── scripts/
│   └── verify.ts             ← tes pipeline lokal tanpa akun apapun
│
├── lib/                      ← FRONTEND helpers
│   ├── env.ts                ← deteksi Supabase kepasang atau belum
│   ├── data.ts               ← INTI frontend: agregasi window + APR + trust
│   ├── model.ts              ← tipe buat UI
│   └── format.ts             ← format angka ($, %, APR, jam)
│
├── components/
│   ├── Chrome.tsx            ← nav + footer + logo
│   ├── PulseView.tsx         ← home v2: stats + chart + tooltip + list
│   ├── Velocity.tsx          ← badge velocity
│   └── Skeletons.tsx         ← placeholder shimmer pas loading
│
└── app/                      ← HALAMAN (Next.js App Router)
    ├── layout.tsx            ← kerangka HTML
    ├── icon.svg             ← favicon (logo nugget)
    ├── globals.css           ← semua styling (tema Robinhood: hitam + hijau)
    ├── page.tsx              ← home: Pulse (overview + chart + daftar pool)
    ├── loading.tsx           ← skeleton pas Pulse loading
    ├── pool/[id]/page.tsx    ← detail 1 pool
    ├── pool/[id]/loading.tsx ← skeleton pas detail loading
    ├── positions/page.tsx    ← position monitor
    ├── about/page.tsx        ← halaman About
    └── how-it-works/page.tsx ← halaman How it works
```

**Yang perlu lo tau cuma:** kalau nanti data Bitquery bentuknya beda, yang lo edit
CUMA `src/ingest/adapters/bitquery.ts`. Sisanya nggak disentuh.

---

## LANGKAH 2 — Jalanin lokal dulu (5 menit, tanpa akun apapun)

Ini buat mastiin di komputer lo semuanya waras SEBELUM setup cloud.

```bash
cd nugget
npm install            # download dependency (~1 menit)
npm run verify         # tes pipeline: harus muncul "verify PASSED"
npm run dev            # nyalain website
```

Buka `http://localhost:3000`. Karena belum ada Supabase, Pulse bakal nampilin
empty state **"Waiting for the first pulse"** (titik hijau berdenyut) — itu normal,
bukan error. Website-nya render, nav + footer jalan, cuma belum ada data. Begitu
Supabase kepasang nanti, empty state ini otomatis keganti data RHC asli.

Stop server: `Ctrl+C`.

---

## LANGKAH 3 — Setup Supabase (database)

1. Masuk **supabase.com** → **New project**.
   - Kasih nama (misal `nugget`), set password database (simpan), pilih region terdekat (Singapore).
   - Tunggu ~2 menit sampai project ready.

2. **Bikin tabel:**
   - Sidebar kiri → **SQL Editor** → **New query**.
   - Buka file `supabase/schema.sql`, copy SELURUH isinya, paste ke editor.
   - Klik **Run** (kanan bawah). Harus muncul "Success".

3. **Nyalain pg_cron (buat auto-prune + keepalive):**
   - Sidebar → **Database** → **Extensions**.
   - Cari `pg_cron` → toggle **ON**.

4. **Pasang prune + keepalive:**
   - Balik ke **SQL Editor** → **New query**.
   - Copy seluruh isi `supabase/prune.sql`, paste, **Run**.

5. **Ambil kunci (nanti dipakai):**
   - Sidebar → **Project Settings** (ikon gerigi) → **API**.
   - Catat 3 hal ini di notepad:
     - **Project URL** → `https://xxxx.supabase.co`
     - **anon public** key → buat website
     - **service_role** key → buat worker (RAHASIA, jangan sebar)

Cek: **Table Editor** di sidebar → harus ada tabel `pools`, `pool_pulse_5m`, dll (masih kosong, wajar).

---

## LANGKAH 4 — Konfirmasi Bitquery (titik paling penting)

Ini satu-satunya bagian yang belum pernah kena data asli. Kita pastiin dulu.

1. Masuk **ide.bitquery.io** → login → **Account / API Keys** → bikin **API key**. Catat.

2. Di IDE Bitquery (kotak query di tengah), paste ini buat cek slug RHC:

```graphql
{
  EVM(network: robinhood, dataset: realtime) {
    DEXTrades(
      limit: { count: 3 }
      orderBy: { descending: Block_Time }
      where: { Trade: { Dex: { ProtocolFamily: { is: "Uniswap" } } } }
    ) {
      Block { Time }
      Transaction { From }
      Trade {
        Dex { ProtocolName ProtocolVersion SmartContract }
        Buy { AmountInUSD Currency { Symbol } }
        Sell { Currency { Symbol } }
      }
    }
  }
}
```

3. Klik run (tombol play). Tiga kemungkinan:
   - **Keluar 3 trade + ada Symbol/AmountInUSD + Transaction.From** → PERFECT. Slug `robinhood` bener, field bener. Lanjut. (`Transaction.From` = alamat trader, dipakai buat trust signal "1-wallet volume" & "few traders".)
   - **Error "unknown network robinhood"** → slug-nya beda. Coba `robinhood_chain`, atau cek dropdown network di IDE. Slug yang bener nanti dipasang sebagai secret `BITQUERY_NETWORK`.
   - **Field merah / null** → nama field beda dikit. Catat nama yang bener, nanti tinggal ganti di `src/ingest/adapters/bitquery.ts` (semua terkumpul di 1 file).

> Kalau ada yang meleset di sini, kabarin gue — itu edit 5 menit di 1 file, bukan bongkar ulang.

### 4b — (opsional) Nyalain TVL buat est. APR

Kolom **est. APR (24h)** butuh **TVL pool**. TVL diambil dari **GeckoTerminal** (API DEX-nya CoinGecko, gratis). Sebelum nyalain, konfirmasi slug RHC-nya:

1. Buka `https://api.geckoterminal.com/api/v2/networks` di browser, cari Robinhood Chain, catat slug-nya (tebakan awal: `robinhood`).
2. Nanti (Langkah 6) set secret `NUGGET_ENABLE_TVL` = `1` dan `NUGGET_GECKOTERMINAL_NETWORK` = slug itu.

Kalau lo skip ini, semua tetap jalan — kolom **APR cuma nampilin "—"** sampai TVL nyala. Fees/volume/velocity/trust nggak butuh ini.

---

## LANGKAH 5 — Push ke GitHub

1. Di **github.com** → **New repository** → nama `nugget` → set **Public** (penting: public = GitHub Actions gratis) → **Create**.

2. Di terminal, dari dalam folder `nugget`:

```bash
git init
git add .
git commit -m "NUGGET v2"
git branch -M main
git remote add origin https://github.com/USERNAME/nugget.git
git push -u origin main
```

Ganti `USERNAME` sama username lo. `.gitignore` udah nahan `.env` & `node_modules`, jadi
nggak ada rahasia yang ke-push. Aman.

---

## LANGKAH 6 — Pasang secrets di GitHub

Worker butuh kunci, tapi kuncinya JANGAN masuk ke code. Taruh sebagai secret:

1. Di repo GitHub lo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**, bikin satu-satu:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL dari Langkah 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key dari Langkah 3 |
| `BITQUERY_API_KEY` | API key dari Langkah 4 |
| `BITQUERY_ENDPOINT` | `https://streaming.bitquery.io/graphql` |
| `BITQUERY_NETWORK` | `robinhood` (atau slug yang lo confirm di Langkah 4) |
| `NUGGET_ENABLE_TVL` | `1` kalau mau APR nyala (Langkah 4b), atau kosongin dulu |
| `NUGGET_GECKOTERMINAL_NETWORK` | slug GeckoTerminal RHC (Langkah 4b), atau kosongin |

Dua secret terakhir opsional — kalau dikosongin, APR nampilin "—", sisanya tetap jalan.

---

## LANGKAH 7 — Jalanin worker pertama kali (manual)

1. Di repo → tab **Actions**. Kalau ada tombol "I understand... enable", klik.
2. Pilih workflow **nugget-ingest** di kiri → tombol **Run workflow** → **Run workflow**.
3. Tunggu ~1 menit, klik run-nya, lihat log. Harus ada:
   ```
   [nugget] tracking N pools
   [nugget] upserted N pulse rows
   [nugget] done
   ```
4. **Bukti data masuk:** balik ke Supabase → **Table Editor** → `pool_pulse_5m` → harus ada baris.

Setelah ini, dia jalan otomatis tiap 5 menit. Nggak usah disentuh lagi.

> Kalau log-nya error di Bitquery → berarti Langkah 4 belum pas. Fix di `bitquery.ts`, commit, push, run lagi.

---

## LANGKAH 8 — Deploy website (Vercel)

1. Masuk **vercel.com** → **Add New → Project** → import repo `nugget` dari GitHub.
2. Vercel auto-detect Next.js. Sebelum deploy, buka **Environment Variables**, tambah 2:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (sama kaya Supabase) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon** key (BUKAN service_role) |

3. Klik **Deploy**. Tunggu ~2 menit. Lo dapet URL `nugget-xxx.vercel.app`.

Buka URL-nya. Kalau empty state **"Waiting for the first pulse"** keganti pool RHC asli → **NUGGET live.**

---

## LANGKAH 9 — Cek akhir (end-to-end)

- [ ] `pool_pulse_5m` di Supabase nambah baris tiap ~5 menit
- [ ] Home nampilin overview (Volume/Fees/Active pools) + bar chart + daftar pool asli
- [ ] Filter 5m/30m/1h/24h ganti angka di list
- [ ] Hover bar chart → tooltip muncul
- [ ] Pool berisiko dapet badge (1-wallet volume / Few traders / New / Thin TVL)
- [ ] Klik satu pool → timeline aktivitas kebuka
- [ ] Tab Positions → masukin range → range health muncul

Kalau semua centang: **selesai, live, real (update tiap 5 menit).**

---

## Troubleshooting cepat

| Gejala | Sebab | Fix |
|---|---|---|
| Actions error "Missing env var" | secret belum kepasang | Cek Langkah 6, nama harus persis |
| Actions error di Bitquery | slug/field beda | Fix `src/ingest/adapters/bitquery.ts`, commit, push |
| Home kosong tapi worker sukses | belum ada pool cukup ramai di window | tunggu beberapa run, atau naikin `NUGGET_TRACKED_POOLS` |
| Home masih "Waiting for the first pulse" | env Vercel belum keset | Cek Langkah 8, lalu redeploy |
| Kolom **APR nampilin "—"** | TVL belum nyala | normal — nyalain Langkah 4b (`NUGGET_ENABLE_TVL=1` + slug), sisanya tetap jalan |
| Trust badge nggak muncul | `Transaction.From` belum kebaca | cek query Langkah 4; kalau field beda, fix di `bitquery.ts` |
| Liquidity net selalu 0 | mint/burn belum di-enable | normal — swap/fees/APR/trust jalan penuh |
| Supabase "project paused" | (nggak akan kejadian) | pg_cron nge-keep aktif; kalau perlu, restore manual |

---

## Setelah live — yang dipantau

1. **Apakah orang buka Pulse berulang?** Itu pertanyaan validasi lo.
2. **Query Bitquery jangan kebanyakan** — 40 pool @ 5 menit aman. Kalau lo naikin drastis, itu satu-satunya yang bisa nembus free tier (bukan hosting).
3. Fase berikutnya (lihat spec di project): net P&L + IL di Positions, backtest, alert Telegram + hot tier 1-menit (Cloudflare).

---

Ada langkah yang macet, screenshot error-nya kasih ke gue — gue arahin.
