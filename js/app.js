/* ==========================================================================
   app.js — logika antarmuka aplikasi laboratorium
   ========================================================================== */

let editingRegId = null;
let hasilRegId = null;
let currentUser = null;

/* ------------------------------ Util UI ---------------------------------- */

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function autoSizeHasilInput(input) {
  input.style.width = Math.max(3, input.value.length + 2) + 'ch';
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function showView(name) {
  $all('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  $all('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
}

function confirmAsync(msg) {
  return new Promise(resolve => {
    const modal = $('#modalConfirm');
    $('#confirmMsg').textContent = msg;
    modal.classList.add('show');
    const cleanup = (val) => {
      modal.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(val);
    };
    const okBtn = $('#confirmOk');
    const cancelBtn = $('#confirmCancel');
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function promptAsync(msg, defaultVal) {
  return new Promise(resolve => {
    const modal = $('#modalPrompt');
    $('#promptMsg').textContent = msg;
    const input = $('#promptInput');
    input.value = defaultVal || '';
    modal.classList.add('show');
    setTimeout(() => input.focus(), 50);
    const cleanup = (val) => {
      modal.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const okBtn = $('#promptOk');
    const cancelBtn = $('#promptCancel');
    const onOk = () => cleanup(input.value.trim() || null);
    const onCancel = () => cleanup(null);
    const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
  });
}

/* ------------------------------ Brand / header ---------------------------- */

function renderBrand() {
  const s = DB.getSettings();
  $('#brandLogo').src = s.logo;
  $('#brandName').textContent = s.namaKlinik;
}

/* ================================= AUTH / RBAC ============================= */

function renderLoginBrand() {
  const s = DB.getSettings();
  $('#loginLogo').src = s.logo;
  $('#loginNamaKlinik').textContent = s.namaKlinik;
}

function hasAccess(view) {
  if (!currentUser) return false;
  const role = ROLES[currentUser.role];
  return !!role && role.views.includes(view);
}

function applyRBAC() {
  const role = ROLES[currentUser.role];
  $all('.navbtn[data-view]').forEach(btn => {
    const view = btn.dataset.view;
    const visible = view === 'daftar' || role.views.includes(view);
    btn.classList.toggle('hidden-role', !visible);
  });
}

function showLoginScreen() {
  currentUser = null;
  renderLoginBrand();
  $('#loginScreen').style.display = 'flex';
  $('#appShell').style.display = 'none';
  $('#loginError').classList.remove('show');
  $('#loginUsername').value = '';
  $('#loginPassword').value = '';
  setTimeout(() => $('#loginUsername').focus(), 50);
}

function enterApp(user) {
  currentUser = user;
  applyRBAC();
  $('#loginScreen').style.display = 'none';
  $('#appShell').style.display = 'block';
  $('#loggedUserNama').textContent = user.nama;
  $('#loggedUserRole').textContent = ROLES[user.role] ? ROLES[user.role].label : user.role;
  renderBrand();
  showView('daftar');
  renderDaftar();
}

function checkSession() {
  const uid = sessionStorage.getItem(SESSION_KEY);
  if (uid) {
    const user = DB.getUsers().find(u => u.id === uid && u.aktif !== false);
    if (user) { enterApp(user); return; }
    sessionStorage.removeItem(SESSION_KEY);
  }
  showLoginScreen();
}

$('#formLogin').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = $('#loginUsername').value.trim();
  const password = $('#loginPassword').value;
  const user = DB.getUsers().find(u =>
    u.username.toLowerCase() === username.toLowerCase() && u.password === password && u.aktif !== false
  );
  if (!user) {
    const err = $('#loginError');
    err.classList.remove('show');
    void err.offsetWidth;
    err.classList.add('show');
    return;
  }
  sessionStorage.setItem(SESSION_KEY, user.id);
  enterApp(user);
  showToast('Selamat datang, ' + user.nama + '.');
});

$('#btnLogout').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLoginScreen();
});

/* ================================ DAFTAR ================================= */

function regStatus(reg) {
  const ids = Object.keys(reg.hasil || {});
  if (ids.length === 0) return { key: 'belum', label: 'Belum Diperiksa' };
  const filled = ids.filter(id => (reg.hasil[id].hasil || '').toString().trim() !== '').length;
  if (filled === 0) return { key: 'belum', label: 'Belum Diperiksa' };
  if (filled === ids.length) return { key: 'selesai', label: 'Selesai' };
  return { key: 'sebagian', label: 'Sebagian' };
}

function renderDaftar() {
  const list = DB.getRegistrasi().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const dokterList = DB.getDokter();
  const analisList = DB.getAnalis();

  const q = ($('#cariPasien').value || '').toLowerCase().trim();
  const tgl = $('#filterTanggal').value;

  const filtered = list.filter(r => {
    if (tgl && r.tanggal !== tgl) return false;
    if (!q) return true;
    return (r.nama || '').toLowerCase().includes(q) ||
      (r.noRM || '').toLowerCase().includes(q) ||
      (r.noReg || '').toLowerCase().includes(q);
  });

  const tbody = $('#tblDaftarBody');
  tbody.innerHTML = '';
  $('#emptyDaftar').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(r => {
    const dokter = dokterList.find(d => d.id === r.dokterId);
    const analis = analisList.find(a => a.id === r.analisId);
    const paketNames = (r.paketSnapshot || []).map(p => p.nama).join(', ');
    const st = regStatus(r);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(r.noReg)}</td>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${escapeHTML(r.noRM)}</td>
      <td>${escapeHTML(r.nama)}</td>
      <td>${r.jk === 'P' ? 'P' : 'L'} / ${escapeHTML(r.umur || '-')}</td>
      <td>${escapeHTML(dokter ? dokter.nama : '-')}</td>
      <td>${escapeHTML(analis ? analis.nama : '-')}</td>
      <td class="small-text">${escapeHTML(paketNames)}</td>
      <td>${formatRupiah(r.totalHarga)}</td>
      <td><span class="badge badge-${st.key}">${st.label}</span></td>
      <td class="aksi-cell"></td>
    `;
    const aksiCell = tr.querySelector('.aksi-cell');
    aksiCell.appendChild(makeBtn('Edit', 'btn-light', () => openForm(r.id)));
    aksiCell.appendChild(makeBtn('Edit2', 'btn-danger', () => openHasil2(r.id)));
    aksiCell.appendChild(makeBtn('Hasil', 'btn-secondary', () => openHasil(r.id)));
    aksiCell.appendChild(makeBtn('Preview', 'btn-light', () => previewReport(r, printCtx())));
    aksiCell.appendChild(makeBtn('Print', 'btn-primary', () => printReport(r, printCtx())));
    aksiCell.appendChild(makeBtn('Label', 'btn-light', () => openLabelModal(r)));
    if (currentUser && currentUser.role !== 'karyawan') {
      aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', () => hapusRegistrasi(r.id)));
    }
    tbody.appendChild(tr);
  });
}

function makeBtn(text, cls, onClick) {
  const b = document.createElement('button');
  b.textContent = text;
  b.type = 'button';
  b.className = 'btn btn-sm ' + cls;
  b.addEventListener('click', onClick);
  return b;
}

function printCtx() {
  return { settings: DB.getSettings(), analisList: DB.getAnalis(), dokterList: DB.getDokter() };
}

async function hapusRegistrasi(id) {
  const ok = await confirmAsync('Hapus data pendaftaran ini beserta hasil pemeriksaannya?');
  if (!ok) return;
  const list = DB.getRegistrasi().filter(r => r.id !== id);
  DB.saveRegistrasi(list);
  renderDaftar();
  showToast('Data pendaftaran dihapus.');
}

function openLabelModal(reg) {
  $('#labelRegInfo').innerHTML = `<strong>${escapeHTML(reg.nama)}</strong><br>No.RM: ${escapeHTML(reg.noRM)} — ${formatTanggal(reg.tanggal)}`;
  $('#labelJumlah').value = 1;
  const modal = $('#modalLabel');
  modal.classList.add('show');
  const okBtn = $('#labelOk');
  const cancelBtn = $('#labelCancel');
  const cleanup = () => {
    modal.classList.remove('show');
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
  };
  const onOk = () => {
    const jumlah = Math.max(1, parseInt($('#labelJumlah').value, 10) || 1);
    printLabel(reg, printCtx(), jumlah);
    cleanup();
  };
  const onCancel = () => cleanup();
  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
}

/* ============================ FORM PENDAFTARAN ============================ */

function isiSelectDokterInto(selId) {
  const sel = $(selId);
  const cur = sel.value;
  sel.innerHTML = DB.getDokter().filter(d => d.aktif !== false).map(d =>
    `<option value="${d.id}">${escapeHTML(d.nama)}${d.asal && d.asal !== '-' ? ' — ' + escapeHTML(d.asal) : ''}</option>`
  ).join('');
  if (cur) sel.value = cur;
}

function isiSelectDokter() {
  isiSelectDokterInto('#fDokter');
}

function isiSelectAnalis() {
  const sel = $('#fAnalis');
  const cur = sel.value;
  sel.innerHTML = DB.getAnalis().filter(a => a.aktif !== false).map(a =>
    `<option value="${a.id}">${escapeHTML(a.nama)}</option>`
  ).join('');
  if (cur) sel.value = cur;
}

function renderPaketPilihan(selectedIds) {
  const wrap = $('#paketPilihan');
  const paket = DB.getPaket();
  wrap.innerHTML = paket.map(p => `
    <label class="paket-item">
      <input type="checkbox" class="paket-cb" value="${p.id}" ${selectedIds && selectedIds.includes(p.id) ? 'checked' : ''}>
      <span class="paket-item-nama">${escapeHTML(p.nama)}</span>
      <span class="paket-item-harga">${formatRupiah(p.harga)}</span>
    </label>
  `).join('');
  $all('.paket-cb').forEach(cb => cb.addEventListener('change', hitungTotalForm));
  hitungTotalForm();
}

function hitungTotalForm() {
  const paket = DB.getPaket();
  let total = 0;
  $all('.paket-cb:checked').forEach(cb => {
    const p = paket.find(x => x.id === cb.value);
    if (p) total += Number(p.harga) || 0;
  });
  $('#fTotalHarga').textContent = formatRupiah(total);
}

function openForm(regId) {
  editingRegId = regId || null;
  isiSelectDokter();
  isiSelectAnalis();

  const reg = regId ? DB.getRegistrasi().find(r => r.id === regId) : null;

  $('#formTitle').textContent = reg ? 'Edit Pendaftaran — ' + reg.nama : 'Pendaftaran Baru';
  $('#fRegId').value = reg ? reg.id : '';
  $('#fNoReg').value = reg ? reg.noReg : DB.nextNoReg();
  $('#fNoRM').value = reg ? reg.noRM : '';
  $('#fTanggal').value = reg ? reg.tanggal : new Date().toISOString().slice(0, 10);
  $('#fNama').value = reg ? reg.nama : '';
  $('#fTglLahir').value = reg ? (reg.tglLahir || '') : '';
  $('#fUmur').value = reg ? (reg.umur || '') : '';
  $('#fJK').value = reg ? (reg.jk || 'L') : 'L';
  $('#fTelp').value = reg ? (reg.telp || '') : '';
  $('#fAlamat').value = reg ? (reg.alamat || '') : '';
  $('#fCatatan').value = reg ? (reg.catatan || '') : '';

  renderPaketPilihan(reg ? reg.paketIds : []);

  if (reg) {
    $('#fDokter').value = reg.dokterId || '';
    $('#fAnalis').value = reg.analisId || '';
  }

  showView('form');
}

$('#fTglLahir').addEventListener('change', () => {
  const v = $('#fTglLahir').value;
  if (v) $('#fUmur').value = hitungUmur(v);
});

$('#btnAutoRM').addEventListener('click', () => {
  $('#fNoRM').value = DB.nextNoRM();
});

$('#btnTambahDokterInline').addEventListener('click', async () => {
  const nama = await promptAsync('Nama dokter baru:');
  if (!nama) return;
  const list = DB.getDokter();
  const item = { id: uid('dk'), nama, asal: '-', aktif: true };
  list.push(item);
  DB.saveDokter(list);
  isiSelectDokter();
  $('#fDokter').value = item.id;
  showToast('Dokter ditambahkan.');
});

$('#btnTambahAnalisInline').addEventListener('click', async () => {
  const nama = await promptAsync('Nama analis baru:');
  if (!nama) return;
  const list = DB.getAnalis();
  const item = { id: uid('an'), nama, aktif: true };
  list.push(item);
  DB.saveAnalis(list);
  isiSelectAnalis();
  $('#fAnalis').value = item.id;
  showToast('Analis ditambahkan.');
});

$('#formDaftar').addEventListener('submit', (e) => {
  e.preventDefault();
  const selectedIds = $all('.paket-cb:checked').map(cb => cb.value);
  if (selectedIds.length === 0) {
    showToast('Pilih minimal satu paket pemeriksaan.');
    return;
  }
  const paketMaster = DB.getPaket();
  const paketSnapshot = selectedIds.map(id => JSON.parse(JSON.stringify(paketMaster.find(p => p.id === id))));

  const list = DB.getRegistrasi();
  const existing = editingRegId ? list.find(r => r.id === editingRegId) : null;
  const oldHasil = existing ? (existing.hasil || {}) : {};

  const hasil = {};
  paketSnapshot.forEach(pk => {
    pk.tests.forEach(t => {
      hasil[t.id] = oldHasil[t.id] || { hasil: '', satuan: t.satuan, nilaiRujukan: t.nilaiRujukan };
    });
  });

  const totalHarga = paketSnapshot.reduce((sum, p) => sum + (Number(p.harga) || 0), 0);

  const data = {
    id: existing ? existing.id : uid('reg'),
    noReg: $('#fNoReg').value,
    noRM: $('#fNoRM').value.trim(),
    tanggal: $('#fTanggal').value,
    nama: $('#fNama').value.trim(),
    tglLahir: $('#fTglLahir').value,
    umur: $('#fUmur').value.trim(),
    jk: $('#fJK').value,
    telp: $('#fTelp').value.trim(),
    alamat: $('#fAlamat').value.trim(),
    dokterId: $('#fDokter').value,
    analisId: $('#fAnalis').value,
    paketIds: selectedIds,
    paketSnapshot,
    hasil,
    catatan: $('#fCatatan').value.trim(),
    totalHarga,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now()
  };

  if (existing) {
    const idx = list.findIndex(r => r.id === existing.id);
    list[idx] = data;
  } else {
    list.push(data);
  }
  DB.saveRegistrasi(list);
  showToast('Pendaftaran disimpan.');
  editingRegId = null;
  showView('daftar');
  renderDaftar();
});

/* ============================ HASIL PEMERIKSAAN ============================ */

function openHasil(regId) {
  const reg = DB.getRegistrasi().find(r => r.id === regId);
  if (!reg) return;
  hasilRegId = regId;

  const dokter = DB.getDokter().find(d => d.id === reg.dokterId);
  const analis = DB.getAnalis().find(a => a.id === reg.analisId);

  $('#hasilPasienInfo').innerHTML = `
    <div class="info-mini-grid">
      <div><strong>${escapeHTML(reg.nama)}</strong> (${reg.jk === 'P' ? 'P' : 'L'}, ${escapeHTML(reg.umur || '-')})</div>
      <div>No. RM: ${escapeHTML(reg.noRM)} — No. Reg: ${escapeHTML(reg.noReg)}</div>
      <div>Tanggal: ${formatTanggal(reg.tanggal)}</div>
      <div>Dokter Pengirim: ${escapeHTML(dokter ? dokter.nama : '-')}</div>
      <div>Analis: ${escapeHTML(analis ? analis.nama : '-')}</div>
    </div>`;

  const wrap = $('#hasilTablesWrap');
  wrap.innerHTML = '';
  (reg.paketSnapshot || []).forEach(pk => {
    if (!pk.tests || pk.tests.length === 0) return;
    const table = document.createElement('table');
    table.className = 'tbl hasil-edit-tbl';
    table.innerHTML = `
      <thead>
        <tr class="kategori-head"><th colspan="5">${escapeHTML(pk.nama)}</th></tr>
        <tr><th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th><th>Nilai Rujukan</th><th></th></tr>
      </thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    pk.tests.forEach(t => {
      const rec = (reg.hasil || {})[t.id] || { hasil: '', satuan: t.satuan, nilaiRujukan: t.nilaiRujukan };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(t.nama)}</td>
        <td class="hasil-cell">
          <input type="text" data-testid="${t.id}" class="hasil-input" value="${escapeHTML(rec.hasil)}">
          <span class="hasil-flag"></span>
        </td>
        <td><input type="text" data-testid="${t.id}" data-field="satuan" class="satuan-input" value="${escapeHTML(rec.satuan)}"></td>
        <td><input type="text" data-testid="${t.id}" data-field="nilaiRujukan" class="nr-input" value="${escapeHTML(rec.nilaiRujukan)}"></td>
        <td class="aksi-cell"></td>
      `;
      const hasilInput = tr.querySelector('.hasil-input');
      const nrInput = tr.querySelector('.nr-input');
      const flagSpan = tr.querySelector('.hasil-flag');
      const updateFlag = () => {
        autoSizeHasilInput(hasilInput);
        const normal = evaluasiHasil(hasilInput.value, nrInput.value);
        hasilInput.classList.remove('flag-normal-input', 'flag-abnormal-input');
        flagSpan.textContent = '';
        if (normal === true) {
          hasilInput.classList.add('flag-normal-input');
        } else if (normal === false) {
          hasilInput.classList.add('flag-abnormal-input');
          flagSpan.textContent = '*';
        }
      };
      hasilInput.addEventListener('input', updateFlag);
      nrInput.addEventListener('input', updateFlag);
      updateFlag();
      tr.querySelector('.aksi-cell').appendChild(makeBtn('Hapus', 'btn-danger', () => hapusHasilTest(regId, pk.id, t.id)));
      tbody.appendChild(tr);
    });
    wrap.appendChild(table);
  });

  showView('hasil');
}

async function hapusHasilTest(regId, paketId, testId) {
  const ok = await confirmAsync('Hapus pemeriksaan ini dari hasil pasien?');
  if (!ok) return;
  const list = DB.getRegistrasi();
  const reg = list.find(r => r.id === regId);
  if (!reg) return;
  const pk = (reg.paketSnapshot || []).find(p => p.id === paketId);
  if (pk) pk.tests = pk.tests.filter(t => t.id !== testId);
  if (reg.hasil) delete reg.hasil[testId];
  DB.saveRegistrasi(list);
  showToast('Pemeriksaan dihapus dari hasil pasien.');
  openHasil(regId);
}

$('#formHasil').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = DB.getRegistrasi();
  const reg = list.find(r => r.id === hasilRegId);
  if (!reg) return;

  const hasil = reg.hasil || {};
  $all('.hasil-input').forEach(inp => {
    const id = inp.dataset.testid;
    if (!hasil[id]) hasil[id] = {};
    hasil[id].hasil = inp.value.trim();
  });
  $all('.satuan-input').forEach(inp => {
    const id = inp.dataset.testid;
    if (!hasil[id]) hasil[id] = {};
    hasil[id].satuan = inp.value.trim();
  });
  $all('.nr-input').forEach(inp => {
    const id = inp.dataset.testid;
    if (!hasil[id]) hasil[id] = {};
    hasil[id].nilaiRujukan = inp.value.trim();
  });

  reg.hasil = hasil;
  reg.updatedAt = Date.now();
  DB.saveRegistrasi(list);
  showToast('Hasil pemeriksaan disimpan.');
  showView('daftar');
  renderDaftar();
});

/* ============================ EDIT2 (EDIT CEPAT HASIL) ===================== */

let hasil2RegId = null;

function openHasil2(regId) {
  const reg = DB.getRegistrasi().find(r => r.id === regId);
  if (!reg) return;
  hasil2RegId = regId;

  $('#hasil2PasienInfo').innerHTML = `
    <div class="info-mini-grid">
      <div><strong>${escapeHTML(reg.nama)}</strong> (${reg.jk === 'P' ? 'P' : 'L'}, ${escapeHTML(reg.umur || '-')})</div>
      <div>No. RM: ${escapeHTML(reg.noRM)} — No. Reg: ${escapeHTML(reg.noReg)}</div>
      <div>Tanggal: ${formatTanggal(reg.tanggal)}</div>
    </div>`;

  const wrap = $('#hasil2TablesWrap');
  wrap.innerHTML = '';
  (reg.paketSnapshot || []).forEach(pk => {
    if (!pk.tests || pk.tests.length === 0) return;
    const table = document.createElement('table');
    table.className = 'tbl hasil-edit-tbl';
    table.innerHTML = `
      <thead>
        <tr class="kategori-head"><th colspan="3">${escapeHTML(pk.nama)}</th></tr>
        <tr><th>Pemeriksaan</th><th>Hasil</th><th>Nilai Rujukan</th></tr>
      </thead>
      <tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    pk.tests.forEach(t => {
      const rec = (reg.hasil || {})[t.id] || { hasil: '', satuan: t.satuan, nilaiRujukan: t.nilaiRujukan };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(t.nama)}</td>
        <td class="hasil-cell">
          <input type="text" data-testid="${t.id}" class="hasil2-input" value="${escapeHTML(rec.hasil)}">
          <span class="hasil-flag"></span>
        </td>
        <td><input type="text" data-testid="${t.id}" class="nr2-input" value="${escapeHTML(rec.nilaiRujukan)}"></td>
      `;
      const hasilInput = tr.querySelector('.hasil2-input');
      const nrInput = tr.querySelector('.nr2-input');
      const flagSpan = tr.querySelector('.hasil-flag');
      const updateFlag = () => {
        autoSizeHasilInput(hasilInput);
        const normal = evaluasiHasil(hasilInput.value, nrInput.value);
        hasilInput.classList.remove('flag-normal-input', 'flag-abnormal-input');
        flagSpan.textContent = '';
        if (normal === true) {
          hasilInput.classList.add('flag-normal-input');
        } else if (normal === false) {
          hasilInput.classList.add('flag-abnormal-input');
          flagSpan.textContent = '*';
        }
      };
      hasilInput.addEventListener('input', updateFlag);
      nrInput.addEventListener('input', updateFlag);
      updateFlag();
      tbody.appendChild(tr);
    });
    wrap.appendChild(table);
  });

  showView('hasil2');
}

$('#formHasil2').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = DB.getRegistrasi();
  const reg = list.find(r => r.id === hasil2RegId);
  if (!reg) return;

  const hasil = reg.hasil || {};
  $all('.hasil2-input').forEach(inp => {
    const id = inp.dataset.testid;
    if (!hasil[id]) hasil[id] = {};
    hasil[id].hasil = inp.value.trim();
  });
  $all('.nr2-input').forEach(inp => {
    const id = inp.dataset.testid;
    if (!hasil[id]) hasil[id] = {};
    hasil[id].nilaiRujukan = inp.value.trim();
  });

  reg.hasil = hasil;
  reg.updatedAt = Date.now();
  DB.saveRegistrasi(list);
  showToast('Hasil pemeriksaan disimpan.');
  showView('daftar');
  renderDaftar();
});

/* =============================== MASTER ANALIS ============================= */

function renderAnalis() {
  const list = DB.getAnalis();
  const tbody = $('#tblAnalisBody');
  tbody.innerHTML = '';
  list.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inline-edit" value="${escapeHTML(a.nama)}"></td>
      <td class="center"><input type="checkbox" ${a.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [namaCell, aktifCell, aksiCell] = tr.children;
    namaCell.querySelector('input').addEventListener('change', (e) => {
      a.nama = e.target.value.trim();
      DB.saveAnalis(list);
      showToast('Analis diperbarui.');
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      a.aktif = e.target.checked;
      DB.saveAnalis(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      const ok = await confirmAsync(`Hapus analis "${a.nama}"?`);
      if (!ok) return;
      DB.saveAnalis(list.filter(x => x.id !== a.id));
      renderAnalis();
      showToast('Analis dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddAnalis').addEventListener('click', () => {
  const input = $('#newAnalisNama');
  const nama = input.value.trim();
  if (!nama) { showToast('Nama analis tidak boleh kosong.'); return; }
  const list = DB.getAnalis();
  list.push({ id: uid('an'), nama, aktif: true });
  DB.saveAnalis(list);
  input.value = '';
  renderAnalis();
  showToast('Analis ditambahkan.');
});

/* =============================== MASTER DOKTER ============================= */

function renderDokter() {
  const list = DB.getDokter();
  const tbody = $('#tblDokterBody');
  tbody.innerHTML = '';
  list.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inline-edit" value="${escapeHTML(d.nama)}"></td>
      <td><input type="text" class="inline-edit" value="${escapeHTML(d.asal || '')}"></td>
      <td class="center"><input type="checkbox" ${d.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [namaCell, asalCell, aktifCell, aksiCell] = tr.children;
    namaCell.querySelector('input').addEventListener('change', (e) => {
      d.nama = e.target.value.trim();
      DB.saveDokter(list);
      showToast('Dokter diperbarui.');
    });
    asalCell.querySelector('input').addEventListener('change', (e) => {
      d.asal = e.target.value.trim();
      DB.saveDokter(list);
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      d.aktif = e.target.checked;
      DB.saveDokter(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      const ok = await confirmAsync(`Hapus dokter "${d.nama}"?`);
      if (!ok) return;
      DB.saveDokter(list.filter(x => x.id !== d.id));
      renderDokter();
      showToast('Dokter dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddDokter').addEventListener('click', () => {
  const namaInput = $('#newDokterNama');
  const asalInput = $('#newDokterAsal');
  const nama = namaInput.value.trim();
  if (!nama) { showToast('Nama dokter tidak boleh kosong.'); return; }
  const list = DB.getDokter();
  list.push({ id: uid('dk'), nama, asal: asalInput.value.trim() || '-', aktif: true });
  DB.saveDokter(list);
  namaInput.value = '';
  asalInput.value = '';
  renderDokter();
  showToast('Dokter ditambahkan.');
});

/* ============================ MASTER PAKET & HARGA ========================== */

function renderPaketMaster() {
  const paket = DB.getPaket();
  const wrap = $('#paketMasterWrap');
  wrap.innerHTML = '';

  paket.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card paket-card';
    card.innerHTML = `
      <div class="paket-card-head">
        <input type="text" class="paket-nama-input" value="${escapeHTML(p.nama)}">
        <div class="paket-harga-wrap">Rp <input type="number" class="paket-harga-input" value="${p.harga}"></div>
        <button type="button" class="btn btn-sm btn-danger">Hapus Paket</button>
      </div>
      <table class="tbl">
        <thead><tr><th>Pemeriksaan</th><th>Satuan</th><th>Nilai Rujukan</th><th></th></tr></thead>
        <tbody class="test-body"></tbody>
        <tfoot>
          <tr class="add-test-row">
            <td><input type="text" class="new-test-nama" placeholder="Nama pemeriksaan"></td>
            <td><input type="text" class="new-test-satuan" placeholder="Satuan"></td>
            <td><input type="text" class="new-test-nr" placeholder="Nilai rujukan"></td>
            <td><button type="button" class="btn btn-sm btn-primary add-test-btn">+ Tambah</button></td>
          </tr>
        </tfoot>
      </table>
    `;

    card.querySelector('.paket-nama-input').addEventListener('change', (e) => {
      p.nama = e.target.value.trim();
      DB.savePaket(paket);
      showToast('Nama paket diperbarui.');
    });
    card.querySelector('.paket-harga-input').addEventListener('change', (e) => {
      p.harga = Number(e.target.value) || 0;
      DB.savePaket(paket);
      showToast('Harga paket diperbarui.');
    });
    card.querySelector('.paket-card-head .btn-danger').addEventListener('click', async () => {
      const ok = await confirmAsync(`Hapus seluruh paket "${p.nama}" beserta daftar pemeriksaannya?`);
      if (!ok) return;
      DB.savePaket(paket.filter(x => x.id !== p.id));
      renderPaketMaster();
      showToast('Paket dihapus.');
    });

    const tbody = card.querySelector('.test-body');
    p.tests.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="test-nama-input" value="${escapeHTML(t.nama)}"></td>
        <td><input type="text" class="test-satuan-input" value="${escapeHTML(t.satuan)}"></td>
        <td><input type="text" class="test-nr-input" value="${escapeHTML(t.nilaiRujukan)}"></td>
        <td><button type="button" class="btn btn-sm btn-danger">Hapus</button></td>
      `;
      tr.querySelector('.test-nama-input').addEventListener('change', (e) => {
        t.nama = e.target.value.trim();
        DB.savePaket(paket);
      });
      tr.querySelector('.test-satuan-input').addEventListener('change', (e) => {
        t.satuan = e.target.value.trim();
        DB.savePaket(paket);
      });
      tr.querySelector('.test-nr-input').addEventListener('change', (e) => {
        t.nilaiRujukan = e.target.value.trim();
        DB.savePaket(paket);
      });
      tr.querySelector('.btn-danger').addEventListener('click', async () => {
        const ok = await confirmAsync(`Hapus pemeriksaan "${t.nama}"?`);
        if (!ok) return;
        p.tests = p.tests.filter(x => x.id !== t.id);
        DB.savePaket(paket);
        renderPaketMaster();
      });
      tbody.appendChild(tr);
    });

    card.querySelector('.add-test-btn').addEventListener('click', () => {
      const namaI = card.querySelector('.new-test-nama');
      const satuanI = card.querySelector('.new-test-satuan');
      const nrI = card.querySelector('.new-test-nr');
      if (!namaI.value.trim()) { showToast('Nama pemeriksaan tidak boleh kosong.'); return; }
      p.tests.push({ id: uid('tst'), nama: namaI.value.trim(), satuan: satuanI.value.trim(), nilaiRujukan: nrI.value.trim() });
      DB.savePaket(paket);
      renderPaketMaster();
      showToast('Pemeriksaan ditambahkan.');
    });

    wrap.appendChild(card);
  });
}

$('#btnTambahPaket').addEventListener('click', async () => {
  const nama = await promptAsync('Nama paket pemeriksaan baru:');
  if (!nama) return;
  const paket = DB.getPaket();
  paket.push({ id: uid('pkt'), nama, harga: 0, tests: [] });
  DB.savePaket(paket);
  renderPaketMaster();
  showToast('Paket baru ditambahkan.');
});

/* ============================ RADIOLOGI: DAFTAR ============================ */

let editingRegRadId = null;
let hasilRegRadId = null;

function regStatusRad(reg) {
  const ids = Object.keys(reg.hasil || {});
  if (ids.length === 0) return { key: 'belum', label: 'Belum Diperiksa' };
  const filled = ids.filter(id => {
    const h = reg.hasil[id] || {};
    return (h.hasilBacaan || '').toString().trim() !== '' || (h.kesan || '').toString().trim() !== '';
  }).length;
  if (filled === 0) return { key: 'belum', label: 'Belum Diperiksa' };
  if (filled === ids.length) return { key: 'selesai', label: 'Selesai' };
  return { key: 'sebagian', label: 'Sebagian' };
}

function printCtxRad() {
  return {
    settings: DB.getSettings(),
    dokterList: DB.getDokter(),
    radiograferList: DB.getRadiografer(),
    dokterSpList: DB.getDokterRadiologi()
  };
}

function openPrintFormatModalRad(reg) {
  $('#printFormatRadInfo').innerHTML = `<strong>${escapeHTML(reg.nama)}</strong><br>No.RM: ${escapeHTML(reg.noRM)} — ${formatTanggal(reg.tanggal)}`;
  const optsWrap = $('#printFormatRadOptions');
  optsWrap.innerHTML = PRINT_FORMAT_RAD_LIST.map((f, i) => `
    <button type="button" class="print-format-card" data-idx="${i}">
      <strong>${escapeHTML(f.label)}</strong>
      <span class="small-text">${escapeHTML(f.ket)}</span>
    </button>`).join('');

  const modal = $('#modalPrintFormatRad');
  modal.classList.add('show');
  const cancelBtn = $('#printFormatRadCancel');

  const cleanup = () => {
    modal.classList.remove('show');
    optsWrap.removeEventListener('click', onCardClick);
    cancelBtn.removeEventListener('click', onCancel);
  };
  const onCardClick = (e) => {
    const card = e.target.closest('.print-format-card');
    if (!card) return;
    const f = PRINT_FORMAT_RAD_LIST[Number(card.dataset.idx)];
    if (f.action === 'preview') previewReportRad(reg, printCtxRad(), f.size, f.signed, f.kesanOnly, f.combined);
    else printReportRad(reg, printCtxRad(), f.size, f.signed, f.kesanOnly, f.combined);
    cleanup();
  };
  const onCancel = () => cleanup();
  optsWrap.addEventListener('click', onCardClick);
  cancelBtn.addEventListener('click', onCancel);
}

function renderDaftarRad() {
  const list = DB.getRegistrasiRadiologi().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const dokterList = DB.getDokter();
  const radiograferList = DB.getRadiografer();
  const dokterSpList = DB.getDokterRadiologi();

  const q = ($('#cariPasienRad').value || '').toLowerCase().trim();
  const tgl = $('#filterTanggalRad').value;

  const filtered = list.filter(r => {
    if (tgl && r.tanggal !== tgl) return false;
    if (!q) return true;
    return (r.nama || '').toLowerCase().includes(q) ||
      (r.noRM || '').toLowerCase().includes(q) ||
      (r.noReg || '').toLowerCase().includes(q);
  });

  const tbody = $('#tblDaftarRadBody');
  tbody.innerHTML = '';
  $('#emptyDaftarRad').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(r => {
    const dokter = dokterList.find(d => d.id === r.dokterId);
    const radiografer = radiograferList.find(x => x.id === r.radiograferId);
    const dokterSp = dokterSpList.find(x => x.id === r.dokterSpId);
    const jenisNames = (r.jenisSnapshot || []).map(j => j.nama).join(', ');
    const st = regStatusRad(r);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(r.noReg)}</td>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${escapeHTML(r.noRM)}</td>
      <td>${escapeHTML(r.nama)}</td>
      <td>${r.jk === 'P' ? 'P' : 'L'} / ${escapeHTML(r.umur || '-')}</td>
      <td>${escapeHTML(dokter ? dokter.nama : '-')}</td>
      <td>${escapeHTML(radiografer ? radiografer.nama : '-')}</td>
      <td>${escapeHTML(dokterSp ? dokterSp.nama : '-')}</td>
      <td class="small-text">${escapeHTML(jenisNames)}</td>
      <td>${formatRupiah(r.totalHarga)}</td>
      <td><span class="badge badge-${st.key}">${st.label}</span></td>
      <td class="aksi-cell"></td>
    `;
    const aksiCell = tr.querySelector('.aksi-cell');
    aksiCell.appendChild(makeBtn('Edit', 'btn-light', () => openFormRad(r.id)));
    aksiCell.appendChild(makeBtn('Edit Rad', 'btn-danger', () => openRadEdit2(r.id)));
    aksiCell.appendChild(makeBtn('Hasil', 'btn-secondary', () => openHasilRad(r.id)));
    aksiCell.appendChild(makeBtn('Cetak Hasil', 'btn-primary', () => openPrintFormatModalRad(r)));
    aksiCell.appendChild(makeBtn('Label', 'btn-light', () => openLabelModal(r)));
    if (currentUser && currentUser.role !== 'karyawan') {
      aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', () => hapusRegistrasiRad(r.id)));
    }
    tbody.appendChild(tr);
  });
}

async function hapusRegistrasiRad(id) {
  const ok = await confirmAsync('Hapus data pendaftaran radiologi ini beserta hasil ekspertisenya?');
  if (!ok) return;
  const list = DB.getRegistrasiRadiologi().filter(r => r.id !== id);
  DB.saveRegistrasiRadiologi(list);
  renderDaftarRad();
  showToast('Data pendaftaran radiologi dihapus.');
}

/* ============================ RADIOLOGI: FORM PENDAFTARAN ============================ */

function isiSelectRadiografer() {
  const sel = $('#fRadiografer');
  const cur = sel.value;
  sel.innerHTML = DB.getRadiografer().filter(r => r.aktif !== false).map(r =>
    `<option value="${r.id}">${escapeHTML(r.nama)}</option>`
  ).join('');
  if (cur) sel.value = cur;
}

function isiSelectDokterSp() {
  const sel = $('#fDokterSp');
  const cur = sel.value;
  sel.innerHTML = DB.getDokterRadiologi().filter(d => d.aktif !== false).map(d =>
    `<option value="${d.id}">${escapeHTML(d.nama)}</option>`
  ).join('');
  if (cur) sel.value = cur;
}

function renderJenisPilihan(selectedIds) {
  const wrap = $('#jenisPilihan');
  const jenis = DB.getJenisRadiologi().filter(j => j.aktif !== false);
  let html = '';
  MODALITAS_LIST.forEach(modalitas => {
    const items = jenis.filter(j => j.modalitas === modalitas);
    if (items.length === 0) return;
    html += `<div class="jenis-group-title">${escapeHTML(modalitas)}</div>`;
    html += items.map(j => `
      <label class="paket-item">
        <input type="checkbox" class="jenis-cb" value="${j.id}" ${selectedIds && selectedIds.includes(j.id) ? 'checked' : ''}>
        <span class="paket-item-nama">${escapeHTML(j.nama)}</span>
        <span class="paket-item-harga">${formatRupiah(j.harga)}</span>
      </label>
    `).join('');
  });
  wrap.innerHTML = html;
  $all('.jenis-cb').forEach(cb => cb.addEventListener('change', hitungTotalFormRad));
  hitungTotalFormRad();
}

function hitungTotalFormRad() {
  const jenis = DB.getJenisRadiologi();
  let total = 0;
  $all('.jenis-cb:checked').forEach(cb => {
    const j = jenis.find(x => x.id === cb.value);
    if (j) total += Number(j.harga) || 0;
  });
  $('#fRadTotalHarga').textContent = formatRupiah(total);
}

function openFormRad(regId) {
  editingRegRadId = regId || null;
  isiSelectDokterInto('#fRadDokter');
  isiSelectRadiografer();
  isiSelectDokterSp();

  const reg = regId ? DB.getRegistrasiRadiologi().find(r => r.id === regId) : null;

  $('#formTitleRad').textContent = reg ? 'Edit Pendaftaran Radiologi — ' + reg.nama : 'Pendaftaran Radiologi Baru';
  $('#fRadRegId').value = reg ? reg.id : '';
  $('#fRadNoReg').value = reg ? reg.noReg : DB.nextNoRegRad();
  $('#fRadNoRM').value = reg ? reg.noRM : '';
  $('#fRadTanggal').value = reg ? reg.tanggal : new Date().toISOString().slice(0, 10);
  $('#fRadNama').value = reg ? reg.nama : '';
  $('#fRadTglLahir').value = reg ? (reg.tglLahir || '') : '';
  $('#fRadUmur').value = reg ? (reg.umur || '') : '';
  $('#fRadJK').value = reg ? (reg.jk || 'L') : 'L';
  $('#fRadTelp').value = reg ? (reg.telp || '') : '';
  $('#fRadAlamat').value = reg ? (reg.alamat || '') : '';
  $('#fRadCatatan').value = reg ? (reg.catatan || '') : '';

  renderJenisPilihan(reg ? reg.jenisIds : []);

  if (reg) {
    $('#fRadDokter').value = reg.dokterId || '';
    $('#fRadiografer').value = reg.radiograferId || '';
    $('#fDokterSp').value = reg.dokterSpId || '';
  }

  showView('rad-form');
}

$('#fRadTglLahir').addEventListener('change', () => {
  const v = $('#fRadTglLahir').value;
  if (v) $('#fRadUmur').value = hitungUmur(v);
});

$('#btnAutoRMRad').addEventListener('click', () => {
  $('#fRadNoRM').value = DB.nextNoRM();
});

$('#btnTambahDokterInlineRad').addEventListener('click', async () => {
  const nama = await promptAsync('Nama dokter baru:');
  if (!nama) return;
  const list = DB.getDokter();
  const item = { id: uid('dk'), nama, asal: '-', aktif: true };
  list.push(item);
  DB.saveDokter(list);
  isiSelectDokterInto('#fRadDokter');
  $('#fRadDokter').value = item.id;
  showToast('Dokter ditambahkan.');
});

$('#btnTambahRadiograferInline').addEventListener('click', async () => {
  const nama = await promptAsync('Nama radiografer baru:');
  if (!nama) return;
  const list = DB.getRadiografer();
  const item = { id: uid('rg'), nama, aktif: true };
  list.push(item);
  DB.saveRadiografer(list);
  isiSelectRadiografer();
  $('#fRadiografer').value = item.id;
  showToast('Radiografer ditambahkan.');
});

$('#btnTambahDokterSpInline').addEventListener('click', async () => {
  const nama = await promptAsync('Nama dokter Sp.Radiologi baru:');
  if (!nama) return;
  const list = DB.getDokterRadiologi();
  const item = { id: uid('drsp'), nama, aktif: true };
  list.push(item);
  DB.saveDokterRadiologi(list);
  isiSelectDokterSp();
  $('#fDokterSp').value = item.id;
  showToast('Dokter Sp.Radiologi ditambahkan.');
});

$('#formDaftarRad').addEventListener('submit', (e) => {
  e.preventDefault();
  const selectedIds = $all('.jenis-cb:checked').map(cb => cb.value);
  if (selectedIds.length === 0) {
    showToast('Pilih minimal satu jenis pemeriksaan.');
    return;
  }
  const jenisMaster = DB.getJenisRadiologi();
  const jenisSnapshot = selectedIds.map(id => JSON.parse(JSON.stringify(jenisMaster.find(j => j.id === id))));

  const list = DB.getRegistrasiRadiologi();
  const existing = editingRegRadId ? list.find(r => r.id === editingRegRadId) : null;
  const oldHasil = existing ? (existing.hasil || {}) : {};

  const hasil = {};
  jenisSnapshot.forEach(j => {
    hasil[j.id] = oldHasil[j.id] || { hasilBacaan: '', kesan: '' };
  });

  const totalHarga = jenisSnapshot.reduce((sum, j) => sum + (Number(j.harga) || 0), 0);

  const data = {
    id: existing ? existing.id : uid('regrad'),
    noReg: $('#fRadNoReg').value,
    noRM: $('#fRadNoRM').value.trim(),
    tanggal: $('#fRadTanggal').value,
    nama: $('#fRadNama').value.trim(),
    tglLahir: $('#fRadTglLahir').value,
    umur: $('#fRadUmur').value.trim(),
    jk: $('#fRadJK').value,
    telp: $('#fRadTelp').value.trim(),
    alamat: $('#fRadAlamat').value.trim(),
    dokterId: $('#fRadDokter').value,
    radiograferId: $('#fRadiografer').value,
    dokterSpId: $('#fDokterSp').value,
    jenisIds: selectedIds,
    jenisSnapshot,
    hasil,
    catatan: $('#fRadCatatan').value.trim(),
    totalHarga,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
    hasilHistory: existing ? existing.hasilHistory : undefined,
    statusBayar: existing ? existing.statusBayar : undefined
  };

  if (existing) {
    const idx = list.findIndex(r => r.id === existing.id);
    list[idx] = data;
  } else {
    list.push(data);
  }
  DB.saveRegistrasiRadiologi(list);
  showToast('Pendaftaran radiologi disimpan.');
  editingRegRadId = null;
  showView('rad-daftar');
  renderDaftarRad();
});

/* ============================ RADIOLOGI: HASIL & EKSPERTISE ============================ */

function openHasilRad(regId) {
  const reg = DB.getRegistrasiRadiologi().find(r => r.id === regId);
  if (!reg) return;
  hasilRegRadId = regId;

  const dokter = DB.getDokter().find(d => d.id === reg.dokterId);
  const radiografer = DB.getRadiografer().find(r => r.id === reg.radiograferId);
  const dokterSp = DB.getDokterRadiologi().find(d => d.id === reg.dokterSpId);

  $('#hasilRadPasienInfo').innerHTML = `
    <div class="info-mini-grid">
      <div><strong>${escapeHTML(reg.nama)}</strong> (${reg.jk === 'P' ? 'P' : 'L'}, ${escapeHTML(reg.umur || '-')})</div>
      <div>No. RM: ${escapeHTML(reg.noRM)} — No. Reg: ${escapeHTML(reg.noReg)}</div>
      <div>Tanggal: ${formatTanggal(reg.tanggal)}</div>
      <div>Dokter Pengirim: ${escapeHTML(dokter ? dokter.nama : '-')}</div>
      <div>Radiografer: ${escapeHTML(radiografer ? radiografer.nama : '-')}</div>
      <div>Dokter Sp.Radiologi: ${escapeHTML(dokterSp ? dokterSp.nama : '-')}</div>
    </div>`;

  const wrap = $('#hasilRadWrap');
  wrap.innerHTML = '';
  const kesanTemplateMap = DB.getKesanTemplate();
  (reg.jenisSnapshot || []).forEach(j => {
    const rec = (reg.hasil || {})[j.id] || { hasilBacaan: '', kesan: '' };
    const kesanOptions = (kesanTemplateMap[j.id] || []).slice().sort((a, b) => b.createdAt - a.createdAt);
    const card = document.createElement('div');
    card.className = 'rad-exam-card';
    card.innerHTML = `
      <h4>${escapeHTML(j.nama)} <span class="small-text">(${escapeHTML(j.modalitas)})</span></h4>
      <label>Hasil Bacaan / Temuan</label>
      <textarea rows="3" class="rad-temuan-input" data-jenisid="${j.id}">${escapeHTML(rec.hasilBacaan)}</textarea>
      <label>Kesan</label>
      ${kesanOptions.length ? `
      <select class="rad-kesan-template-select" data-jenisid="${j.id}">
        <option value="">-- pilih dari kesan tersimpan (opsional) --</option>
        ${kesanOptions.map(t => `<option value="${t.id}">${escapeHTML(t.kesan.length > 70 ? t.kesan.slice(0, 70) + '…' : t.kesan)}</option>`).join('')}
      </select>` : ''}
      <textarea rows="2" class="rad-kesan-input" data-jenisid="${j.id}">${escapeHTML(rec.kesan)}</textarea>
      <div class="aksi-cell"></div>
    `;
    card.querySelector('.aksi-cell').appendChild(makeBtn('Hapus Pemeriksaan', 'btn-danger', () => hapusHasilTestRad(regId, j.id)));
    wrap.appendChild(card);
  });

  showView('rad-hasil');
}

$('#hasilRadWrap').addEventListener('change', (e) => {
  const sel = e.target.closest('.rad-kesan-template-select');
  if (!sel || !sel.value) return;
  const jenisId = sel.dataset.jenisid;
  const entry = (DB.getKesanTemplate()[jenisId] || []).find(t => t.id === sel.value);
  if (!entry) return;
  const ta = $(`#hasilRadWrap .rad-kesan-input[data-jenisid="${jenisId}"]`);
  if (ta) ta.value = entry.kesan;
});

async function hapusHasilTestRad(regId, jenisId) {
  const ok = await confirmAsync('Hapus pemeriksaan ini dari hasil pasien?');
  if (!ok) return;
  const list = DB.getRegistrasiRadiologi();
  const reg = list.find(r => r.id === regId);
  if (!reg) return;
  reg.jenisSnapshot = (reg.jenisSnapshot || []).filter(j => j.id !== jenisId);
  reg.jenisIds = (reg.jenisIds || []).filter(id => id !== jenisId);
  if (reg.hasil) delete reg.hasil[jenisId];
  DB.saveRegistrasiRadiologi(list);
  showToast('Pemeriksaan dihapus dari hasil pasien.');
  openHasilRad(regId);
}

$('#formHasilRad').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = DB.getRegistrasiRadiologi();
  const reg = list.find(r => r.id === hasilRegRadId);
  if (!reg) return;

  const hasil = reg.hasil || {};
  $all('.rad-temuan-input').forEach(inp => {
    const id = inp.dataset.jenisid;
    if (!hasil[id]) hasil[id] = {};
    hasil[id].hasilBacaan = inp.value.trim();
  });

  const kesanTemplates = DB.getKesanTemplate();
  $all('.rad-kesan-input').forEach(inp => {
    const id = inp.dataset.jenisid;
    const teks = inp.value.trim();
    if (!hasil[id]) hasil[id] = {};
    hasil[id].kesan = teks;
    if (!teks) return;
    if (!kesanTemplates[id]) kesanTemplates[id] = [];
    const existing = kesanTemplates[id].find(t => t.kesan.trim() === teks);
    if (existing) {
      existing.patientRegId = reg.id;
      existing.patientNama = reg.nama;
      existing.patientNoRM = reg.noRM;
    } else {
      kesanTemplates[id].push({
        id: uid('ks'),
        kesan: teks,
        createdAt: Date.now(),
        patientRegId: reg.id,
        patientNama: reg.nama,
        patientNoRM: reg.noRM
      });
    }
  });
  DB.saveKesanTemplate(kesanTemplates);

  reg.hasil = hasil;
  reg.updatedAt = Date.now();
  DB.saveRegistrasiRadiologi(list);
  showToast('Hasil ekspertise radiologi disimpan.');
  showView('rad-daftar');
  renderDaftarRad();
});

/* ============================ RADIOLOGI: EDIT2 (KATALOG LENGKAP) ============================ */

let hasilRegRad2Id = null;
let radEdit2Items = {};
let radEdit2JenisMap = {};
let activeRadEdit2JenisId = null;

function accordionBadgeHTML(jenisId) {
  const st = radEdit2Items[jenisId];
  const j = radEdit2JenisMap[jenisId];
  return st.added
    ? '<span class="accordion-badge accordion-badge-added">&#10003; Ditambahkan</span>'
    : `<span class="accordion-badge">${formatRupiah(j.harga)}</span>`;
}

/* Panel per pemeriksaan: pilih apakah masuk ke pendaftaran ini. */
function accordionItemBodyHTML(jenisId) {
  const st = radEdit2Items[jenisId];
  const j = radEdit2JenisMap[jenisId];
  return st.added
    ? `<div class="delphi-placeholder">&#10003; Pemeriksaan ini sudah termasuk dalam pendaftaran.</div>`
    : `<button type="button" class="btn btn-sm btn-primary accordion-tambah-btn">+ Tambah Pemeriksaan Ini (${formatRupiah(j.harga)})</button>`;
}

/* Menyimpan langsung pilihan pemeriksaan ke data pendaftaran, tanpa menunggu
   tombol Simpan di bawah. */
function persistAccordionItem(jenisId) {
  const list = DB.getRegistrasiRadiologi();
  const reg = list.find(r => r.id === hasilRegRad2Id);
  if (!reg) return;
  const st = radEdit2Items[jenisId];

  const jenisIdSet = new Set(reg.jenisIds || []);
  if (st.added) jenisIdSet.add(jenisId); else jenisIdSet.delete(jenisId);
  const idsArr = Array.from(jenisIdSet);
  const jenisMaster = DB.getJenisRadiologi();

  reg.jenisIds = idsArr;
  reg.jenisSnapshot = idsArr.map(id => JSON.parse(JSON.stringify(jenisMaster.find(j => j.id === id) || radEdit2JenisMap[id])));
  reg.totalHarga = reg.jenisSnapshot.reduce((sum, j) => sum + (Number(j.harga) || 0), 0);
  reg.updatedAt = Date.now();

  DB.saveRegistrasiRadiologi(list);
}

/* Gaya Delphi 7: daftar pemeriksaan sebagai listbox vertikal di kiri (Thorax
   paling atas, lalu BNO dst di bawahnya). Klik satu baris -> panel kanan
   menampilkan status pemeriksaan itu. */
function renderRadEdit2Accordion(jenisAll) {
  const wrap = $('#radEdit2Wrap');
  let html = '';
  MODALITAS_LIST.forEach(modalitas => {
    const items = jenisAll.filter(j => j.modalitas === modalitas);
    if (items.length === 0) return;
    html += `<div class="delphi-list-group">${escapeHTML(modalitas)}</div>`;
    html += items.map(j => {
      const st = radEdit2Items[j.id];
      const cls = 'delphi-list-item' + (activeRadEdit2JenisId === j.id ? ' active' : '') + (st.added ? ' delphi-list-item-added' : '');
      return `<div class="${cls}" data-jenisid="${j.id}">${escapeHTML(j.nama)}${st.added ? ' &#10003;' : ''}</div>`;
    }).join('');
  });
  wrap.innerHTML = html;
  renderRadEdit2Panel();
}

function renderRadEdit2Panel() {
  const panel = $('#radEdit2Panel');
  if (!activeRadEdit2JenisId) {
    panel.innerHTML = `<div class="delphi-placeholder">Pilih salah satu pemeriksaan di daftar kiri (Thorax, BNO, dst).</div>`;
    return;
  }
  const j = radEdit2JenisMap[activeRadEdit2JenisId];
  if (!j) { activeRadEdit2JenisId = null; renderRadEdit2Panel(); return; }
  panel.innerHTML = `
    <div class="delphi-groupbox">
      <div class="delphi-groupbox-title">${escapeHTML(j.nama)} (${escapeHTML(j.modalitas)})</div>
      <div class="delphi-groupbox-badge">${accordionBadgeHTML(activeRadEdit2JenisId)}</div>
      ${accordionItemBodyHTML(activeRadEdit2JenisId)}
    </div>
  `;
}

function refreshRadEdit2Tab(jenisId) {
  const row = document.querySelector(`#radEdit2Wrap .delphi-list-item[data-jenisid="${jenisId}"]`);
  if (row) {
    const st = radEdit2Items[jenisId];
    const j = radEdit2JenisMap[jenisId];
    row.classList.toggle('delphi-list-item-added', st.added);
    row.innerHTML = `${escapeHTML(j.nama)}${st.added ? ' &#10003;' : ''}`;
  }
  renderRadEdit2Panel();
}

function openRadEdit2(regId) {
  const reg = DB.getRegistrasiRadiologi().find(r => r.id === regId);
  if (!reg) return;
  hasilRegRad2Id = regId;

  const dokter = DB.getDokter().find(d => d.id === reg.dokterId);
  const radiografer = DB.getRadiografer().find(r => r.id === reg.radiograferId);
  const dokterSp = DB.getDokterRadiologi().find(d => d.id === reg.dokterSpId);

  $('#radEdit2PasienInfo').innerHTML = `
    <div class="info-mini-grid">
      <div><strong>${escapeHTML(reg.nama)}</strong> (${reg.jk === 'P' ? 'P' : 'L'}, ${escapeHTML(reg.umur || '-')})</div>
      <div>No. RM: ${escapeHTML(reg.noRM)} — No. Reg: ${escapeHTML(reg.noReg)}</div>
      <div>Tanggal: ${formatTanggal(reg.tanggal)}</div>
      <div>Dokter Pengirim: ${escapeHTML(dokter ? dokter.nama : '-')}</div>
      <div>Radiografer: ${escapeHTML(radiografer ? radiografer.nama : '-')}</div>
      <div>Dokter Sp.Radiologi: ${escapeHTML(dokterSp ? dokterSp.nama : '-')}</div>
    </div>`;

  const jenisAll = DB.getJenisRadiologi().filter(j => j.aktif !== false);
  radEdit2JenisMap = {};
  jenisAll.forEach(j => { radEdit2JenisMap[j.id] = j; });

  const addedIds = new Set(reg.jenisIds || []);
  radEdit2Items = {};
  jenisAll.forEach(j => {
    radEdit2Items[j.id] = { added: addedIds.has(j.id) };
  });

  activeRadEdit2JenisId = null;
  renderRadEdit2Accordion(jenisAll);
  showView('rad-edit2');
}

$('#radEdit2Wrap').addEventListener('click', (e) => {
  const row = e.target.closest('.delphi-list-item');
  if (row) {
    activeRadEdit2JenisId = row.dataset.jenisid;
    $all('#radEdit2Wrap .delphi-list-item').forEach(b => b.classList.toggle('active', b === row));
    renderRadEdit2Panel();
  }
});

$('#radEdit2Panel').addEventListener('click', (e) => {
  const jid = activeRadEdit2JenisId;
  if (!jid) return;
  const tambahBtn = e.target.closest('.accordion-tambah-btn');
  if (tambahBtn) {
    radEdit2Items[jid].added = true;
    persistAccordionItem(jid);
    refreshRadEdit2Tab(jid);
    showToast('Pemeriksaan ditambahkan.');
    renderDaftarRad();
    return;
  }
});

$('#formRadEdit2').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = DB.getRegistrasiRadiologi();
  const reg = list.find(r => r.id === hasilRegRad2Id);
  if (!reg) return;

  const addedIds = Object.keys(radEdit2Items).filter(id => radEdit2Items[id].added);
  if (addedIds.length === 0) {
    showToast('Pilih minimal satu pemeriksaan.');
    return;
  }

  const jenisMaster = DB.getJenisRadiologi();
  reg.jenisIds = addedIds;
  reg.jenisSnapshot = addedIds.map(id => JSON.parse(JSON.stringify(jenisMaster.find(j => j.id === id))));
  const oldHasil = reg.hasil || {};
  const hasil = {};
  addedIds.forEach(id => {
    hasil[id] = oldHasil[id] || { hasilBacaan: '', kesan: '' };
  });
  reg.hasil = hasil;
  reg.totalHarga = reg.jenisSnapshot.reduce((sum, j) => sum + (Number(j.harga) || 0), 0);
  reg.updatedAt = Date.now();

  DB.saveRegistrasiRadiologi(list);
  showToast('Perubahan pemeriksaan radiologi disimpan.');
  showView('rad-daftar');
  renderDaftarRad();
});

/* ============================ RADIOLOGI: MASTER JENIS & TARIF ============================ */

function isiSelectModalitas(selId, current) {
  const sel = $(selId);
  sel.innerHTML = MODALITAS_LIST.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
  if (current) sel.value = current;
}

function renderJenisMaster() {
  isiSelectModalitas('#newJenisModalitas');
  const list = DB.getJenisRadiologi();
  const tbody = $('#tblJenisRadBody');
  tbody.innerHTML = '';
  list.forEach(j => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inline-edit" value="${escapeHTML(j.nama)}"></td>
      <td class="jenis-modalitas-cell"></td>
      <td><input type="number" class="inline-edit" value="${j.harga}"></td>
      <td class="center"><input type="checkbox" ${j.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [namaCell, modalitasCell, hargaCell, aktifCell, aksiCell] = tr.children;

    const modSel = document.createElement('select');
    modSel.className = 'role-select';
    modSel.innerHTML = MODALITAS_LIST.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
    modSel.value = j.modalitas;
    modSel.addEventListener('change', (e) => {
      j.modalitas = e.target.value;
      DB.saveJenisRadiologi(list);
      showToast('Modalitas diperbarui.');
    });
    modalitasCell.appendChild(modSel);

    namaCell.querySelector('input').addEventListener('change', (e) => {
      j.nama = e.target.value.trim();
      DB.saveJenisRadiologi(list);
      showToast('Nama pemeriksaan diperbarui.');
    });
    hargaCell.querySelector('input').addEventListener('change', (e) => {
      j.harga = Number(e.target.value) || 0;
      DB.saveJenisRadiologi(list);
      showToast('Harga diperbarui.');
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      j.aktif = e.target.checked;
      DB.saveJenisRadiologi(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      const ok = await confirmAsync(`Hapus jenis pemeriksaan "${j.nama}"?`);
      if (!ok) return;
      DB.saveJenisRadiologi(list.filter(x => x.id !== j.id));
      renderJenisMaster();
      showToast('Jenis pemeriksaan dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddJenis').addEventListener('click', () => {
  const namaI = $('#newJenisNama');
  const modalitasI = $('#newJenisModalitas');
  const hargaI = $('#newJenisHarga');
  const nama = namaI.value.trim();
  if (!nama) { showToast('Nama pemeriksaan tidak boleh kosong.'); return; }
  const list = DB.getJenisRadiologi();
  list.push({ id: uid('rj'), nama, modalitas: modalitasI.value, harga: Number(hargaI.value) || 0, aktif: true });
  DB.saveJenisRadiologi(list);
  namaI.value = '';
  hargaI.value = '';
  renderJenisMaster();
  showToast('Jenis pemeriksaan ditambahkan.');
});

/* ============================ RADIOLOGI: DAFTAR VARIAN KESAN (TAB) ============================ */
/* Nama pemeriksaan tampil sejajar sebagai tab (Thorax, BNO, dst berdampingan).
   Klik satu tab -> panel di bawahnya otomatis menampilkan Edit / Tambah dan
   daftar Kesan pemeriksaan itu. Satu pemeriksaan bisa punya banyak kesan. */

let activeKesanTabId = null;
let editingKesanEntryId = null;

function kesanTemplateBadgeHTML(jenisId) {
  const list = DB.getKesanTemplate()[jenisId] || [];
  return list.length > 0
    ? `<span class="accordion-badge accordion-badge-added">${list.length} Kesan Tersimpan</span>`
    : '<span class="accordion-badge">Belum ada kesan</span>';
}

function renderKesanTemplateMaster() {
  const jenisAll = DB.getJenisRadiologi().filter(j => j.aktif !== false);
  const wrap = $('#kesanTemplateWrap');
  let html = '';
  MODALITAS_LIST.forEach(modalitas => {
    const items = jenisAll.filter(j => j.modalitas === modalitas);
    if (items.length === 0) return;
    html += `<div class="jenis-group-title">${escapeHTML(modalitas)}</div>`;
    html += `<div class="kesan-tab-row">` + items.map(j => `
      <button type="button" class="kesan-tab${activeKesanTabId === j.id ? ' active' : ''}" data-jenisid="${j.id}">${escapeHTML(j.nama)}</button>
    `).join('') + `</div>`;
  });
  wrap.innerHTML = html;
  renderKesanTabPanel();
}

$('#btnHapusSemuaKesan').addEventListener('click', async () => {
  const ok = await confirmAsync('Yakin ingin menghapus SEMUA data Kesan Pemeriksaan Radiologi? Tindakan ini tidak bisa dibatalkan.');
  if (!ok) return;
  DB.saveKesanTemplate({});
  activeKesanTabId = null;
  editingKesanEntryId = null;
  renderKesanTemplateMaster();
  showToast('Semua data kesan pemeriksaan radiologi dihapus.');
});

function kesanEntryHTML(jenisId, entry) {
  if (editingKesanEntryId === entry.id) {
    return `
      <div class="kesan-entry" data-entryid="${entry.id}">
        <textarea rows="4" class="kesan-entry-edit-input">${escapeHTML(entry.kesan)}</textarea>
        <div class="kesan-entry-meta">
          <span class="kesan-entry-info">${new Date(entry.createdAt).toLocaleString('id-ID')}</span>
          <div class="accordion-actions">
            <button type="button" class="btn btn-sm btn-primary kesan-entry-simpan-edit-btn">Simpan</button>
            <button type="button" class="btn btn-sm btn-light kesan-entry-batal-edit-btn">Batal</button>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="kesan-entry" data-entryid="${entry.id}">
      <div class="kesan-entry-text">${escapeHTML(entry.kesan)}</div>
      <div class="kesan-entry-meta">
        <span class="kesan-entry-info">
          ${new Date(entry.createdAt).toLocaleString('id-ID')}
          ${entry.patientNama ? `&bull; <button type="button" class="kesan-entry-patient-link" data-regid="${entry.patientRegId}">&#128100; ${escapeHTML(entry.patientNama)} (RM ${escapeHTML(entry.patientNoRM || '-')})</button>` : ''}
        </span>
        <div class="accordion-actions">
          <button type="button" class="btn btn-sm btn-light kesan-entry-copy-btn">Copy</button>
          <button type="button" class="btn btn-sm btn-light kesan-entry-edit-btn">Edit</button>
          <button type="button" class="btn btn-sm btn-danger kesan-entry-hapus-btn">Hapus</button>
        </div>
      </div>
    </div>`;
}

function renderKesanTabPanel() {
  const panel = $('#kesanTabPanel');
  if (!activeKesanTabId) {
    panel.innerHTML = `<div class="empty-state">Pilih salah satu pemeriksaan di atas (Thorax, BNO, dst) untuk melihat atau menambah Kesan.</div>`;
    return;
  }
  const j = DB.getJenisRadiologi().find(x => x.id === activeKesanTabId);
  if (!j) { activeKesanTabId = null; renderKesanTabPanel(); return; }

  const list = (DB.getKesanTemplate()[activeKesanTabId] || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  const entriesHTML = list.length === 0
    ? `<div class="small-text">Belum ada kesan tersimpan untuk pemeriksaan ini.</div>`
    : list.map(entry => kesanEntryHTML(activeKesanTabId, entry)).join('');

  panel.innerHTML = `
    <div class="kesan-panel-head">
      <h3>${escapeHTML(j.nama)} <span class="small-text">(${escapeHTML(j.modalitas)})</span></h3>
      ${kesanTemplateBadgeHTML(activeKesanTabId)}
    </div>
    <label>Tambah Varian Kesan Baru</label>
    <textarea rows="4" class="kesan-template-input" placeholder="Tulis salah satu kemungkinan kesan untuk pemeriksaan ini..."></textarea>
    <div class="accordion-actions" style="margin-bottom:16px;">
      <button type="button" class="btn btn-sm btn-primary kesan-template-tambah-btn">+ Tambah Kesan</button>
    </div>
    <div class="kesan-entry-list">${entriesHTML}</div>
  `;
}

$('#kesanTemplateWrap').addEventListener('click', (e) => {
  const tab = e.target.closest('.kesan-tab');
  if (tab) {
    activeKesanTabId = tab.dataset.jenisid;
    editingKesanEntryId = null;
    renderKesanTemplateMaster();
    return;
  }
});

$('#kesanTabPanel').addEventListener('click', (e) => {
  const tambahBtn = e.target.closest('.kesan-template-tambah-btn');
  if (tambahBtn) {
    const textarea = $('#kesanTabPanel .kesan-template-input');
    const teks = textarea.value.trim();
    if (!teks) { showToast('Tulis kesan terlebih dahulu.'); return; }
    const templates = DB.getKesanTemplate();
    if (!templates[activeKesanTabId]) templates[activeKesanTabId] = [];
    templates[activeKesanTabId].push({ id: uid('ks'), kesan: teks, createdAt: Date.now() });
    DB.saveKesanTemplate(templates);
    showToast('Kesan baru ditambahkan.');
    renderKesanTabPanel();
    return;
  }
  const copyBtn = e.target.closest('.kesan-entry-copy-btn');
  if (copyBtn) {
    const entryId = copyBtn.closest('.kesan-entry').dataset.entryid;
    const entry = (DB.getKesanTemplate()[activeKesanTabId] || []).find(x => x.id === entryId);
    if (entry) {
      copyTextToClipboard(entry.kesan);
      showToast('Kesan disalin ke clipboard.');
    }
    return;
  }
  const editBtn = e.target.closest('.kesan-entry-edit-btn');
  if (editBtn) {
    editingKesanEntryId = editBtn.closest('.kesan-entry').dataset.entryid;
    renderKesanTabPanel();
    return;
  }
  const batalBtn = e.target.closest('.kesan-entry-batal-edit-btn');
  if (batalBtn) {
    editingKesanEntryId = null;
    renderKesanTabPanel();
    return;
  }
  const simpanEditBtn = e.target.closest('.kesan-entry-simpan-edit-btn');
  if (simpanEditBtn) {
    const entryId = simpanEditBtn.closest('.kesan-entry').dataset.entryid;
    const teks = simpanEditBtn.closest('.kesan-entry').querySelector('.kesan-entry-edit-input').value.trim();
    if (!teks) { showToast('Kesan tidak boleh kosong.'); return; }
    const templates = DB.getKesanTemplate();
    const entry = (templates[activeKesanTabId] || []).find(x => x.id === entryId);
    if (entry) entry.kesan = teks;
    DB.saveKesanTemplate(templates);
    editingKesanEntryId = null;
    showToast('Kesan diperbarui.');
    renderKesanTabPanel();
    return;
  }
  const hapusBtn = e.target.closest('.kesan-entry-hapus-btn');
  if (hapusBtn) {
    const entryId = hapusBtn.closest('.kesan-entry').dataset.entryid;
    const templates = DB.getKesanTemplate();
    templates[activeKesanTabId] = (templates[activeKesanTabId] || []).filter(entry => entry.id !== entryId);
    DB.saveKesanTemplate(templates);
    showToast('Kesan dihapus.');
    renderKesanTabPanel();
    return;
  }
  const patientLink = e.target.closest('.kesan-entry-patient-link');
  if (patientLink) {
    const regId = patientLink.dataset.regid;
    const reg = DB.getRegistrasiRadiologi().find(r => r.id === regId);
    if (!reg) { showToast('Data pendaftaran pasien ini sudah tidak ada.'); return; }
    openRadEdit2(regId);
    return;
  }

  /* Klik di baris kesan mana pun (bukan tombol Edit/Hapus/dst di atas, dan bukan
     saat sedang mode edit teks) langsung melompat ke Edit2 pasien terkait. */
  const entryRow = e.target.closest('.kesan-entry');
  if (entryRow && e.target.tagName !== 'TEXTAREA') {
    const entryId = entryRow.dataset.entryid;
    if (editingKesanEntryId === entryId) return;
    const entry = (DB.getKesanTemplate()[activeKesanTabId] || []).find(x => x.id === entryId);
    if (!entry) return;
    if (!entry.patientRegId) { showToast('Kesan ini belum terhubung ke data pasien manapun.'); return; }
    const reg = DB.getRegistrasiRadiologi().find(r => r.id === entry.patientRegId);
    if (!reg) { showToast('Data pendaftaran pasien ini sudah tidak ada.'); return; }
    openRadEdit2(entry.patientRegId);
  }
});

/* ============================ RADIOLOGI: DATA SEKUNDER ============================ */
/* Hub Kwitansi, Label, Pajak, Laporan Mingguan/Bulanan/Tahunan, dan Sharing Dokter —
   semua dihitung dari data pendaftaran Radiologi saja. */

function regsInRangeRad(dari, sampai) {
  return DB.getRegistrasiRadiologi().filter(r => {
    if (dari && r.tanggal < dari) return false;
    if (sampai && r.tanggal > sampai) return false;
    return true;
  });
}

function switchDatasekTab(tabName) {
  $all('.datasek-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  const panelId = 'datasek' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  $all('.datasek-panel').forEach(p => p.classList.toggle('active', p.id === panelId));
}

function refreshDatasekTab(tabName) {
  if (tabName === 'kwitansi') renderKwitansiList();
  else if (tabName === 'label') renderLabelSekList();
  else if (tabName === 'pajak') initPajakForm();
  else if (tabName === 'tahunan') populateTahunYearSelect();
}

$('#datasekSubnav').addEventListener('click', (e) => {
  const btn = e.target.closest('.datasek-tab');
  if (!btn) return;
  const tabName = btn.dataset.tab;
  switchDatasekTab(tabName);
  refreshDatasekTab(tabName);
});

/* ------------------------------ Kwitansi ------------------------------ */

function renderKwitansiList() {
  const q = ($('#cariKwitansi').value || '').toLowerCase().trim();
  const list = DB.getRegistrasiRadiologi()
    .filter(r => !q || (r.nama || '').toLowerCase().includes(q) || (r.noRM || '').toLowerCase().includes(q) || (r.noReg || '').toLowerCase().includes(q))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const tbody = $('#tblKwitansiBody');
  tbody.innerHTML = '';
  $('#emptyKwitansi').style.display = list.length ? 'none' : 'block';
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHTML(r.noReg)}</td><td>${formatTanggal(r.tanggal)}</td><td>${escapeHTML(r.nama)}</td><td>${formatRupiah(r.totalHarga)}</td><td class="aksi-cell"></td>`;
    tr.querySelector('.aksi-cell').appendChild(makeBtn('Cetak Kwitansi', 'btn-primary', () => printKwitansiRad(r, printCtxRad())));
    tbody.appendChild(tr);
  });
}
$('#cariKwitansi').addEventListener('input', renderKwitansiList);

/* ------------------------------ Label ------------------------------ */

function renderLabelSekList() {
  const q = ($('#cariLabelSek').value || '').toLowerCase().trim();
  const list = DB.getRegistrasiRadiologi()
    .filter(r => !q || (r.nama || '').toLowerCase().includes(q) || (r.noRM || '').toLowerCase().includes(q) || (r.noReg || '').toLowerCase().includes(q))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const tbody = $('#tblLabelSekBody');
  tbody.innerHTML = '';
  $('#emptyLabelSek').style.display = list.length ? 'none' : 'block';
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHTML(r.noReg)}</td><td>${formatTanggal(r.tanggal)}</td><td>${escapeHTML(r.nama)}</td><td class="aksi-cell"></td>`;
    tr.querySelector('.aksi-cell').appendChild(makeBtn('Cetak Label', 'btn-light', () => openLabelModal(r)));
    tbody.appendChild(tr);
  });
}
$('#cariLabelSek').addEventListener('input', renderLabelSekList);

/* ------------------------------ Pajak ------------------------------ */

function initPajakForm() {
  $('#pajakPersen').value = DB.getPajakSetting().persen;
}

$('#btnSimpanPajakPersen').addEventListener('click', () => {
  const persen = Number($('#pajakPersen').value) || 0;
  DB.savePajakSetting({ persen });
  showToast('Persentase pajak disimpan.');
});

$('#formPajak').addEventListener('submit', (e) => {
  e.preventDefault();
  const dari = $('#pajakDari').value;
  const sampai = $('#pajakSampai').value;
  const persen = Number($('#pajakPersen').value) || 0;
  const list = regsInRangeRad(dari, sampai);
  const total = list.reduce((s, r) => s + (Number(r.totalHarga) || 0), 0);
  const pajak = total * persen / 100;
  const bersih = total - pajak;
  $('#pajakHasil').innerHTML = `
    <div class="datasek-summary">
      <div class="datasek-stat"><div class="stat-label">Jumlah Registrasi</div><div class="stat-value">${list.length}</div></div>
      <div class="datasek-stat"><div class="stat-label">Total Pendapatan</div><div class="stat-value">${formatRupiah(total)}</div></div>
      <div class="datasek-stat"><div class="stat-label">Pajak (${persen}%)</div><div class="stat-value">${formatRupiah(pajak)}</div></div>
      <div class="datasek-stat"><div class="stat-label">Pendapatan Bersih</div><div class="stat-value">${formatRupiah(bersih)}</div></div>
    </div>
    <div class="form-actions"><button type="button" class="btn btn-light" id="btnCetakPajak">Cetak</button></div>
  `;
  $('#btnCetakPajak').addEventListener('click', () => {
    const label = `Periode: ${dari ? formatTanggal(dari) : '(semua)'} s/d ${sampai ? formatTanggal(sampai) : '(semua)'}`;
    printLaporanContainer('#pajakHasil', 'Laporan Pajak Radiologi', label);
  });
});

/* ------------------------------ Laporan periode (Mingguan/Bulanan/Tahunan) ------------------------------ */

function weekInputToRange(weekStr) {
  if (!weekStr) return null;
  const [y, w] = weekStr.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = d => d.toISOString().slice(0, 10);
  return { dari: fmt(monday), sampai: fmt(sunday) };
}

function monthInputToRange(monthStr) {
  if (!monthStr) return null;
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const fmt = d => d.toISOString().slice(0, 10);
  return { dari: fmt(first), sampai: fmt(last) };
}

function yearToRange(year) {
  return { dari: `${year}-01-01`, sampai: `${year}-12-31` };
}

function populateTahunYearSelect() {
  const years = new Set(DB.getRegistrasiRadiologi().map(r => (r.tanggal || '').slice(0, 4)).filter(Boolean));
  years.add(String(new Date().getFullYear()));
  const sorted = Array.from(years).sort((a, b) => b - a);
  const sel = $('#tahunanYear');
  const cur = sel.value;
  sel.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join('');
  if (cur && sorted.includes(cur)) sel.value = cur;
}

function renderLaporanPeriode(containerSel, dari, sampai, periodeLabel, judul) {
  const list = regsInRangeRad(dari, sampai);
  const total = list.reduce((s, r) => s + (Number(r.totalHarga) || 0), 0);

  const modalitasMap = {};
  list.forEach(r => {
    (r.jenisSnapshot || []).forEach(j => {
      if (!modalitasMap[j.modalitas]) modalitasMap[j.modalitas] = { count: 0, total: 0 };
      modalitasMap[j.modalitas].count += 1;
      modalitasMap[j.modalitas].total += Number(j.harga) || 0;
    });
  });
  const modalitasRows = Object.keys(modalitasMap).map(m =>
    `<tr><td>${escapeHTML(m)}</td><td>${modalitasMap[m].count}</td><td>${formatRupiah(modalitasMap[m].total)}</td></tr>`
  ).join('') || '<tr><td colspan="3" class="empty-state">Tidak ada data.</td></tr>';

  const regRows = list.map(r =>
    `<tr><td>${escapeHTML(r.noReg)}</td><td>${formatTanggal(r.tanggal)}</td><td>${escapeHTML(r.nama)}</td><td>${formatRupiah(r.totalHarga)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty-state">Tidak ada data.</td></tr>';

  const el = $(containerSel);
  el.innerHTML = `
    <div class="datasek-summary">
      <div class="datasek-stat"><div class="stat-label">Jumlah Registrasi</div><div class="stat-value">${list.length}</div></div>
      <div class="datasek-stat"><div class="stat-label">Total Pendapatan</div><div class="stat-value">${formatRupiah(total)}</div></div>
    </div>
    <h4>Rincian per Modalitas</h4>
    <table class="tbl"><thead><tr><th>Modalitas</th><th>Jumlah</th><th>Pendapatan</th></tr></thead><tbody>${modalitasRows}</tbody></table>
    <h4>Daftar Registrasi</h4>
    <table class="tbl"><thead><tr><th>No. Reg</th><th>Tanggal</th><th>Nama</th><th>Total</th></tr></thead><tbody>${regRows}</tbody></table>
    <div class="form-actions"><button type="button" class="btn btn-light btn-cetak-laporan">Cetak</button></div>
  `;
  el.querySelector('.btn-cetak-laporan').addEventListener('click', () => printLaporanContainer(containerSel, judul, periodeLabel));
}

$('#formMingguan').addEventListener('submit', (e) => {
  e.preventDefault();
  const range = weekInputToRange($('#mingguanWeek').value);
  if (!range) { showToast('Pilih minggu terlebih dahulu.'); return; }
  renderLaporanPeriode('#mingguanHasil', range.dari, range.sampai, `Minggu: ${formatTanggal(range.dari)} s/d ${formatTanggal(range.sampai)}`, 'Laporan Mingguan Radiologi');
});

$('#formBulanan').addEventListener('submit', (e) => {
  e.preventDefault();
  const range = monthInputToRange($('#bulananMonth').value);
  if (!range) { showToast('Pilih bulan terlebih dahulu.'); return; }
  renderLaporanPeriode('#bulananHasil', range.dari, range.sampai, `Bulan: ${formatTanggal(range.dari)} s/d ${formatTanggal(range.sampai)}`, 'Laporan Bulanan Radiologi');
});

$('#formTahunan').addEventListener('submit', (e) => {
  e.preventDefault();
  const year = $('#tahunanYear').value;
  if (!year) { showToast('Pilih tahun terlebih dahulu.'); return; }
  const range = yearToRange(year);
  renderLaporanPeriode('#tahunanHasil', range.dari, range.sampai, `Tahun: ${year}`, 'Laporan Tahunan Radiologi');
});

/* ------------------------------ Sharing Dokter ------------------------------ */

$('#formSharing').addEventListener('submit', (e) => {
  e.preventDefault();
  const dari = $('#sharingDari').value;
  const sampai = $('#sharingSampai').value;
  const list = regsInRangeRad(dari, sampai);
  const dokterList = DB.getDokter();
  const agg = {};
  list.forEach(r => {
    if (!r.dokterId) return;
    if (!agg[r.dokterId]) agg[r.dokterId] = { count: 0, total: 0 };
    agg[r.dokterId].count += 1;
    agg[r.dokterId].total += Number(r.totalHarga) || 0;
  });
  const dokterIds = Object.keys(agg);
  const hasilEl = $('#sharingHasil');
  if (dokterIds.length === 0) {
    hasilEl.innerHTML = `<div class="empty-state">Tidak ada data pada periode ini.</div>`;
    return;
  }
  const rowsHTML = dokterIds.map(did => {
    const d = dokterList.find(x => x.id === did);
    const nama = d ? d.nama : '(tidak diketahui)';
    const persen = d && d.sharingPersen != null ? d.sharingPersen : 0;
    const nominal = agg[did].total * persen / 100;
    return `<tr data-dokterid="${did}">
      <td>${escapeHTML(nama)}</td>
      <td>${agg[did].count}</td>
      <td>${formatRupiah(agg[did].total)}</td>
      <td><input type="number" class="sharing-persen-input" value="${persen}" min="0" max="100" step="0.1" style="width:70px;"> %</td>
      <td class="sharing-nominal-cell">${formatRupiah(nominal)}</td>
    </tr>`;
  }).join('');

  hasilEl.innerHTML = `
    <table class="tbl">
      <thead><tr><th>Dokter Pengirim</th><th>Jumlah Pasien</th><th>Total Pendapatan</th><th>% Sharing</th><th>Nominal Sharing</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <div class="form-actions"><button type="button" class="btn btn-light" id="btnCetakSharing">Cetak</button></div>
  `;

  hasilEl.querySelectorAll('.sharing-persen-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const tr = e.target.closest('tr');
      const did = tr.dataset.dokterid;
      const persen = Number(e.target.value) || 0;
      const dList = DB.getDokter();
      const d = dList.find(x => x.id === did);
      if (d) { d.sharingPersen = persen; DB.saveDokter(dList); }
      e.target.setAttribute('value', String(persen));
      const nominal = agg[did].total * persen / 100;
      tr.querySelector('.sharing-nominal-cell').textContent = formatRupiah(nominal);
      showToast('Persentase sharing disimpan.');
    });
  });

  $('#btnCetakSharing').addEventListener('click', () => {
    const label = `Periode: ${dari ? formatTanggal(dari) : '(semua)'} s/d ${sampai ? formatTanggal(sampai) : '(semua)'}`;
    printLaporanContainer('#sharingHasil', 'Laporan Sharing Dokter Radiologi', label);
  });
});

/* ============================ RADIOLOGI: MASTER RADIOGRAFER ============================ */

function renderRadiografer() {
  const list = DB.getRadiografer();
  const tbody = $('#tblRadiograferBody');
  tbody.innerHTML = '';
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inline-edit" value="${escapeHTML(r.nama)}"></td>
      <td class="center"><input type="checkbox" ${r.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [namaCell, aktifCell, aksiCell] = tr.children;
    namaCell.querySelector('input').addEventListener('change', (e) => {
      r.nama = e.target.value.trim();
      DB.saveRadiografer(list);
      showToast('Radiografer diperbarui.');
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      r.aktif = e.target.checked;
      DB.saveRadiografer(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      const ok = await confirmAsync(`Hapus radiografer "${r.nama}"?`);
      if (!ok) return;
      DB.saveRadiografer(list.filter(x => x.id !== r.id));
      renderRadiografer();
      showToast('Radiografer dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddRadiografer').addEventListener('click', () => {
  const input = $('#newRadiograferNama');
  const nama = input.value.trim();
  if (!nama) { showToast('Nama radiografer tidak boleh kosong.'); return; }
  const list = DB.getRadiografer();
  list.push({ id: uid('rg'), nama, aktif: true });
  DB.saveRadiografer(list);
  input.value = '';
  renderRadiografer();
  showToast('Radiografer ditambahkan.');
});

/* ============================ RADIOLOGI: MASTER DOKTER SP.RADIOLOGI ============================ */

function renderDokterSp() {
  const list = DB.getDokterRadiologi();
  const tbody = $('#tblDokterSpBody');
  tbody.innerHTML = '';
  list.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inline-edit" value="${escapeHTML(d.nama)}"></td>
      <td class="center"><input type="checkbox" ${d.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [namaCell, aktifCell, aksiCell] = tr.children;
    namaCell.querySelector('input').addEventListener('change', (e) => {
      d.nama = e.target.value.trim();
      DB.saveDokterRadiologi(list);
      showToast('Dokter Sp.Radiologi diperbarui.');
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      d.aktif = e.target.checked;
      DB.saveDokterRadiologi(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      const ok = await confirmAsync(`Hapus dokter "${d.nama}"?`);
      if (!ok) return;
      DB.saveDokterRadiologi(list.filter(x => x.id !== d.id));
      renderDokterSp();
      showToast('Dokter Sp.Radiologi dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddDokterSp').addEventListener('click', () => {
  const input = $('#newDokterSpNama');
  const nama = input.value.trim();
  if (!nama) { showToast('Nama dokter tidak boleh kosong.'); return; }
  const list = DB.getDokterRadiologi();
  list.push({ id: uid('drsp'), nama, aktif: true });
  DB.saveDokterRadiologi(list);
  input.value = '';
  renderDokterSp();
  showToast('Dokter Sp.Radiologi ditambahkan.');
});

/* =================================== KASIR =================================== */
/* Menggabungkan pendaftaran Laboratorium dan Radiologi dalam satu daftar kasir,
   untuk menandai status pembayaran (Lunas / Belum Lunas) dan mencetak kwitansi. */

function kasirCombinedList() {
  const lab = DB.getRegistrasi().map(r => ({ dept: 'lab', reg: r }));
  const rad = DB.getRegistrasiRadiologi().map(r => ({ dept: 'radiologi', reg: r }));
  return lab.concat(rad).sort((a, b) => (b.reg.createdAt || 0) - (a.reg.createdAt || 0));
}

function renderKasirList() {
  const q = ($('#cariKasir').value || '').toLowerCase().trim();
  const deptFilter = $('#filterDeptKasir').value;
  const statusFilter = $('#filterStatusKasir').value;

  const filtered = kasirCombinedList().filter(({ dept, reg }) => {
    if (deptFilter && dept !== deptFilter) return false;
    const status = reg.statusBayar || 'belum';
    if (statusFilter && status !== statusFilter) return false;
    if (!q) return true;
    return (reg.nama || '').toLowerCase().includes(q) ||
      (reg.noRM || '').toLowerCase().includes(q) ||
      (reg.noReg || '').toLowerCase().includes(q);
  });

  renderKasirSummary(filtered);

  const tbody = $('#tblKasirBody');
  tbody.innerHTML = '';
  $('#emptyKasir').style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(({ dept, reg }) => {
    const status = reg.statusBayar || 'belum';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dept === 'lab' ? 'Laboratorium' : 'Radiologi'}</td>
      <td>${escapeHTML(reg.noReg)}</td>
      <td>${formatTanggal(reg.tanggal)}</td>
      <td>${escapeHTML(reg.nama)}</td>
      <td>${formatRupiah(reg.totalHarga)}</td>
      <td><span class="badge badge-${status === 'lunas' ? 'selesai' : 'belum'}">${status === 'lunas' ? 'Lunas' : 'Belum Lunas'}</span></td>
      <td class="aksi-cell"></td>
    `;
    const aksiCell = tr.querySelector('.aksi-cell');
    aksiCell.appendChild(makeBtn(status === 'lunas' ? 'Batal Lunas' : 'Tandai Lunas', status === 'lunas' ? 'btn-light' : 'btn-primary', () => {
      toggleKasirLunas(dept, reg.id);
    }));
    aksiCell.appendChild(makeBtn('Cetak Kwitansi', 'btn-light', () => {
      const adminNama = $('#kasirAdminSelect').value;
      if (dept === 'lab') printKwitansiLab(reg, Object.assign({}, printCtx(), { adminNama }));
      else printKwitansiRad(reg, Object.assign({}, printCtxRad(), { adminNama }));
    }));
    tbody.appendChild(tr);
  });
}

/* Admin yang bertugas di kasir — namanya dipakai sebagai penerima di kwitansi,
   menggantikan nama penanggung jawab klinik. */
function populateKasirAdminSelect() {
  const sel = $('#kasirAdminSelect');
  const cur = sel.value;
  const list = DB.getAdmin().filter(a => a.aktif !== false);
  sel.innerHTML = list.length
    ? list.map(a => `<option value="${escapeHTML(a.nama)}">${escapeHTML(a.nama)}</option>`).join('')
    : '<option value="">(Belum ada admin)</option>';
  if (cur && list.some(a => a.nama === cur)) sel.value = cur;
}

/* "Data Kasir" — ringkasan statistik dari daftar yang sedang tampil (ikut berubah
   sesuai pencarian/filter departemen & status yang aktif). */
function renderKasirSummary(filtered) {
  const totalSemua = filtered.reduce((s, { reg }) => s + (Number(reg.totalHarga) || 0), 0);
  const lunasList = filtered.filter(({ reg }) => (reg.statusBayar || 'belum') === 'lunas');
  const belumList = filtered.filter(({ reg }) => (reg.statusBayar || 'belum') !== 'lunas');
  const totalLunas = lunasList.reduce((s, { reg }) => s + (Number(reg.totalHarga) || 0), 0);
  const totalBelum = belumList.reduce((s, { reg }) => s + (Number(reg.totalHarga) || 0), 0);

  $('#kasirSummary').innerHTML = `
    <div class="datasek-stat"><div class="stat-label">Jumlah Transaksi</div><div class="stat-value">${filtered.length}</div></div>
    <div class="datasek-stat"><div class="stat-label">Total Nilai</div><div class="stat-value">${formatRupiah(totalSemua)}</div></div>
    <div class="datasek-stat"><div class="stat-label">Sudah Lunas (${lunasList.length})</div><div class="stat-value">${formatRupiah(totalLunas)}</div></div>
    <div class="datasek-stat"><div class="stat-label">Belum Lunas (${belumList.length})</div><div class="stat-value">${formatRupiah(totalBelum)}</div></div>
  `;
}

function toggleKasirLunas(dept, regId) {
  if (dept === 'lab') {
    const list = DB.getRegistrasi();
    const reg = list.find(r => r.id === regId);
    if (!reg) return;
    reg.statusBayar = (reg.statusBayar || 'belum') === 'lunas' ? 'belum' : 'lunas';
    DB.saveRegistrasi(list);
  } else {
    const list = DB.getRegistrasiRadiologi();
    const reg = list.find(r => r.id === regId);
    if (!reg) return;
    reg.statusBayar = (reg.statusBayar || 'belum') === 'lunas' ? 'belum' : 'lunas';
    DB.saveRegistrasiRadiologi(list);
  }
  renderKasirList();
  showToast('Status pembayaran diperbarui.');
}

$('#cariKasir').addEventListener('input', renderKasirList);
$('#filterDeptKasir').addEventListener('change', renderKasirList);
$('#filterStatusKasir').addEventListener('change', renderKasirList);

/* =================================== ADMIN =================================== */

function renderAdmin() {
  const q = ($('#cariAdmin').value || '').toLowerCase().trim();
  const list = DB.getAdmin();
  const filtered = list.filter(a => !q || a.nama.toLowerCase().includes(q));
  const tbody = $('#tblAdminBody');
  tbody.innerHTML = '';
  $('#emptyAdmin').style.display = filtered.length ? 'none' : 'block';
  filtered.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inline-edit" value="${escapeHTML(a.nama)}"></td>
      <td class="center"><input type="checkbox" ${a.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [namaCell, aktifCell, aksiCell] = tr.children;
    namaCell.querySelector('input').addEventListener('change', (e) => {
      a.nama = e.target.value.trim();
      DB.saveAdmin(list);
      showToast('Admin diperbarui.');
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      a.aktif = e.target.checked;
      DB.saveAdmin(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      const ok = await confirmAsync(`Hapus admin "${a.nama}"?`);
      if (!ok) return;
      DB.saveAdmin(list.filter(x => x.id !== a.id));
      renderAdmin();
      showToast('Admin dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddAdmin').addEventListener('click', () => {
  const input = $('#newAdminNama');
  const nama = input.value.trim();
  if (!nama) { showToast('Nama admin tidak boleh kosong.'); return; }
  const list = DB.getAdmin();
  list.push({ id: uid('adm'), nama, aktif: true });
  DB.saveAdmin(list);
  input.value = '';
  renderAdmin();
  showToast('Admin ditambahkan.');
});

$('#cariAdmin').addEventListener('input', renderAdmin);

/* =============================== PENGATURAN ================================ */

let pendingLogoDataUrl = null;

function renderPengaturan() {
  const s = DB.getSettings();
  $('#sNamaKlinik').value = s.namaKlinik;
  $('#sAlamat').value = s.alamat;
  $('#sTelp').value = s.telp;
  $('#sEmail').value = s.email || '';
  $('#sPenanggungJawab').value = s.penanggungJawab;
  $('#logoPreview').src = s.logo;
  pendingLogoDataUrl = null;
}

$('#sLogoFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingLogoDataUrl = reader.result;
    $('#logoPreview').src = pendingLogoDataUrl;
  };
  reader.readAsDataURL(file);
});

$('#formPengaturan').addEventListener('submit', (e) => {
  e.preventDefault();
  const s = DB.getSettings();
  s.namaKlinik = $('#sNamaKlinik').value.trim();
  s.alamat = $('#sAlamat').value.trim();
  s.telp = $('#sTelp').value.trim();
  s.email = $('#sEmail').value.trim();
  s.penanggungJawab = $('#sPenanggungJawab').value.trim();
  if (pendingLogoDataUrl) s.logo = pendingLogoDataUrl;
  DB.saveSettings(s);
  renderBrand();
  showToast('Pengaturan disimpan.');
});

/* =========================== MANAJEMEN PENGGUNA ============================ */

function roleTagHTML(role) {
  const label = ROLES[role] ? ROLES[role].label : role;
  return `<span class="role-tag role-tag-${role}">${escapeHTML(label)}</span>`;
}

function renderUsers() {
  if (!currentUser || currentUser.role !== 'ceo') return;
  const list = DB.getUsers();
  const tbody = $('#tblUsersBody');
  tbody.innerHTML = '';
  list.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(u.username)}</td>
      <td><input type="text" class="inline-edit" value="${escapeHTML(u.nama)}"></td>
      <td></td>
      <td><input type="password" class="inline-edit user-pass-input" value="${escapeHTML(u.password)}"></td>
      <td class="center"><input type="checkbox" ${u.aktif !== false ? 'checked' : ''}></td>
      <td class="aksi-cell"></td>
    `;
    const [, namaCell, roleCell, passCell, aktifCell, aksiCell] = tr.children;

    const roleSelect = document.createElement('select');
    roleSelect.className = 'role-select';
    Object.keys(ROLES).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = ROLES[r].label;
      if (r === u.role) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener('change', (e) => {
      u.role = e.target.value;
      DB.saveUsers(list);
      showToast('Peran pengguna diperbarui.');
      if (currentUser.id === u.id) { currentUser = u; applyRBAC(); }
    });
    roleCell.appendChild(roleSelect);

    namaCell.querySelector('input').addEventListener('change', (e) => {
      u.nama = e.target.value.trim();
      DB.saveUsers(list);
      if (currentUser.id === u.id) { currentUser = u; $('#loggedUserNama').textContent = u.nama; }
    });
    passCell.querySelector('input').addEventListener('change', (e) => {
      if (!e.target.value) { e.target.value = u.password; return; }
      u.password = e.target.value;
      DB.saveUsers(list);
      showToast('Password diperbarui.');
    });
    aktifCell.querySelector('input').addEventListener('change', (e) => {
      u.aktif = e.target.checked;
      DB.saveUsers(list);
    });
    aksiCell.appendChild(makeBtn('Hapus', 'btn-danger', async () => {
      if (u.id === currentUser.id) { showToast('Tidak bisa menghapus akun yang sedang digunakan.'); return; }
      if (u.role === 'ceo' && list.filter(x => x.role === 'ceo').length <= 1) {
        showToast('Minimal harus ada satu akun CEO.'); return;
      }
      const ok = await confirmAsync(`Hapus pengguna "${u.nama}" (${u.username})?`);
      if (!ok) return;
      DB.saveUsers(list.filter(x => x.id !== u.id));
      renderUsers();
      showToast('Pengguna dihapus.');
    }));
    tbody.appendChild(tr);
  });
}

$('#btnAddUser').addEventListener('click', () => {
  if (!currentUser || currentUser.role !== 'ceo') return;
  const usernameI = $('#newUserUsername');
  const passwordI = $('#newUserPassword');
  const namaI = $('#newUserNama');
  const roleI = $('#newUserRole');
  const username = usernameI.value.trim();
  const password = passwordI.value;
  const nama = namaI.value.trim();
  if (!username || !password || !nama) { showToast('Username, password, dan nama wajib diisi.'); return; }
  const list = DB.getUsers();
  if (list.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    showToast('Username sudah digunakan.'); return;
  }
  list.push({ id: uid('usr'), username, password, nama, role: roleI.value, aktif: true });
  DB.saveUsers(list);
  usernameI.value = '';
  passwordI.value = '';
  namaI.value = '';
  renderUsers();
  showToast('Pengguna ditambahkan.');
});

/* ================================ NAVIGASI ================================= */

$all('.navbtn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (!hasAccess(view)) return;
    showView(view);
    refreshView(view);
    const openMenu = btn.closest('.nav-dropdown-menu');
    if (openMenu) openMenu.classList.remove('show');
  });
});

/* Menu Radiologi / Lab / Umum di header disusun sebagai dropdown — isinya baru
   terlihat saat tombol grupnya diklik, supaya header tidak penuh sesak. */
$all('.nav-dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = toggle.nextElementSibling;
    const willOpen = !menu.classList.contains('show');
    $all('.nav-dropdown-menu').forEach(m => m.classList.remove('show'));
    if (willOpen) menu.classList.add('show');
  });
});
document.addEventListener('click', () => {
  $all('.nav-dropdown-menu').forEach(m => m.classList.remove('show'));
});

$all('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.back;
    showView(target);
    refreshView(target);
  });
});

$('#btnTambahDaftar').addEventListener('click', () => openForm(null));

$('#cariPasien').addEventListener('input', renderDaftar);
$('#filterTanggal').addEventListener('change', renderDaftar);
$('#btnResetFilter').addEventListener('click', () => {
  $('#cariPasien').value = '';
  $('#filterTanggal').value = '';
  renderDaftar();
});

$('#btnTambahDaftarRad').addEventListener('click', () => openFormRad(null));

$('#cariPasienRad').addEventListener('input', renderDaftarRad);
$('#filterTanggalRad').addEventListener('change', renderDaftarRad);
$('#btnResetFilterRad').addEventListener('click', () => {
  $('#cariPasienRad').value = '';
  $('#filterTanggalRad').value = '';
  renderDaftarRad();
});

function refreshView(view) {
  if (view === 'daftar') renderDaftar();
  else if (view === 'master-analis') renderAnalis();
  else if (view === 'master-dokter') renderDokter();
  else if (view === 'master-paket') renderPaketMaster();
  else if (view === 'rad-daftar') renderDaftarRad();
  else if (view === 'rad-master-jenis') renderJenisMaster();
  else if (view === 'rad-master-kesan') renderKesanTemplateMaster();
  else if (view === 'rad-data-sekunder') { renderKwitansiList(); populateTahunYearSelect(); }
  else if (view === 'kasir') { populateKasirAdminSelect(); renderKasirList(); }
  else if (view === 'admin') renderAdmin();
  else if (view === 'rad-master-radiografer') renderRadiografer();
  else if (view === 'rad-master-dokter-sp') renderDokterSp();
  else if (view === 'pengaturan') renderPengaturan();
  else if (view === 'users') renderUsers();
}

/* ================================== INIT ==================================== */

(async () => {
  try {
    await bootstrapCache();
  } catch (err) {
    console.error(err);
    const txt = $('#loadingText');
    txt.textContent = 'Gagal terhubung ke server. Pastikan server (node server.js) sedang berjalan, lalu muat ulang halaman ini.';
    txt.classList.add('loading-error');
    return;
  }
  DB.init();
  $('#loadingScreen').style.display = 'none';
  checkSession();
})();
