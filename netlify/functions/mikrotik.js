/*
  NETLIFY FUNCTION PROXY UNTUK MIKROTIK

  Tujuan:
  MikroTik RouterOS lama sering gagal langsung ke Google Apps Script karena redirect 302.
  Function ini menjadi jembatan:
  MikroTik -> Netlify Function -> Apps Script -> Sheet

  Setting di Netlify:
  Site settings -> Environment variables
  APPS_SCRIPT_URL = URL Apps Script /exec
  MIKROTIK_KEY = tandonetwork123
*/

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwtSHunV_u3hyuNZjkBGJTxwVi3XQoPrjT0n_8wYiggtrokRqjocdHk9tFHXund-D4c/exec';
const DEFAULT_KEY = 'tandonetwork123';

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const action = params.action || 'ping';
  const key = params.key || '';

  const gasUrl = process.env.APPS_SCRIPT_URL || DEFAULT_GAS_URL;
  const allowedKey = process.env.MIKROTIK_KEY || DEFAULT_KEY;

  if (!gasUrl || gasUrl.includes('PASTE_URL')) {
    return plain(500, 'ERROR|APPS_SCRIPT_URL_BELUM_DIISI');
  }

  if (key !== allowedKey) {
    return plain(403, 'ERROR|KEY_SALAH');
  }

  const url = new URL(gasUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('key', allowedKey);

  if (params.id) url.searchParams.set('id', params.id);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.message) url.searchParams.set('message', params.message);

  try {
    const res = await fetch(url.toString(), { redirect: 'follow' });
    const text = await res.text();
    return plain(200, text.trim());
  } catch (err) {
    return plain(500, 'ERROR|' + String(err.message || err).replace(/[|\r\n]/g, ' '));
  }
};

function plain(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body
  };
}
