# SecureLogix Expedition System (UTS Jaringan)

Aplikasi Sistem Informasi Ekspedisi sederhana yang mengimplementasikan keamanan data menggunakan algoritma **Stream Cipher RC4**.

## Fitur
- **Input Pengiriman**: Mencatat data pengirim, penerima, dan paket.
- **Enkripsi RC4**: Alamat pengiriman dienkripsi sebelum disimpan ke database SQLite.
- **Dashboard Monitor**: Melihat data yang tersimpan dalam bentuk terenkripsi (keamanan data di sisi database/jaringan).
- **Dekripsi On-Demand**: Fitur untuk mendekripsi data kembali ke bentuk teks asli.

## Algoritma Stream Cipher: RC4
RC4 adalah stream cipher yang didesain oleh Ronald Rivest. Cara kerjanya:
1. **Key Scheduling Algorithm (KSA)**: Inisialisasi S-Box (larik 256 byte) berdasarkan kunci rahasia.
2. **Pseudo-Random Generation Algorithm (PRGA)**: Menghasilkan aliran bit acak (keystream).
3. **XOR Operation**: Keystream di-XOR dengan teks asli (plaintext) untuk menghasilkan ciphertext.

## Cara Menjalankan
1. Pastikan Node.js sudah terinstal.
2. Jalankan Backend (Server & Database):
   ```bash
   node server.js
   ```
3. Jalankan Frontend (UI):
   ```bash
   npm run dev
   ```
4. Buka browser ke alamat yang muncul (biasanya `http://localhost:5173`).

## Teknologi
- **Frontend**: React.js + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite3
- **Cipher**: RC4 (Manual Implementation)
