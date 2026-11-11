# Asterism: keputusan, bukti, dan selisih

Berkas ini mencatat setiap keputusan teknis beserta buktinya. Urutan: ringkasan, toolchain, Gerbang X (a sampai h), fakta riset ulang, selisih dokumentasi dan perilaku langsung, temuan yang harus diselesaikan di tahap kontrak, hal yang belum terverifikasi, dan log keputusan.

Tanggal pemeriksaan: 10 November 2026 (UTC), 11 November 2026 (WITA).

Metode:
- Dokumentasi resmi diambil langsung di sesi ini (docs.robinhood.com, developers.uniswap.org, docs.arbitrum.io, developers.cloudflare.com, cloudflare.com/terms, support.opensea.io).
- Panggilan RPC read-only: `fetch()` JSON-RPC dari built-in browser di Mac pemilik, dari halaman explorer resmi (origin robinhoodchain.blockscout.com untuk mainnet, explorer.testnet.chain.robinhood.com untuk testnet). Hanya metode baca (eth_chainId, eth_blockNumber, eth_getBlockByNumber, eth_getCode, eth_call, eth_getLogs, web3_clientVersion). Tidak ada tanda tangan, tidak ada eth_sendRawTransaction.
- Alasan memakai browser: shell kontainer cloud dan shell VM di mesin pemilik sama-sama ditolak proxy saat menghubungi rpc.*.chain.robinhood.com (403 CONNECT). Rute browser adalah satu-satunya rute baca yang tersedia.
- Kode sumber DN404 dan Solady di-clone read-only dari GitHub ke direktori sementara sesi (bukan ke folder proyek).

---

## 0. Ringkasan

| Pertanyaan | Hasil | Akibat |
|---|---|---|
| Chain mainnet | Chain ID 4663 (0x1237), gas ETH, explorer Blockscout. Terverifikasi langsung. | Dipakai. |
| Chain testnet | Chain ID 46630 (0xb626). Terverifikasi langsung. | Dipakai untuk latihan pemilik. |
| DEX V2 tanpa izin di mainnet | Ada: Uniswap V2 resmi (factory dan Router02 dari docs Uniswap, kode ada on-chain, factory terverifikasi di explorer, 147.802 pair). | **Model L dengan Uniswap V2**, LP dikirim ke sink tanpa fungsi penarikan. |
| DEX resmi di testnet | Tidak ada di alamat mainnet; docs Uniswap tidak mencantumkan testnet. Ada banyak salinan V2 buatan komunitas. | Keputusan pemilik untuk latihan testnet (lihat D-007). |
| Multicall3 | Ada di alamat kanonik, mainnet dan testnet (3.808 byte). | Galeri memakai Multicall3. |
| Verifikasi kontrak | Blockscout, `forge verify-contract --verifier blockscout`, tanpa kunci API. API Blockscout mengirim `Access-Control-Allow-Origin: *`. | Label "Source verified on explorer" bisa dicek langsung dari API explorer. |
| Waktu | `block.number` = perkiraan nomor blok L1; `block.timestamp` dari jam sequencer, boleh mundur sampai 24 jam atau maju 1 jam terhadap waktu nyata. | Kontrak hanya memakai `block.timestamp`, dengan jendela berskala jam atau hari. |
| Keacakan | `prevrandao` konstan = 1 (diukur). | Tidak ada keacakan chain. Seed dari commit-reveal. |
| Hybrid | DN404 berasal dari repositori Vectorized/dn404, bukan Solady. v0.0.25 memuat perbaikan Guardian. | Kunci dn404 pada commit 3397cb1. |
| Toolchain | forge tidak bisa dijalankan sesi ini di mesin pemilik. | Lihat D-001. |

---

## 1. Toolchain

| Alat | VM sesi di Mac pemilik (Linux aarch64) | Kontainer cloud (Linux x86_64) | Mac pemilik (host) |
|---|---|---|---|
| forge, anvil, cast | tidak ada | tidak ada | folder `~/.foundry` ada (hanya nama terlihat; versi dan isi tidak diperiksa; biner macOS tidak bisa dijalankan dari VM) |
| node | v22.23.4 | v22.23.4 | aplikasi desktop memakai Node 24.22.0; `~/.nvm` ada |
| pnpm | tidak ada | 10.28.0 | tidak diketahui |
| git | 2.34.1 | 2.43.0 | tidak diketahui |
| slither, aderyn | tidak ada | tidak ada | tidak diketahui |
| solc | tidak ada | tidak ada | tidak diketahui |

Jaringan:
- VM sesi: proxy menolak docs.robinhood.com dan RPC Robinhood.
- Kontainer: GitHub (termasuk aset rilis Foundry) dan registry npm bisa dijangkau; binaries.soliditylang.org dan RPC Robinhood tidak.

Folder kerja: `/Users/aldy/Project/WP/Asterism` (dipilih pemilik; nama di spesifikasi `asterism` huruf kecil merujuk folder yang sama pada sistem berkas macOS yang tidak peka huruf besar). Saat diperiksa folder kosong.

---

## 2. Gerbang X

### a. Parameter jaringan

Sumber: https://docs.robinhood.com/chain/connecting dan /chain/add-network-to-wallet.

| | Mainnet | Testnet |
|---|---|---|
| Nama | Robinhood Chain | Robinhood Chain Testnet |
| Chain ID (docs) | 4663 | 46630 |
| Chain ID (live `eth_chainId`) | 0x1237 = 4663 | 0xb626 = 46630 |
| Gas | ETH | ETH |
| RPC publik | https://rpc.mainnet.chain.robinhood.com | https://rpc.testnet.chain.robinhood.com |
| RPC penyedia (docs) | Alchemy `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`, juga Chainstack, QuickNode, Blockdaemon, dRPC, dan lain-lain | Alchemy `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` |
| Explorer | https://robinhoodchain.blockscout.com | https://explorer.testnet.chain.robinhood.com |
| Klien node (live) | nitro/v3.12.3-rc.4 | nitro/v3.12.4-rc.3 |

- Docs menyatakan RPC publik dibatasi laju dan tidak disarankan untuk produksi. `/api/rpc` harus memakai penyedia dengan kunci di variabel lingkungan Cloudflare.
- Jembatan resmi (docs /chain/bridging): `https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum`. Penarikan ke L1 butuh sekitar 7 hari (masa tantangan) dan satu transaksi klaim di L1.
- Faucet testnet: docs resmi tidak menyebut faucet. Ada faucet pihak ketiga di Alchemy (https://www.alchemy.com/faucets/robinhood-testnet); syaratnya belum diperiksa.
- Status: docs menyatakan "Robinhood Chain is live". Blog Uniswap tertanggal 2 Juli 2026 menyatakan Uniswap v2, v3, v4, dan UniswapX aktif di Robinhood Chain.

Pengukuran langsung (mainnet, 2026-11-10T17:37:45Z): blok L2 111.061.720, `l1BlockNumber` 26.386.052, gasPrice 20.334.000 wei (sekitar 0,02 gwei), rata-rata waktu blok menurut API explorer 101 ms.
Pengukuran langsung (testnet, 2026-11-10T17:40:09Z): blok L2 151.437.855, `l1BlockNumber` 12.106.170.

### b. Dukungan EVM

Uji dengan `eth_call` tanpa `to` (initcode sintetis, tidak di-deploy):

| Fitur | Mainnet | Testnet | Catatan |
|---|---|---|---|
| PUSH0 (Shanghai) | didukung | didukung | |
| MCOPY (Cancun) | didukung | (tidak diuji) | |
| TSTORE/TLOAD (Cancun) | didukung | (tidak diuji) | |
| BLOBHASH | mengembalikan 0 | (tidak diuji) | |
| BLOBBASEFEE | **ditolak**: "BLOBBASEFEE is not supported on Arbitrum" | (tidak diuji) | jangan dipakai |
| CLZ (Osaka) | didukung (clz(1) = 255) | didukung | tidak akan dipakai |
| `ArbSys.arbOSVersion()` | 116 (mentah) | 116 (mentah) | tafsiran ke nomor ArbOS belum diverifikasi |
| Batas ukuran kode | 98.304 byte (96 KiB): 98.304 lolos, 98.305 ditolak "max code size exceeded" | | sesuai docs (96 KB, initcode 192 KB) |
| Batas gas `eth_call` RPC publik | 50.000.000 (opcode GAS di awal mengembalikan 49.946.884 baik tanpa parameter gas maupun dengan 1e9) | sama | |

Keputusan: `evm_version = "cancun"` (paling konservatif yang memuat PUSH0, MCOPY, dan transient storage; semuanya diukur). Batas gas `tokenURI` tetap 3.000.000 sesuai spesifikasi, jauh di bawah 50 juta, untuk memberi ruang bagi penyedia gratis yang batasnya lebih kecil.

### c. Semantik waktu dan keacakan

Sumber: https://docs.robinhood.com/chain/differences-from-ethereum, https://docs.arbitrum.io/time, dan pengukuran.

- `block.number`: docs Robinhood: perkiraan nomor blok L1 yang diperbarui berkala. Diukur: opcode NUMBER mengembalikan 26.386.054 sementara blok L2 adalah 111.061.858 (`ArbSys.arbBlockNumber()`). **Tidak dipakai untuk apa pun.**
- `block.timestamp`: docs Arbitrum: diatur dari jam sequencer, tidak terikat ke timestamp L1, tidak pernah mundur, dan harus dalam batas 24 jam sebelum hingga 1 jam sesudah waktu sekarang. Diukur: nilai sesuai waktu nyata (2026-11-10T17:37:57Z). Dokumentasi Robinhood tidak membahasnya.
- `blockhash`: docs Robinhood: didukung tetapi hanya andal untuk blok baru. **Tidak dipakai.**
- `prevrandao`/`difficulty`: docs: konstan. Diukur: 1 di mainnet dan testnet. **Tidak dipakai.**

Keputusan: SALE_START, SALE_END, FINALIZE_WINDOW, dan REVEAL_DEADLINE memakai `block.timestamp`. Jendela minimum yang disarankan untuk tiap parameter adalah beberapa jam, bukan menit, karena docs Arbitrum menyebut waktu tidak andal dalam skala menit. Situs menampilkan waktu sebagai "sekitar" dan menjelaskan bahwa jam chain bisa berbeda dari jam pengguna.

### d. Explorer dan verifikasi

Sumber: https://docs.robinhood.com/chain/deploy-smart-contracts dan uji langsung API.

- Jenis: Blockscout (backend mainnet v12.0.4, testnet v10.2.6).
- Perintah resmi:
  `forge verify-contract <address> <path:Contract> --chain-id 4663 --rpc-url $RH_RPC_URL --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/`
  Untuk testnet, `--chain-id 46630` dan `--verifier-url https://explorer.testnet.chain.robinhood.com/api/` (URL testnet disimpulkan dari pola mainnet; belum diuji).
- Kunci API: tidak dibutuhkan (contoh Hardhat di docs memakai `"empty"`).
- API: `GET /api/v2/smart-contracts/{address}` mengembalikan `is_verified`; endpoint gaya Etherscan `?module=contract&action=getsourcecode` juga bekerja. Header `Access-Control-Allow-Origin: *`.
- Catatan: contoh docs memakai `--private-key $PRIVATE_KEY`. Proyek ini **tidak** mengikuti contoh itu; skrip pemilik memakai `--account` (keystore Foundry) atau `--ledger`.

### e. Multicall3 dan utilitas deploy

| Kontrak | Mainnet | Testnet |
|---|---|---|
| Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11` | ada, 3.808 byte | ada, 3.808 byte |
| Deployer CREATE2 deterministik `0x4e59b44847b379578588920cA78FbF26c0B4956C` | ada, 69 byte | ada, 69 byte |
| CreateX `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` | ada | (tidak diuji) |
| Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3` | ada | ada |
| WETH L2 (docs) | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`, ada | `0x7943e237c7F95DA44E0301572D358911207852Fa`, ada |

Docs Robinhood (/chain/protocol-contracts) tidak mencantumkan Multicall3; keberadaannya hanya dibuktikan lewat `eth_getCode`. Docs mencantumkan "L2 Multicall" lain (`0x2cAC…DaD1`), tidak dipakai.

### f. DEX

Sumber: https://developers.uniswap.org/docs/protocols/v2/deployments (dibuka lewat browser karena WebFetch gagal), /v3/deployments/v3-robinhood-chain-deployments, /v4/deployments, https://blog.uniswap.org/robinhood-chain-is-live.

Uniswap V2 di Robinhood Chain (mainnet, 4663):
- UniswapV2Factory `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f`: kode 13.859 byte; terverifikasi di explorer sebagai `UniswapV2Factory`, compiler v0.5.16; `allPairsLength()` = 147.802; `feeTo()` = `0x2ac03e14cfe755426daaee0a4994184ce81482f8` (biaya protokol **aktif**); `feeToSetter()` = `0x2bad8182c09f50c8318d769245bea52c32be46cd`.
- UniswapV2Router02 `0x89e5db8b5aa49aa85ac63f691524311aeb649eba`: kode 21.902 byte; `factory()` = factory di atas; `WETH()` = WETH L2 resmi `0x0Bd7…AD73`.
- Pembuatan pair tanpa izin (`createPair` publik pada Uniswap V2).
- Locker LP: tidak dibutuhkan; LP dikirim ke sink tanpa fungsi penarikan.

Juga ada (tidak dipakai): Uniswap V3 (factory `0x1f7d…2efa`, NonfungiblePositionManager `0x7399…d0d3`, SwapRouter02 `0xcaf6…5cb2`), Uniswap V4 (PoolManager `0x8366…0951`, PositionManager `0x58da…4fa7`), UniversalRouter `0x8876…0904`. Semua punya kode on-chain.

Testnet: alamat Uniswap V2 dan V3 di atas tidak punya kode di testnet. Docs Uniswap tidak mencantumkan deployment testnet Robinhood. Pencarian explorer testnet menemukan banyak kontrak bernama `UniswapV2Factory` dan `UniswapV2Router02` yang terverifikasi, semuanya tidak resmi. Alamat PoolManager V4 mainnet punya kode di testnet, tetapi tidak tercantum di docs.

**Aturan keputusan diterapkan: DEX V2 tersedia di mainnet, maka Model L dengan LP token ke sink tanpa fungsi penarikan.**

### g. Pasar NFT

- OpenSea: Robinhood Chain tercantum dalam daftar resmi blockchain yang didukung (https://support.opensea.io/en/articles/8867082).
- Element: berita pihak ketiga (KuCoin, 22 Juli 2026) mengutip pengumuman Element bahwa Element terintegrasi dengan Robinhood Chain. Belum diverifikasi dari sumber Element.
- Explorer mainnet mengenali tipe token "ERC-404"; ada beberapa koleksi hybrid lain dengan jumlah pemegang kecil (paling besar 133 pemegang saat diperiksa).

### h. DN404 dan Solady

Temuan utama: **DN404 dan DN404Mirror tidak ada di repositori Solady.** Keduanya ada di repositori terpisah `Vectorized/dn404` (paket npm `dn404`). Solady (`Vectorized/solady`) hanya submodule di repositori itu, dan `DN404.sol` serta `DN404Mirror.sol` tidak meng-import apa pun.

| Paket | Versi terbaru | Commit | Tanggal |
|---|---|---|---|
| dn404 | v0.0.25 (tag terbaru, juga HEAD `main`) | `3397cb11558ac853912ee87871422b6a29c9d346` | 2025-02-19 |
| solady | v0.1.26 (tag terbaru; npm terbaru) | `acd959aa4bd04720d640bf4e6a5c71037510cc4b` | 2025-08-25 |
| solady HEAD `main` (tidak dipakai) | | `258f67cc71e39cff307b726939ade17e9d8bcf5c` | 2026-10-20 |
| solady yang dipin dn404 v0.0.25 | v0.0.168 | `9deb9ed36a27261a8745db5b7cd7f4cdc3b1cd4e` | 2024-02-07 |

Perbaikan Guardian:
- Artikel Guardian: temuan tingkat tinggi ada di versi 0.0.8 sampai 0.0.16; perbaikan di commit `3bd069888016717f6fd92c672152ed66e405baad`, versi 0.0.17 di `ecdc34682a176f9c734718c60781ddf65752d437`.
- Riwayat git: `3bd0698 🐞 Guardian Audit fixes (#136)` lalu `ecdc346 Bump version to 0.0.17`. `git merge-base --is-ancestor 3bd0698 3397cb1` benar: v0.0.25 memuat perbaikan itu.
- H-01 (burn pool di `_mintNext`): `_mintNext` di v0.0.25 mengosongkan burn pool (`$.burnedPoolHead = 0; $.burnedPoolTail = 0;` dengan komentar "Invalidate (empty) the burned pool").
- M-03 (address staining): `getSkipNFT` di v0.0.25 memanggil `_skipNFTDefault(owner)` (yaitu `extcodesize(owner) != 0`) setiap kali flag belum diinisialisasi eksplisit, sesuai deskripsi perbaikan.
- M-01 (bait-and-switch penawaran): dimitigasi lewat panduan, bukan kode. Situs harus menjelaskannya (jangan melakukan operasi ERC-20 dan ERC-721 bersamaan di dompet yang sama).
- Perubahan setelah 0.0.17 yang relevan: `SkipNFTDefault (#148)`, `Refactor _skipNFTDefault (#153)`, `Make Permit2 enabled by default (#147)`, `Automatic pullOwner (#146)`. Diff #146 sampai #153 harus dibaca baris per baris di tahap kontrak.

Hook dan fungsi yang dikonfirmasi dari sumber v0.0.25 (`src/DN404.sol`):
- Wajib di-override: `name()`, `symbol()`, `_tokenURI(uint256)`.
- Inisialisasi: `_initializeDN404(...)`.
- Konfigurasi: `_unit()` (default 10**18), `_skipNFTDefault(address)` (default: kontrak di-skip), `_useOneIndexed()` (default true, id mulai 1), `_useDirectTransfersIfPossible()` (default true), `_addToBurnedPool(...)` (default false: id dicetak ulang secara siklis), `_useExistsLookup()` (default true), `_afterNFTTransfers(...)` dan `_useAfterNFTTransfers()`.
- Skip NFT: `getSkipNFT(address)`, `setSkipNFT(bool)` (publik, untuk pemanggil sendiri), `_setSkipNFT(address,bool)` (internal).
- Enumerasi milik pemilik: `_ownedIds(address owner, uint256 begin, uint256 end)` internal; komentar sumber menyatakan dioptimalkan untuk panggilan off-chain. Tidak ada versi publik bawaan, jadi AsterismToken akan menambah fungsi view publik yang membungkusnya (bukan indexer).
- Mirror (`src/DN404Mirror.sol`): `ownerOf`, `ownerAt`, `tokenURI`, `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll`, `owner()`, `pullOwner()`, `supportsInterface`.
- Konvensi repositori dn404: solc 0.8.26, `evm_version = "paris"` (Cancun diuji di CI mereka).

Keputusan: lihat D-003 dan D-004.

---

## 3. Fakta riset ulang

| No. | Klaim di spesifikasi | Hasil | Sumber |
|---|---|---|---|
| 1 | Guardian: 2 temuan tinggi di `_mintNext`, 1 menengah bait-and-switch, 1 address staining, perbaikan di v0.0.17 | Sesuai. Catatan: DN404 adalah repositori `Vectorized/dn404`, bukan Solady. | Guardian; riwayat git dn404 |
| 2 | Kategori hybrid CoinGecko sekitar 106,2 juta dolar AS, NPC sekitar 104,4 juta (sekitar 98 persen) | Sesuai: 106.200.180 dolar AS, NPC 104.353.012 (98,3 persen), 16 token. Halaman tidak menampilkan tanggal data. | https://www.coingecko.com/en/categories/hybrid-token-standards |
| 3 | Rilis interpretatif SEC 17 Maret 2026, CFTC bergabung; koleksi digital umumnya bukan sekuritas; fraksionalisasi atau bagi hasil dapat memicu analisis kontrak investasi | Sesuai menurut ringkasan Greenberg Traurig. Rilis SEC aslinya belum dibaca. Bukan nasihat hukum. | Greenberg Traurig alert |
| 4 | Perilaku bakar-cetak DN404 dan skipNFT | Sesuai dengan sumber v0.0.25 (lihat 2h). | `src/DN404.sol` |
| 5 | `prevrandao` konstan, `block.number` mengikuti L1 | Sesuai, diukur langsung dan sesuai docs Robinhood. | 2c |
| 6 | Cloudflare Pages gratis boleh komersial | Self-Serve Subscription Agreement (terakhir diperbarui 12 September 2025) tidak membatasi paket gratis pada penggunaan non-komersial. Lihat catatan di bawah. | https://www.cloudflare.com/terms/ |

Catatan Cloudflare:
- Pasal 2.2.1(h): dilarang memproses atau mengumpulkan data kartu kredit di properti web yang menerima Free Services. Situs ini tidak melakukannya.
- Pasal 2.2.1(j): dilarang memakai layanan untuk "virtual private network or other similar proxy services". `/api/rpc` adalah penerus baca yang sempit untuk aplikasi sendiri (allowlist metode, hanya alamat proyek untuk log), bukan layanan proxy umum. Risiko rendah; pemilik sebaiknya membaca ulang pasal ini.
- Service-Specific Terms Developer Platform (terakhir diperbarui 28 September 2026): tidak ada larangan khusus blockchain; melarang kode berbahaya, serangan volumetrik, dan phishing.
- Batas Pages gratis: 500 build per bulan, 1 build bersamaan, 20.000 berkas per situs, 25 MiB per berkas, 100 domain kustom per proyek, `_headers` maksimal 100 aturan.
- Pages Functions dihitung ke kuota Workers Free (contoh docs: 100.000 permintaan per hari, reset tengah malam UTC). Permintaan aset statis gratis dan tidak terbatas. Docs tidak menyebut apa yang terjadi saat kuota habis.
- Rate limiting: binding Workers Rate Limiting ada (periode 10 atau 60 detik, perkiraan per lokasi, konsistensi akhir). Docs tidak menyebut ketersediaan per paket dan tidak menyebut Pages Functions. Harus dicek di tahap situs; bila tidak tersedia di Pages gratis, dicatat dan diganti dengan batas ukuran batch, allowlist, cache, dan aturan WAF gratis bila ada.

---

## 4. Selisih dokumentasi dan perilaku langsung

| No. | Dokumentasi atau spesifikasi | Perilaku langsung | Yang dipakai |
|---|---|---|---|
| S-1 | Spesifikasi: "Solady DN404 + DN404Mirror" | DN404 ada di `Vectorized/dn404`, tidak di Solady | `Vectorized/dn404` |
| S-2 | Docs Robinhood tidak menyebut versi EVM | PUSH0, MCOPY, TSTORE, dan CLZ bekerja; BLOBBASEFEE ditolak | `cancun`, tanpa BLOBBASEFEE |
| S-3 | Docs Robinhood (protocol-contracts) tidak mencantumkan Multicall3 | Multicall3 ada di alamat kanonik | Multicall3 kanonik |
| S-4 | Docs Uniswap v2 dan v4 tidak mencantumkan testnet Robinhood | Kode PoolManager V4 ada di alamat yang sama di testnet; V2 dan V3 tidak | Tidak memakai alamat tak terdokumentasi |
| S-5 | Contoh deploy docs memakai `--private-key` | (aturan proyek) | `--account` atau `--ledger` |
| S-6 | Spesifikasi menyebut paritas "dalam toleransi pembulatan" | Pembulatan tokenLP ke bawah membuat harga pool 0,08 persen di atas MINT_PRICE pada penjualan habis | Usulan D-006 (paritas tepat) |

---

## 5. Temuan untuk diselesaikan di tahap kontrak (4a)

T-1. **Suplai 2.222 tidak tercapai dengan parameter default.** `SALE_BPS x MAX_SUPPLY_TOKENS = 1.333,2` token; karena penjualan hanya token utuh, batas jual adalah 1.333. `ethLP = 1.333 x P x 0,6667 = 888,71 P`, sehingga `tokenLP = 888`. Suplai akhir pada penjualan habis = 2.221, bukan 2.222. Akibatnya satu tingkat akan kurang satu rasi bahkan bila semua terjual. Ini sesuai aturan "paling banyak", tetapi harus ditampilkan jujur, atau parameter diubah oleh pemilik sebelum deploy (misalnya MAX_SUPPLY yang membuat 60 persen bulat, seperti 2.220 atau 2.225, dengan tabel distribusi yang disesuaikan).

T-2. **Paritas harga tepat.** Usulan: `tokenLP = floor(ethLPmentah x 1e18 / MINT_PRICE / 1e18)` token utuh, lalu `ethLP = tokenLP x MINT_PRICE` tepat, dan sisa (`hasil - ethLP`) ke treasury. Harga awal pool menjadi tepat MINT_PRICE (tanpa selisih pembulatan), dan invarian `ethLP + treasuryAmount = hasil` tetap berlaku.

T-3. **Pair bisa dibuat orang lain sebelum finalisasi.** `createPair` publik. Penyerang bisa membuat pair lebih dulu, mengirim WETH, lalu memanggil `sync()` sehingga cadangan menjadi (0 token, X WETH). Router V2 lalu revert di `quote()` (cadangan token nol), yang bisa memblokir finalisasi, atau bila Launcher memanggil `pair.mint` langsung, harga awal naik (penyerang kehilangan X, tetapi paritas rusak). Transfer token terkunci sampai finalisasi, jadi penyerang tidak bisa mengirim token. Desain finalisasi harus: memakai jalur `pair.mint` langsung (bukan router), membaca cadangan yang ada, dan menangani WETH yang didonasikan secara tetap (misalnya `skim` kelebihan ke treasury bila belum di-`sync`, dan bila sudah di-`sync`, mengirim token tambahan dalam batas suplai yang tersisa agar rasio tetap MINT_PRICE, atau membiarkan donasi masuk ke LP terkunci dan mencatatnya). Harus diuji dengan skenario ini di anvil.

T-4. **skipNFT eksplisit.** Alamat pair bisa dihitung sebelum dibuat (CREATE2 dari factory). Token harus memanggil `_setSkipNFT(pair, true)`, `_setSkipNFT(launcher, true)`, dan `_setSkipNFT(sink, true)` sebelum menerima token, bukan mengandalkan `extcodesize`, karena Launcher berstatus tanpa kode selama constructor-nya.

T-5. **`owner()` pada mirror.** Marketplace memakai `owner()` koleksi untuk hak edit halaman koleksi. Kontrak tanpa pemilik membuat `owner()` = alamat nol, sehingga tidak ada yang bisa mengklaim halaman koleksi di marketplace. Pilihan: tetap nol (paling jujur, kehilangan kontrol tampilan marketplace), atau mengembalikan alamat tampilan immutable yang tidak punya hak apa pun di kontrak (harus dijelaskan di situs). Keputusan pemilik; default yang paling aman adalah nol.

T-6. **Biaya protokol Uniswap aktif.** `feeTo` terisi, sehingga sebagian biaya swap dicetak sebagai LP untuk alamat `feeTo`. Tidak memengaruhi likuiditas yang terkunci, tetapi situs tidak boleh menyebut biaya swap "milik pool sepenuhnya".

T-7. **Jumlah NFT per id dan tingkat.** Dengan `_addToBurnedPool` default false dan id satu-indeks, id hidup selalu dalam 1 sampai suplai akhir; permutasi tingkat atas domain MAX_SUPPLY_TOKENS tetap benar dengan hitungan "paling banyak".

T-8. **Batas getLogs.** RPC publik mainnet menerima `eth_getLogs` dengan rentang 1.000.000 blok untuk satu alamat. Batas penyedia gratis (mis. Alchemy) belum diketahui; MAX_LOG_RANGE dibuat variabel dengan default konservatif, dan situs tidak bergantung pada log untuk galeri.

---

## 6. Belum terverifikasi

- Versi Foundry di Mac pemilik dan apakah forge bisa dijalankan di sana.
- Tafsiran `arbOSVersion() = 116` ke nomor ArbOS.
- MCOPY, TSTORE, BLOBBASEFEE, dan ukuran kode di testnet (hanya PUSH0, CLZ, prevrandao, gas cap, dan Multicall3 yang diuji di testnet).
- URL verifier Blockscout testnet (disimpulkan, belum diuji).
- Faucet testnet pihak ketiga (syarat Alchemy).
- Batas laju dan getLogs penyedia RPC gratis.
- Ketersediaan binding Rate Limiting di Pages Functions tingkat gratis.
- Integrasi Element (hanya sumber sekunder).
- Teks asli rilis SEC (hanya ringkasan firma hukum).
- Ketersediaan nama "Asterism", simbol ASTERISM, dan domain (tugas pemilik).
- Konvensi `../theorem` dan `../dockhood-app/apps/contracts`: belum dibaca; butuh izin akses folder. Akan diminta sekali saat mulai membangun situs dan kontrak.

---

## 7. Log keputusan

D-001. **Kompilasi dan uji kontrak.** forge tidak bisa dijalankan oleh sesi ini di mesin pemilik (VM tanpa forge; biner macOS di `~/.foundry` tidak bisa dijalankan dari VM). Sesuai aturan, tidak ada yang dipasang di mesin pemilik. Rencana: kompilasi dan uji di kontainer cloud sesi yang terisolasi (bukan mesin pemilik) dengan Foundry versi terkunci dari rilis GitHub dan solc 0.8.28 dari rilis GitHub `ethereum/solidity` (karena binaries.soliditylang.org diblokir), lalu menyalin hasil dan log uji ke folder proyek. Pemilik bisa mengulang `forge build && forge test` di Mac. Bila pemilik menolak rencana ini, jalur cadangan sesuai spesifikasi: spesifikasi dan rencana uji di docs, situs dengan ABI tiruan berlabel, dan kontrak dilaporkan belum dikompilasi.

D-002. **Model likuiditas: Model L dengan Uniswap V2 resmi** (factory `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f`, Router02 `0x89e5db8b5aa49aa85ac63f691524311aeb649eba`, WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`). LP ke sink tanpa fungsi penarikan. Alamat ini menjadi parameter constructor dan dicatat di `deployments/4663.json`.

D-003. **Basis hybrid: `Vectorized/dn404` v0.0.25, commit `3397cb11558ac853912ee87871422b6a29c9d346`**, sebagai submodule terkunci. Diff v0.0.17 sampai v0.0.25 dibaca penuh di tahap kontrak dan skenario Guardian diuji ulang.

D-004. **Solady untuk utilitas** (Base64, LibString, dan sejenisnya bila dipakai): v0.1.26, commit `acd959aa4bd04720d640bf4e6a5c71037510cc4b`. DN404 tidak bergantung padanya.

D-005. **Kompiler dan target:** solc 0.8.28 (konvensi dockhood-app), `evm_version = "cancun"`, optimizer aktif. Tidak memakai BLOBBASEFEE, `block.number`, `blockhash`, atau `prevrandao`.

D-006. **Paritas harga tepat** lewat pembulatan ETH ke treasury (T-2). Diusulkan; diterapkan di 4a kecuali pemilik menolak.

D-007. **Latihan testnet tanpa DEX resmi.** Pemilik memilih salah satu sebelum latihan: (a) men-deploy sendiri kontrak Uniswap V2 resmi tanpa modifikasi (bytecode kanonik) di testnet sebagai infrastruktur uji, atau (b) memakai salah satu salinan V2 komunitas setelah membandingkan bytecode-nya dengan factory mainnet. Ini bukan "pasar buatan sendiri" karena hanya untuk testnet dan memakai kode Uniswap tanpa perubahan. Skrip pemilik mendukung keduanya lewat parameter alamat router.

D-008. **Waktu:** hanya `block.timestamp`; parameter jendela minimum beberapa jam; constructor menolak urutan waktu yang tidak masuk akal (mis. SALE_END sebelum SALE_START).

D-009. **Galeri:** Multicall3 kanonik untuk baca batch; fungsi view `ownedIds` di AsterismToken membungkus `_ownedIds`.

D-010. **Status "Source verified on explorer"** dibaca dari `GET /api/v2/smart-contracts/{address}` (`is_verified`) di explorer Blockscout yang sesuai chain.

D-011. **Penyangkalan bukan tinjauan hukum.** Footer dan halaman Risk tidak menggantikan tinjauan hukum; tinjauan hukum wajib sebelum mainnet.

D-012. **Arah visual: C, Diffraction** (dipilih pemilik, 11 November 2026). Mitigasi risiko yang tercatat di CONCEPTS.md: (1) supaya tidak terbaca sebagai "kosmik generik", latar selalu grafit netral, tanpa gradien, nebula, atau cahaya; rasi dibingkai seperti bidang ukur alat dengan tanda tepi dan readout. (2) Hijau-kuning dipakai hanya untuk satu aksi utama per tampilan dan titik konfirmasi simulasi. (3) Untuk teks panjang di latar gelap: badan 16px, tinggi baris 1,6, panjang baris maksimal 68ch, teks redup tetap 6,9:1. (4) Bentuk khusus hanya pada bintang utama; bintang biasa berupa cakram polos, supaya tanda tingkat tidak tertukar dengan bintang terang pada thumbnail.

D-013. **Jawaban default untuk pertanyaan yang belum dijawab di titik berhenti pertama:** kompilasi dan uji kontrak di kontainer cloud (D-001); suplai 2.221 pada penjualan habis dipertahankan dan ditampilkan jujur (T-1); `owner()` pada mirror mengembalikan alamat nol (T-5). Pemilik bisa mengubah ketiganya sebelum tahap kontrak.

D-014. **Renderer referensi TypeScript** (`web/src/lib/asterism/`) adalah spesifikasi yang bisa dijalankan; renderer Solidity wajib menghasilkan byte SVG yang sama (diuji golden di tahap kontrak). Aturan:
- Draw stream: `keccak256(abi.encodePacked(bytes32 seed, uint32 id, uint32 k))`, 8 lajur 32-bit per kata, `draw(n) = lane % n`.
- Tingkat: Feistel 4 putaran pada 12 bit (dua paruh 6 bit), fungsi putaran `keccak256(abi.encodePacked(bytes32 key, uint8 r, uint8 half)) & 63`, cycle-walking ke domain 2.222, lalu batas kumulatif 1.200/1.800/2.100/2.200/2.222.
- Penempatan: kanvas 400, bidang x 44..356, y 60..332, jarak minimum 34, 24 percobaan per bintang, lalu fallback kisi heksagonal (95 slot; tiap bintang memblokir paling banyak 5 slot, jadi selalu ada slot kosong untuk bintang ke-16). Bukti ada di komentar `spec.ts` dan diuji.
- Garis: MST Prim O(n²) dengan jarak kuadrat bilangan bulat, seri dipecah oleh indeks terkecil.
- Tanda tingkat (jari-jari luar): Dust titik 8, Ember cincin 11, Star 4 sudut 18, Giant 8 sudut 20, Nova 8 sudut + cincin 25 + lingkaran pancar putus-putus 33. Pancaran Nova (33) lebih kecil dari jarak minimum (34), jadi tidak pernah menutupi bintang lain.
- Hasil uji pada seed contoh (`keccak256("asterism-styleguide-example")`): 2.222 id, 2.222 gambar unik, SVG terbesar 2.436 byte (termasuk nama), maksimal 10 kata keccak per rasi, fallback tidak pernah terpakai, hitungan tingkat tepat 1.200/600/300/100/22, tidak ada garis berpotongan, jarak minimum selalu terpenuhi, tanda tidak pernah menyentuh pita teks.

D-015. **Versi situs yang dikunci:** next 16.4.6, react dan react-dom 19.3.1, viem 2.57.17, typescript 5.9.3 (bukan 7.x, karena kompiler Go-native belum tentu kompatibel dengan build Next), vitest 5.1.0, @types/node 22.19.1, font dari @fontsource-variable 5.3.0 (Archivo dengan sumbu wdth 62 sampai 125, Martian Mono wght; keduanya OFL, lisensi disalin ke `web/src/fonts/`). Next 16.4.6 dirilis 9 November 2026; catatan rilisnya belum bisa dibaca dari sesi ini, jadi perlu dicek ulang sebelum deploy.

D-016. **Static export:** didukung oleh Next 16.4.6 (`output: "export"`, docs terpasang `01-app/02-guides/static-exports.md`). `headers`, `redirects`, dan `rewrites` di next.config tidak didukung pada static export, jadi header keamanan akan ditulis di `web/public/_headers` milik Cloudflare Pages. `useSearchParams` untuk `?id=` harus dibungkus `<Suspense>`.

D-017. **Alur kerja berkas:** build, uji, dan screenshot dijalankan di kontainer cloud sesi ini (node 22, pnpm 10.28, Playwright). Sumber (tanpa `node_modules`, `.next`, `out`) disalin ke folder pemilik setelah setiap tahap. Folder pemilik adalah salinan utama. Di Mac: `cd web && pnpm install && pnpm test && pnpm build`.

## Tahap kontrak, situs, dan operasional (keputusan dan selisih tambahan)

D-018. **Kompilasi dan uji di kontainer cloud** tetap sesuai D-001; versi: Foundry 1.8.7, solc 0.8.28, evm `cancun`, optimizer 200, `bytecode_hash = none`, `cbor_metadata = false`, `deny_warnings`, `offline = true` (agar forge tidak menghubungi Sourcify). Dependensi dikunci per commit di `contracts/install-deps.sh`: dn404 v0.0.25 (3397cb1…; commit perbaikan Guardian 3bd0698 adalah leluhurnya), solady v0.1.26 (acd959a…), forge-std v1.16.2 (bf647bd…).

D-019. **DN404 berasal dari Vectorized/dn404, bukan Solady** (S-1). Solady dipakai hanya untuk `Base64`, `LibString`, dan `ReentrancyGuardTransient`.

D-020. **Jendela reveal berupa durasi setelah finalisasi** (`revealWindow`), bukan tanggal mutlak (`REVEAL_DEADLINE`). Alasan: finalisasi yang terlambat tidak boleh menyisakan revealer tanpa waktu. `revealDeadline() = finalizedAt + revealWindow`.

D-021. **Permit2 tidak punya izin tak-terhingga bawaan** (`_givePermit2DefaultInfiniteAllowance` mengembalikan false). Pemegang menyetujui secara eksplisit.

D-022. **Kunci transfer:** `!tradingOpen && from != launcher` pada `_transfer` dan `_transferFromNFT`. `openTrading()` dipanggil di dalam `finalizeLaunch` sebelum panggilan ke pool, karena `skim` Uniswap melakukan transfer (juga bernilai nol) yang akan tertahan kunci.

D-023. **skipNFT:** `mintSale` menyetel "terima NFT" untuk pembeli yang flag-nya belum diinisialisasi, karena DN404 secara bawaan melewatkan NFT untuk kontrak dan akun EIP-7702. Pool, sink, dan launcher ditandai skipNFT secara eksplisit.

D-024. **Reentrancy:** `ReentrancyGuardTransient` milik Solady dipaksa memakai penyimpanan transien di semua rantai (`_useTransientReentrancyGuardOnlyOnMainnet()` mengembalikan false). Robinhood Chain mendukung TSTORE (diperiksa di sesi).

D-025. **Donasi ke pair:** donasi token atau WETH ke pair yang belum sinkron di-`skim` ke treasury saat finalisasi; donasi WETH yang sudah sinkron dibalas dengan token tambahan (dibatasi ruang di bawah suplai maksimum) agar harga pembuka tetap sama dengan harga jual. Donasi sebesar apa pun tidak bisa memblokir finalisasi. Pembulatan ETH selalu ke treasury (T-2).

D-026. **Minimal satu token likuiditas** untuk finalisasi (`NotFinalizable` bila `sold == 0` atau likuiditas nol); setelah jendela habis, jalur refund terbuka.

D-027. **Pitfall Foundry 1.8.7:** `vm.expectRevert` yang diikuti `new` mengakhiri tes lebih awal tanpa melaporkan kasus berikutnya. `ParamsTest` dan `RendererTest` memakai `try/catch` dengan penghitung; urutan expectRevert berbasis panggilan diverifikasi berjalan penuh lewat tes kenari.

D-028. **Forge lint** dijalankan pada setiap build. Pengecualian global: `uninitialized-local`, `encode-packed-collision` (semua masukan `abi.encodePacked` berlebar tetap), `block-timestamp` (jendela skala jam), `require-revert-in-loop`. Pengecualian baris diberi alasan.

D-029. **`/api/rpc`:** hanya 12 metode baca; `eth_call` dan `eth_estimateGas` hanya ke alamat proyek atau Multicall3 `aggregate3` dengan semua target milik proyek (≤500 panggilan); `eth_getLogs` hanya untuk alamat proyek (≤5), rentang ≤ `MAX_LOG_RANGE`; badan ≤ 64 KB, batch ≤ 25; asal permintaan harus sama dengan situs atau masuk `ALLOWED_ORIGINS`; pembatas laju opsional (`RPC_LIMITER`); galat sanitasi mempertahankan data revert hex; cache 60 detik hanya untuk `eth_chainId` dan `eth_getCode`. Cloudflare Workers hanya mendukung `redirect: "follow" | "manual"`, jadi proxy memakai `manual` dan menganggap status ≥ 300 sebagai kegagalan.

D-030. **Geoblock** memakai `request.cf.country` (header `CF-IPCountry` hanya bila `request.cf` tidak ada, yaitu pengembangan lokal). `wrangler pages dev` memberi `cf.country = "US"` palsu; uji geoblock memakai `BLOCKED_COUNTRIES=US`.

D-031. **CSP per halaman** lewat `out/_headers` dengan hash sha256 skrip inline (tanpa `unsafe-inline` untuk skrip), terpanjang 482 karakter (batas Cloudflare 2.000). `connect-src` hanya `self` dan dua explorer; `CSP_EXTRA_CONNECT` untuk build uji lokal.

D-032. **Mock wallet untuk e2e** hanya aktif bila `NEXT_PUBLIC_E2E=1` (build `out-e2e`, tidak pernah dipakai produksi); `secrets:check` memindai `out/` dan `out-e2e/` agar nama variabel rahasia server tidak bocor ke bundel.

D-033. **Kinerja:** galeri contoh menghitung 2.222 rasi di thread utama dalam irisan berbatas waktu 10 ms; item dimemo; 24 kartu per halaman; Suspense memesan tinggi layar penuh agar footer tidak bergeser (CLS 0). Lighthouse mobile pada build mainnet (belum dideploy) bervariasi ±4 poin antar-run: Home 90–97, Launch 93–97, Gallery 88–90, Observatory 90–97, Rules 89–95, Contracts 91–93; Accessibility 98–100, Best Practices 96, SEO 100.

D-034. **Skrip pemilik:** `scripts/gen-commit.mjs` (rahasia ke berkas 0600 di luar repo, tidak dicetak), `scripts/deploy.sh` (hanya `--account`/`--ledger`; menolak bila variabel kunci mentah terisi; simulasi bawaan, `--broadcast` eksplisit; diuji di anvil dengan keystore uji berisi kunci uji bawaan anvil).

D-035. **Dokumen untuk auditor ditulis dalam bahasa Inggris** (`docs/AUDIT-PACKET.md`); dokumen untuk pemilik (`docs/LAUNCH-CHECKLIST.md`, berkas ini) dalam bahasa Indonesia.

D-036. **Analisis statis:** Slither 0.11.6 dijalankan pada `contracts/src` (14 kontrak, 81 detektor, 27 hasil). Tidak ada temuan yang menuntut perubahan kode; triase per detektor ada di `docs/AUDIT-PACKET.md` bagian 9b. Aderyn belum dijalankan.

D-037. **Perbaikan profil Foundry:** `foundry.toml` semula menunjuk ke `/opt/solc/solc-0.8.28` dan `offline = true`, jalur yang hanya ada di kontainer sesi ini dan akan membuat `forge build` gagal di mesin pemilik. Profil bawaan sekarang `solc = "0.8.28"` tanpa `offline`; jalur lokal dan mode offline pindah ke `[profile.container]` (`FOUNDRY_PROFILE=container`). Bytecode tidak berubah (ABI dan hash kode yang disimpan identik setelah dibangun ulang; 70 tes tetap lulus).

D-038. **DEX untuk gladi bersih testnet:** `script/DeployTestnetDex.s.sol` (via `scripts/deploy.sh dex-testnet`) men-deploy WETH pengganti dan factory V2-kompatibel dari mock repo, hanya di chain 46630 atau anvil; menolak chain lain termasuk mainnet (diuji dengan anvil ber-chain-id 4663). Ini bukan kontrak Uniswap; gladi bersih membuktikan alur, bukan perilaku Uniswap asli.

D-039. **Lint dan CI:** `eslint` 10.14.0 dan `eslint-config-next` 16.4.6 (konfigurasi `eslint.config.mjs` sesuai docs terpasang); dua pelanggaran `react-hooks/set-state-in-effect` diperbaiki (pilihan aset di Observatory diturunkan, bukan disimpan lewat efek; hitung sifat galeri tanpa seed tidak lagi menyetel state di efek). Alur CI di `.github/workflows/ci.yml` memakai tingkat gratis dan tanpa rahasia.

D-040. **Vercel sebagai host kedua:** pemilik memilih Vercel walaupun saya merekomendasikan Cloudflare Pages. Perubahan: `web/vercel.json` (framework `null`, output `out`, header statis), `web/api/rpc.ts` dan `web/api/geo.ts` (format Web Handler `export default { fetch }`, runtime `nodejs`; format dan `config` dari dokumen Vercel Functions yang dibaca di sesi), logika kebijakan tetap satu di `functions/_lib`. `handleRpc` menerima `siteUrl` opsional karena asal situs di Vercel diturunkan dari header `host`/`x-forwarded-proto` (dokumen "Request headers": `host` berisi domain yang diakses klien), bukan dari `request.url`. Negara di Vercel hanya dari `x-vercel-ip-country` (`geoResponse` dipakai bersama); di Cloudflare tetap `request.cf.country`. Kekurangan yang diterima: tidak ada `RPC_LIMITER` di kode (lihat langkah 7b.4); CSP berupa meta tag karena `_headers` diabaikan Vercel dan `vercel.json` dibaca sebelum build (tanpa `frame-ancestors`, diganti `X-Frame-Options`). Jalur Cloudflare tetap berfungsi (e2e 20/20 setelah perubahan). Batas 2000 karakter CSP hanya berlaku untuk build Cloudflare (D-039 terkait). Perilaku fungsi di platform Vercel sungguhan belum teramati dari sesi ini; hanya diuji lewat unit test dan peramban terhadap halaman statis dengan meta CSP.

D-041. **Bidang ukur Diffraction bergerak.** Memperbarui D-012 atas persetujuan pemilik. Dasar grafit datar memuat tanda silang kisi, cakram bintang, garis pohon rentang minimum, dan cincin difraksi dari titik tekan. Titik dan garis berasal dari geometri renderer referensi dengan seed contoh. Bidang dekoratif ini tidak menyatakan data peluncuran. Warna bidang dibatasi oleh token tinta buram, tanpa gradien, kabut, atau pendar. Bingkai, kontrol, dan indikator memakai rel, sudut potong, dan tanda ukur. Pratinjau seni memakai lapisan SVG terpisah di atas gambar asli, sehingga keluaran renderer tetap sama byte demi byte.

Canvas 2D dimuat setelah `load` pada saat idle bila tersedia, dengan satu loop animasi, rasio piksel maksimum 2, dan jumlah rasi lebih sedikit pada layar kecil atau perangkat dengan sedikit inti. Loop berhenti saat tab tersembunyi atau kanvas di luar layar. Preferensi pengurangan gerak menampilkan bidang statis, meniadakan tarikan tombol, kemiringan panel, dan animasi masuk, serta langsung menampilkan angka terbaru. Token `--field-*` dan `--instrument-*` mengatur palet, geometri, dan durasi. Tidak ada dependensi produksi baru.

Pada pointer halus, reticle mengikuti posisi pointer tanpa mengganti kursor asli dan disembunyikan di atas kontrol masukan. Pada layar sentuh, bintang tetap bergeser pelan dan ketukan menghasilkan cincin. Jeda minimum antar cincin membatasi laju perubahan visual. Uji kontras membandingkan setiap tinta bidang dengan rasio teks di atas `--surface`. Font lokal memakai `font-display: optional` agar font yang terlambat dimuat tidak menggeser tata letak.

Penyempurnaan hero D-041: satu rasi dari renderer referensi dipindai oleh reticle yang bergerak otomatis dan mengikuti pointer saat memasuki bidang gambar. Apertur mempertegas ruas garis yang dilewatinya dan ketukan memicu cincin. Tinta yang lebih terang dibatasi pada kanvas dekoratif di bidang gambar, di luar area judul, tindakan, dan keterangan. Kanvas itu memakai loop animasi bidang yang sama, berhenti digambar saat keluar dari viewport, dan menampilkan satu posisi tetap bila pengurangan gerak aktif. Di ponsel bidang gambar tampil sebelum status peluncuran.

Bidang gambar hero kemudian diperluas menjadi tiga rasi referensi. Garis pemindaian dan reticle berputar bergerak pada periode berbeda, titik cahaya melintasi ruas rasi, dan tiga cincin dari satu ketukan menyorot bintang yang dilalui. Kisi serta tanda skala memberi orientasi pada setiap lapisan. Mode pengurangan gerak tetap menggambar bidang lengkap dalam satu posisi tanpa lintasan cahaya atau gema bergerak.
