# Daftar periksa peluncuran Asterism

Semua langkah di bawah dijalankan **manual oleh pemilik**. Sesi pembangunan tidak pernah memegang kunci dan tidak pernah menyiarkan transaksi ke jaringan publik. Urutannya mengikat: jangan lompat. Tidak ada estimasi waktu di dokumen ini; setiap langkah selesai ketika kondisi "Selesai bila" terpenuhi.

## 0. Apa yang permanen

Begitu `AsterismLauncher` dideploy, hal berikut **tidak bisa diubah oleh siapa pun**, termasuk Anda:

- Nama, simbol, suplai maksimum 2.222, porsi penjualan 60%, pembagian hasil jual 66,67% likuiditas / 33,33% treasury.
- Harga per token, batas per dompet, batas per transaksi, jendela jual, jendela finalisasi, jendela reveal.
- Alamat treasury, komitmen reveal (`revealCommit`), alamat revealer (alamat deployer), alamat WETH dan factory Uniswap V2.
- Kode renderer dan seluruh seni (tidak ada tahap ganti gambar).

Kesalahan di salah satu nilai di atas hanya bisa diperbaiki dengan deploy ulang dari nol (alamat baru, situs baru). Kontrak tidak punya pemilik, jeda, atau fungsi darurat.

## 1. Keputusan yang hanya Anda yang bisa ambil

| Keputusan | Catatan |
| --- | --- |
| Audit eksternal | Belum ada. Skrip mainnet menolak berjalan tanpa pernyataan bahwa Anda punya audit dan tinjauan hukum. Berkas `docs/AUDIT-PACKET.md` disiapkan untuk auditor. |
| Tinjauan hukum | Termasuk apakah koleksi ini boleh ditawarkan di wilayah tertentu, dan teks `Risk`/`Terms` di situs (itu draf, bukan nasihat hukum). |
| Daftar negara tampilan-saja (geoblock) | Diisi di `BLOCKED_COUNTRIES` (lihat langkah 8). Ini batas antarmuka saja, bukan batas kontrak. |
| Harga (`mintPriceWei`) dan batas dompet/transaksi | Permanen. |
| Alamat treasury | Disarankan multisig. Hanya menerima ETH; tidak bisa memanggil apa pun yang istimewa. |
| Jendela waktu | `saleStart` harus lebih dari satu jam di depan saat deploy. Semua jendela minimal satu jam. |
| DEX untuk testnet | Testnet tidak punya Uniswap V2 resmi (D-007). Pilih: deploy sendiri factory V2 + WETH di testnet, atau uji finalisasi hanya di mainnet-fork/anvil. |
| Akun resmi (X, Discord) | Footer situs masih berkata akun resmi akan dicantumkan. Isi di `web/src/components/layout/SiteFooter.tsx` sebelum penjualan dibuka. |

## 2. Siapkan mesin Anda

1. Pasang Foundry (`foundryup`) dan pnpm 10.28. Sesi pembangunan **tidak** memasang apa pun di mesin Anda (D-001).
2. `cd contracts && ./install-deps.sh && forge build && forge test` harus lulus (70 tes).
3. `cd web && pnpm install && pnpm lint && pnpm test && pnpm copy:check && pnpm secrets:check` harus lulus. Berkas `.github/workflows/ci.yml` menjalankan semua ini (dan membuktikan ABI serta hash kode yang disimpan sama dengan hasil build) di GitHub Actions tingkat gratis; sematkan kedua action ke SHA commit sebelum bergantung padanya.
4. Buat keystore Foundry: `cast wallet import deployer --interactive`. Kunci diketik ke prompt tersembunyi, tidak masuk riwayat shell. Untuk Ledger, tidak perlu keystore. Jangan pernah menaruh kunci di variabel lingkungan; `scripts/deploy.sh` menolak jalan bila `PRIVATE_KEY` dan sejenisnya terisi.

Selesai bila: ketiga perintah lulus dan `cast wallet list` menampilkan keystore Anda.

## 3. Rahasia reveal

1. `node scripts/gen-commit.mjs --label testnet` (lalu lagi dengan `--label mainnet` nanti). Rahasia ditulis ke `~/.asterism/reveal-secret-<label>.txt` dengan izin 0600 dan **tidak dicetak**. Yang dicetak hanya `revealCommit`.
2. Cadangkan berkas rahasia di dua tempat offline. Jangan kirim lewat chat atau email.
3. Rahasia baru dipublikasikan saat Anda memanggil `reveal(secret)` setelah finalisasi. Bila hilang atau tidak dipanggil sebelum batas, siapa pun bisa memanggil `revealFallback()` dan seed menjadi `keccak256(entropy, commit)`. Itu aman tetapi bisa diprediksi.

Selesai bila: `revealCommit` tercatat dan dua cadangan rahasia ada.

## 4. Testnet (gladi bersih)

1. Testnet tidak punya Uniswap V2 resmi (D-007). Untuk gladi bersih, jalankan `scripts/deploy.sh dex-testnet --account deployer --broadcast`: skrip ini men-deploy WETH pengganti dan factory V2-kompatibel dari mock repo ini (bukan kontrak Uniswap; skrip menolak mainnet). Gladi bersih membuktikan alur dan paritas harga pada kontrak pengganti, bukan perilaku Uniswap asli; perilaku Uniswap asli baru teramati saat finalisasi mainnet, jadi baca ulang bagian risiko di `docs/AUDIT-PACKET.md`.
2. `cp deployments/config/46630.example.json deployments/config/46630.json`, isi semua nilai `REPLACE_` (WETH dan factory dari langkah 1), hapus `_notes`.
3. Simulasi: `scripts/deploy.sh testnet --account deployer`. Tidak ada yang terkirim.
4. Deploy: `scripts/deploy.sh testnet --account deployer --broadcast`. Forge meminta kata sandi keystore.
5. `cd web && node scripts/record-deployment.mjs --chain 46630 --rpc https://rpc.testnet.chain.robinhood.com`, lalu `node scripts/verify-deployment.mjs --chain 46630`. Harus mencetak "All checks passed".
6. Verifikasi sumber di Blockscout testnet (tanpa kunci API): `forge verify-contract <alamat> <path>:<Nama> --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/ --chain 46630 --guess-constructor-args --rpc-url <rpc>`. Lakukan untuk renderer, launcher, token, mirror, sink. Token, mirror, dan sink dibuat oleh constructor launcher; bila Blockscout tidak mengenalinya otomatis, kirim manual dengan constructor args dari `cast abi-encode`. Saya tidak bisa menjalankan ini ke explorer dari sesi pembangunan, jadi periksa sendiri bahwa perintahnya berhasil di testnet sebelum mainnet.
7. Bangun situs untuk testnet: `NEXT_PUBLIC_CHAIN_ID=46630 pnpm build` dan terbitkan ke proyek Cloudflare Pages terpisah (staging).
8. Lakukan seluruh alur dengan dompet nyata: beli, tunggu jendela, finalisasi, reveal dengan `cast send <launcher> "reveal(bytes32)" <rahasia> --account deployer`, lihat galeri, beri nama, kirim, uji refund pada peluncuran uji lain bila perlu.

Selesai bila: halaman Contracts di situs staging menampilkan "Code matches this build" untuk kelima kontrak dan seluruh alur berjalan.

## 5. Pra-pemeriksaan mainnet

Jalankan pemeriksaan baca-saja ini sebelum simulasi dan ulangi tepat sebelum deploy. Ia tidak mengirim transaksi dan tidak butuh kunci: ia memeriksa konfigurasi, kode WETH dan factory di rantai, jenis alamat treasury, saldo deployer, dan bahwa berkas rahasia reveal memang menghasilkan `revealCommit` (nilai rahasia tidak dicetak).

```bash
node scripts/preflight.mjs --chain 4663 --deployer <alamat-ledger-anda>
```

`FAIL` harus nol. Setiap `WARN` adalah keputusan Anda yang dicatat tertulis. Skrip tidak menggantikan membaca ulang parameter oleh dua orang.

- [ ] Audit eksternal selesai; semua temuan ditutup atau diterima tertulis. Taruh URL laporan di `NEXT_PUBLIC_AUDIT_REPORT_URL`.
- [ ] Tinjauan hukum selesai; teks `/risk/` dan `/terms/` disesuaikan.
- [ ] Treasury adalah alamat yang benar (kirim jumlah kecil ke sana dan lihat bahwa Anda bisa menggerakkannya) dan penandatanganan multisig diuji.
- [ ] `deployments/config/4663.json` terisi. Nilai `weth` dan `uniswapV2Factory` harus tetap alamat resmi di contoh (skrip menolak yang lain).
- [ ] Parameter dibaca ulang oleh dua orang. Hitung: `liquidityProceedsBps * saleBps` harus cocok dengan paritas harga; skrip dan konstruktor menolak sebaliknya.
- [ ] Alamat WETH dan factory dicek ulang di dokumentasi resmi Uniswap saat ini (`developers.uniswap.org`) dan kodenya di explorer. Nilai di repo diverifikasi pada 10 November 2026; jangan percaya tanpa mengecek ulang.
- [ ] Saldo deployer cukup untuk gas (simulasi menampilkan estimasi).
- [ ] Akun resmi sudah dibuat dan dicantumkan di footer.

## 6. Deploy mainnet

1. `export ASTERISM_MAINNET_ACK="I have an external audit, a legal review, and I understand every parameter is permanent"` di shell yang sama (jangan simpan di berkas).
2. Simulasi: `scripts/deploy.sh mainnet --ledger`. Baca keluarannya baris demi baris.
3. Deploy: `scripts/deploy.sh mainnet --ledger --broadcast`. Konfirmasi di perangkat.
4. Catat dan periksa: `node scripts/record-deployment.mjs --chain 4663 --rpc https://rpc.mainnet.chain.robinhood.com` lalu `node scripts/verify-deployment.mjs --chain 4663` ("All checks passed"). Perintah kedua membandingkan bytecode on-chain dengan build, parameter dengan konfigurasi, dan peran (revealer, treasury, tanpa owner).
5. Verifikasi sumber di `https://robinhoodchain.blockscout.com/api/` (lihat langkah 4.6, ganti `--chain 4663`).
6. Komit `deployments/4663.json` (tanpa rahasia; hanya alamat dan parameter publik).

Selesai bila: `verify-deployment` lulus 100% dan sumber terverifikasi di explorer.

## 7. Situs produksi (Cloudflare Pages atau Vercel)

Situs mendukung dua host. Langkah 2 sampai 5 sama untuk keduanya; langkah 1, 4, dan 6 berbeda. Bagian 7b khusus Vercel.

1. Buat proyek Pages dari folder `web`, perintah build `pnpm build`, direktori keluaran `out`, Node 22.
2. Variabel build: `NEXT_PUBLIC_CHAIN_ID=4663`, `NEXT_PUBLIC_SITE_URL=<domain resmi>`, `NEXT_PUBLIC_AUDIT_REPORT_URL=<bila ada>`.
3. Rahasia/variabel runtime: `RPC_UPSTREAM_URL`, `PROJECT_ADDRESSES` (lima alamat dipisah koma: renderer, launcher, token, mirror, sink), `BLOCKED_COUNTRIES`, opsional `ALLOWED_ORIGINS`, `MAX_LOG_RANGE`. Contoh: `web/.env.example`. Jangan pernah memakai variabel `NEXT_PUBLIC_` untuk kunci apa pun.
4. Opsional: binding Workers Rate Limiting bernama `RPC_LIMITER` untuk `/api/rpc` (tingkat gratis tersedia; tanpa binding, proxy tetap jalan tanpa pembatas).
5. Sebelum mengumumkan: `pnpm verify:deployment`, `pnpm copy:check`, `pnpm secrets:check`, dan buka tiap halaman di produksi. Halaman Contracts harus menampilkan "Code matches this build" lima kali.
6. Header keamanan dan CSP ditulis oleh `postbuild` ke `out/_headers`; periksa bahwa respons produksi memuat `Content-Security-Policy` per halaman.

### 7b. Vercel

1. Impor repositori di Vercel. Pengaturan proyek: **Root Directory** `web`. Berkas `web/vercel.json` sudah menetapkan framework `null`, perintah install/build, direktori keluaran `out`, `trailingSlash`, dan header keamanan statis; jangan menimpanya di dasbor.
2. Variabel lingkungan (Settings > Environment Variables). Build: `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AUDIT_REPORT_URL`. Runtime server: `RPC_UPSTREAM_URL`, `PROJECT_ADDRESSES`, `BLOCKED_COUNTRIES`, opsional `ALLOWED_ORIGINS` dan `MAX_LOG_RANGE`. Tandai `RPC_UPSTREAM_URL` sebagai sensitif. Ubah variabel lalu **deploy ulang**; variabel baru tidak berlaku pada deployment lama.
3. `/api/rpc` dan `/api/geo` adalah Vercel Functions (`web/api/*.ts`) yang memakai kode kebijakan yang sama dengan versi Cloudflare. Negara dibaca dari header `x-vercel-ip-country` yang diisi Vercel; header `cf-ipcountry` diabaikan di sana.
4. Pembatas laju: binding `RPC_LIMITER` hanya ada di Cloudflare. Di Vercel tidak ada pembatas di dalam kode; bila paket Anda menyediakan aturan pembatas laju di Firewall, buat aturan untuk path `/api/rpc` dan periksa ketersediaannya di dasbor. Tanpa itu, batas efektif hanya anggaran penyedia RPC.
5. CSP: Vercel membaca `vercel.json` sebelum build dan mengabaikan `_headers`, jadi saat build di Vercel `postbuild` menulis kebijakan yang sama sebagai tag `<meta http-equiv="Content-Security-Policy">` di tiap halaman (hash skrip per halaman). Perbedaannya dengan Cloudflare: meta tidak bisa memuat `frame-ancestors`, jadi pembingkaian dicegah oleh `X-Frame-Options: DENY` dari `vercel.json`; dan kebijakan hanya berlaku untuk konten setelah tag itu. Periksa di produksi bahwa konsol tidak menampilkan pelanggaran CSP dan bahwa halaman `/api/geo` mengembalikan JSON.
6. Setelah deploy: `curl -s https://<domain>/api/geo` harus mengembalikan `{"country":"..","viewOnly":false}`; ujilah juga dari negara yang Anda daftarkan di `BLOCKED_COUNTRIES` (mis. lewat VPN) sebelum mengandalkannya.

## 8. Geoblock

`BLOCKED_COUNTRIES` (kode ISO dua huruf dipisah koma) membuat situs menjadi tampilan-saja di negara itu: tombol beli, finalisasi, refund, beri nama, dan kirim hilang. Kontrak tetap permissionless dan tidak bisa membatasi siapa pun. Jangan menyatakan di situs atau di komunikasi bahwa koleksi "tidak tersedia" di suatu negara; yang benar adalah bahwa antarmuka ini membatasi diri.

## 9. Selama dan setelah penjualan

1. **Penjualan dibuka** otomatis pada `saleStart`. Situs menampilkan status dari rantai.
2. **Finalisasi.** Setelah terjual habis atau lewat `saleEnd`, siapa pun (termasuk Anda) memanggil `finalizeLaunch()` dari halaman Launch. Harus sebelum `saleEnd + finalizeWindow`. Gas terukur sekitar 1,4 juta di anvil dengan mock Uniswap; di rantai nyata bisa berbeda, jadi lihat estimasi dompet.
3. **Reveal.** Segera setelah finalisasi, dari alamat deployer: `cast send <launcher> "reveal(bytes32)" $(cat ~/.asterism/reveal-secret-mainnet.txt) --ledger --rpc-url <rpc>`. Hanya sekali, sebelum `finalizedAt + revealWindow`. Setelah itu publikasikan rahasia agar orang bisa memakai alat verifikasi di halaman Rules.
4. **Kirim bagian treasury.** `withdrawTreasury()` bisa dipanggil siapa pun dan selalu mengirim ke treasury yang tetap.
5. **Jika finalisasi terlewat.** Setelah `saleEnd + finalizeWindow`, halaman Launch menampilkan refund; tiap pembeli mengambil kembali persis yang dibayar. Tidak ada tindakan pemilik yang diperlukan atau mungkin.
6. **Jika rahasia hilang atau reveal terlewat.** Setelah batas, `revealFallback()` oleh siapa pun menetapkan seed.
7. **Jangan pernah** meminta pembeli menandatangani sesuatu di luar halaman situs ini, dan jangan pernah menjanjikan harga, imbal hasil, atau kelangkaan sebagai alasan membeli (daftar kata terlarang ada di `scripts/copy-check.mjs`).

## 10. Pemeriksaan akhir sebelum mengumumkan

- [ ] Halaman Launch menampilkan status yang benar, harga, batas, dan jendela dari rantai.
- [ ] Kelima kontrak "Code matches this build"; "Source verified on explorer" muncul hanya bila explorer memang melaporkannya.
- [ ] `NEXT_PUBLIC_AUDIT_REPORT_URL` kosong bila belum ada audit (situs lalu menulis "No external audit yet").
- [ ] Footer memuat akun resmi; domain dan `NEXT_PUBLIC_SITE_URL` sama.
- [ ] Anda tahu siapa memegang cadangan rahasia reveal dan siapa memegang kunci revealer.
