PENCATATAN WIFI DARI 0
======================

ISI FILE:
- index.html
- app.js
- style.css
- kode.gs
- netlify/functions/mikrotik.js
- mikrotik_ambil_command.rsc

ALUR FINAL:
Browser / Netlify -> Apps Script -> Google Sheet -> PendingCommand
MikroTik -> Netlify Function -> Apps Script -> Sheet -> PPP Secret dibuat

KENAPA MIKROTIK LEWAT NETLIFY FUNCTION?
RouterOS 6.48.6 sering gagal langsung ke Apps Script karena Google memberi redirect 302.
Netlify Function bisa mengikuti redirect itu, lalu mengirim teks bersih ke MikroTik.

==================================================
TAHAP 1 - GOOGLE SHEET DAN APPS SCRIPT
==================================================
1. Buat Google Spreadsheet baru.
2. Klik Extensions / Ekstensi -> Apps Script.
3. Hapus kode lama.
4. Paste isi kode.gs.
5. Klik Save.
6. Pilih fungsi setupSheets.
7. Klik Run / Jalankan.
8. Beri izin akses.

Sheet yang dibuat:
- Users
- PelangganBaru
- PendingCommand
- LogAktivitas

Akun login awal:
admin / admin123
user / user123

==================================================
TAHAP 2 - DEPLOY APPS SCRIPT
==================================================
1. Klik Deploy -> New deployment.
2. Pilih Web app.
3. Execute as: Me.
4. Who has access: Anyone.
5. Klik Deploy.
6. Copy URL Web App yang berakhiran /exec.

Contoh:
https://script.google.com/macros/s/AKfycbxxxx/exec

==================================================
TAHAP 3 - SET app.js
==================================================
Buka app.js.
Cari:
const WEB_APP_URL = "PASTE_URL_APPS_SCRIPT_EXEC_DI_SINI";

Ganti dengan URL Apps Script /exec.

Contoh:
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxxxx/exec";

==================================================
TAHAP 4 - TES FORM LOKAL
==================================================
1. Buka index.html di browser.
2. Login admin / admin123.
3. Masuk Pelanggan -> Tambah Pelanggan Baru.
4. Isi:
   Nama Pelanggan: ANDI
   Password Pelanggan: 12345
   Profil Paket: 1 Day
5. Klik Simpan.
6. Cek Google Sheet PendingCommand.
7. Harus muncul data status PENDING.

BERHENTI DI SINI DULU SAMPAI PENDINGCOMMAND MUNCUL.

==================================================
TAHAP 5 - UPLOAD KE NETLIFY
==================================================
Upload seluruh folder project ini ke Netlify, termasuk:
- index.html
- app.js
- style.css
- folder netlify/functions/mikrotik.js

Di Netlify buka:
Site settings -> Environment variables

Tambah:
APPS_SCRIPT_URL = URL Apps Script /exec
MIKROTIK_KEY = tandonetwork123

Deploy ulang site.

==================================================
TAHAP 6 - TES NETLIFY FUNCTION
==================================================
Buka browser:
https://NAMA-SITE.netlify.app/.netlify/functions/mikrotik?action=getPendingCommand&key=tandonetwork123

Hasil normal:
EMPTY
atau
OK|CMD-xxx|ANDI|12345|1 Day

Kalau muncul APPS_SCRIPT_URL_BELUM_DIISI, berarti environment variable Netlify belum diset.

==================================================
TAHAP 7 - SET SCRIPT MIKROTIK
==================================================
Buka file mikrotik_ambil_command.rsc.
Ganti:
:local proxyUrl "https://NAMA-SITE-SAMPEAN.netlify.app/.netlify/functions/mikrotik"

Dengan URL Netlify sampean.

Contoh:
:local proxyUrl "https://pencatatan-wifi.netlify.app/.netlify/functions/mikrotik"

Di Winbox:
System -> Scripts -> +
Name: wifi_ambil_command
Paste script.
Klik OK.

==================================================
TAHAP 8 - JALANKAN MANUAL DI MIKROTIK
==================================================
System -> Scripts -> pilih wifi_ambil_command -> Run Script.

Lihat Log.
Kalau berhasil:
WIFI-APP: PPP berhasil dibuat: ANDI

Cek PPP -> Secrets.

Sheet PendingCommand harus berubah dari PENDING menjadi DONE.

==================================================
TAHAP 9 - JADIKAN OTOMATIS
==================================================
Kalau manual sudah berhasil:
System -> Scheduler -> +
Name: wifi_auto_command
Interval: 00:00:30
On Event:
/system script run wifi_ambil_command

==================================================
CATATAN PENTING
==================================================
Nama Profil Paket di aplikasi harus sama persis dengan PPP Profile di MikroTik.
Kalau aplikasi memilih "1 Day", maka di MikroTik harus ada profile bernama "1 Day".

Cek di MikroTik:
PPP -> Profiles
atau terminal:
/ppp profile print
