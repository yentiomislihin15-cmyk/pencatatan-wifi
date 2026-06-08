/*
  FRONTEND PENCATATAN WIFI

  Untuk lokal/Netlify:
  1. Deploy kode.gs sebagai Web App Google Apps Script.
  2. Copy URL Web App yang berakhiran /exec.
  3. Tempel ke WEB_APP_URL di bawah ini.
*/
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwtSHunV_u3hyuNZjkBGJTxwVi3XQoPrjT0n_8wYiggtrokRqjocdHk9tFHXund-D4c/exec";

const state = {
  user: null
};

const $ = (id) => document.getElementById(id);

function showMsg(el, text, type = "info") {
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
  if (text) {
    setTimeout(() => {
      el.textContent = "";
      el.className = "msg";
    }, 3500);
  }
}

async function api(action, payload = {}) {
  if (!WEB_APP_URL || WEB_APP_URL.includes("PASTE_URL")) {
    throw new Error("WEB_APP_URL belum diisi di app.js");
  }

  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Terjadi kesalahan server");
  return data;
}

function saveSession(user) {
  localStorage.setItem("wifi_user", JSON.stringify(user));
}

function loadSession() {
  try {
    const raw = localStorage.getItem("wifi_user");
    state.user = raw ? JSON.parse(raw) : null;
  } catch (_) {
    state.user = null;
  }
}

function clearSession() {
  localStorage.removeItem("wifi_user");
  state.user = null;
}

function showPage() {
  if (state.user) {
    $("loginPage").classList.add("hidden");
    $("dashboardPage").classList.remove("hidden");
    $("userInfo").textContent = `${state.user.nama} • ${state.user.role}`;
    backToMenu();
  } else {
    $("loginPage").classList.remove("hidden");
    $("dashboardPage").classList.add("hidden");
  }
}

async function login(e) {
  e.preventDefault();
  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value.trim();

  try {
    showMsg($("loginMsg"), "Memeriksa akun...", "info");
    const data = await api("login", { username, password });
    state.user = data.user;
    saveSession(data.user);
    showMsg($("loginMsg"), "Login berhasil", "success");
    showPage();
  } catch (err) {
    showMsg($("loginMsg"), err.message, "error");
  }
}

function openMenu(menu) {
  const titles = {
    pelanggan: "Pelanggan",
    perpanjang: "Perpanjang Paket",
    laporan: "Laporan"
  };

  document.querySelector(".dashboard-menu-card").classList.add("hidden");
  $("contentCard").classList.remove("hidden");
  $("contentTitle").textContent = titles[menu] || "Menu";

  if (menu === "pelanggan") {
    $("contentBody").className = "submenu-box";
    $("contentBody").innerHTML = `
      <p class="menu-note">Silakan pilih menu pelanggan.</p>
      <div class="submenu-grid">
        <button class="menu-card" type="button" onclick="openSubMenu('tambahPelanggan')">
          <span class="menu-icon">➕</span>
          <strong>Tambah Pelanggan</strong>
          <small>Menu tambah data pelanggan</small>
        </button>

        <button class="menu-card" type="button" onclick="openSubMenu('tambahPelangganBaru')">
          <span class="menu-icon">🆕</span>
          <strong>Tambah Pelanggan Baru</strong>
          <small>Buat PPP Secret baru</small>
        </button>
      </div>
    `;
    return;
  }

  const descriptions = {
    perpanjang: "Menu perpanjang paket sudah disiapkan. Isi detailnya nanti kita susun.",
    laporan: "Menu laporan sudah disiapkan. Isi detailnya nanti kita susun."
  };

  $("contentBody").className = "placeholder-box";
  $("contentBody").innerHTML = `<p>${descriptions[menu] || "Isi menu nanti disusun di sini."}</p>`;
}

function openSubMenu(submenu) {
  const titles = {
    tambahPelanggan: "Tambah Pelanggan",
    tambahPelangganBaru: "Tambah Pelanggan Baru"
  };

  $("contentTitle").textContent = titles[submenu] || "Menu Pelanggan";

  if (submenu === "tambahPelangganBaru") {
    const opsiPaket = Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      return `<option value="${day} Day">${day} Day</option>`;
    }).join("");

    $("contentBody").className = "form-box";
    $("contentBody").innerHTML = `
      <form id="formPelangganBaru" class="form pelanggan-baru-form" onsubmit="simpanPelangganBaru(event)">
        <label>Nama Pelanggan</label>
        <input id="namaPelangganBaru" type="text" placeholder="Contoh: ANDI" required />

        <label>Password Pelanggan</label>
        <input id="passwordPelangganBaru" type="text" placeholder="Contoh: 12345" required />

        <label>Profil Paket</label>
        <select id="profilPaketBaru" required>
          ${opsiPaket}
        </select>

        <button type="submit" class="btn primary">Simpan</button>
        <div id="subFormMsg" class="msg"></div>
      </form>
    `;
    return;
  }

  $("contentBody").className = "placeholder-box";
  $("contentBody").innerHTML = `<p>${titles[submenu] || "Menu ini"} sudah disiapkan.</p>`;
}

async function simpanPelangganBaru(e) {
  e.preventDefault();

  const payload = {
    token: state.user.token,
    pelangganBaru: {
      nama: $("namaPelangganBaru").value.trim().toUpperCase(),
      password: $("passwordPelangganBaru").value.trim(),
      profilPaket: $("profilPaketBaru").value
    }
  };

  try {
    showMsg($("subFormMsg"), "Menyimpan data...", "info");
    await api("addPelangganBaru", payload);
    $("formPelangganBaru").reset();
    showMsg($("subFormMsg"), "Data berhasil disimpan. Command masuk PendingCommand.", "success");
  } catch (err) {
    showMsg($("subFormMsg"), err.message, "error");
  }
}

function backToMenu() {
  const menuCard = document.querySelector(".dashboard-menu-card");
  if (menuCard) menuCard.classList.remove("hidden");
  const contentCard = $("contentCard");
  if (contentCard) contentCard.classList.add("hidden");
}

window.openMenu = openMenu;
window.openSubMenu = openSubMenu;
window.simpanPelangganBaru = simpanPelangganBaru;
window.backToMenu = backToMenu;

$("loginForm").addEventListener("submit", login);
$("logoutBtn").addEventListener("click", () => {
  clearSession();
  showPage();
});

loadSession();
showPage();
