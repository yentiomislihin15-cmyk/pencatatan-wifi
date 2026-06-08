/*
  NETLIFY FUNCTION PROXY UNTUK MIKROTIK

  Tujuan:
  MikroTik RouterOS lama sering gagal langsung ke Google Apps Script karena redirect 302.
  Function ini menjadi jembatan:

  MikroTik -> Netlify Function -> Apps Script -> Sheet

  Setting di Netlify:
  Project configuration -> Environment variables

  APPS_SCRIPT_URL = URL Apps Script /exec
  MIKROTIK_KEY = tandonetwork123

  Support:
  1. GET dari browser:
     /.netlify/functions/mikrotik?action=getPendingCommand&key=tandonetwork123

  2. POST dari MikroTik tanpa tanda ?:
     /tool fetch url="https://pencatatan-wifi.netlify.app/.netlify/functions/mikrotik" mode=https check-certificate=no output=user http-method=post http-data="action=getPendingCommand&key=tandonetwork123"
*/

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwtSHunV_u3hyuNZjkBGJTxwVi3XQoPrjT0n_8wYiggtrokRqjocdHk9tFHXund-D4c/exec';
const DEFAULT_KEY = 'tandonetwork123';

exports.handler = async function(event) {
  const gasUrl = process.env.APPS_SCRIPT_URL || DEFAULT_GAS_URL;
  const allowedKey = process.env.MIKROTIK_KEY || DEFAULT_KEY;

  if (!gasUrl || gasUrl.includes('PASTE_URL')) {
    return plain('ERROR|APPS_SCRIPT_URL_BELUM_DIISI');
  }

  const params = getParams(event);

  const action = clean(params.action || 'ping');
  const key = clean(params.key || '');
  const id = clean(params.id || '');
  const status = clean(params.status || '');
  const message = clean(params.message || params.msg || '');
  const data = cleanData(params.data || '');

  if (key !== allowedKey) {
    return plain('ERROR|KEY_SALAH');
  }

  const allowedActions = [
    'ping',
    'getPendingCommand',
    'markCommandDone',
    'markCommandError',
    'saveSyncExpire'
  ];

  if (!allowedActions.includes(action)) {
    return plain('ERROR|ACTION_TIDAK_DIKENAL');
  }

  const targetUrl = new URL(gasUrl);
  targetUrl.searchParams.set('action', action);
  targetUrl.searchParams.set('key', allowedKey);

  if (id) targetUrl.searchParams.set('id', id);
  if (status) targetUrl.searchParams.set('status', status);
  if (message) targetUrl.searchParams.set('message', message);
  if (data) targetUrl.searchParams.set('data', data);

  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await res.text();
    return plain(String(text || '').trim());
  } catch (err) {
    return plain('ERROR|' + clean(err.message || err));
  }
};

function getParams(event) {
  const result = {};

  const query = event.queryStringParameters || {};
  Object.keys(query).forEach(function(key) {
    result[key] = query[key];
  });

  if (event.body) {
    let body = event.body;

    if (event.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf8');
    }

    body.split('&').forEach(function(part) {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) return;

      const rawKey = part.slice(0, eqIndex);
      const rawValue = part.slice(eqIndex + 1);

      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));

      if (key) result[key] = value;
    });
  }

  return result;
}

function cleanData(value) {
  return String(value || '')
    .replace(/[\r\n]/g, '')
    .trim();
}

function clean(value) {
  return String(value || '')
    .replace(/[|\r\n]/g, ' ')
    .trim();
}

function plain(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: String(body || '')
  };
}
