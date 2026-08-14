/* ==========================================================================
   server.js — server Express + SQLite (node:sqlite bawaan Node.js) yang
   menggantikan localStorage sebagai penyimpanan data aplikasi.

   Desainnya sengaja dibuat sederhana: satu tabel key-value (satu baris per
   "kunci" data, mis. lab_registrasi, rad_registrasi, dst — persis seperti
   kunci localStorage sebelumnya), nilainya disimpan sebagai JSON. Ini
   membuat migrasi dari localStorage ke SQLite tidak mengubah bentuk data
   sama sekali, hanya tempat penyimpanannya.
   ========================================================================== */

const express = require('express');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 8791;
const DB_FILE = path.join(__dirname, 'data.sqlite');

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
app.use(express.json({ limit: '10mb' }));

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

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Database SQLite: ${DB_FILE}`);
});
