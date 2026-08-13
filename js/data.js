/* ==========================================================================
   data.js — lapisan penyimpanan (localStorage) & data bawaan (default seed)
   ========================================================================== */

const DB_KEYS = {
  SETTINGS: 'lab_settings',
  ANALIS: 'lab_analis',
  DOKTER: 'lab_dokter',
  PAKET: 'lab_paket',
  REG: 'lab_registrasi',
  SEQ: 'lab_seq',
  USERS: 'lab_users'
};

const SESSION_KEY = 'lab_session_uid';

/* Peran & hak akses. Ini adalah gerbang akses sisi-klien (localStorage) untuk
   kenyamanan penggunaan bersama satu komputer — bukan otentikasi tingkat
   server, karena aplikasi ini tidak memiliki backend. */
const ROLES = {
  ceo: { label: 'CEO', views: ['daftar', 'form', 'hasil', 'master-analis', 'master-dokter', 'master-paket', 'pengaturan', 'users'] },
  manajer: { label: 'Manajer', views: ['daftar', 'form', 'hasil', 'master-analis', 'master-dokter', 'master-paket', 'pengaturan'] },
  karyawan: { label: 'Karyawan', views: ['daftar', 'form', 'hasil'] }
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

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Gagal memuat', key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

  nextNoRM() {
    let seq = loadJSON(DB_KEYS.SEQ, { rm: 0, reg: 0 });
    seq.rm += 1;
    saveJSON(DB_KEYS.SEQ, seq);
    const yr = new Date().getFullYear();
    return `RM-${yr}-${String(seq.rm).padStart(5, '0')}`;
  },

  nextNoReg() {
    let seq = loadJSON(DB_KEYS.SEQ, { rm: 0, reg: 0 });
    seq.reg += 1;
    saveJSON(DB_KEYS.SEQ, seq);
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `REG-${ymd}-${String(seq.reg).padStart(4, '0')}`;
  },

  init() {
    if (!localStorage.getItem(DB_KEYS.SETTINGS)) this.saveSettings(defaultSettings());
    if (!localStorage.getItem(DB_KEYS.ANALIS)) this.saveAnalis(defaultAnalis());
    if (!localStorage.getItem(DB_KEYS.DOKTER)) this.saveDokter(defaultDokter());
    if (!localStorage.getItem(DB_KEYS.PAKET)) this.savePaket(defaultPaket());
    if (!localStorage.getItem(DB_KEYS.REG)) this.saveRegistrasi([]);
    if (!localStorage.getItem(DB_KEYS.USERS)) this.saveUsers(defaultUsers());
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
