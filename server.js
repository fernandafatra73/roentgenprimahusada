/* ==========================================================================
   server.js — server Express + SQLite (node:sqlite bawaan Node.js) yang
   menggantikan localStorage sebagai penyimpanan data aplikasi.

   Desainnya sengaja dibuat sederhana: satu tabel key-value (satu baris per
   "kunci" data, mis. lab_registrasi, rad_registrasi, dst — persis seperti
   kunci localStorage sebelumnya), nilainya disimpan sebagai JSON. Ini
   membuat migrasi dari localStorage ke SQLite tidak mengubah bentuk data
   sama sekali, hanya tempat penyimpanannya.
   ========================================================================== */

try { process.loadEnvFile(); } catch (e) { /* .env opsional — abaikan kalau tidak ada */ }

const express = require('express');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 8791;
const DB_FILE = path.join(__dirname, 'data.sqlite');
const MEDIA_DIR = path.join(__dirname, 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);

const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const stmtGetAll = db.prepare('SELECT key, value FROM kv_store');
const stmtUpsert = db.prepare(`
  INSERT INTO kv_store (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const stmtDelete = db.prepare('DELETE FROM kv_store WHERE key = ?');

const app = express();
app.use(express.json({ limit: '20mb' }));

// Ambil semua data sekaligus — dipakai saat aplikasi pertama kali dimuat
// supaya tidak perlu satu request per kunci data.
app.get('/api/kv', (req, res) => {
  const rows = stmtGetAll.all();
  const out = {};
  for (const row of rows) {
    try { out[row.key] = JSON.parse(row.value); } catch (e) { out[row.key] = null; }
  }
  res.json(out);
});

// Simpan/perbarui satu kunci data.
app.put('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  if (!('value' in req.body)) {
    res.status(400).json({ error: 'Body harus berisi field "value".' });
    return;
  }
  stmtUpsert.run(key, JSON.stringify(req.body.value));
  res.json({ ok: true });
});

app.delete('/api/kv/:key', (req, res) => {
  stmtDelete.run(req.params.key);
  res.json({ ok: true });
});

/* ==========================================================================
   AI Radiolog — draf Hasil Bacaan & Kesan dari foto pemeriksaan radiologi,
   dibuat AI (Claude) sebagai BANTUAN AWAL, bukan diagnosis final. Butuh
   ANTHROPIC_API_KEY di file .env (lihat .env.example).
   ========================================================================== */

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const AI_RADIOLOG_SYSTEM_PROMPT = `Anda adalah asisten AI yang membantu radiolog membuat DRAF AWAL hasil bacaan dan kesan dari foto pemeriksaan radiologi (rontgen/USG/CT).

PENTING: Ini BUKAN diagnosis final. Radiolog manusia WAJIB meninjau, mengoreksi, dan memvalidasi draf ini sebelum digunakan untuk pasien sungguhan. Jangan pernah menyatakan kepastian diagnosis — gunakan bahasa hati-hati seperti "tampak", "curiga", "perlu korelasi klinis lebih lanjut", dan sebutkan keterbatasan bila gambar kurang jelas.

Balas HANYA dengan format berikut, tanpa kalimat pembuka/penutup lain:
HASIL BACAAN:
<deskripsi temuan pada gambar>
KESAN:
<ringkasan kesan, tetap dengan bahasa hati-hati>`;

app.post('/api/ai-radiolog', async (req, res) => {
  if (!anthropicClient) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY belum diatur di file .env server. Salin .env.example menjadi .env lalu isi API key, kemudian restart server.' });
    return;
  }
  const { imageBase64, mediaType, catatan } = req.body || {};
  if (!imageBase64 || !mediaType) {
    res.status(400).json({ error: 'Body harus berisi imageBase64 dan mediaType.' });
    return;
  }

  try {
    const userText = catatan
      ? `Konteks/indikasi klinis: ${catatan}\n\nBuatkan draf Hasil Bacaan dan Kesan dari foto pemeriksaan radiologi ini.`
      : 'Buatkan draf Hasil Bacaan dan Kesan dari foto pemeriksaan radiologi ini.';

    const message = await anthropicClient.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8192,
      output_config: { effort: 'high' },
      system: AI_RADIOLOG_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: userText }
        ]
      }]
    });

    if (message.stop_reason === 'refusal') {
      res.status(422).json({ error: 'AI menolak memproses gambar ini. Coba gambar lain atau tulis manual.' });
      return;
    }

    const textBlock = message.content.find(b => b.type === 'text');
    const text = textBlock ? textBlock.text : '';
    const bacaanMatch = text.match(/HASIL BACAAN:\s*([\s\S]*?)\s*KESAN:/i);
    const kesanMatch = text.match(/KESAN:\s*([\s\S]*)$/i);

    res.json({
      hasilBacaan: bacaanMatch ? bacaanMatch[1].trim() : text.trim(),
      kesan: kesanMatch ? kesanMatch[1].trim() : '',
      raw: text
    });
  } catch (err) {
    console.error('AI Radiolog error:', err);
    res.status(500).json({ error: 'Gagal memanggil AI: ' + (err.message || 'kesalahan tidak diketahui') });
  }
});

/* ==========================================================================
   Musik Prima Husada — upload file MP3/MP4 ke folder lokal "media/"
   (bukan disimpan sebagai base64 di kv_store supaya /api/kv tetap ringan).
   ========================================================================== */

app.post('/api/musik-upload', express.json({ limit: '150mb' }), (req, res) => {
  const { filename, dataBase64 } = req.body || {};
  if (!filename || !dataBase64) {
    res.status(400).json({ error: 'Body harus berisi filename dan dataBase64.' });
    return;
  }
  const ext = path.extname(filename).toLowerCase();
  const EXT_DIDUKUNG = ['.mp3', '.mp4', '.mpeg', '.mpg'];
  if (!EXT_DIDUKUNG.includes(ext)) {
    res.status(400).json({ error: 'Hanya file .mp3, .mp4, .mpeg, atau .mpg yang didukung.' });
    return;
  }
  const safeName = `musik_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const base64Data = dataBase64.replace(/^data:[^;]+;base64,/, '');
  fs.writeFile(path.join(MEDIA_DIR, safeName), Buffer.from(base64Data, 'base64'), (err) => {
    if (err) {
      console.error('Gagal menyimpan file musik:', err);
      res.status(500).json({ error: 'Gagal menyimpan file di server.' });
      return;
    }
    res.json({ ok: true, filename: safeName, url: '/media/' + safeName });
  });
});

app.delete('/api/musik-upload/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  fs.unlink(path.join(MEDIA_DIR, filename), () => {
    res.json({ ok: true });
  });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Database SQLite: ${DB_FILE}`);
  console.log(anthropicClient ? 'AI Radiolog: ANTHROPIC_API_KEY terdeteksi.' : 'AI Radiolog: ANTHROPIC_API_KEY belum diatur (fitur nonaktif).');
});
