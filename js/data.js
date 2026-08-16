/* ==========================================================================
   data.js — lapisan penyimpanan (server + SQLite via /api/kv) & data bawaan
   (default seed)

   Semua data dimuat sekaligus dari server saat aplikasi dibuka (lihat
   bootstrapCache di bawah), disimpan dalam CACHE di memori supaya
   DB.getX()/saveX() tetap terasa instan (sinkron) seperti sebelumnya —
   setiap saveX() langsung memperbarui CACHE lalu mengirim perubahannya ke
   server di belakang layar.
   ========================================================================== */

const DB_KEYS = {
  SETTINGS: 'lab_settings',
  ANALIS: 'lab_analis',
  DOKTER: 'lab_dokter',
  PAKET: 'lab_paket',
  REG: 'lab_registrasi',
  SEQ: 'lab_seq',
  USERS: 'lab_users',
  RAD_JENIS: 'rad_jenis',
  RAD_DOKTER_SP: 'rad_dokter_sp',
  RAD_RADIOGRAFER: 'rad_radiografer',
  RAD_REG: 'rad_registrasi',
  RAD_KESAN_TEMPLATE: 'rad_kesan_template',
  RAD_BACAAN_TEMPLATE: 'rad_bacaan_template',
  RAD_PENYAKIT_TEMPLATE: 'rad_penyakit_template',
  RAD_EDIT_TABS: 'rad_edit_tabs',
  RAD_PAJAK_SETTING: 'rad_pajak_setting',
  ADMIN: 'lab_admin',
  FARMASI_OBAT: 'farmasi_obat',
  RAD_PEMERIKSAAN_KESAN: 'rad_pemeriksaan_kesan'
};

const MODALITAS_LIST = ['X-Ray', 'USG', 'CT-Scan', 'MRI', 'Panoramic Dental', 'Mammografi', 'BNO-IVP', 'Fluoroskopi'];

const SESSION_KEY = 'lab_session_uid';

/* Peran & hak akses. Ini adalah gerbang akses sisi-klien (localStorage) untuk
   kenyamanan penggunaan bersama satu komputer — bukan otentikasi tingkat
   server, karena aplikasi ini tidak memiliki backend. */
const ROLES = {
  ceo: {
    label: 'CEO', views: [
      'daftar', 'form', 'hasil', 'master-analis', 'master-dokter', 'master-paket', 'data-sekunder',
      'rad-daftar', 'rad-form', 'rad-hasil', 'rad-master-jenis', 'rad-master-radiografer', 'rad-master-dokter-sp', 'rad-master-kesan', 'rad-edit2', 'rad-data-sekunder', 'rad-cetak-universal', 'rad-print-hasil',
      'kasir', 'admin', 'pengaturan', 'users', 'keuangan-sharing', 'farmasi-obat',
      'rad-pemeriksaan-catalog', 'rad-ai'
    ]
  },
  manajer: {
    label: 'Manajer', views: [
      'daftar', 'form', 'hasil', 'master-analis', 'master-dokter', 'master-paket', 'data-sekunder',
      'rad-daftar', 'rad-form', 'rad-hasil', 'rad-master-jenis', 'rad-master-radiografer', 'rad-master-dokter-sp', 'rad-master-kesan', 'rad-edit2', 'rad-data-sekunder', 'rad-cetak-universal', 'rad-print-hasil',
      'kasir', 'admin', 'pengaturan', 'keuangan-sharing', 'farmasi-obat',
      'rad-pemeriksaan-catalog', 'rad-ai'
    ]
  },
  karyawan: { label: 'Karyawan', views: ['daftar', 'form', 'hasil', 'rad-daftar', 'rad-form', 'rad-hasil', 'kasir', 'rad-cetak-universal', 'rad-print-hasil'] }
};

const DEFAULT_LOGO =
  "data:image/svg+xml;utf8," + encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <circle cx='50' cy='50' r='48' fill='#0f6e5f'/>
    <path d='M50 20 v60 M20 50 h60' stroke='white' stroke-width='10' stroke-linecap='round'/>
    <circle cx='50' cy='50' r='48' fill='none' stroke='#0b5245' stroke-width='3'/>
  </svg>`);

function uid(prefix) {
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let CACHE = {};
let cacheReady = false;

function hasKey(key) {
  return Object.prototype.hasOwnProperty.call(CACHE, key) && CACHE[key] !== null && CACHE[key] !== undefined;
}

/* Dipanggil sekali di awal (lihat bagian INIT di app.js) — mengambil seluruh
   data dari server dalam satu request supaya DB.getX() sesudahnya bisa
   sinkron membaca dari CACHE tanpa menunggu jaringan setiap kali. */
async function bootstrapCache() {
  const res = await fetch('/api/kv');
  if (!res.ok) throw new Error('Gagal memuat data dari server (HTTP ' + res.status + ')');
  CACHE = await res.json();
  cacheReady = true;
}

function loadJSON(key, fallback) {
  return hasKey(key) ? CACHE[key] : fallback;
}

function saveJSON(key, value) {
  CACHE[key] = value;
  fetch('/api/kv/' + encodeURIComponent(key), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  }).catch(err => {
    console.error('Gagal menyimpan ke server:', key, err);
    if (typeof showToast === 'function') {
      showToast('Gagal menyimpan ke server — periksa koneksi ke server.');
    }
  });
}

/* ------------------------- Data bawaan (seed) --------------------------- */

function defaultSettings() {
  return {
    namaKlinik: 'LABORATORIUM KLINIK SEHAT SEJAHTERA',
    alamat: 'Jl. Kesehatan No. 10, Kota Anda',
    telp: '(021) 555-0100',
    email: 'info@labklinik.example',
    penanggungJawab: 'dr. Nama Penanggung Jawab, Sp.PK',
    logo: DEFAULT_LOGO
  };
}

function defaultUsers() {
  return [
    { id: uid('usr'), username: 'ceo', password: 'ceo123', nama: 'Pimpinan Laboratorium', role: 'ceo', aktif: true },
    { id: uid('usr'), username: 'manajer', password: 'manajer123', nama: 'Manajer Laboratorium', role: 'manajer', aktif: true },
    { id: uid('usr'), username: 'karyawan', password: 'karyawan123', nama: 'Staf Laboratorium', role: 'karyawan', aktif: true }
  ];
}

function defaultAnalis() {
  return [
    { id: uid('an'), nama: 'Ahmad Yani, A.Md.AK', aktif: true },
    { id: uid('an'), nama: 'Siti Aminah, A.Md.AK', aktif: true }
  ];
}

function defaultDokter() {
  return [
    { id: uid('dk'), nama: 'Pasien Sendiri (Tanpa Rujukan)', asal: '-', aktif: true },
    { id: uid('dk'), nama: 'dr. Budi Santoso', asal: 'Poli Umum', aktif: true },
    { id: uid('dk'), nama: 'dr. Rina Wijaya, Sp.PD', asal: 'Poli Penyakit Dalam', aktif: true }
  ];
}

function T(nama, satuan, nilaiRujukan) {
  return { id: uid('tst'), nama, satuan, nilaiRujukan };
}

function defaultPaket() {
  return [
    {
      id: 'hematologi',
      nama: 'Hematologi',
      harga: 75000,
      tests: [
        T('Hemoglobin (Hb)', 'g/dL', 'L: 13-17 | P: 12-15'),
        T('Leukosit', '/mm³', '4.000 - 10.000'),
        T('Trombosit', '/mm³', '150.000 - 400.000'),
        T('Hematokrit', '%', 'L: 40-48 | P: 37-43'),
        T('Eritrosit', 'juta/mm³', 'L: 4.5-5.5 | P: 4.0-5.0'),
        T('LED (Laju Endap Darah)', 'mm/jam', 'L: 0-10 | P: 0-15'),
        T('MCV', 'fL', '80 - 100'),
        T('MCH', 'pg', '27 - 31'),
        T('MCHC', 'g/dL', '32 - 36')
      ]
    },
    {
      id: 'diffcount',
      nama: 'Diffcount (Hitung Jenis Leukosit)',
      harga: 40000,
      tests: [
        T('Basofil', '%', '0 - 1'),
        T('Eosinofil', '%', '1 - 3'),
        T('Neutrofil Batang', '%', '2 - 6'),
        T('Neutrofil Segmen', '%', '50 - 70'),
        T('Limfosit', '%', '20 - 40'),
        T('Monosit', '%', '2 - 8')
      ]
    },
    {
      id: 'led',
      nama: 'Laju Endap Darah',
      harga: 30000,
      tests: [
        T('LED', 'mm/jam', 'L: 0-10 | P: 0-15')
      ]
    },
    {
      id: 'kimiadarah',
      nama: 'Kimia Darah',
      harga: 90000,
      tests: [
        T('Glukosa Sewaktu', 'mg/dL', '< 200'),
        T('Glukosa Puasa', 'mg/dL', '70 - 110'),
        T('Glukosa 2 Jam PP', 'mg/dL', '< 140'),
        T('Ureum', 'mg/dL', '10 - 50'),
        T('Kreatinin', 'mg/dL', 'L: 0.6-1.3 | P: 0.5-1.1'),
        T('Asam Urat', 'mg/dL', 'L: 3.5-7.2 | P: 2.6-6.0'),
        T('SGOT', 'U/L', '< 37'),
        T('SGPT', 'U/L', '< 42')
      ]
    },
    {
      id: 'kimiadarah2',
      nama: 'Kimia Darah 2',
      harga: 95000,
      tests: [
        T('Cholesterol Total', 'mg/dL', '< 200'),
        T('Trigliserida', 'mg/dL', '< 150'),
        T('HDL Cholesterol', 'mg/dL', '> 45'),
        T('LDL Cholesterol', 'mg/dL', '< 130'),
        T('Bilirubin Total', 'mg/dL', '0.3 - 1.2'),
        T('Bilirubin Direk', 'mg/dL', '0.1 - 0.4'),
        T('Protein Total', 'g/dL', '6.4 - 8.3'),
        T('Albumin', 'g/dL', '3.5 - 5.2')
      ]
    },
    {
      id: 'widal',
      nama: 'Widal',
      harga: 60000,
      tests: [
        T('Salmonella typhi O', 'titer', 'Negatif (< 1/80)'),
        T('Salmonella typhi H', 'titer', 'Negatif (< 1/80)'),
        T('Salmonella paratyphi AO', 'titer', 'Negatif (< 1/80)'),
        T('Salmonella paratyphi AH', 'titer', 'Negatif (< 1/80)'),
        T('Salmonella paratyphi BO', 'titer', 'Negatif (< 1/80)'),
        T('Salmonella paratyphi BH', 'titer', 'Negatif (< 1/80)')
      ]
    },
    {
      id: 'urinalisa',
      nama: 'Urinalisa',
      harga: 35000,
      tests: [
        T('Warna', '-', 'Kuning'),
        T('Kejernihan', '-', 'Jernih'),
        T('Berat Jenis', '-', '1.005 - 1.030'),
        T('pH', '-', '4.5 - 8.0'),
        T('Protein', '-', 'Negatif'),
        T('Glukosa', '-', 'Negatif'),
        T('Keton', '-', 'Negatif'),
        T('Bilirubin', '-', 'Negatif'),
        T('Urobilinogen', '-', 'Normal'),
        T('Nitrit', '-', 'Negatif'),
        T('Blood / Darah Samar', '-', 'Negatif'),
        T('Leukosit Esterase', '-', 'Negatif')
      ]
    },
    {
      id: 'urinerutin',
      nama: 'Urine Rutin',
      harga: 45000,
      tests: [
        T('Warna', '-', 'Kuning'),
        T('Kejernihan', '-', 'Jernih'),
        T('Berat Jenis', '-', '1.005 - 1.030'),
        T('pH', '-', '4.5 - 8.0'),
        T('Protein', '-', 'Negatif'),
        T('Reduksi / Glukosa', '-', 'Negatif'),
        T('Bilirubin', '-', 'Negatif'),
        T('Urobilinogen', '-', 'Normal'),
        T('Sedimen Eritrosit', '/LPB', '0 - 2'),
        T('Sedimen Leukosit', '/LPB', '0 - 5'),
        T('Epitel', '/LPK', 'Positif (sedikit)'),
        T('Silinder', '/LPK', 'Negatif'),
        T('Kristal', '/LPK', 'Negatif'),
        T('Bakteri', '-', 'Negatif')
      ]
    }
  ];
}

function J(nama, modalitas, harga) {
  return { id: uid('rj'), nama, modalitas, harga, aktif: true };
}

function defaultJenisRadiologi() {
  return [
    J('Thorax PA', 'X-Ray', 100000),
    J('Thorax PA/Lateral', 'X-Ray', 150000),
    J('Cranium AP/Lateral', 'X-Ray', 150000),
    J('Abdomen Polos (BNO)', 'X-Ray', 130000),
    J('Abdomen 3 Posisi', 'X-Ray', 275000),
    J('Vertebrae Cervical AP/Lateral', 'X-Ray', 180000),
    J('Vertebrae Lumbal AP/Lateral', 'X-Ray', 180000),
    J('Pelvis AP', 'X-Ray', 130000),
    J('Extremitas Atas', 'X-Ray', 120000),
    J('Extremitas Bawah', 'X-Ray', 120000),
    J('Genu (Lutut) AP/Lateral', 'X-Ray', 130000),
    J('Sinus Paranasal (SPN)', 'X-Ray', 140000),
    J('Panoramic Gigi', 'Panoramic Dental', 175000),
    J('USG Abdomen Lengkap', 'USG', 220000),
    J('USG Kandungan (Obstetri)', 'USG', 250000),
    J('USG Thyroid', 'USG', 180000),
    J('USG Mammae (Payudara)', 'USG', 220000),
    J('BNO-IVP', 'BNO-IVP', 550000),
    J('Mammografi', 'Mammografi', 400000),
    J('CT-Scan Kepala Non-Kontras', 'CT-Scan', 850000),
    J('CT-Scan Kepala Kontras', 'CT-Scan', 1350000),
    J('CT-Scan Thorax', 'CT-Scan', 1400000),
    J('CT-Scan Abdomen', 'CT-Scan', 1500000)
  ];
}

function O(nama, satuan, hargaBeli, hargaJual, stok, stokMin) {
  return { id: uid('obt'), nama, satuan, hargaBeli, hargaJual, stok, stokMin, aktif: true };
}

function defaultObat() {
  return [
    O('Paracetamol 500mg', 'Tablet', 300, 500, 200, 50),
    O('Amoxicillin 500mg', 'Tablet', 700, 1200, 150, 30),
    O('CTM (Antihistamin) 4mg', 'Tablet', 150, 300, 300, 50),
    O('Omeprazole 20mg', 'Kapsul', 1200, 2000, 100, 20),
    O('Ibuprofen 400mg', 'Tablet', 400, 700, 150, 30),
    O('Kontras Iodine Non-Ionik', 'Vial', 350000, 500000, 20, 5),
    O('Barium Sulfat (Kontras BNO/Colon in Loop)', 'Sachet', 85000, 130000, 15, 5),
    O('Cairan NaCl 0.9% 500ml', 'Botol', 12000, 20000, 50, 10),
    O('Alkohol Swab', 'Box', 15000, 25000, 40, 10),
    O('Masker Medis', 'Box', 25000, 40000, 30, 5)
  ];
}

function defaultPemeriksaanKesan() {
  return [];
}

function defaultDokterRadiologi() {
  return [
    { id: uid('drsp'), nama: 'dr. Andi Wijaya, Sp.Rad', aktif: true },
    { id: uid('drsp'), nama: 'dr. Maya Kusuma, Sp.Rad', aktif: true }
  ];
}

function defaultRadiografer() {
  return [
    { id: uid('rg'), nama: 'Dedi Supriyadi, A.Md.Rad', aktif: true },
    { id: uid('rg'), nama: 'Nurul Fadilah, A.Md.Rad', aktif: true }
  ];
}

function defaultAdmin() {
  return [
    { id: uid('adm'), nama: 'Siti Rahma', aktif: true }
  ];
}

/* ------------------------------ API DB ----------------------------------- */

const DB = {
  getSettings() {
    return loadJSON(DB_KEYS.SETTINGS, defaultSettings());
  },
  saveSettings(s) {
    saveJSON(DB_KEYS.SETTINGS, s);
  },

  getAnalis() {
    return loadJSON(DB_KEYS.ANALIS, defaultAnalis());
  },
  saveAnalis(list) {
    saveJSON(DB_KEYS.ANALIS, list);
  },

  getDokter() {
    return loadJSON(DB_KEYS.DOKTER, defaultDokter());
  },
  saveDokter(list) {
    saveJSON(DB_KEYS.DOKTER, list);
  },

  getPaket() {
    return loadJSON(DB_KEYS.PAKET, defaultPaket());
  },
  savePaket(list) {
    saveJSON(DB_KEYS.PAKET, list);
  },

  getRegistrasi() {
    return loadJSON(DB_KEYS.REG, []);
  },
  saveRegistrasi(list) {
    saveJSON(DB_KEYS.REG, list);
  },

  getUsers() {
    return loadJSON(DB_KEYS.USERS, defaultUsers());
  },
  saveUsers(list) {
    saveJSON(DB_KEYS.USERS, list);
  },

  getJenisRadiologi() {
    return loadJSON(DB_KEYS.RAD_JENIS, defaultJenisRadiologi());
  },
  saveJenisRadiologi(list) {
    saveJSON(DB_KEYS.RAD_JENIS, list);
  },

  getPemeriksaanKesan() {
    return loadJSON(DB_KEYS.RAD_PEMERIKSAAN_KESAN, defaultPemeriksaanKesan());
  },
  savePemeriksaanKesan(list) {
    saveJSON(DB_KEYS.RAD_PEMERIKSAAN_KESAN, list);
  },

  getObat() {
    return loadJSON(DB_KEYS.FARMASI_OBAT, defaultObat());
  },
  saveObat(list) {
    saveJSON(DB_KEYS.FARMASI_OBAT, list);
  },

  getDokterRadiologi() {
    return loadJSON(DB_KEYS.RAD_DOKTER_SP, defaultDokterRadiologi());
  },
  saveDokterRadiologi(list) {
    saveJSON(DB_KEYS.RAD_DOKTER_SP, list);
  },

  getRadiografer() {
    return loadJSON(DB_KEYS.RAD_RADIOGRAFER, defaultRadiografer());
  },
  saveRadiografer(list) {
    saveJSON(DB_KEYS.RAD_RADIOGRAFER, list);
  },

  getAdmin() {
    return loadJSON(DB_KEYS.ADMIN, defaultAdmin());
  },
  saveAdmin(list) {
    saveJSON(DB_KEYS.ADMIN, list);
  },

  getRegistrasiRadiologi() {
    return loadJSON(DB_KEYS.RAD_REG, []);
  },
  saveRegistrasiRadiologi(list) {
    saveJSON(DB_KEYS.RAD_REG, list);
  },

  getKesanTemplate() {
    return loadJSON(DB_KEYS.RAD_KESAN_TEMPLATE, {});
  },
  saveKesanTemplate(map) {
    saveJSON(DB_KEYS.RAD_KESAN_TEMPLATE, map);
  },

  getBacaanTemplate() {
    return loadJSON(DB_KEYS.RAD_BACAAN_TEMPLATE, {});
  },
  saveBacaanTemplate(map) {
    saveJSON(DB_KEYS.RAD_BACAAN_TEMPLATE, map);
  },

  getPenyakitTemplate() {
    return loadJSON(DB_KEYS.RAD_PENYAKIT_TEMPLATE, {});
  },
  savePenyakitTemplate(map) {
    saveJSON(DB_KEYS.RAD_PENYAKIT_TEMPLATE, map);
  },

  getEditRadTabs() {
    return loadJSON(DB_KEYS.RAD_EDIT_TABS, []);
  },
  saveEditRadTabs(list) {
    saveJSON(DB_KEYS.RAD_EDIT_TABS, list);
  },

  getPajakSetting() {
    return loadJSON(DB_KEYS.RAD_PAJAK_SETTING, { persen: 10 });
  },
  savePajakSetting(obj) {
    saveJSON(DB_KEYS.RAD_PAJAK_SETTING, obj);
  },

  nextNoRM() {
    let seq = loadJSON(DB_KEYS.SEQ, { rm: 0, reg: 0, regRad: 0 });
    seq.rm += 1;
    saveJSON(DB_KEYS.SEQ, seq);
    const yr = new Date().getFullYear();
    return `RM-${yr}-${String(seq.rm).padStart(5, '0')}`;
  },

  nextNoReg() {
    let seq = loadJSON(DB_KEYS.SEQ, { rm: 0, reg: 0, regRad: 0 });
    seq.reg += 1;
    saveJSON(DB_KEYS.SEQ, seq);
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `REG-${ymd}-${String(seq.reg).padStart(4, '0')}`;
  },

  nextNoRegRad() {
    let seq = loadJSON(DB_KEYS.SEQ, { rm: 0, reg: 0, regRad: 0 });
    seq.regRad = (seq.regRad || 0) + 1;
    saveJSON(DB_KEYS.SEQ, seq);
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `RAD-${ymd}-${String(seq.regRad).padStart(4, '0')}`;
  },

  init() {
    if (!hasKey(DB_KEYS.SETTINGS)) this.saveSettings(defaultSettings());
    if (!hasKey(DB_KEYS.ANALIS)) this.saveAnalis(defaultAnalis());
    if (!hasKey(DB_KEYS.DOKTER)) this.saveDokter(defaultDokter());
    if (!hasKey(DB_KEYS.PAKET)) this.savePaket(defaultPaket());
    if (!hasKey(DB_KEYS.REG)) this.saveRegistrasi([]);
    if (!hasKey(DB_KEYS.USERS)) this.saveUsers(defaultUsers());
    if (!hasKey(DB_KEYS.FARMASI_OBAT)) this.saveObat(defaultObat());
    if (!hasKey(DB_KEYS.RAD_PEMERIKSAAN_KESAN)) this.savePemeriksaanKesan(defaultPemeriksaanKesan());
    if (!hasKey(DB_KEYS.RAD_JENIS)) this.saveJenisRadiologi(defaultJenisRadiologi());
    if (!hasKey(DB_KEYS.RAD_DOKTER_SP)) this.saveDokterRadiologi(defaultDokterRadiologi());
    if (!hasKey(DB_KEYS.RAD_RADIOGRAFER)) this.saveRadiografer(defaultRadiografer());
    if (!hasKey(DB_KEYS.RAD_REG)) this.saveRegistrasiRadiologi([]);
    if (!hasKey(DB_KEYS.RAD_KESAN_TEMPLATE)) this.saveKesanTemplate({});
    if (!hasKey(DB_KEYS.RAD_BACAAN_TEMPLATE)) this.saveBacaanTemplate({});
    if (!hasKey(DB_KEYS.RAD_PENYAKIT_TEMPLATE)) this.savePenyakitTemplate({});
    if (!hasKey(DB_KEYS.RAD_EDIT_TABS)) {
      const jenisList = this.getJenisRadiologi();
      const namaDefault = ['Thorax', 'BNO', 'Lumbo-Sacral AP/Lat'];
      let jenisBerubah = false;
      const tabIds = namaDefault.map(nama => {
        let j = jenisList.find(x => x.nama.toLowerCase() === nama.toLowerCase());
        if (!j) {
          j = { id: uid('rj'), nama, modalitas: 'X-Ray', harga: 0, aktif: true };
          jenisList.push(j);
          jenisBerubah = true;
        }
        return j.id;
      });
      if (jenisBerubah) this.saveJenisRadiologi(jenisList);
      this.saveEditRadTabs(tabIds);
    }
    if (!hasKey(DB_KEYS.RAD_PAJAK_SETTING)) this.savePajakSetting({ persen: 10 });
    if (!hasKey(DB_KEYS.ADMIN)) this.saveAdmin(defaultAdmin());
    this.migrate();
  },

  migrate() {
    const paket = this.getPaket();
    const hema = paket.find(p => p.id === 'hematologi');
    if (hema && hema.nama === 'Klasifikasi Hematologi') {
      hema.nama = 'Hematologi';
      this.savePaket(paket);
    }

    // Registrasi yang sudah tersimpan menyimpan salinan (snapshot) nama paket
    // sendiri, jadi rename di atas tidak otomatis ikut berubah di sana.
    const reg = this.getRegistrasi();
    let regBerubah = false;
    reg.forEach(r => {
      (r.paketSnapshot || []).forEach(p => {
        if (p.id === 'hematologi' && p.nama === 'Klasifikasi Hematologi') {
          p.nama = 'Hematologi';
          regBerubah = true;
        }
      });
    });
    if (regBerubah) this.saveRegistrasi(reg);
  }
};

function formatRupiah(n) {
  n = Number(n) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatTanggal(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function hitungUmur(tglLahir) {
  if (!tglLahir) return '';
  const bd = new Date(tglLahir);
  if (isNaN(bd)) return '';
  const now = new Date();
  let th = now.getFullYear() - bd.getFullYear();
  let bl = now.getMonth() - bd.getMonth();
  if (bl < 0 || (bl === 0 && now.getDate() < bd.getDate())) th--;
  return th + ' th';
}

/* Angka ke terbilang Bahasa Indonesia, dipakai untuk kwitansi. */
function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function rec(x) {
    if (x < 12) return satuan[x];
    if (x < 20) return rec(x - 10) + ' belas';
    if (x < 100) return rec(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + rec(x % 10) : '');
    if (x < 200) return 'seratus' + (x % 100 ? ' ' + rec(x % 100) : '');
    if (x < 1000) return rec(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + rec(x % 100) : '');
    if (x < 2000) return 'seribu' + (x % 1000 ? ' ' + rec(x % 1000) : '');
    if (x < 1000000) return rec(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + rec(x % 1000) : '');
    if (x < 1000000000) return rec(Math.floor(x / 1000000)) + ' juta' + (x % 1000000 ? ' ' + rec(x % 1000000) : '');
    return rec(Math.floor(x / 1000000000)) + ' miliar' + (x % 1000000000 ? ' ' + rec(x % 1000000000) : '');
  }
  if (n === 0) return 'nol';
  return rec(n).trim();
}
