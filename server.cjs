const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Robust Master Key for Windows Compatibility
const SECRET_KEY = "EKSPRESIN_AJA_2026_MASTER_KEY";
console.log(`System Security Initialized.`);

const db = new sqlite3.Database('./ekspedisi.db', (err) => {
    if (err) console.error(err.message);
});

// Reset table for fresh testing with fixed encryption
db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS shipments`); 
    db.run(`DROP TABLE IF EXISTS users`); 
    db.run(`DROP TABLE IF EXISTS branches`); 
    db.run(`DROP TABLE IF EXISTS address_book`); 
    db.run(`DROP TABLE IF EXISTS audit_logs`); 

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        address TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS address_book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT,
        phone TEXT,
        province TEXT,
        city TEXT,
        district TEXT,
        street TEXT,
        rt TEXT,
        rw TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT UNIQUE,
        tracking_number TEXT UNIQUE,
        sender_name_enc TEXT,
        sender_phone_enc TEXT,
        sender_kec_enc TEXT,
        sender_addr_enc TEXT,
        receiver_name_enc TEXT,
        receiver_phone_enc TEXT,
        receiver_kec TEXT,
        receiver_addr_enc TEXT,
        item_name_enc TEXT,
        item_category_enc TEXT,
        item_desc_enc TEXT,
        item_notes TEXT,
        courier_notes TEXT,
        insurance_enc TEXT,
        item_value_enc TEXT,
        insurance_fee_enc TEXT,
        cod_amount_enc TEXT,
        nonce TEXT,
        service_type TEXT,
        weight REAL,
        status TEXT DEFAULT 'ORDER_CREATED',
        payment_method TEXT DEFAULT 'Cash',
        use_insurance INTEGER DEFAULT 0,
        quantity INTEGER DEFAULT 1,
        length REAL DEFAULT 0,
        width REAL DEFAULT 0,
        height REAL DEFAULT 0,
        customer_id INTEGER,
        role_type TEXT,
        delivery_type TEXT,
        branch_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES users(id)
    )`);

    // Seed default data
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')`);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('customer', 'customer', 'customer')`);

    db.run(`INSERT OR IGNORE INTO branches (name, address) VALUES ('Jakarta Pusat Hub', 'Jl. Menteng No. 12, Jakarta Pusat')`);
    db.run(`INSERT OR IGNORE INTO branches (name, address) VALUES ('Bandung City Hub', 'Jl. Lengkong No. 8, Bandung')`);
    db.run(`INSERT OR IGNORE INTO branches (name, address) VALUES ('Surabaya Utama Hub', 'Jl. Gubeng No. 5, Surabaya')`);
});

/**
 * High-Precision ChaCha20 Implementation
 */
function chacha20Block(key, nonce, counter) {
    const state = new Uint32Array(16);
    
    // Key (32 bytes)
    const k = Buffer.alloc(32, 0);
    Buffer.from(key).copy(k);
    
    // Nonce (12 bytes)
    const n = Buffer.from(nonce, 'base64');

    state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
    for (let i = 0; i < 8; i++) state[i + 4] = k.readUInt32LE(i * 4);
    state[12] = counter;
    state[13] = n.readUInt32LE(0);
    state[14] = n.readUInt32LE(4);
    state[15] = n.readUInt32LE(8);

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
    let keyStream;
    for (let i = 0; i < input.length; i++) {
        if (i % 64 === 0) {
            const block = chacha20Block(key, nonce, Math.floor(i / 64) + 1);
            keyStream = block;
        }
        output[i] = input[i] ^ keyStream[i % 64];
    }
    return output;
}

// HELPER: Root route to check server status
app.get('/', (req, res) => {
    res.send(`<h1>🚀 Server Ekspedisi Aktif</h1><p>API running on /api/shipments</p>`);
});

// API
// PUBLIC TRACKING API
// PUBLIC TRACKING API
app.get('/api/track/:number', (req, res) => {
    const { number } = req.params;
    db.get("SELECT * FROM shipments WHERE tracking_number = ? OR booking_number = ?", [number, number], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Resi/Booking tidak ditemukan' });
        res.json(row);
    });
});

app.get('/api/key', (req, res) => res.json({ key: SECRET_KEY }));

// AUTH ENDPOINTS
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Username atau password salah!' });
        res.json({ id: row.id, username: row.username, role: row.role });
    });
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'customer')", [username, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username sudah terdaftar!' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// BRANCH ENDPOINTS
app.get('/api/branches', (req, res) => {
    db.all("SELECT * FROM branches ORDER BY name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/branches', (req, res) => {
    const { name, address } = req.body;
    db.run("INSERT INTO branches (name, address) VALUES (?, ?)", [name, address], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, address });
    });
});

app.delete('/api/branches/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.run("DELETE FROM branches WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Success' });
    });
});

// ADDRESS BOOK ENDPOINTS
app.get('/api/address-book', (req, res) => {
    const { userId } = req.query;
    db.all("SELECT * FROM address_book WHERE user_id = ? ORDER BY name ASC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/address-book', (req, res) => {
    const { userId, name, phone, province, city, district, street, rt, rw } = req.body;
    db.run(
        "INSERT INTO address_book (user_id, name, phone, province, city, district, street, rt, rw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, name, phone, province, city, district, street, rt, rw],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/address-book/:id', (req, res) => {
    const addressId = parseInt(req.params.id);
    const { name, phone, province, city, district, street, rt, rw } = req.body;
    db.run(
        "UPDATE address_book SET name = ?, phone = ?, province = ?, city = ?, district = ?, street = ?, rt = ?, rw = ? WHERE id = ?",
        [name, phone, province, city, district, street, rt, rw, addressId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Success' });
        }
    );
});

app.delete('/api/address-book/:id', (req, res) => {
    const addressId = parseInt(req.params.id);
    db.run("DELETE FROM address_book WHERE id = ?", [addressId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Success' });
    });
});

// AUDIT LOG ENDPOINTS
app.get('/api/audit-logs', (req, res) => {
    db.all("SELECT * FROM audit_logs ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/audit-logs', (req, res) => {
    const { username, action } = req.body;
    db.run("INSERT INTO audit_logs (username, action) VALUES (?, ?)", [username, action], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// SHIPMENTS ENDPOINTS
app.get('/api/shipments', (req, res) => {
    const customerId = req.query.customer_id;
    console.log(`GET /api/shipments - Fetching data. Customer ID filter: ${customerId || 'none'}`);
    
    let query = "SELECT * FROM shipments";
    const params = [];
    if (customerId) {
        query += " WHERE customer_id = ?";
        params.push(customerId);
    }
    query += " ORDER BY created_at DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/shipments', (req, res) => {
    const { 
        senderName, senderPhone, senderKec, senderAddr,
        receiverName, receiverPhone, receiverKec, receiverAddr,
        itemName, itemCategory, itemDesc, insuranceValue, itemValue, service, weight,
        paymentMethod, codAmount, useInsurance,
        itemNotes, courierNotes, quantity, length, width, height,
        customerId, roleType, deliveryType, branchName
    } = req.body;
    
    const booking_number = 'BOOK-' + Math.random().toString(36).substr(2, 7).toUpperCase();
    const nonce = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) nonce[i] = Math.floor(Math.random() * 256);
    
    const nonceB64 = nonce.toString('base64');
    const enc = (data) => (data !== undefined && data !== null && data !== '') ? processChaCha20(SECRET_KEY, nonceB64, data.toString()).toString('base64') : '';

    // Insurance fee = 0.2% of item value (encrypted)
    const calcInsuranceFee = useInsurance && itemValue ? Math.ceil(parseFloat(itemValue) * 0.002) : 0;

    console.log(`POST /api/shipments - Saving new shipment...`);

    db.run(`INSERT INTO shipments (
        booking_number, tracking_number,
        sender_name_enc, sender_phone_enc, sender_kec_enc, sender_addr_enc,
        receiver_name_enc, receiver_phone_enc, receiver_kec, receiver_addr_enc,
        item_name_enc, item_category_enc, item_desc_enc, item_notes, courier_notes, 
        insurance_enc, item_value_enc, insurance_fee_enc, cod_amount_enc,
        nonce, service_type, weight, status, payment_method, use_insurance,
        quantity, length, width, height, customer_id, role_type, delivery_type, branch_name
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
            booking_number, null, 
            enc(senderName), enc(senderPhone), enc(senderKec), enc(senderAddr),
            enc(receiverName), enc(receiverPhone), receiverKec, enc(receiverAddr),
            enc(itemName), enc(itemCategory), enc(itemDesc), itemNotes, courierNotes,
            enc(itemValue), enc(itemValue), enc(calcInsuranceFee), enc(codAmount),
            nonceB64, service, weight, 'ORDER_CREATED',
            paymentMethod || 'Cash', useInsurance ? 1 : 0,
            quantity || 1, length || 0, width || 0, height || 0,
            customerId || null, roleType || 'sender', deliveryType || 'pickup', branchName || null
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, booking_number });
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

app.put('/api/shipments/:id/verify', (req, res) => {
    const shipmentId = parseInt(req.params.id);
    const { weight } = req.body;
    
    if (weight === undefined || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0) {
        return res.status(400).json({ error: 'Berat aktual tidak valid!' });
    }
    
    const tracking_number = 'JP' + Math.floor(1000000000 + Math.random() * 9000000000);
    
    db.run(
        `UPDATE shipments SET status = 'READY_TO_SHIP', weight = ?, tracking_number = ? WHERE id = ?`,
        [parseFloat(weight), tracking_number, shipmentId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Success', tracking_number });
        }
    );
});

app.post('/api/decrypt', (req, res) => {
    const { encryptedData, nonceBase64 } = req.body;
    if (!encryptedData || !nonceBase64) {
        return res.json({ decrypted: '' });
    }
    try {
        const encrypted = Buffer.from(encryptedData, 'base64');
        const decrypted = processChaCha20(SECRET_KEY, nonceBase64, encrypted);
        res.json({ decrypted: decrypted.toString() });
    } catch (err) {
        res.status(500).json({ error: 'Decryption failed' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`------------------------------------------`);
    console.log(`🚀 BACKEND RUNNING: http://127.0.0.1:${PORT}`);
    console.log(`------------------------------------------`);
});
