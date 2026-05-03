const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Hardcoded Master Key for session stability
const SECRET_KEY = "UTS-JARINGAN-EKSPRESIN-AJA";
console.log(`Using Stable System Key: ${SECRET_KEY}`);

const db = new sqlite3.Database('./ekspedisi.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_number TEXT UNIQUE,
        sender_name TEXT,
        receiver_name TEXT,
        receiver_phone TEXT,
        address_encrypted TEXT,
        nonce TEXT,
        item_description TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

/**
 * ChaCha20 Full Implementation with Counter support
 */
function chacha20Block(key, nonce, counter) {
    const state = new Uint32Array(16);
    const k = new Uint32Array(Buffer.from(key.padEnd(32, '0')).buffer);
    const n = new Uint32Array(Buffer.from(nonce, 'base64').buffer);

    state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
    for (let i = 0; i < 8; i++) state[i + 4] = k[i];
    state[12] = counter;
    state[13] = n[0]; state[14] = n[1]; state[15] = n[2];

    const workingState = new Uint32Array(state);
    const rotate = (v, c) => (v << c) | (v >>> (32 - c));
    const quarterRound = (a, b, c, d) => {
        workingState[a] += workingState[b]; workingState[d] ^= workingState[a]; workingState[d] = rotate(workingState[d], 16);
        workingState[c] += workingState[d]; workingState[b] ^= workingState[c]; workingState[b] = rotate(workingState[b], 12);
        workingState[a] += workingState[b]; workingState[d] ^= workingState[a]; workingState[d] = rotate(workingState[d], 8);
        workingState[c] += workingState[d]; workingState[b] ^= workingState[c]; workingState[b] = rotate(workingState[b], 7);
    };

    for (let i = 0; i < 10; i++) {
        quarterRound(0, 4, 8, 12); quarterRound(1, 5, 9, 13); quarterRound(2, 6, 10, 14); quarterRound(3, 7, 11, 15);
        quarterRound(0, 5, 10, 15); quarterRound(1, 6, 11, 12); quarterRound(2, 7, 8, 13); quarterRound(3, 4, 9, 14);
    }

    for (let i = 0; i < 16; i++) state[i] += workingState[i];
    return Buffer.from(state.buffer);
}

function processChaCha20(key, nonce, data) {
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const output = Buffer.alloc(input.length);
    for (let i = 0; i < input.length; i++) {
        if (i % 64 === 0) {
            const block = chacha20Block(key, nonce, Math.floor(i / 64) + 1);
            keyStream = block;
        }
        output[i] = input[i] ^ keyStream[i % 64];
    }
    return output;
}

// API
// PUBLIC TRACKING API
app.get('/api/track/:number', (req, res) => {
    const { number } = req.params;
    db.get("SELECT tracking_number, receiver_name, receiver_phone, address_encrypted, status, created_at FROM shipments WHERE tracking_number = ?", [number], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Resi tidak ditemukan' });
        res.json(row);
    });
});

app.get('/api/key', (req, res) => res.json({ key: SECRET_KEY }));

app.get('/api/shipments', (req, res) => {
    db.all("SELECT * FROM shipments ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/shipments', (req, res) => {
    const { sender, receiver, phone, address, description } = req.body;
    const tracking_number = 'EJA-' + Math.random().toString(36).substr(2, 7).toUpperCase();
    const nonce = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) nonce[i] = Math.floor(Math.random() * 256);
    
    const encAddr = processChaCha20(SECRET_KEY, nonce.toString('base64'), address);
    const encPhone = processChaCha20(SECRET_KEY, nonce.toString('base64'), phone);
    
    db.run(`INSERT INTO shipments (tracking_number, sender_name, receiver_name, receiver_phone, address_encrypted, nonce, item_description, status) VALUES (?,?,?,?,?,?,?,?)`,
        [tracking_number, sender, receiver, encPhone.toString('base64'), encAddr.toString('base64'), nonce.toString('base64'), description, 'Pending'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, tracking_number });
        }
    );
});

app.put('/api/shipments/:id/status', (req, res) => {
    const shipmentId = parseInt(req.params.id);
    const { status } = req.body;
    db.run(`UPDATE shipments SET status = ? WHERE id = ?`, [status, shipmentId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Success' });
    });
});

app.post('/api/decrypt', (req, res) => {
    const { encryptedData, nonceBase64 } = req.body;
    const encrypted = Buffer.from(encryptedData, 'base64');
    const decrypted = processChaCha20(SECRET_KEY, nonceBase64, encrypted);
    res.json({ decrypted: decrypted.toString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
