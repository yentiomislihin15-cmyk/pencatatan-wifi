/*
  BACKEND GOOGLE APPS SCRIPT - PENCATATAN WIFI

  CARA AWAL:
  1. Paste file ini ke Apps Script dari Google Spreadsheet.
  2. Jalankan setupSheets() satu kali.
  3. Deploy sebagai Web App:
     - Execute as: Me
     - Who has access: Anyone
  4. Copy URL /exec ke app.js dan Netlify Function.
*/

const MIKROTIK_KEY = 'tandonetwork123';

const SHEETS = {
  USERS: 'Users',
  PELANGGAN_BARU: 'PelangganBaru',
  PENDING: 'PendingCommand',
  LOG: 'LogAktivitas'
};

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const users = ensureSheet_(ss, SHEETS.USERS, [
    'Username', 'Password', 'Nama', 'Role', 'Token', 'Status'
  ]);

  if (users.getLastRow() < 2) {
    users.appendRow(['admin', 'admin123', 'Administrator', 'Admin', makeToken_(), 'Active']);
    users.appendRow(['user', 'user123', 'User', 'User', makeToken_(), 'Active']);
  }

  ensureSheet_(ss, SHEETS.PELANGGAN_BARU, [
    'ID', 'Tanggal', 'Nama Pelanggan', 'Password', 'Profil Paket', 'Status'
  ]);

  ensureSheet_(ss, SHEETS.PENDING, [
    'ID', 'Tanggal', 'Nama', 'Password', 'Profil', 'Command', 'Status', 'EksekusiPada', 'Pesan'
  ]);

  ensureSheet_(ss, SHEETS.LOG, [
    'Tanggal', 'Aktivitas', 'Detail'
  ]);

  return 'Setup sheet selesai';
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action;

    if (action === 'login') return json_(login_(body));
    if (action === 'addPelangganBaru') return json_(addPelangganBaru_(body));

    return json_({ success: false, message: 'Action tidak dikenal: ' + action });
  } catch (err) {
    return json_({ success: false, message: err.message });
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'ping';

  try {
    if (action === 'ping') {
      return text_('OK|BACKEND_AKTIF');
    }

    if (action === 'getPendingCommand') {
      if (p.key !== MIKROTIK_KEY) return text_('ERROR|KEY_SALAH');
      return text_(getPendingCommand_());
    }

    if (action === 'markCommandDone') {
      if (p.key !== MIKROTIK_KEY) return text_('ERROR|KEY_SALAH');
      return text_(markCommand_(p.id, p.status || 'DONE', p.message || 'OK'));
    }

    return text_('ERROR|ACTION_TIDAK_DIKENAL');
  } catch (err) {
    return text_('ERROR|' + cleanText_(err.message));
  }
}

function login_(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();

  if (!username || !password) throw new Error('Username dan password wajib diisi');

  const sheet = getSheet_(SHEETS.USERS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const [u, p, nama, role, token, status] = rows[i];
    if (String(u) === username && String(p) === password && String(status) === 'Active') {
      return {
        success: true,
        user: {
          username: String(u),
          nama: String(nama),
          role: String(role),
          token: String(token)
        }
      };
    }
  }

  return { success: false, message: 'Username atau password salah' };
}

function addPelangganBaru_(body) {
  validateToken_(body.token);

  const data = body.pelangganBaru || {};
  const nama = cleanName_(data.nama);
  const password = cleanText_(data.password);
  const profil = cleanText_(data.profilPaket);

  if (!nama) throw new Error('Nama pelanggan wajib diisi');
  if (!password) throw new Error('Password pelanggan wajib diisi');
  if (!profil) throw new Error('Profil paket wajib dipilih');

  const now = new Date();
  const id = 'CMD-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
  const command = '/addppp ' + nama + ' ' + password + ' ' + profil;

  getSheet_(SHEETS.PELANGGAN_BARU).appendRow([
    id, now, nama, password, profil, 'BARU'
  ]);

  getSheet_(SHEETS.PENDING).appendRow([
    id, now, nama, password, profil, command, 'PENDING', '', ''
  ]);

  log_('ADD_PELANGGAN_BARU', command);

  return {
    success: true,
    message: 'Data pelanggan baru disimpan dan command masuk PendingCommand',
    id: id
  };
}

function getPendingCommand_() {
  const sheet = getSheet_(SHEETS.PENDING);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][0] || '');
    const nama = String(rows[i][2] || '');
    const password = String(rows[i][3] || '');
    const profil = String(rows[i][4] || '');
    const status = String(rows[i][6] || '');

    if (status === 'PENDING') {
      return ['OK', id, nama, password, profil].join('|');
    }
  }

  return 'EMPTY';
}

function markCommand_(id, status, message) {
  if (!id) return 'ERROR|ID_KOSONG';

  const sheet = getSheet_(SHEETS.PENDING);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.getRange(i + 1, 7).setValue(status);
      sheet.getRange(i + 1, 8).setValue(new Date());
      sheet.getRange(i + 1, 9).setValue(message);
      log_('MARK_COMMAND', id + ' -> ' + status + ' / ' + message);
      return 'OK|UPDATED';
    }
  }

  return 'ERROR|ID_TIDAK_DITEMUKAN';
}

function validateToken_(token) {
  if (!token) throw new Error('Token kosong. Silakan login ulang.');

  const sheet = getSheet_(SHEETS.USERS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) === String(token) && String(rows[i][5]) === 'Active') {
      return true;
    }
  }

  throw new Error('Sesi tidak valid. Silakan login ulang.');
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmpty = firstRow.every(v => String(v || '').trim() === '');
    if (isEmpty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(1);
  return sheet;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet belum ada: ' + name + '. Jalankan setupSheets().');
  return sheet;
}

function log_(aktivitas, detail) {
  try {
    getSheet_(SHEETS.LOG).appendRow([new Date(), aktivitas, detail]);
  } catch (_) {}
}

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function cleanName_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]/g, '_');
}

function cleanText_(value) {
  return String(value || '')
    .trim()
    .replace(/[|]/g, ' ')
    .replace(/[\r\n]/g, ' ');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(text) {
  return ContentService
    .createTextOutput(String(text))
    .setMimeType(ContentService.MimeType.TEXT);
}
