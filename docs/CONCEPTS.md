# Asterism: Langkah 0, tiga arah visual

Tiga arah untuk situs **dan** seni rasi on-chain. Ketiganya memakai geometri yang sama (pohon rentang minimum, lima tanda tingkat), tetapi dunia, warna, huruf, bentuk, dan cara menggambar bintangnya berbeda. Pratinjau: `docs/concepts-preview.svg` (geometri contoh, seed 417, tingkat Giant, bukan keluaran renderer final).

Kontras di bawah dihitung dengan rumus WCAG 2.x. Font semuanya berlisensi OFL dan bisa di-self-host; ketersediaan file dan subset diperiksa lagi saat membangun token.

Tanda tingkat sama di ketiga arah (bentuk, bukan warna): Dust titik polos, Ember cincin dengan titik, Star bintang 4 sudut, Giant bintang 8 sudut (sudut panjang dan pendek bergantian), Nova bintang 8 sudut dengan cincin dan lingkaran pancar putus-putus. Semua tanda adalah satu warna di atas satu latar, jadi tetap terbaca dalam tangkapan abu-abu.

---

## Arah A: Negative

**a. Ide inti.** Langit dibalik: setiap rasi tampil seperti di negatif kaca seorang astronom, bintang hitam di atas kaca pucat, diukur dan diberi tanda tangan.

**b. Dunia dan alasannya.** Selama hampir seratus tahun, survei langit dilakukan dengan negatif kaca: bintang terekam sebagai titik hitam di kaca bening, diukur dengan reticle dan kisi réseau yang tercetak di kaca, lalu ditandai dengan pensil lilin merah. Dunia ini cocok karena tiga hal. Hening: tidak ada cahaya, hanya catatan. Presisi: semuanya diukur, berkoordinat, bernomor. Jujur: negatif adalah rekaman mentah, apa adanya, dan setiap tanda punya keterangan. Pembalikan ini juga satu-satunya cara tetap bertema bintang tanpa latar angkasa gelap. Untuk kolektor yang teliti, ia terasa seperti arsip pengamatan, bukan poster.

**c. Palet**

| Peran | Hex | Catatan kontras |
|---|---|---|
| Permukaan dasar (kaca) | `#E9ECE7` | |
| Permukaan kedua (kaca buram, panel) | `#F5F6F2` | |
| Teks utama, bintang | `#16181B` | 14,9:1 di kaca |
| Teks redup | `#50575C` | 6,2:1 di kaca, 6,8:1 di panel |
| Aksen utama (pensil lilin) | `#B8321C` | 5,0:1 di kaca; teks putih di atasnya 6,0:1 |
| Garis batas komponen | `#6F7772` | 3,9:1 (lolos 3:1) |
| Status | sukses `#2D6A3E` (5,4:1), peringatan `#8A5300` (5,3:1), bahaya `#8F1D2C` (7,4:1), info `#2B5689` (6,3:1) | selalu dengan ikon dan label |

Mode: terang saja. Alasannya: negatif kaca memang terang, dan teks aturan serta risiko yang panjang lebih nyaman dibaca terang. `color-scheme: light`.

**d. Huruf.**
- Display: **Newsreader** (Production Type), serif teks dengan optical size. Untuk judul dan nama rasi: suara pengamat yang tenang, bukan huruf antik.
- Isi: **Instrument Sans**, grotesk yang rapat dan presisi, dengan lebar sempit untuk label.
- Mono: **Azeret Mono** untuk nomor katalog, koordinat, alamat, dan angka harga (tabular).
- Di dalam SVG token: `serif` generik untuk nama dan `monospace` generik untuk nomor, karena SVG tidak memuat font eksternal.

**e. Bahasa bentuk.**
- Sudut 0 (tepi kaca terpotong). Garis 1px.
- Pemisah lapisan: garis rambut dan beda nada kaca (bening lawan buram). Tanpa bayangan.
- Elevasi: datar (kaca), terangkat (kaca buram + garis rambut), melayang (kaca buram + garis tinta + tepi pemegang 2px berwarna garis, bukan bayangan).
- Tekstur: tidak ada. Hanya kisi réseau tipis di area seni.
- Ikon: set kecil kustom, garis 1,5px, ujung siku, dibangun di atas reticle.
- Gerak: linear yang tenang, seperti mesin ukur yang bergeser. Pendek, tanpa pantulan.
- Seni: latar kaca, garis pohon abu `#858D87` 1px, bintang hitam dalam 3 ukuran, tanda tingkat hitam. Gaya panduan: tanpa panduan, lingkaran ukur konsentris, atau kisi réseau. Sudut registrasi berbentuk L di keempat pojok supaya gambar terbaca sebagai bingkai di marketplace bertema terang.

**f. Detail khas.** Lingkaran pensil lilin. Begitu sebuah rasi menjadi milikmu, situs menggambar elips merah yang sedikit tidak sempurna (dari seed) di sekelilingnya, dan namanya tertulis di sampingnya. Itu satu-satunya warna merah di halaman. Di galeri, kamu mengenali milikmu dari jauh.

**g. Risiko.**
- Bisa terasa klinis, dingin, atau "belum jadi" di samping NFT gelap yang ramai. Kehangatan harus datang dari serif dan pensil merah, bukan dari hiasan.
- Mudah tergelincir ke kesan arsip lama. Larangan keras: tanpa sepia, tanpa tekstur kertas, tanpa tulisan tangan, tanpa bahasa museum.
- Aksen merah berdekatan dengan warna bahaya. Mitigasi: bahaya selalu berupa blok dengan ikon dan label, aksen selalu berupa garis pensil atau tombol utama.
- Yang dikorbankan: kemegahan visual. Tidak ada cahaya, tidak ada efek.

---

## Arah B: Lightbox

**a. Ide inti.** Setiap rasi adalah kartu yang dilubangi mesin potong, dan cahaya datang dari belakang.

**b. Dunia dan alasannya.** Kartu bintang berlubang yang ditaruh di atas kotak lampu, cakram proyektor planetarium, dan presisi pisau potong (die-cut) di percetakan. Hening: cahayanya hangat dan pelan, tidak berpendar. Presisi: lubang dipotong mesin, posisinya pasti. Jujur: lubang adalah lubang; yang kamu lihat persis yang ada. Untuk kolektor, arah ini terasa seperti benda yang bisa dipegang dan disimpan.

**c. Palet**

| Peran | Hex | Catatan kontras |
|---|---|---|
| Permukaan dasar (karton umber) | `#2A1F1A` | |
| Permukaan kedua (kartu terangkat) | `#3A2B24` | |
| Teks utama, cahaya lubang | `#F8EAD2` | 13,5:1 |
| Teks redup | `#C9B49B` | 8,0:1 di dasar, 6,8:1 di kartu |
| Aksen utama (lampu) | `#FFD7A1` | tombol menyala dengan teks umber 11,8:1 |
| Aksen pendukung (tautan) | `#9CC3B0` | 8,3:1 |
| Garis batas komponen | `#8A7262` | 3,6:1 |
| Status | sukses `#8FD3A0`, peringatan `#E9A23B`, bahaya `#FF8E7E`, info `#9DC4F0` (semua di atas 7:1) | selalu dengan ikon dan label |

Mode: gelap hangat saja. Alasannya: cahaya dari lubang hanya terbaca di karton gelap; umber dipilih supaya tidak jatuh ke biru tua, hitam-ungu, atau hijau meja judi. `color-scheme: dark`.

**d. Huruf.**
- Display: **Young Serif**, serif tebal dan hangat yang terasa seperti huruf yang dicap.
- Isi: **Atkinson Hyperlegible Next**, dirancang untuk keterbacaan tinggi, cocok untuk teks terang di latar gelap.
- Mono: **Atkinson Hyperlegible Mono** untuk angka dan alamat.
- Di SVG token: `sans-serif` generik.

**e. Bahasa bentuk.**
- Sudut 10px untuk kartu, 6px untuk kontrol (karton dipotong dengan pisau bersudut bulat).
- Pemisah lapisan: kedalaman. Lapisan cekung lebih gelap, kartu terangkat punya satu garis terang 1px di tepi atas (cahaya dari belakang). Tanpa bayangan kabur.
- Elevasi: cekung, kartu, kartu di atas kartu.
- Tekstur: tidak ada; motif baris perforasi sebagai pembatas.
- Ikon: garis 2px, ujung membulat.
- Gerak: pegas lembut; kartu terangkat sedikit, cahaya menyala pelan.
- Seni: karton umber dengan bingkai potong dalam, garis pohon sebagai garis lipat putus-putus, bintang sebagai lubang bercahaya dengan cincin gelap tipis. Gaya panduan: tanpa panduan, cincin konsentris, atau kisi alas potong.

**f. Detail khas.** Sobekan tanda terima. Setelah pembelian berhasil, tanda terima keluar sebagai potongan kartu yang sobek mengikuti garis perforasi, membawa hash transaksi dan tautan explorer. Perayaan dan bukti sekaligus.

**g. Risiko.**
- Bisa terasa seperti merek alat tulis atau kerajinan: manis, nyaman, kurang presisi.
- Cokelat gelap bisa tampak kusam di layar murah.
- Aksen lampu dan warna peringatan sama-sama hangat; ikon dan label wajib.
- Metafora tidak sempurna untuk garis (garis tidak bisa jadi lubang, jadi diganti garis lipat).
- Motif tiket dan perforasi umum di aplikasi acara.
- Yang dikorbankan: kesan ilmiah dan ketajaman.

---

## Arah C: Diffraction

**a. Ide inti.** Rasi dibaca seperti layar instrumen optik: setiap bintang adalah titik cahaya dengan pola difraksi, dan tingkat adalah seberapa terang bintang utamanya "berdering".

**b. Dunia dan alasannya.** Teleskop pemantul menghasilkan paku difraksi dari penyangga cermin dan cincin Airy di sekitar bintang terang. Tanda tingkat punya alasan fisik: Dust tanpa paku, Ember cincin, Star 4 paku, Giant 8 paku, Nova 8 paku dengan cincin dan pancaran. Hening: layar instrumen tanpa hiasan. Presisi: reticle, fokus, angka. Jujur: pembacaan alat, bukan ilustrasi. Untuk pengguna crypto-native, ini terasa seperti alat, bukan pameran.

**c. Palet**

| Peran | Hex | Catatan kontras |
|---|---|---|
| Permukaan dasar (grafit netral) | `#121315` | |
| Permukaan kedua | `#1C1D20` | |
| Teks utama | `#ECEDEE` | 15,9:1 |
| Teks redup | `#9A9EA6` | 6,9:1 di dasar, 6,3:1 di panel |
| Aksen utama (konfirmasi fokus) | `#B9F15A` | 14,0:1; teks grafit di atasnya 14,0:1 |
| Aksen pendukung (cahaya bintang) | `#FFF4E0` | |
| Garis batas komponen | `#6A6E76` | 3,6:1 |
| Status | sukses `#4FD1A1`, peringatan `#F0B04A`, bahaya `#FF7B6B`, info `#7FB2FF` (semua di atas 7:1) | selalu dengan ikon dan label |

Mode: gelap netral saja. Grafit dipilih abu murni (bukan biru tua atau ungu). `color-scheme: dark`.

**d. Huruf.**
- Display dan isi: **Archivo** (Omnibus-Type), grotesk dengan sumbu lebar; lebar lapang untuk judul, sempit untuk label pembacaan.
- Mono: **Martian Mono**, mono teknis dengan lebar variabel, untuk angka, alamat, dan pembacaan.
- Di SVG token: `monospace` generik.

**e. Bahasa bentuk.**
- Sudut 2px. Garis 1px.
- Pemisah lapisan: langkah kecerahan. Elevasi: datar, terangkat (+1 langkah), melayang (+2 langkah + cincin 1px).
- Tekstur: tidak ada; motif tanda reticle di tepi bingkai dan glif paku.
- Ikon: garis 1,25px, ujung datar.
- Gerak: bertahap dan tegas, seperti motor fokus yang melangkah.
- Seni: grafit, garis pohon abu `#4B4E55`, bintang putih hangat, paku pada bintang paling terang. Gaya panduan: tanpa panduan, cincin fokus, atau kisi piksel sensor.

**f. Detail khas.** Titik konfirmasi fokus. Titik hijau-kuning kecil di sudut formulir hanya menyala bila simulasi transaksimu lolos. "In focus" sebelum kamu menandatangani.

**g. Risiko.**
- Paling dekat dengan bawaan kategori: bintang di latar gelap. Meski grafit, bisa tetap terbaca sebagai "kosmik generik".
- Hijau-kuning di latar gelap bisa terasa seperti neon "degen".
- Teks aturan dan risiko yang panjang lebih melelahkan di latar gelap.
- Paku di banyak bintang bisa ramai di ukuran kecil.
- Yang dikorbankan: orisinalitas.

---

## Rekomendasi: A, Negative

1. Ia satu-satunya arah yang menyelesaikan larangan latar angkasa gelap dari akarnya: langitnya dibalik, bukan diwarnai ulang. Di kategori yang hampir seluruhnya gelap, gambar terang bertinta hitam akan langsung menonjol.
2. Keterbacaan tingkat dalam abu-abu paling tinggi: bentuk hitam di atas kaca pucat (14,9:1), tanpa bergantung pada cahaya atau warna.
3. Metaforanya sama dengan janji produk. Negatif adalah rekaman mentah yang diukur dan diberi keterangan; situs ini juga hanya mencatat apa yang ada di chain dan mengajak orang memeriksanya sendiri (commit, reveal, hash kode).
4. Mode terang membuat aturan, risiko, dan ringkasan sebelum tanda tangan nyaman dibaca, dan itu bagian terpenting dari situs ini.
5. Lingkaran pensil lilin memberi kepemilikan sebuah tanda yang personal tanpa gamifikasi.

Risiko utamanya (klinis, kesan arsip) dikendalikan dengan aturan: tanpa sepia, tekstur, atau tulisan tangan; kehangatan hanya dari serif dan satu warna merah.

B adalah alternatif bila pemilik ingin produk yang lebih hangat dan lebih terasa sebagai benda koleksi. C adalah pilihan paling aman bagi pasar, tetapi paling lemah orisinalitasnya.
