/* ==========================================================================
   app.js — logika antarmuka aplikasi laboratorium
   ========================================================================== */

let editingRegId = null;
let hasilRegId = null;
let currentUser = null;

/* ------------------------------ Util UI ---------------------------------- */

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

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

function isiSelectDokter() {
  const sel = $('#fDokter');
  const cur = sel.value;
  sel.innerHTML = DB.getDokter().filter(d => d.aktif !== false).map(d =>
    `<option value="${d.id}">${escapeHTML(d.nama)}${d.asal && d.asal !== '-' ? ' — ' + escapeHTML(d.asal) : ''}</option>`
  ).join('');
  if (cur) sel.value = cur;
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
  });
});

$all('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.back);
    renderDaftar();
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

function refreshView(view) {
  if (view === 'daftar') renderDaftar();
  else if (view === 'master-analis') renderAnalis();
  else if (view === 'master-dokter') renderDokter();
  else if (view === 'master-paket') renderPaketMaster();
  else if (view === 'pengaturan') renderPengaturan();
  else if (view === 'users') renderUsers();
}

/* ================================== INIT ==================================== */

DB.init();
checkSession();
