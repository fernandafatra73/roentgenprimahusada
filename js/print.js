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

function printBaseStyles() {
  return `
  <style>
    @page { size: A4; margin: 15mm; }
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
    table.hasil td.hasil-val { font-weight:700; }
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
      <div class="lbl">Analis</div><div>:</div><div>${escapeHTML(analis ? analis.nama : '-')}</div>
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
    <div style="margin-top:10px; font-size:11px; color:#666;">Dicetak pada ${new Date().toLocaleString('id-ID')} — ${escapeHTML(settings.penanggungJawab)}</div>
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

const LABEL_KOLOM = 3;
const LABEL_BARIS = 4;
const LABEL_LEBAR_MM = 15;
const LABEL_TINGGI_MM = 21;
const LABEL_PER_HALAMAN = LABEL_KOLOM * LABEL_BARIS;

function buildLabelHTML(reg, ctx, jumlah) {
  const settings = ctx.settings;
  const satuLabel = `
    <div class="label">
      <div class="label-klinik">${escapeHTML(settings.namaKlinik)}</div>
      <div class="label-nama">${escapeHTML(reg.nama)}</div>
      <div class="label-row"><span>${escapeHTML(reg.noRM)}</span><span>${reg.jk === 'P' ? 'P' : 'L'}/${escapeHTML(reg.umur)}</span></div>
      <div class="label-row"><span>${formatTanggal(reg.tanggal)}</span></div>
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
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .page {
      display: grid;
      grid-template-columns: repeat(${LABEL_KOLOM}, ${LABEL_LEBAR_MM}mm);
      grid-template-rows: repeat(${LABEL_BARIS}, ${LABEL_TINGGI_MM}mm);
      gap: 3mm;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .label {
      width: ${LABEL_LEBAR_MM}mm;
      height: ${LABEL_TINGGI_MM}mm;
      border: 1px dashed #888;
      border-radius: 2px;
      padding: 1.5mm;
      font-size: 7px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1px;
    }
    .label-klinik { font-size: 5.5px; color:#0f6e5f; font-weight:700; text-transform:uppercase; line-height:1.1; }
    .label-nama { font-size: 8px; font-weight:700; line-height:1.15; word-break: break-word; }
    .label-row { display:flex; justify-content:space-between; font-size:6.5px; }
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
