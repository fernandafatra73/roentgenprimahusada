/* ==========================================================================
   print.js — pembuatan tampilan cetak: hasil pemeriksaan, preview, & label
   ========================================================================== */

function openPrintWindow(html, autoprint) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    alert('Popup diblokir oleh browser. Izinkan popup untuk mencetak.');
    return null;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  if (autoprint) {
    w.onload = () => {
      w.focus();
      w.print();
    };
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
  }
  return w;
}

function printBaseStyles(pageSize, margin) {
  return `
  <style>
    @page { size: ${pageSize || 'A4'}; margin: ${margin || '15mm'}; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin:0; padding: 0 0 30px; }
    .sheet { max-width: 800px; margin: 0 auto; padding: 10px 6px; }
    .kop { display:flex; align-items:center; gap:16px; border-bottom: 3px solid #0f6e5f; padding-bottom: 10px; margin-bottom: 14px; }
    .kop img { width: 68px; height: 68px; object-fit: contain; }
    .kop-nama { font-size: 20px; font-weight: 700; color:#0f6e5f; letter-spacing: .5px; }
    .kop-alamat { font-size: 12px; color:#333; margin-top:2px; }
    .judul { text-align:center; font-size: 15px; font-weight:700; text-decoration: underline; margin: 6px 0 16px; letter-spacing: .5px; }
    .info-grid { display:grid; grid-template-columns: 130px 10px 1fr 130px 10px 1fr; font-size: 13px; row-gap: 4px; margin-bottom: 16px;}
    .info-grid div.lbl { font-weight:600; }
    table.hasil { width:100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px; }
    table.hasil th, table.hasil td { border: 1px solid #999; padding: 5px 8px; text-align:left; }
    table.hasil th { background:#eef6f4; }
    table.hasil td.hasil-val, table.hasil .hasil-val { font-weight:700; }
    .kategori-row td { background:#0f6e5f; color:#fff; font-weight:700; }
    .flag-normal { color:#0056b3; }
    .flag-abnormal { color:#b30000; }
    .flag-abnormal .star { color:#b30000; font-weight:700; }
    .footer-sign { display:flex; justify-content:flex-end; margin-top: 40px; font-size:13px; }
    .footer-sign .sign-box { text-align:center; width: 220px; }
    .sign-space { height: 60px; }
    .cetak-bar { text-align:center; margin: 16px 0; }
    .cetak-bar button { padding: 8px 22px; font-size:14px; background:#0f6e5f; color:#fff; border:none; border-radius:6px; cursor:pointer; }
    @media print { .cetak-bar { display:none; } }
  </style>`;
}

/* Mengembalikan true (normal), false (tidak normal), atau null (tidak dapat dinilai / kosong) */
function evaluasiHasil(hasil, nilaiRujukan) {
  const h = String(hasil == null ? '' : hasil).trim();
  const nr = String(nilaiRujukan == null ? '' : nilaiRujukan).trim();
  if (!h) return null;

  const hNum = parseFloat(h.replace(',', '.'));
  if (!isNaN(hNum)) {
    const range = nr.match(/(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)/);
    if (range) {
      const lo = parseFloat(range[1].replace(',', '.'));
      const hi = parseFloat(range[2].replace(',', '.'));
      return hNum >= lo && hNum <= hi;
    }
    const lt = nr.match(/<\s*(-?\d+(?:[.,]\d+)?)/);
    if (lt) return hNum < parseFloat(lt[1].replace(',', '.'));
    const gt = nr.match(/>\s*(-?\d+(?:[.,]\d+)?)/);
    if (gt) return hNum > parseFloat(gt[1].replace(',', '.'));
  }

  if (!nr) return null;
  const hl = h.toLowerCase();
  const nrl = nr.toLowerCase();
  return nrl.includes(hl) || hl.includes(nrl);
}

function hasilTampil(hasil, nilaiRujukan) {
  const normal = evaluasiHasil(hasil, nilaiRujukan);
  const teks = escapeHTML(hasil) || '-';
  if (normal === null) return { cls: '', html: teks };
  if (normal) return { cls: 'flag-normal', html: teks };
  return { cls: 'flag-abnormal', html: teks + '<span class="star">*</span>' };
}

function buildKopHTML(settings) {
  return `
    <div class="kop">
      <img src="${settings.logo}" alt="logo">
      <div>
        <div class="kop-nama">${escapeHTML(settings.namaKlinik)}</div>
        <div class="kop-alamat">${escapeHTML(settings.alamat)} &nbsp;|&nbsp; Telp: ${escapeHTML(settings.telp)}${settings.email ? ' &nbsp;|&nbsp; ' + escapeHTML(settings.email) : ''}</div>
      </div>
    </div>`;
}

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildReportHTML(reg, ctx, showPrintBar) {
  const settings = ctx.settings;
  const dokter = ctx.dokterList.find(d => d.id === reg.dokterId);
  const analis = ctx.analisList.find(a => a.id === reg.analisId);

  let tablesHTML = '';
  (reg.paketSnapshot || []).forEach(pk => {
    if (!pk.tests || pk.tests.length === 0) return;
    tablesHTML += `<table class="hasil"><thead>
      <tr class="kategori-row"><td colspan="4">${escapeHTML(pk.nama)}</td></tr>
      <tr><th style="width:40%">Pemeriksaan</th><th style="width:18%">Hasil</th><th style="width:18%">Satuan</th><th style="width:24%">Nilai Rujukan</th></tr>
      </thead><tbody>`;
    pk.tests.forEach(t => {
      const rec = (reg.hasil || {})[t.id] || {};
      const hasilVal = rec.hasil || '';
      const nr = rec.nilaiRujukan != null ? rec.nilaiRujukan : t.nilaiRujukan;
      const tampil = hasilTampil(hasilVal, nr);
      tablesHTML += `<tr>
        <td>${escapeHTML(t.nama)}</td>
        <td class="hasil-val ${tampil.cls}">${tampil.html}</td>
        <td>${escapeHTML(rec.satuan != null ? rec.satuan : t.satuan)}</td>
        <td>${escapeHTML(nr)}</td>
      </tr>`;
    });
    tablesHTML += `</tbody></table>`;
  });
  const legenda = `<div style="font-size:11.5px; margin: -6px 0 14px; color:#444;">
    <span class="flag-normal" style="font-weight:700;">biru</span> = normal &nbsp;|&nbsp;
    <span class="flag-abnormal" style="font-weight:700;">merah *</span> = di luar nilai rujukan
  </div>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Hasil Pemeriksaan - ${escapeHTML(reg.nama)}</title>
  ${printBaseStyles()}
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">HASIL PEMERIKSAAN LABORATORIUM</div>
    <div class="info-grid">
      <div class="lbl">No. Registrasi</div><div>:</div><div>${escapeHTML(reg.noReg)}</div>
      <div class="lbl">Tanggal</div><div>:</div><div>${formatTanggal(reg.tanggal)}</div>
      <div class="lbl">Nama Pasien</div><div>:</div><div>${escapeHTML(reg.nama)}</div>
      <div class="lbl">No. RM</div><div>:</div><div>${escapeHTML(reg.noRM)}</div>
      <div class="lbl">Jenis Kelamin</div><div>:</div><div>${reg.jk === 'P' ? 'Perempuan' : 'Laki-laki'}</div>
      <div class="lbl">Umur</div><div>:</div><div>${escapeHTML(reg.umur)}</div>
      <div class="lbl">Alamat</div><div>:</div><div>${escapeHTML(reg.alamat)}</div>
      <div class="lbl">Dokter Pengirim</div><div>:</div><div>${escapeHTML(dokter ? dokter.nama : '-')}</div>
    </div>
    ${legenda}
    ${tablesHTML}
    <div class="footer-sign">
      <div class="sign-box">
        <div>Analis Pemeriksa,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(analis ? analis.nama : '-')}</strong></div>
      </div>
    </div>
    ${showPrintBar ? `<div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>` : ''}
  </div>
  </body></html>`;
}

function printReport(reg, ctx) {
  const html = buildReportHTML(reg, ctx, false);
  openPrintWindow(html, true);
}

function previewReport(reg, ctx) {
  const html = buildReportHTML(reg, ctx, true);
  openPrintWindow(html, false);
}

/* ============================ LAPORAN RADIOLOGI ============================ */

function buildReportRadHTML(reg, ctx, showPrintBar, tanpaBacaan, opts) {
  opts = opts || {};
  const settings = ctx.settings;
  const dokter = (ctx.dokterList || []).find(d => d.id === reg.dokterId);
  const dokterSp = (ctx.dokterSpList || []).find(d => d.id === reg.dokterSpId);

  let tablesHTML = '';
  (reg.jenisSnapshot || []).forEach(j => {
    const rec = (reg.hasil || {})[j.id] || {};
    const bacaanRow = tanpaBacaan ? '' : `<tr><td style="width:22%;font-weight:600;">Hasil Bacaan</td><td style="white-space:pre-wrap;">${escapeHTML(rec.hasilBacaan) || '-'}</td></tr>`;
    tablesHTML += `<table class="hasil"><thead>
      <tr class="kategori-row"><td colspan="2">${escapeHTML(j.nama)}</td></tr>
      </thead><tbody>
      ${bacaanRow}
      <tr><td style="font-weight:600;">Kesan</td><td class="hasil-val" style="white-space:pre-wrap;">${escapeHTML(rec.kesan) || '-'}</td></tr>
      </tbody></table>`;
  });

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Hasil Radiologi - ${escapeHTML(reg.nama)}</title>
  ${printBaseStyles(opts.pageSize, opts.margin)}
  </head><body>
  <div class="sheet">
    ${opts.tanpaLogo ? '' : buildKopHTML(settings)}
    <div class="judul">HASIL PEMERIKSAAN RADIOLOGI</div>
    <div class="info-grid">
      <div class="lbl">No. Registrasi</div><div>:</div><div>${escapeHTML(reg.noReg)}</div>
      <div class="lbl">Tanggal</div><div>:</div><div>${formatTanggal(reg.tanggal)}</div>
      <div class="lbl">Nama Pasien</div><div>:</div><div>${escapeHTML(reg.nama)}</div>
      <div class="lbl">No. RM</div><div>:</div><div>${escapeHTML(reg.noRM)}</div>
      <div class="lbl">Jenis Kelamin</div><div>:</div><div>${reg.jk === 'P' ? 'Perempuan' : 'Laki-laki'}</div>
      <div class="lbl">Umur</div><div>:</div><div>${escapeHTML(reg.umur)}</div>
      <div class="lbl">Alamat</div><div>:</div><div>${escapeHTML(reg.alamat)}</div>
      <div class="lbl">Dokter Pengirim</div><div>:</div><div>${escapeHTML(dokter ? dokter.nama : '-')}</div>
    </div>
    <div style="font-size:13px; margin: -6px 0 14px;"><strong>Klinis</strong> : ${escapeHTML(reg.catatan) || '-'}</div>
    ${tablesHTML}
    ${opts.tanpaTtd ? '' : `<div class="footer-sign">
      <div class="sign-box">
        <div>Dokter Spesialis Radiologi,</div>
        ${dokterSp && dokterSp.ttd
          ? `<img src="${dokterSp.ttd}" alt="Tanda tangan" style="height:60px; object-fit:contain;">`
          : '<div class="sign-space"></div>'}
        <div><strong>${escapeHTML(dokterSp ? dokterSp.nama : '-')}</strong></div>
      </div>
    </div>`}
    ${showPrintBar ? `<div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>` : ''}
  </div>
  </body></html>`;
}

function printReportRad(reg, ctx, tanpaBacaan, opts) {
  const html = buildReportRadHTML(reg, ctx, false, tanpaBacaan, opts);
  openPrintWindow(html, true);
}

function previewReportRad(reg, ctx, tanpaBacaan, opts) {
  const html = buildReportRadHTML(reg, ctx, true, tanpaBacaan, opts);
  openPrintWindow(html, false);
}

const LABEL_KOLOM = 1;
const LABEL_BARIS = 1;
const LABEL_LEBAR_MM = 80; // 8 cm
const LABEL_TINGGI_MM = 60; // 6 cm
const LABEL_PER_HALAMAN = LABEL_KOLOM * LABEL_BARIS;

function buildLabelHTML(reg, ctx, jumlah) {
  const settings = ctx.settings;
  const dokter = (ctx.dokterList || []).find(d => d.id === reg.dokterId);

  const satuLabel = `
    <div class="label">
      <div class="label-head">
        <img src="${settings.logo}" alt="logo">
        <div class="label-head-teks">
          <div class="label-klinik">${escapeHTML(settings.namaKlinik)}</div>
          <div class="label-alamat clamp2">${escapeHTML(settings.alamat)}</div>
        </div>
      </div>
      <div class="label-garis"></div>
      <table class="label-info">
        <tr><td>No. Reg</td><td>${escapeHTML(reg.noReg)}</td></tr>
        <tr><td>Nama</td><td><strong>${escapeHTML(reg.nama)}</strong></td></tr>
        <tr><td>Umur</td><td>${reg.jk === 'P' ? 'Perempuan' : 'Laki-laki'} / ${escapeHTML(reg.umur)}</td></tr>
        <tr><td>Alamat</td><td class="clamp2">${escapeHTML(reg.alamat)}</td></tr>
        <tr><td>Tanggal</td><td>${formatTanggal(reg.tanggal)}</td></tr>
        <tr><td>Pengirim</td><td>${escapeHTML(dokter ? dokter.nama : '-')}</td></tr>
      </table>
    </div>`;

  let halaman = '';
  let sisa = jumlah;
  while (sisa > 0) {
    const isiHalaman = Math.min(sisa, LABEL_PER_HALAMAN);
    let cells = '';
    for (let i = 0; i < isiHalaman; i++) cells += satuLabel;
    halaman += `<div class="page">${cells}</div>`;
    sisa -= isiHalaman;
  }

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Label - ${escapeHTML(reg.nama)}</title>
  <style>
    @page { size: A4; margin: 4mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .page {
      display: grid;
      grid-template-columns: repeat(${LABEL_KOLOM}, ${LABEL_LEBAR_MM}mm);
      grid-template-rows: repeat(${LABEL_BARIS}, ${LABEL_TINGGI_MM}mm);
      gap: 2mm;
      justify-content: center;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .label {
      width: ${LABEL_LEBAR_MM}mm;
      height: ${LABEL_TINGGI_MM}mm;
      border: 1px solid #0f6e5f;
      padding: 3.5mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .label-head { display: flex; align-items: center; gap: 2.2mm; }
    .label-head img { width: 10mm; height: 10mm; object-fit: contain; flex-shrink: 0; }
    .label-head-teks { min-width: 0; }
    .label-klinik { font-size: 9px; color:#0f6e5f; font-weight:700; text-transform:uppercase; letter-spacing: .2px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .label-alamat { font-size: 7px; color:#444; line-height:1.25; }
    .label-garis { border-top: 1px solid #0f6e5f; margin: 1.6mm 0; }
    .label-info { width:100%; border-collapse: collapse; font-size: 8px; }
    .label-info td { padding: 0.9mm 0; vertical-align: top; line-height: 1.2; }
    .label-info td:first-child { width: 16mm; color:#666; white-space: nowrap; }
    .label-info td:last-child { font-size: 8.5px; }
    .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cetak-bar { text-align:center; margin: 16px 0; }
    .cetak-bar button { padding: 8px 22px; font-size:14px; background:#0f6e5f; color:#fff; border:none; border-radius:6px; cursor:pointer; }
    @media print { .cetak-bar { display:none; } }
  </style>
  </head><body>
  <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Label</button></div>
  ${halaman}
  </body></html>`;
}

function printLabel(reg, ctx, jumlah) {
  const html = buildLabelHTML(reg, ctx, jumlah);
  openPrintWindow(html, false);
}

/* ============================ LABEL RADIOLOGI (RONTGEN) ============================ */
/* Beda dengan label Lab: lembar labelnya berukuran 21 x 15 cm, terbagi jadi
   3 kolom x 4 baris (12 label per lembar), bukan satu label per lembar A4. */

const LABEL_RAD_KOLOM = 3;
const LABEL_RAD_BARIS = 4;
const LABEL_RAD_LEBAR_MM = 68;
const LABEL_RAD_TINGGI_MM = 36;
const LABEL_RAD_GAP_KOLOM_MM = 3;
const LABEL_RAD_GAP_BARIS_MM = 2;
const LABEL_RAD_PER_HALAMAN = LABEL_RAD_KOLOM * LABEL_RAD_BARIS;

function buildLabelRadHTML(reg, ctx, selectedPositions) {
  const settings = ctx.settings;
  const dokter = (ctx.dokterList || []).find(d => d.id === reg.dokterId);

  const satuLabel = `
    <div class="label-rad">
      <div class="label-rad-head">
        <img src="${settings.logo}" alt="logo">
        <div class="label-rad-head-teks">
          <div class="label-rad-klinik">${escapeHTML(settings.namaKlinik)}</div>
          <div class="label-rad-alamat clamp1">${escapeHTML(settings.alamat)}</div>
        </div>
      </div>
      <div class="label-rad-garis"></div>
      <table class="label-rad-info">
        <tr><td>No. Reg</td><td>${escapeHTML(reg.noReg)}</td></tr>
        <tr><td>Nama</td><td><strong>${escapeHTML(reg.nama)}</strong></td></tr>
        <tr><td>Umur</td><td>${reg.jk === 'P' ? 'P' : 'L'} / ${escapeHTML(reg.umur)}</td></tr>
        <tr><td>Tanggal</td><td>${formatTanggal(reg.tanggal)}</td></tr>
        <tr><td>Pengirim</td><td class="clamp1">${escapeHTML(dokter ? dokter.nama : '-')}</td></tr>
      </table>
    </div>`;
  const labelKosong = `<div class="label-rad label-rad-kosong"></div>`;

  const selected = new Set(selectedPositions);
  let cells = '';
  for (let i = 0; i < LABEL_RAD_PER_HALAMAN; i++) cells += selected.has(i) ? satuLabel : labelKosong;
  const halaman = `<div class="page-rad">${cells}</div>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Label Radiologi - ${escapeHTML(reg.nama)}</title>
  <style>
    @page { size: ${LABEL_RAD_KOLOM * LABEL_RAD_LEBAR_MM + (LABEL_RAD_KOLOM - 1) * LABEL_RAD_GAP_KOLOM_MM}mm ${LABEL_RAD_BARIS * LABEL_RAD_TINGGI_MM + (LABEL_RAD_BARIS - 1) * LABEL_RAD_GAP_BARIS_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; }
    .page-rad {
      display: grid;
      grid-template-columns: repeat(${LABEL_RAD_KOLOM}, ${LABEL_RAD_LEBAR_MM}mm);
      grid-template-rows: repeat(${LABEL_RAD_BARIS}, ${LABEL_RAD_TINGGI_MM}mm);
      gap: ${LABEL_RAD_GAP_BARIS_MM}mm ${LABEL_RAD_GAP_KOLOM_MM}mm;
      page-break-after: always;
    }
    .page-rad:last-child { page-break-after: auto; }
    .label-rad {
      width: ${LABEL_RAD_LEBAR_MM}mm;
      height: ${LABEL_RAD_TINGGI_MM}mm;
      border: 1px solid #0f6e5f;
      padding: 2mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .label-rad-head { display: flex; align-items: center; gap: 1.5mm; }
    .label-rad-head img { width: 6mm; height: 6mm; object-fit: contain; flex-shrink: 0; }
    .label-rad-head-teks { min-width: 0; }
    .label-rad-klinik { font-size: 7px; color:#0f6e5f; font-weight:700; text-transform:uppercase; letter-spacing: .2px; line-height:1.15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .label-rad-alamat { font-size: 5.5px; color:#444; line-height:1.2; }
    .label-rad-garis { border-top: 1px solid #0f6e5f; margin: 1mm 0; }
    .label-rad-info { width:100%; border-collapse: collapse; font-size: 6.5px; }
    .label-rad-info td { padding: 0.4mm 0; vertical-align: top; line-height: 1.15; }
    .label-rad-info td:first-child { width: 13mm; color:#666; white-space: nowrap; }
    .label-rad-info td:last-child { font-size: 7px; }
    .label-rad-kosong { border: none; }
    .clamp1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    .cetak-bar { text-align:center; margin: 16px 0; }
    .cetak-bar button { padding: 8px 22px; font-size:14px; background:#0f6e5f; color:#fff; border:none; border-radius:6px; cursor:pointer; }
    @media print { .cetak-bar { display:none; } }
  </style>
  </head><body>
  <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Label</button></div>
  ${halaman}
  </body></html>`;
}

function printLabelRad(reg, ctx, selectedPositions) {
  const html = buildLabelRadHTML(reg, ctx, selectedPositions);
  openPrintWindow(html, false);
}

/* ============================ SLIP GAJI KARYAWAN ============================ */

function buildSlipGajiHTML(gaji, karyawan, settings, adminNama) {
  const gajiPokok = Number(gaji.gajiPokok) || 0;
  const tunjangan = Number(gaji.tunjangan) || 0;
  const potongan = Number(gaji.potongan) || 0;
  const total = gajiPokok + tunjangan - potongan;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Slip Gaji - ${escapeHTML(karyawan ? karyawan.nama : '-')}</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">SLIP GAJI KARYAWAN</div>
    <div class="info-grid">
      <div class="lbl">Nama Karyawan</div><div>:</div><div>${escapeHTML(karyawan ? karyawan.nama : '-')}</div>
      <div class="lbl">No. HP</div><div>:</div><div>${escapeHTML(karyawan ? karyawan.hp : '-') || '-'}</div>
      <div class="lbl">Periode</div><div>:</div><div>${escapeHTML(formatPeriode(gaji.periode))}</div>
    </div>
    <table class="hasil">
      <thead><tr><th>Keterangan</th><th>Jumlah</th></tr></thead>
      <tbody>
        <tr><td>Gaji Pokok</td><td class="rp-value">${formatRupiah(gajiPokok)}</td></tr>
        <tr><td>Tunjangan</td><td class="rp-value">${formatRupiah(tunjangan)}</td></tr>
        <tr><td>Potongan</td><td class="rp-value">- ${formatRupiah(potongan)}</td></tr>
      </tbody>
      <tfoot><tr><td style="font-weight:700;">Total Diterima</td><td class="rp-value">${formatRupiah(total)}</td></tr></tfoot>
    </table>
    ${gaji.catatan ? `<div style="font-size:13px; margin: -6px 0 14px;"><strong>Catatan</strong> : ${escapeHTML(gaji.catatan)}</div>` : ''}
    <div class="footer-sign" style="justify-content: space-between;">
      <div class="sign-box">
        <div>Diterima oleh,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(karyawan ? karyawan.nama : '-')}</strong></div>
      </div>
      <div class="sign-box">
        <div>Diserahkan oleh,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(adminNama || settings.penanggungJawab)}</strong></div>
      </div>
    </div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Slip Gaji</button></div>
  </div>
  </body></html>`;
}

function printSlipGaji(gaji, karyawan, settings, adminNama) {
  const html = buildSlipGajiHTML(gaji, karyawan, settings, adminNama);
  openPrintWindow(html, true);
}

/* ============================ BHP RADIOLOGI (STOK) ============================ */

function buildBhpRadiologiHTML(list, settings) {
  const rowsHTML = list.map(b => {
    const menipis = (Number(b.stok) || 0) <= (Number(b.stokMin) || 0);
    return `<tr>
      <td>${escapeHTML(b.nama)}</td>
      <td>${escapeHTML(b.satuan || '-')}</td>
      <td class="rp-value">${formatRupiah(b.harga)}</td>
      <td${menipis ? ' style="color:#b30000; font-weight:700;"' : ''}>${b.stok}${menipis ? ' (Menipis)' : ''}</td>
      <td>${b.stokMin}</td>
      <td>${b.tglPenggantian ? formatTanggal(b.tglPenggantian) : '-'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Laporan Stok BHP Radiologi</title>
  ${printBaseStyles()}
  <style>.rp-value { color: #0b3d91; font-weight: 700; }</style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">LAPORAN STOK BHP (BAHAN HABIS PAKAI) RADIOLOGI</div>
    <table class="hasil">
      <thead><tr><th>Nama</th><th>Satuan</th><th>Harga</th><th>Stok</th><th>Stok Minimum</th><th>Tgl. Penggantian</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printBhpRadiologi(list, settings) {
  const html = buildBhpRadiologiHTML(list, settings);
  openPrintWindow(html, true);
}

/* ============================ KARYAWAN ============================ */

function buildKaryawanHTML(list, settings) {
  const totalGaji = list.reduce((s, k) => s + (Number(k.gaji) || 0), 0);
  const rowsHTML = list.map(k => `
    <tr>
      <td>${escapeHTML(k.nama)}</td>
      <td>${escapeHTML(k.hp || '-')}</td>
      <td>${escapeHTML(k.bank || '-')}</td>
      <td>${escapeHTML(k.rekening || '-')}</td>
      <td class="rp-value">${formatRupiah(k.gaji)}</td>
      <td>${k.aktif !== false ? 'Aktif' : 'Nonaktif'}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Data Karyawan</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">DATA KARYAWAN</div>
    <table class="hasil">
      <thead><tr><th>Nama</th><th>No. HP</th><th>Bank</th><th>No. Rekening</th><th>Jumlah Gaji</th><th>Status</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right; font-weight:700;">Total Jumlah Gaji</td><td class="rp-value">${formatRupiah(totalGaji)}</td><td></td></tr></tfoot>
    </table>
    <div class="footer-sign">
      <div class="sign-box">
        <div>Mengetahui,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(settings.penanggungJawab || '')}</strong></div>
      </div>
    </div>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printKaryawan(list, settings) {
  const html = buildKaryawanHTML(list, settings);
  openPrintWindow(html, true);
}

/* ============================ FARMASI: DATA KARYAWAN ============================ */

function buildKaryawanFarmasiHTML(list, settings) {
  const totalGaji = list.reduce((s, k) => s + (Number(k.gaji) || 0), 0);
  const rowsHTML = list.map(k => `
    <tr>
      <td>${escapeHTML(k.nama)}</td>
      <td>${escapeHTML(k.hp || '-')}</td>
      <td>${escapeHTML(k.bank || '-')}</td>
      <td>${escapeHTML(k.rekening || '-')}</td>
      <td class="rp-value">${formatRupiah(k.gaji)}</td>
      <td>${k.aktif !== false ? 'Aktif' : 'Nonaktif'}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Data Karyawan Farmasi</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">DATA KARYAWAN FARMASI</div>
    <table class="hasil">
      <thead><tr><th>Nama</th><th>No. HP</th><th>Bank</th><th>No. Rekening</th><th>Jumlah Gaji</th><th>Status</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right; font-weight:700;">Total Jumlah Gaji</td><td class="rp-value">${formatRupiah(totalGaji)}</td><td></td></tr></tfoot>
    </table>
    <div class="footer-sign">
      <div class="sign-box">
        <div>Mengetahui,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(settings.penanggungJawab || '')}</strong></div>
      </div>
    </div>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printKaryawanFarmasi(list, settings) {
  const html = buildKaryawanFarmasiHTML(list, settings);
  openPrintWindow(html, true);
}

/* ============================ FARMASI: STRUK PENDAFTARAN ============================ */

function buildStrukFarmasiHTML(reg, settings, adminNama) {
  const itemsHTML = (reg.items || []).map(it => `
    <tr>
      <td>${escapeHTML(it.nama)}</td>
      <td class="rp-value">${formatRupiah(it.harga)}</td>
      <td>${it.qty}</td>
      <td class="rp-value">${formatRupiah(it.subtotal)}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty-state">Tidak ada item.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Struk Farmasi - ${escapeHTML(reg.nama)}</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">STRUK FARMASI</div>
    <div class="info-grid">
      <div class="lbl">No. Registrasi</div><div>:</div><div>${escapeHTML(reg.noReg)}</div>
      <div class="lbl">Nama Pasien</div><div>:</div><div>${escapeHTML(reg.nama)}</div>
      <div class="lbl">No. WA</div><div>:</div><div>${escapeHTML(reg.wa || '-')}</div>
      <div class="lbl">Tanggal</div><div>:</div><div>${formatTanggal(reg.tanggal)}</div>
    </div>
    <table class="hasil">
      <thead><tr><th>Obat</th><th>Harga</th><th>Jumlah</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsHTML}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right; font-weight:700;">Total Harga</td><td class="rp-value">${formatRupiah(reg.totalHarga)}</td></tr></tfoot>
    </table>
    ${reg.catatan ? `<div style="font-size:13px; margin: -6px 0 14px;"><strong>Catatan</strong> : ${escapeHTML(reg.catatan)}</div>` : ''}
    <div class="footer-sign">
      <div class="sign-box">
        <div>Admin,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(adminNama || settings.penanggungJawab)}</strong></div>
      </div>
    </div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Struk</button></div>
  </div>
  </body></html>`;
}

function printStrukFarmasi(reg, settings, adminNama) {
  const html = buildStrukFarmasiHTML(reg, settings, adminNama);
  openPrintWindow(html, true);
}

function buildFarmasiListHTML(list, settings) {
  const totalSemua = list.reduce((s, r) => s + (Number(r.totalHarga) || 0), 0);
  const rowsHTML = list.map(r => `
    <tr>
      <td>${escapeHTML(r.noReg)}</td>
      <td>${formatTanggal(r.tanggal)}</td>
      <td>${escapeHTML(r.nama)}</td>
      <td>${escapeHTML(r.wa || '-')}</td>
      <td class="rp-value">${formatRupiah(r.totalHarga)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Data Pendaftaran Farmasi</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">DATA PENDAFTARAN FARMASI</div>
    <table class="hasil">
      <thead><tr><th>No. Reg</th><th>Tanggal</th><th>Nama Pasien</th><th>No. WA</th><th>Total</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right; font-weight:700;">Total Keseluruhan</td><td class="rp-value">${formatRupiah(totalSemua)}</td></tr></tfoot>
    </table>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printFarmasiList(list, settings) {
  const html = buildFarmasiListHTML(list, settings);
  openPrintWindow(html, true);
}

/* ============================ KEUANGAN: DATA BESAR (GABUNGAN) ============================ */

function buildDataBesarHTML(rows, totalMasuk, totalKeluar, settings, periodeLabel) {
  const rowsHTML = rows.map(r => `
    <tr>
      <td>${r.tanggal ? formatTanggal(r.tanggal) : '-'}</td>
      <td>${escapeHTML(r.sumber)}</td>
      <td>${escapeHTML(r.keterangan)}</td>
      <td>${r.jenis === 'masuk' ? 'Masuk' : 'Keluar'}</td>
      <td class="rp-value">${r.jenis === 'keluar' ? '- ' : ''}${formatRupiah(r.nominal)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Data Besar - Keuangan</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">DATA BESAR — RINGKASAN KEUANGAN GABUNGAN</div>
    ${periodeLabel ? `<div style="text-align:left; font-size:12.5px; margin:-8px 0 14px;">${escapeHTML(periodeLabel)}</div>` : ''}
    <table class="hasil">
      <thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th>Jenis</th><th>Nominal</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot>
        <tr><td colspan="4" style="text-align:right; font-weight:700;">Total Pemasukan</td><td class="rp-value">${formatRupiah(totalMasuk)}</td></tr>
        <tr><td colspan="4" style="text-align:right; font-weight:700;">Total Pengeluaran</td><td class="rp-value">${formatRupiah(totalKeluar)}</td></tr>
        <tr><td colspan="4" style="text-align:right; font-weight:700;">Saldo</td><td class="rp-value">${formatRupiah(totalMasuk - totalKeluar)}</td></tr>
      </tfoot>
    </table>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printDataBesar(rows, totalMasuk, totalKeluar, settings, periodeLabel) {
  const html = buildDataBesarHTML(rows, totalMasuk, totalKeluar, settings, periodeLabel);
  openPrintWindow(html, true);
}

/* ============================ PIMPINAN TTD ============================ */

function buildPimpinanTtdHTML(p, settings) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Data Pimpinan - ${escapeHTML(p.nama)}</title>
  ${printBaseStyles()}
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">DATA PIMPINAN (TANDA TANGAN)</div>
    <div class="info-grid">
      <div class="lbl">Nama</div><div>:</div><div>${escapeHTML(p.nama)}</div>
      <div class="lbl">No. HP</div><div>:</div><div>${escapeHTML(p.hp || '-')}</div>
    </div>
    <div class="footer-sign">
      <div class="sign-box">
        <div>Pimpinan,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(p.nama)}</strong></div>
      </div>
    </div>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printPimpinanTtd(p, settings) {
  const html = buildPimpinanTtdHTML(p, settings);
  openPrintWindow(html, true);
}

/* ============================ PENGELUARAN PERBULAN ============================ */

function buildPengeluaranBulananHTML(rows, totalGaji, settings, adminNama, periodeLabel) {
  const rowsHTML = rows.map(r => `
    <tr>
      <td>${escapeHTML(r.namaKaryawan)}</td>
      <td>${escapeHTML(formatPeriode(r.bulan))}</td>
      <td class="rp-value">${formatRupiah(r.jumlah)}</td>
    </tr>`).join('') || `<tr><td colspan="3" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Laporan Pengeluaran Perbulan</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">LAPORAN PENGELUARAN GAJI PERBULAN</div>
    ${periodeLabel ? `<div style="text-align:left; font-size:12.5px; margin:-8px 0 14px;">${escapeHTML(periodeLabel)}</div>` : ''}
    <table class="hasil">
      <thead><tr><th>Nama Karyawan</th><th>Bulan</th><th>Jumlah Gaji</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot><tr><td colspan="2" style="text-align:right; font-weight:700;">Total Gaji</td><td class="rp-value">${formatRupiah(totalGaji)}</td></tr></tfoot>
    </table>
    <div class="footer-sign">
      <div class="sign-box">
        <div>Mengetahui,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(adminNama || settings.penanggungJawab)}</strong></div>
      </div>
    </div>
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printPengeluaranBulanan(rows, totalGaji, settings, adminNama, periodeLabel) {
  const html = buildPengeluaranBulananHTML(rows, totalGaji, settings, adminNama, periodeLabel);
  openPrintWindow(html, true);
}

/* ============================ DATA SEKUNDER: KWITANSI ============================ */

function buildKwitansiRadHTML(reg, ctx) {
  const settings = ctx.settings;
  const total = Number(reg.totalHarga) || 0;
  const pemeriksaanNames = (reg.jenisSnapshot || []).map(j => j.nama).join(', ');
  const noKwitansi = 'KW-' + reg.noReg;
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Kwitansi - ${escapeHTML(reg.nama)}</title>
  ${printBaseStyles()}
  <style>
    .kwitansi-box { border: 2px solid #0f6e5f; padding: 20px 24px; margin-top: 10px; }
    .kwitansi-row { display:flex; margin-bottom:10px; font-size:13.5px; }
    .kwitansi-row .lbl { width:160px; font-weight:600; }
    .kwitansi-terbilang { border-top:1px dashed #999; border-bottom:1px dashed #999; padding:10px 0; margin:14px 0; font-style:italic; text-transform:capitalize; }
    .kwitansi-total { text-align:right; font-size:18px; font-weight:700; color:#0f6e5f; margin:10px 0; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">KWITANSI</div>
    <div class="kwitansi-box">
      <div class="kwitansi-row"><div class="lbl">No. Kwitansi</div><div>: ${escapeHTML(noKwitansi)}</div></div>
      <div class="kwitansi-row"><div class="lbl">Tanggal</div><div>: ${formatTanggal(reg.tanggal)}</div></div>
      <div class="kwitansi-row"><div class="lbl">Telah terima dari</div><div>: ${escapeHTML(reg.nama)}</div></div>
      <div class="kwitansi-row"><div class="lbl">Untuk pembayaran</div><div>: ${escapeHTML(pemeriksaanNames)}</div></div>
      <div class="kwitansi-total">${formatRupiah(total)}</div>
      <div class="kwitansi-terbilang">Terbilang: ${terbilang(total)} rupiah</div>
      <div class="footer-sign">
        <div class="sign-box">
          <div>Admin,</div>
          <div class="sign-space"></div>
          <div><strong>${escapeHTML(ctx.adminNama || settings.penanggungJawab)}</strong></div>
        </div>
      </div>
    </div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Kwitansi</button></div>
  </div>
  </body></html>`;
}

function printKwitansiRad(reg, ctx) {
  const html = buildKwitansiRadHTML(reg, ctx);
  openPrintWindow(html, true);
}

function buildKwitansiLabHTML(reg, ctx) {
  const settings = ctx.settings;
  const total = Number(reg.totalHarga) || 0;
  const pemeriksaanNames = (reg.paketSnapshot || []).map(p => p.nama).join(', ');
  const noKwitansi = 'KW-' + reg.noReg;
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Kwitansi - ${escapeHTML(reg.nama)}</title>
  ${printBaseStyles()}
  <style>
    .kwitansi-box { border: 2px solid #0f6e5f; padding: 20px 24px; margin-top: 10px; }
    .kwitansi-row { display:flex; margin-bottom:10px; font-size:13.5px; }
    .kwitansi-row .lbl { width:160px; font-weight:600; }
    .kwitansi-terbilang { border-top:1px dashed #999; border-bottom:1px dashed #999; padding:10px 0; margin:14px 0; font-style:italic; text-transform:capitalize; }
    .kwitansi-total { text-align:right; font-size:18px; font-weight:700; color:#0f6e5f; margin:10px 0; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">KWITANSI</div>
    <div class="kwitansi-box">
      <div class="kwitansi-row"><div class="lbl">No. Kwitansi</div><div>: ${escapeHTML(noKwitansi)}</div></div>
      <div class="kwitansi-row"><div class="lbl">Tanggal</div><div>: ${formatTanggal(reg.tanggal)}</div></div>
      <div class="kwitansi-row"><div class="lbl">Telah terima dari</div><div>: ${escapeHTML(reg.nama)}</div></div>
      <div class="kwitansi-row"><div class="lbl">Untuk pembayaran</div><div>: ${escapeHTML(pemeriksaanNames)}</div></div>
      <div class="kwitansi-total">${formatRupiah(total)}</div>
      <div class="kwitansi-terbilang">Terbilang: ${terbilang(total)} rupiah</div>
      <div class="footer-sign">
        <div class="sign-box">
          <div>Admin,</div>
          <div class="sign-space"></div>
          <div><strong>${escapeHTML(ctx.adminNama || settings.penanggungJawab)}</strong></div>
        </div>
      </div>
    </div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Kwitansi</button></div>
  </div>
  </body></html>`;
}

function printKwitansiLab(reg, ctx) {
  const html = buildKwitansiLabHTML(reg, ctx);
  openPrintWindow(html, true);
}

/* ============================ DATA SEKUNDER: LAPORAN GENERIK ============================ */
/* Mencetak ulang isi kontainer laporan (Pajak / Mingguan / Bulanan / Tahunan / Sharing Dokter)
   yang sudah dirender di layar, dibungkus kop surat & judul. */
function printLaporanContainer(containerSelector, judul, periodeLabel) {
  const el = document.querySelector(containerSelector);
  if (!el) return;
  const settings = DB.getSettings();
  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>${escapeHTML(judul)}</title>
  ${printBaseStyles()}
  <style>
    .datasek-summary { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
    .datasek-stat { border:1px solid #999; border-radius:6px; padding:10px 14px; min-width:140px; }
    .datasek-stat .stat-label { font-size:11px; color:#555; margin-bottom:3px; }
    .datasek-stat .stat-value { font-size:16px; font-weight:700; color:#0f6e5f; }
    table.tbl { width:100%; border-collapse:collapse; margin-bottom:14px; font-size:12.5px; }
    table.tbl th, table.tbl td { border:1px solid #999; padding:5px 8px; text-align:left; }
    table.tbl th { background:#eef6f4; }
    h4 { margin: 14px 0 6px; }
    .form-actions { display:none; }
    input, select { border:none; background:transparent; font-size:12.5px; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">${escapeHTML(judul).toUpperCase()}</div>
    ${periodeLabel ? `<div style="text-align:center; font-size:12.5px; margin:-8px 0 14px;">${escapeHTML(periodeLabel)}</div>` : ''}
    ${el.innerHTML}
    <div style="margin-top:14px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')} — ${escapeHTML(settings.penanggungJawab)}</div>
  </div>
  </body></html>`;
  openPrintWindow(html, true);
}

/* ============================ LAPORAN SHARING DOKTER PENGIRIM ============================ */
/* Satu lembar per dokter pengirim: daftar pasien yang dirujuk beserta nominal
   sharing masing-masing, ditandatangani Admin. Dipakai oleh Sharing Dokter
   Laboratorium, Radiologi, maupun Keuangan (gabungan) — formatnya sama. */
function buildLaporanSharingDokterHTML(dokterNama, rows, totalSharing, periodeLabel, adminNama) {
  const settings = DB.getSettings();
  const rowsHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHTML(r.nama)}</td>
      <td>${escapeHTML(r.umur)}</td>
      <td>${escapeHTML(r.alamat)}</td>
      <td>${escapeHTML(r.pemeriksaan)}</td>
      <td class="rp-value">${formatRupiah(r.jumlahSharing)}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty-state">Tidak ada data.</td></tr>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Laporan Sharing Dokter Pengirim - ${escapeHTML(dokterNama)}</title>
  ${printBaseStyles()}
  <style>
    table.hasil tfoot td { border: 1px solid #999; padding: 5px 8px; }
    .rp-value { color: #0b3d91; font-weight: 700; }
  </style>
  </head><body>
  <div class="sheet">
    ${buildKopHTML(settings)}
    <div class="judul">LAPORAN SHARING DOKTER PENGIRIM</div>
    ${periodeLabel ? `<div style="text-align:center; font-size:12.5px; margin:-8px 0 14px;">${escapeHTML(periodeLabel)}</div>` : ''}
    <div style="font-size:14px; margin-bottom:14px;"><strong>Dokter Pengirim :</strong> ${escapeHTML(dokterNama)}</div>
    <table class="hasil">
      <thead><tr><th>No</th><th>Nama</th><th>Umur</th><th>Alamat</th><th>Pemeriksaan</th><th>Jumlah Sharing</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right; font-weight:700;">Total Sharing</td><td class="rp-value">${formatRupiah(totalSharing)}</td></tr></tfoot>
    </table>
    <div class="footer-sign">
      <div class="sign-box">
        <div>Admin,</div>
        <div class="sign-space"></div>
        <div><strong>${escapeHTML(adminNama || settings.penanggungJawab)}</strong></div>
      </div>
    </div>
    <div class="cetak-bar"><button onclick="window.print()">🖨️ Cetak Sekarang</button></div>
  </div>
  </body></html>`;
}

function printLaporanSharingDokter(dokterNama, rows, totalSharing, periodeLabel, adminNama) {
  const html = buildLaporanSharingDokterHTML(dokterNama, rows, totalSharing, periodeLabel, adminNama);
  openPrintWindow(html, true);
}
