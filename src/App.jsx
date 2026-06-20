import React, { useState, useEffect } from 'react';
import REGIONS_DATA from './indonesia_regions.json';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [serverKey, setServerKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [decryptedData, setDecryptedData] = useState({});
  const [currentView, setCurrentView] = useState('dashboard');
  const [dbConnected, setDbConnected] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutData, setCheckoutData] = useState(null);
  
  const [securityLogs, setSecurityLogs] = useState([
    { id: 1, time: '10:00 AM', msg: 'System initialized with IP Master Key.', type: 'info' },
    { id: 2, time: '10:05 AM', msg: 'ChaCha20 ARX Rounds validated.', type: 'success' }
  ]);
  
  const [formData, setFormData] = useState({
    senderName: '', senderPhone: '', senderKec: '', senderAddr: '',
    receiverName: '', receiverPhone: '', receiverKec: '', receiverAddr: '',
    itemName: '', itemCategory: 'Pakaian', itemDesc: '', 
    service: 'Reguler', insuranceValue: 0, weight: 1, itemValue: 0,
    paymentMethod: 'Cash', codAmount: 0, useInsurance: false,
    
    // Alamat detail dipisah
    senderJalan: '', senderRT: '', senderRW: '',
    receiverJalan: '', receiverRT: '', receiverRW: '',
    
    // Daerah bertingkat
    senderProv: '', senderCity: '',
    receiverProv: '', receiverCity: '',
    
    // Detail fisik barang
    quantity: 1,
    length: '',
    width: '',
    height: '',
    
    // Dropdown instruksi utama
    itemNotes: 'Jangan dibanting (Fragile)',
    // Teks catatan kurir opsional
    courierNotes: ''
  });

  const API_URL = `http://${window.location.hostname}:5000/api`;

  useEffect(() => {
    if (isLoggedIn) {
      fetchShipments();
      fetchKey();
    }
  }, [isLoggedIn]);

  const fetchKey = async () => {
    try {
      const response = await fetch(`${API_URL}/key`);
      if (!response.ok) throw new Error('Failed to fetch key');
      const data = await response.json();
      setServerKey(data.key);
      setDbConnected(true);
      addLog('Master Key synchronized with server.', 'success');
    } catch (err) { 
      console.error(err);
      setDbConnected(false);
      addLog('Failed to sync Master Key. Check server!', 'warning');
    }
  }

  const fetchShipments = async () => {
    try {
      const response = await fetch(`${API_URL}/shipments`);
      const data = await response.json();
      setShipments(data);
    } catch (err) { console.error(err); }
  };

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSecurityLogs(prev => [{ id: Date.now(), time, msg, type }, ...prev].slice(0, 5));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.username === 'admin' && loginData.password === 'admin') {
      setIsLoggedIn(true);
      addLog('Admin authenticated via secure gateway.', 'success');
    } else {
      alert("Akses Ditolak!");
      addLog('Unauthorized login attempt.', 'warning');
    }
  };


  const updateStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/shipments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (response.ok && data.message === 'Success') {
        await fetchShipments();
        addLog(`Status: ${newStatus}`, 'success');
      }
    } catch (err) { console.error(err); }
  };

  const handleCycleStatus = (item) => {
    const currentStatus = item.status;
    let nextStatus;
    if (currentStatus === 'Pending') {
      const confirmPay = window.confirm(`Konfirmasi pelunasan pembayaran untuk resi ${item.tracking_number}?`);
      if (!confirmPay) return;
      nextStatus = 'Ready to Ship';
    } else if (currentStatus === 'Ready to Ship') {
      nextStatus = 'In Transit';
    } else if (currentStatus === 'In Transit') {
      nextStatus = 'Delivered';
    } else {
      nextStatus = 'Pending';
    }
    updateStatus(item.id, nextStatus);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const combinedSenderAddr = `${formData.senderJalan}, RT ${formData.senderRT}, RW ${formData.senderRW}`;
      const combinedReceiverAddr = `${formData.receiverJalan}, RT ${formData.receiverRT}, RW ${formData.receiverRW}`;
      
      const combinedSenderKec = `${formData.senderKec}, ${formData.senderCity}, ${formData.senderProv}`;
      const combinedReceiverKec = `${formData.receiverKec}, ${formData.receiverCity}, ${formData.receiverProv}`;

      const insuranceFee = formData.useInsurance ? Math.ceil(formData.itemValue * 0.002) : 0;
      const payload = {
        ...formData,
        senderAddr: combinedSenderAddr,
        receiverAddr: combinedReceiverAddr,
        senderKec: combinedSenderKec,
        receiverKec: combinedReceiverKec,
        insuranceValue: formData.useInsurance ? formData.itemValue : 0,
        insuranceFee: insuranceFee,
        itemValue: formData.useInsurance ? formData.itemValue : 0
      };
      
      const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        
        // Calculate costs for receipt modal
        const baseRate = 10000;
        const multiplier = formData.service === 'Ekspres' ? 1.5 : formData.service === 'Same Day' ? 2 : 1;
        const shippingCost = (formData.weight * baseRate * multiplier) + 5000;
        const calcInsuranceFee = formData.useInsurance ? Math.ceil(formData.itemValue * 0.002) : 0;
        const totalCost = shippingCost + calcInsuranceFee;

        setCheckoutData({
          id: result.id,
          trackingNumber: result.tracking_number,
          service: formData.service,
          weight: formData.weight,
          paymentMethod: formData.paymentMethod,
          codAmount: formData.codAmount,
          shippingCost: shippingCost,
          insuranceFee: calcInsuranceFee,
          insuranceValue: formData.useInsurance ? formData.itemValue : 0,
          totalCost: totalCost
        });

        // Reset form
        setFormData({ 
          senderName: '', senderPhone: '', senderKec: '', senderAddr: '',
          receiverName: '', receiverPhone: '', receiverKec: '', receiverAddr: '',
          itemName: '', itemCategory: 'Pakaian', itemDesc: '', 
          service: 'Reguler', insuranceValue: 0, weight: 1, itemValue: 0,
          paymentMethod: 'Cash', codAmount: 0, useInsurance: false,
          senderJalan: '', senderRT: '', senderRW: '',
          receiverJalan: '', receiverRT: '', receiverRW: '',
          senderProv: '', senderCity: '', senderKec: '',
          receiverProv: '', receiverCity: '', receiverKec: '',
          quantity: 1, length: '', width: '', height: '',
          itemNotes: 'Jangan dibanting (Fragile)', courierNotes: ''
        });
        
        fetchShipments();
        addLog(`New shipment secured and saved.`, 'success');
      } else {
        const errorData = await response.json();
        alert(`Gagal menyimpan: ${errorData.error || 'Server error'}`);
        addLog(`Failed to save shipment: ${errorData.error}`, 'warning');
      }
    } catch (err) { 
      console.error(err); 
      alert("Gagal menghubungi server. Pastikan server backend sudah jalan (node server.cjs)");
      addLog(`Connection error: ${err.message}`, 'warning');
    }
    finally { setLoading(false); }
  };

  const handleDecrypt = async (id, itemsToDecrypt, nonce) => {
    try {
      addLog(`Decrypting dataset ${id}...`, 'info');
      const decryptedResults = {};
      
      for (const [key, encryptedData] of Object.entries(itemsToDecrypt)) {
        const res = await fetch(`${API_URL}/decrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedData, nonceBase64: nonce })
        });
        const data = await res.json();
        decryptedResults[`${key}_${id}`] = data.decrypted;
      }

      setDecryptedData(prev => ({ ...prev, ...decryptedResults }));
      addLog(`ChaCha20 Decryption completed for ${id}.`, 'success');
    } catch (err) { console.error(err); }
  };

  const handleDecryptAll = async () => {
    if (shipments.length === 0) return;
    addLog('Master audit decryption started...', 'warning');
    for (const item of shipments) {
      await handleDecrypt(item.id, {
        sender: item.sender_name_enc,
        sender_phone: item.sender_phone_enc,
        sender_kec: item.sender_kec_enc,
        sender_addr: item.sender_addr_enc,
        receiver: item.receiver_name_enc,
        receiver_phone: item.receiver_phone_enc,
        receiver_addr: item.receiver_addr_enc,
        item_name: item.item_name_enc,
        item_cat: item.item_category_enc,
        item_desc: item.item_desc_enc,
        insurance: item.insurance_enc,
        item_value: item.item_value_enc,
        insurance_fee: item.insurance_fee_enc,
        cod_amount: item.cod_amount_enc
      }, item.nonce);
    }
  };

  const handleLock = (id) => {
    const newDecrypted = { ...decryptedData };
    // Bersihkan semua data terkait ID ini
    Object.keys(newDecrypted).forEach(key => {
      if (key.endsWith(`_${id}`)) {
        delete newDecrypted[key];
      }
    });
    setDecryptedData(newDecrypted);
    addLog(`Record ${id} re-locked for security.`, 'info');
  };

  const parseItemData = (item) => {
    const service = item.service_type || 'Reguler';
    const weight = item.weight || 1;
    const baseRate = 10000;
    const multiplier = service === 'Ekspres' ? 1.5 : service === 'Same Day' ? 2 : 1;
    // Hanya hitung ongkir — insurance_fee kini terenkripsi
    const shippingCost = (weight * baseRate * multiplier) + 5000;
    return { service, weight, type: 'Paket', shippingCost };
  };

  const formatRupiah = (val) => {
    const num = parseInt(val) || 0;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  const calculateTotalRevenue = () => {
    // Hanya hitung ongkir (insurance fee terenkripsi, tidak tersedia tanpa dekripsi)
    return shipments.reduce((total, item) => total + parseItemData(item).shippingCost, 0);
  };


  const printReceipt = async (item) => {
    let sender = decryptedData[`sender_${item.id}`];
    let senderPhone = decryptedData[`sender_phone_${item.id}`] || '';
    let senderKec = decryptedData[`sender_kec_${item.id}`] || '';
    let senderAddr = decryptedData[`sender_addr_${item.id}`] || '';
    let receiver = decryptedData[`receiver_${item.id}`];
    let addr = decryptedData[`receiver_addr_${item.id}`];
    let phone = decryptedData[`receiver_phone_${item.id}`];
    let kec = item.receiver_kec || '';
    
    if (!sender || !receiver || !addr) {
      addLog(`Akses Ditolak: Data masih terenkripsi.`, 'warning');
      return alert("Akses Ditolak! Mohon dekripsi data terlebih dahulu sebelum mencetak resi.");
    }
    
    if (item.status === 'Pending') {
      updateStatus(item.id, 'Ready to Ship');
    }
    
    const { service } = parseItemData(item);
    const win = window.open('', '_blank');
    // COD amount diambil dari data terenkripsi
    const codDecrypted = decryptedData[`cod_amount_${item.id}`];
    const paymentMethodText = item.payment_method === 'COD' 
      ? `COD${codDecrypted ? ` - Rp ${parseInt(codDecrypted).toLocaleString()}` : ' (ENCODED)'}`
      : `${(item.payment_method || 'Cash').toUpperCase()} - LUNAS`;

    win.document.write(`
      <html><head><style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; padding: 15px; color: #000; width: 400px; margin: 0 auto; }
        .label-container { border: 3px solid #000; border-radius: 4px; overflow: hidden; }
        .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding: 10px; background: #000; color: #fff; }
        .brand { font-size: 24px; font-weight: 900; }
        .service-badge { background: #fff; color: #000; padding: 5px 15px; font-weight: 900; font-size: 16px; border-radius: 2px; }
        .barcode-section { padding: 15px; text-align: center; border-bottom: 2px solid #000; background: #fff; }
        .barcode-visual { height: 60px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 6px); width: 80%; margin: 0 auto; }
        .tracking-text { font-size: 28px; font-weight: 900; letter-spacing: 4px; margin-top: 10px; }
        .receiver-main { padding: 15px; background: #fff; border-bottom: 2px solid #000; }
        .receiver-name { font-size: 24px; font-weight: 900; margin-bottom: 5px; }
        .address-box { padding: 12px; border-bottom: 2px solid #000; }
        .label-small { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; opacity: 0.7; }
        .address-val { font-size: 14px; font-weight: 700; line-height: 1.2; }
        .payment-box { display: flex; justify-content: space-between; padding: 10px 15px; background: #f8fafc; border-bottom: 2px solid #000; font-weight: 800; font-size: 14px; }
        .security-footer { font-size: 8px; text-align: center; padding: 5px; background: #f4f4f4; border-top: 1px solid #000; font-weight: 700; }
      </style></head>
      <body>
        <div class="label-container">
          <div class="receipt-header"><div class="brand">EKSPRESIN AJA</div><div class="service-badge">${service.toUpperCase()}</div></div>
          <div class="barcode-section"><div class="barcode-visual"></div><div class="tracking-text">${item.tracking_number}</div></div>
          <div class="payment-box">
            <span>METODE: ${paymentMethodText}</span>
            <span>BERAT: ${item.weight || 1} KG</span>
          </div>
          <div class="address-box">
            <div class="label-small">PENGIRIM (SENDER)</div>
            <div class="address-val" style="font-size:16px; font-weight:900;">${sender}</div>
          </div>
          <div class="receiver-main">
            <div class="label-small" style="color:red;">PENERIMA (RECEIVER)</div>
            <div class="receiver-name">${receiver}</div>
            <div class="address-val" style="font-size:16px; margin-bottom:8px;">${phone}</div>
            <div class="address-val">${kec}, ${addr}</div>
          </div>
          ${item.item_notes ? `
          <div class="address-box" style="background:#fff7ed; border-top: 1px dashed #000;">
            <div class="label-small" style="color:#c2410c;">INSTRUKSI PENANGANAN</div>
            <div class="address-val" style="font-size:14px; font-weight:900; text-transform:uppercase;">${item.item_notes}</div>
          </div>` : ''}
          ${item.courier_notes ? `
          <div class="address-box" style="background:#f0fdf4; border-top: 1px dashed #000;">
            <div class="label-small" style="color:#15803d;">CATATAN KURIR</div>
            <div class="address-val" style="font-size:13px; font-weight:700;">${item.courier_notes}</div>
          </div>` : ''}
          <div class="security-footer">SECURED BY CHACHA20 // DATA PROTECTED</div>
        </div>
      </body></html>
    `);
    win.document.close(); win.print();
  };

  const printFullReport = () => {
    const win = window.open('', '_blank');
    const totalRev = calculateTotalRevenue();
    win.document.write(`
      <html><head>
        <title>Laporan Manifest & Audit Ekspresin Aja</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
          body { font-family: 'Outfit', sans-serif; padding: 30px; color: #0f172a; }
          h1 { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 15px; font-weight: 900; }
          .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9rem; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.85rem; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; font-weight: 700; color: #0f172a; }
          .footer { margin-top: 35px; text-align: right; font-size: 1.2rem; font-weight: 900; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 15px; }
          .badge { font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; }
          .badge-pending { background: #ffe4e6; color: #b91c1c; }
          .badge-ready { background: #f3e8ff; color: #6b21a8; }
          .badge-transit { background: #dbeafe; color: #1e40af; }
          .badge-delivered { background: #dcfce7; color: #166534; }
          .locked { color: #94a3b8; font-style: italic; font-weight: normal; }
        </style>
      </head>
      <body>
        <h1>LAPORAN MANIFEST & AUDIT KEAMANAN</h1>
        <div class="meta-info">
          <div><strong>EKSPRESIN AJA</strong> - Gateway Aman Terintegrasi</div>
          <div>Tanggal Cetak: ${new Date().toLocaleString()}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Resi / Status</th>
              <th>Pengirim (Audit)</th>
              <th>Penerima (Audit)</th>
              <th>Detail Barang & Fisik</th>
              <th>Deskripsi & Catatan</th>
              <th>Biaya & Pembayaran</th>
            </tr>
          </thead>
          <tbody>
            ${shipments.map(s => {
              const { shippingCost } = parseItemData(s);
              const senderName = decryptedData[`sender_${s.id}`] || '<span class="locked">LOCKED</span>';
              const senderPhone = decryptedData[`sender_phone_${s.id}`] || '<span class="locked">LOCKED</span>';
              const senderAddr = decryptedData[`sender_addr_${s.id}`] && decryptedData[`sender_kec_${s.id}`]
                ? `${decryptedData[`sender_addr_${s.id}`]}, ${decryptedData[`sender_kec_${s.id}`]}`
                : '<span class="locked">LOCKED</span>';
              const receiverName = decryptedData[`receiver_${s.id}`] || '<span class="locked">LOCKED</span>';
              const receiverPhone = decryptedData[`receiver_phone_${s.id}`] || '<span class="locked">LOCKED</span>';
              const receiverAddr = decryptedData[`receiver_addr_${s.id}`]
                ? `${decryptedData[`receiver_addr_${s.id}`]}, ${s.receiver_kec}`
                : '<span class="locked">LOCKED</span>';
              const itemName = decryptedData[`item_name_${s.id}`] || '<span class="locked">LOCKED</span>';
              const itemCat = decryptedData[`item_cat_${s.id}`] || '<span class="locked">LOCKED</span>';
              const itemDesc = decryptedData[`item_desc_${s.id}`] || '<span class="locked">LOCKED</span>';
              const itemValueDec = decryptedData[`item_value_${s.id}`]
                ? `Rp ${parseInt(decryptedData[`item_value_${s.id}`]).toLocaleString()}`
                : '<span class="locked">LOCKED</span>';
              const codAmountDec = decryptedData[`cod_amount_${s.id}`]
                ? `Rp ${parseInt(decryptedData[`cod_amount_${s.id}`]).toLocaleString()}`
                : '<span class="locked">LOCKED</span>';
              const insFeeDec = decryptedData[`insurance_fee_${s.id}`]
                ? `Rp ${parseInt(decryptedData[`insurance_fee_${s.id}`]).toLocaleString()}`
                : '<span class="locked">LOCKED</span>';
              const decInsFeePrint = decryptedData[`insurance_fee_${s.id}`] ? parseInt(decryptedData[`insurance_fee_${s.id}`]) : null;
              const totalCostStr = decInsFeePrint !== null
                ? `Rp ${(shippingCost + decInsFeePrint).toLocaleString()}`
                : (s.use_insurance !== 1 ? `Rp ${shippingCost.toLocaleString()}` : '<span class="locked">LOCKED</span>');
              const statusClass = s.status.toLowerCase().replace(/ /g, '');
              let badgeStyle = 'badge-pending';
              if (statusClass === 'readytoship') badgeStyle = 'badge-ready';
              else if (statusClass === 'intransit') badgeStyle = 'badge-transit';
              else if (statusClass === 'delivered') badgeStyle = 'badge-delivered';
              const volWeight = s.length && s.width && s.height ? ((s.length * s.width * s.height) / 6000).toFixed(2) : '-';
              return `
                <tr>
                  <td>
                    <strong>${s.tracking_number}</strong><br/>
                    <div style="margin-top: 5px;" class="badge ${badgeStyle}">${s.status}</div>
                  </td>
                  <td>
                    <strong>Nama:</strong> ${senderName}<br/>
                    <strong>Telp:</strong> ${senderPhone}<br/>
                    <strong>Alamat:</strong> ${senderAddr}
                  </td>
                  <td>
                    <strong>Nama:</strong> ${receiverName}<br/>
                    <strong>Telp:</strong> ${receiverPhone}<br/>
                    <strong>Alamat:</strong> ${receiverAddr}
                  </td>
                  <td>
                    <strong>Barang:</strong> ${itemName} (${itemCat})<br/>
                    <strong>Qty:</strong> ${s.quantity || 1} pcs<br/>
                    <strong>Dimensi:</strong> ${s.length && s.width && s.height ? `${s.length}x${s.width}x${s.height} cm` : '-'}<br/>
                    <strong>Berat:</strong> ${s.weight} Kg (Vol: ${volWeight} Kg)
                  </td>
                  <td>
                    <strong>Deskripsi:</strong> ${itemDesc}<br/>
                    <strong>Instruksi:</strong> ${s.item_notes || '-'}<br/>
                    <strong>Notes Kurir:</strong> ${s.courier_notes || '-'}
                  </td>
                  <td>
                    <strong>Metode:</strong> ${s.payment_method || 'Cash'}<br/>
                    ${s.payment_method === 'COD' ? `<strong>Nominal COD:</strong> ${codAmountDec}<br/>` : ''}
                    <strong>Ongkir:</strong> Rp ${shippingCost.toLocaleString()}<br/>
                    ${s.use_insurance === 1 ? `<strong>Nilai Barang:</strong> ${itemValueDec}<br/><strong>Premi Asuransi:</strong> ${insFeeDec}<br/>` : ''}
                    <strong>Total:</strong> <strong>${totalCostStr}</strong>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="footer">Total Ongkir: Rp ${totalRev.toLocaleString()} <span style="font-size:0.7rem; font-weight:normal;">(Nominal asuransi terenkripsi)</span></div>
      </body></html>
    `);
    win.document.close(); win.print();
  };

  const filteredShipments = shipments.filter(s => 
    s.tracking_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-card fade-in">
          <div className="logo" style={{ marginBottom: '0.5rem', textAlign: 'center', width: '100%' }}>Ekspresin Aja</div>
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginBottom: '2.5rem', fontWeight: 600 }}>Administrator Authorization</p>
          <form onSubmit={handleLogin}>
            <div className="form-group"><label>Administrator ID</label><input type="text" placeholder="admin" onChange={e => setLoginData({...loginData, username: e.target.value})} /></div>
            <div className="form-group"><label>Password</label><input type="password" placeholder="••••••••" onChange={e => setLoginData({...loginData, password: e.target.value})} /></div>
            <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '1rem'}}>Authorize & Open Gateway</button>
          </form>
          <p style={{marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)'}}>Sistem Informasi Ekspedisi Aman Terintegrasi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">
        <div className="logo" style={{ padding: '2.5rem 2rem' }}>Ekspresin Aja</div>
        <div className="nav-items">
          <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>Dashboard</div>
          <div className={`nav-item ${currentView === 'registration' ? 'active' : ''}`} onClick={() => setCurrentView('registration')}>Input Pengiriman</div>
          <div className={`nav-item ${currentView === 'manifest' ? 'active' : ''}`} onClick={() => setCurrentView('manifest')}>Monitoring Paket</div>
          <div className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>Statistik & Laporan</div>
        </div>
        <div className="logout-btn" onClick={() => setIsLoggedIn(false)}>Sign Out</div>
      </nav>

      <main className="content">
        <div className="header-dashboard fade-in">
          <div>
            <h1>{currentView === 'dashboard' ? 'Dashboard' : currentView === 'registration' ? 'Input Pengiriman Baru' : currentView === 'manifest' ? 'Monitoring Manifest' : 'Statistik & Laporan'}</h1>
            <p style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Operasional Ekspedisi Terenkripsi</p>
          </div>
          <div className="user-profile"><div className="status-dot"></div><span>Gateway: {serverKey}</span></div>
        </div>

        {currentView === 'dashboard' && (
          <div className="fade-in">
            {!dbConnected && (
              <div className="card" style={{background: '#fee2e2', border: '1px solid #ef4444', marginBottom: '2rem', color: '#b91c1c'}}>
                <strong>⚠️ Server Offline:</strong> Data tidak dapat dimuat atau disimpan. Pastikan Anda menjalankan <code>npm run server</code> di terminal baru.
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card" style={{borderLeft:'5px solid var(--primary)'}}><span className="stat-label">Total Shipments</span><div className="stat-value" style={{color:'var(--primary)'}}>{shipments.length}</div><div className="stat-trend" style={{color: dbConnected ? 'var(--success)' : 'var(--danger)'}}>{dbConnected ? 'DB Status: Connected' : 'DB Status: Disconnected'}</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid var(--success)'}}><span className="stat-label">Ready to Ship</span><div className="stat-value">{shipments.filter(s => s.status === 'Ready to Ship').length}</div><div className="stat-trend">Label Terbit</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid #6366f1'}}><span className="stat-label">Total Revenue</span><div className="stat-value" style={{fontSize:'1.5rem'}}>Rp {calculateTotalRevenue().toLocaleString()}</div><div className="stat-trend" style={{color:'var(--success)'}}>Live Income</div></div>
            </div>

            <div className="main-grid" style={{gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem'}}>
              <div className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                  <h3>Recent Shipments</h3>
                  <button className="btn-primary" style={{padding:'5px 15px', fontSize:'11px'}} onClick={() => setCurrentView('manifest')}>View All</button>
                </div>
                <div className="table-responsive">
                   <table className="custom-table" style={{fontSize:'0.85rem'}}>
                     <thead><tr><th>Resi</th><th>Penerima</th><th>Layanan</th><th>Status</th></tr></thead>
                     <tbody>
                       {shipments.slice(0, 6).map(s => {
                         const { service } = parseItemData(s);
                         return (
                           <tr key={s.id}>
                             <td style={{fontWeight:'bold', padding:'1rem 5px'}}>{s.tracking_number}</td>
                             <td>{decryptedData[`receiver_${s.id}`] || '••••••••'}</td>
                             <td><span className={`service-badge ${service === 'Ekspres' ? 'ekspres' : ''}`}>{service}</span></td>
                             <td>
                               <span 
                                 className={`status-badge status-${s.status.toLowerCase().replace(/ /g, '')}`}
                                 style={{fontSize:'9px', padding: '4px 8px', whiteSpace: 'nowrap'}}
                               >
                                 {s.status}
                               </span>
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                </div>
              </div>

              <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                  <h3>Security Health Pulse</h3>
                  <div className="pulse-container">
                    <div className="pulse-dot"></div>
                    <span style={{fontSize:'9px', fontWeight:'900', color:'var(--success)'}}>LIVE PROTECTION</span>
                  </div>
                </div>
                
                <div className="security-metrics" style={{flex: 1}}>
                  <div className="metric-row">
                    <span className="metric-label">Algorithm</span>
                    <span className="badge-tech">ChaCha20 (256-bit)</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">ARX Design</span>
                    <span className="badge-tech">Add-Rotate-Xor</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Master Key</span>
                    <span className="badge-tech" style={{maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis'}}>{serverKey}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Data Integrity</span>
                    <span style={{color:'var(--success)', fontWeight:'900', fontSize: '0.8rem'}}>Verified ✅</span>
                  </div>

                  <div style={{marginTop:'1.5rem', padding:'1rem', background:'#f0f9ff', borderRadius:'10px', border:'1px dashed #bae6fd'}}>
                    <div style={{fontSize:'0.7rem', color:'#0369a1', lineHeight:'1.5'}}>
                      <strong>Security Note:</strong> Data PII (Personal Identifiable Information) dienkripsi di level database menggunakan Stream Cipher untuk performa tinggi.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'registration' && (
          <div className="fade-in card" style={{maxWidth: '1000px', padding: '0', background: '#f8fafc'}}>
            <div style={{padding: '2rem', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2 style={{margin: 0}}>Tambah Paket Baru</h2>
              <div className="service-badge ekspres">{formData.service}</div>
            </div>

            <form onSubmit={handleSubmit} style={{padding: '2rem'}}>
              {/* SECTION PENGIRIM */}
              <div className="form-section-card">
                <div className="section-header">PENGIRIM</div>
                <div className="form-row">
                  <div className="form-group"><label>Nama Pengirim</label><input type="text" value={formData.senderName} onChange={e => setFormData({...formData, senderName: e.target.value})} placeholder="Nama Lengkap" required /></div>
                  <div className="form-group"><label>No. Telp/HP</label><input type="number" value={formData.senderPhone} onChange={e => setFormData({...formData, senderPhone: e.target.value})} placeholder="08xxxxxxxxxx" required /></div>
                </div>
                
                {/* Dropdown Lokasi Bertingkat Pengirim */}
                <div className="form-row">
                  <div className="form-group"><label>Provinsi Asal</label>
                    <select value={formData.senderProv} onChange={e => setFormData({...formData, senderProv: e.target.value, senderCity: '', senderKec: ''})} className="modern-select" required>
                      <option value="">-- Pilih Provinsi --</option>
                      {Object.keys(REGIONS_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kota/Kabupaten Asal</label>
                    <select value={formData.senderCity} onChange={e => setFormData({...formData, senderCity: e.target.value, senderKec: ''})} className="modern-select" disabled={!formData.senderProv} required>
                      <option value="">-- Pilih Kota/Kabupaten --</option>
                      {formData.senderProv && Object.keys(REGIONS_DATA[formData.senderProv]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kecamatan Asal</label>
                    <select value={formData.senderKec} onChange={e => setFormData({...formData, senderKec: e.target.value})} className="modern-select" disabled={!formData.senderCity} required>
                      <option value="">-- Pilih Kecamatan --</option>
                      {formData.senderProv && formData.senderCity && REGIONS_DATA[formData.senderProv][formData.senderCity].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                {/* RT RW Dipisah */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}><label>Nama Jalan / No. Rumah</label>
                    <input type="text" value={formData.senderJalan} onChange={e => setFormData({...formData, senderJalan: e.target.value})} placeholder="Cth: Jl. Mawar No. 12" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RT</label>
                    <input type="number" value={formData.senderRT} onChange={e => setFormData({...formData, senderRT: e.target.value})} placeholder="Cth: 02" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RW</label>
                    <input type="number" value={formData.senderRW} onChange={e => setFormData({...formData, senderRW: e.target.value})} placeholder="Cth: 05" required />
                  </div>
                </div>
              </div>

              {/* SECTION PENERIMA */}
              <div className="form-section-card" style={{marginTop: '2rem'}}>
                <div className="section-header" style={{color: '#ef4444'}}>PENERIMA</div>
                <div className="form-row">
                  <div className="form-group"><label>Nama Penerima</label><input type="text" value={formData.receiverName} onChange={e => setFormData({...formData, receiverName: e.target.value})} placeholder="Nama Lengkap" required /></div>
                  <div className="form-group"><label>No. Telp/HP</label><input type="number" value={formData.receiverPhone} onChange={e => setFormData({...formData, receiverPhone: e.target.value})} placeholder="08xxxxxxxxxx" required /></div>
                </div>

                {/* Dropdown Lokasi Bertingkat Penerima */}
                <div className="form-row">
                  <div className="form-group"><label>Provinsi Tujuan</label>
                    <select value={formData.receiverProv} onChange={e => setFormData({...formData, receiverProv: e.target.value, receiverCity: '', receiverKec: ''})} className="modern-select" required>
                      <option value="">-- Pilih Provinsi --</option>
                      {Object.keys(REGIONS_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kota/Kabupaten Tujuan</label>
                    <select value={formData.receiverCity} onChange={e => setFormData({...formData, receiverCity: e.target.value, receiverKec: ''})} className="modern-select" disabled={!formData.receiverProv} required>
                      <option value="">-- Pilih Kota/Kabupaten --</option>
                      {formData.receiverProv && Object.keys(REGIONS_DATA[formData.receiverProv]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kecamatan Tujuan</label>
                    <select value={formData.receiverKec} onChange={e => setFormData({...formData, receiverKec: e.target.value})} className="modern-select" disabled={!formData.receiverCity} required>
                      <option value="">-- Pilih Kecamatan --</option>
                      {formData.receiverProv && formData.receiverCity && REGIONS_DATA[formData.receiverProv][formData.receiverCity].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                {/* RT RW Dipisah */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}><label>Nama Jalan / No. Rumah</label>
                    <input type="text" value={formData.receiverJalan} onChange={e => setFormData({...formData, receiverJalan: e.target.value})} placeholder="Cth: Jl. Melati No. 45" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RT</label>
                    <input type="number" value={formData.receiverRT} onChange={e => setFormData({...formData, receiverRT: e.target.value})} placeholder="Cth: 01" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RW</label>
                    <input type="number" value={formData.receiverRW} onChange={e => setFormData({...formData, receiverRW: e.target.value})} placeholder="Cth: 07" required />
                  </div>
                </div>
              </div>

              {/* SECTION INFORMASI BARANG */}
              <div className="form-section-card" style={{marginTop: '2rem'}}>
                <div className="section-header" style={{color: 'var(--primary)'}}>INFORMASI BARANG & FISIK PAKET</div>
                <div className="form-row">
                  <div className="form-group"><label>Nama Barang</label><input type="text" value={formData.itemName} onChange={e => setFormData({...formData, itemName: e.target.value})} placeholder="Cth: Laptop" required /></div>
                  <div className="form-group"><label>Jenis Barang</label>
                    <select value={formData.itemCategory} onChange={e => setFormData({...formData, itemCategory: e.target.value})} className="modern-select">
                      <option>Pakaian</option><option>Elektronik</option><option>Makanan</option><option>Dokumen</option><option>Lainnya</option>
                    </select>
                  </div>
                </div>

                {/* Dimensi & Kuantitas Paket */}
                <div className="form-row">
                  <div className="form-group"><label>Jumlah Barang (Kuantitas)</label>
                    <input type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} required />
                  </div>
                  <div className="form-group"><label>Dimensi Paket (Panjang x Lebar x Tinggi) - cm</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" min="0" value={formData.length} onChange={e => setFormData({...formData, length: parseFloat(e.target.value) || ''})} placeholder="P (cm)" required />
                      <input type="number" min="0" value={formData.width} onChange={e => setFormData({...formData, width: parseFloat(e.target.value) || ''})} placeholder="L (cm)" required />
                      <input type="number" min="0" value={formData.height} onChange={e => setFormData({...formData, height: parseFloat(e.target.value) || ''})} placeholder="T (cm)" required />
                    </div>
                  </div>
                </div>

                {/* Kalkulasi Berat Volume */}
                {(formData.length && formData.width && formData.height) ? (
                  <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.8rem', marginBottom: '1.5rem', fontWeight: 600 }}>
                    ℹ️ Estimasi Berat Volume: {((formData.length * formData.width * formData.height) / 6000).toFixed(2)} Kg (Tarif akan didasarkan pada mana yang lebih berat)
                  </div>
                ) : null}

                <div className="form-row">
                  <div className="form-group"><label>Layanan Pengiriman</label>
                    <select value={formData.service} onChange={e => setFormData({...formData, service: e.target.value})} className="modern-select">
                      <option>Reguler</option><option>Ekspres</option><option>Same Day</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Berat Aktual (Kg)</label>
                    <input type="number" min="1" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})} required />
                  </div>
                </div>

                {/* Asuransi Pengiriman */}
                <div className="form-row">
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '1rem', paddingBottom: '1rem' }}>
                    <input 
                      type="checkbox" 
                      id="useInsurance"
                      checked={formData.useInsurance} 
                      onChange={e => {
                        const checked = e.target.checked;
                        const ins = checked ? (formData.itemValue * 0.002) : 0;
                        setFormData({...formData, useInsurance: checked, insuranceValue: ins});
                      }} 
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="useInsurance" style={{ margin: 0, fontWeight: 700, cursor: 'pointer' }}>Gunakan Asuransi Pengiriman</label>
                  </div>
                </div>
                {formData.useInsurance && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Estimasi Harga Barang (Rp) - <i>Di-enkripsi</i></label>
                      <input type="number" value={formData.itemValue} onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        const ins = val * 0.002; // 0.2%
                        setFormData({...formData, itemValue: val, insuranceValue: ins});
                      }} required={formData.useInsurance} />
                      {formData.itemValue > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 700, marginTop: '4px' }}>
                          Terbaca: Rp {formData.itemValue.toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>
                    <div className="form-group"><label>Premi Asuransi (0.2%)</label>
                      <input type="text" value={`Rp ${formData.insuranceValue.toLocaleString()}`} readOnly className="cost-input" />
                    </div>
                  </div>
                )}

                {/* Metode Pembayaran */}
                <div className="form-row">
                  <div className="form-group"><label>Metode Pembayaran</label>
                    <select value={formData.paymentMethod} onChange={e => {
                      const method = e.target.value;
                      setFormData({...formData, paymentMethod: method, codAmount: method === 'COD' ? formData.codAmount : 0});
                    }} className="modern-select">
                      <option value="Cash">Cash (Tunai)</option>
                      <option value="Transfer">Transfer Bank</option>
                      <option value="COD">COD (Cash on Delivery)</option>
                    </select>
                  </div>
                  {formData.paymentMethod === 'COD' && (
                    <div className="form-group">
                      <label>Nominal Tagihan COD (Rp)</label>
                      <input type="number" value={formData.codAmount} onChange={e => setFormData({...formData, codAmount: parseFloat(e.target.value) || 0})} required />
                      {formData.codAmount > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, marginTop: '4px' }}>
                          Terbaca: Rp {formData.codAmount.toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Dropdown Instruksi & Catatan Kurir */}
                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group"><label>Instruksi Penanganan Paket</label>
                    <select value={formData.itemNotes} onChange={e => setFormData({...formData, itemNotes: e.target.value})} className="modern-select">
                      <option value="Jangan dibanting (Fragile)">Jangan dibanting (Fragile)</option>
                      <option value="Jauhkan dari air">Jauhkan dari air</option>
                      <option value="Jauhkan dari panas">Jauhkan dari panas</option>
                      <option value="Makanan - Cepat Basi">Makanan - Cepat Basi</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Catatan Tambahan untuk Kurir (Opsional)</label>
                    <input type="text" value={formData.courierNotes} onChange={e => setFormData({...formData, courierNotes: e.target.value})} placeholder="Cth: Titip tetangga jika rumah kosong" />
                  </div>
                </div>

                {/* Deskripsi Barang Terenkripsi */}
                <div className="form-group" style={{ marginTop: '1rem' }}><label>Deskripsi Detail Barang (Isi Paket) - <i>Di-enkripsi</i></label>
                  <textarea rows="2" value={formData.itemDesc} onChange={e => setFormData({...formData, itemDesc: e.target.value})} placeholder="Cth: Baju batik sutra warna merah ukuran XL" required></textarea>
                </div>
              </div>

              <div style={{marginTop: '2.5rem', display: 'flex', gap: '1rem'}}>
                <button type="submit" className="btn-primary" disabled={loading} style={{flex: 2, padding: '1.2rem'}}>
                  {loading ? '🔐 MENGAMANKAN DATA...' : 'KONFIRMASI & KIRIM PAKET'}
                </button>
                <div style={{flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', textAlign: 'center'}}>
                  <div style={{fontSize: '0.7rem', color: '#64748b'}}>TOTAL Ongkir & Asuransi</div>
                  <div style={{fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)'}}>
                    Rp {( (formData.weight * 10000 * (formData.service === 'Ekspres' ? 1.5 : formData.service === 'Same Day' ? 2 : 1)) + 5000 + formData.insuranceValue ).toLocaleString()}
                  </div>
                </div>
              </div>
            </form>
            
            <style>{`
              .form-section-card { background: #fff; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
              .section-header { font-size: 0.75rem; font-weight: 900; letter-spacing: 1px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 10px; }
              .section-header::after { content: ''; flex: 1; height: 1px; background: #f1f5f9; }
            `}</style>
          </div>
        )}

        {currentView === 'manifest' && (
          <div className="fade-in">
            <div className="search-bar-container"><input type="text" placeholder="Cari Resi atau Penerima..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" /></div>
            <div className="card table-card">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead><tr><th>No. Resi</th><th>Kecamatan Tujuan</th><th>Penerima</th><th>Layanan</th><th>Status</th><th>Pembayaran</th><th>Data Terenkripsi</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {filteredShipments.map(item => {
                      const { service } = parseItemData(item);
                      return (
                        <tr key={item.id}>
                          <td className="tracking-id">{item.tracking_number}</td>
                          <td style={{fontWeight: 700}}>{item.receiver_kec || '-'}</td>
                          <td style={{fontWeight: 700}}>{decryptedData[`receiver_${item.id}`] || '••••••••'}</td>
                          <td><span className={`service-badge ${service === 'Ekspres' ? 'ekspres' : ''}`}>{service}</span></td>
                          <td>
                             <span 
                               className={`status-badge status-${item.status.toLowerCase().replace(/ /g, '')}`} 
                               onClick={() => handleCycleStatus(item)}
                               style={{cursor:'pointer'}}
                             >
                               {item.status}
                             </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>Rp {parseItemData(item).shippingCost.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                              {item.payment_method || 'Cash'}
                              {item.payment_method === 'COD' && (
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>
                                  {decryptedData[`cod_amount_${item.id}`]
                                    ? ` (COD: Rp ${parseInt(decryptedData[`cod_amount_${item.id}`]).toLocaleString()})`
                                    : ' (COD: 🔒)'}
                                </span>
                              )}
                            </div>
                            {item.use_insurance === 1 && (
                              <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: '2px' }}>
                                + Asuransi: {decryptedData[`insurance_fee_${item.id}`]
                                  ? `Rp ${parseInt(decryptedData[`insurance_fee_${item.id}`]).toLocaleString()}`
                                  : '🔒 Encrypted'}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{display:'flex', gap:'5px', flexWrap: 'wrap'}}>
                              <div className="cipher-box" title="Decrypted Receiver" style={{ background: decryptedData[`receiver_${item.id}`] ? '#ecfdf5' : '', color: decryptedData[`receiver_${item.id}`] ? '#059669' : '' }}>
                                {decryptedData[`receiver_${item.id}`] || (item.receiver_name_enc || '••••').substring(0, 8) + '...'}
                              </div>
                              <div className="cipher-box" title="Decrypted Address" style={{ background: decryptedData[`receiver_addr_${item.id}`] ? '#ecfdf5' : '', color: decryptedData[`receiver_addr_${item.id}`] ? '#059669' : '' }}>
                                {decryptedData[`receiver_addr_${item.id}`] || (item.receiver_addr_enc || '••••').substring(0, 8) + '...'}
                              </div>
                              <div className="cipher-box" title="Notes (Public)" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#ffedd5' }}>
                                📝 {item.item_notes || 'No Notes'}
                              </div>
                              <div className="cipher-box" title="Insurance/Price" style={{ background: decryptedData[`item_value_${item.id}`] ? '#eff6ff' : '', color: decryptedData[`item_value_${item.id}`] ? '#2563eb' : '' }}>
                                💰 {decryptedData[`item_value_${item.id}`] ? `Rp ${parseInt(decryptedData[`item_value_${item.id}`]).toLocaleString()}` : (item.item_value_enc || '••••').substring(0, 6) + '...'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="action-btns">
                              {!decryptedData[`receiver_addr_${item.id}`] ? (
                                <button className="btn-action decrypt" onClick={() => handleDecrypt(item.id, {
                                  sender: item.sender_name_enc,
                                  sender_phone: item.sender_phone_enc,
                                  sender_kec: item.sender_kec_enc,
                                  sender_addr: item.sender_addr_enc,
                                  receiver: item.receiver_name_enc,
                                  receiver_addr: item.receiver_addr_enc,
                                  receiver_phone: item.receiver_phone_enc,
                                  item_name: item.item_name_enc,
                                  item_cat: item.item_category_enc,
                                  item_desc: item.item_desc_enc,
                                  insurance: item.insurance_enc,
                                  item_value: item.item_value_enc,
                                  insurance_fee: item.insurance_fee_enc,
                                  cod_amount: item.cod_amount_enc
                                }, item.nonce)} title="Dekripsi Data">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><path d="M12 11v-4"></path></svg>
                                </button>
                              ) : (
                                <button className="btn-action lock" onClick={() => handleLock(item.id)} title="Kunci Kembali">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </button>
                              )}
                              <button className="btn-action print" onClick={() => printReceipt(item)} title="Cetak Resi">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentView === 'reports' && (
          <div className="fade-in">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', gap: '10px'}}>
              <h2>Laporan Audit & Statistik</h2>
              <div style={{display:'flex', gap:'10px'}}>
                <button className="btn-primary" onClick={printFullReport} style={{background:'#6366f1'}}>Cetak Laporan (PDF)</button>
                <button className="btn-primary" onClick={handleDecryptAll} style={{background:'#059669'}}>Mulai Audit Dekripsi (Full Access)</button>
                <button className="btn-primary" onClick={() => { setDecryptedData({}); addLog('Laporan audit berhasil dikunci kembali.', 'info'); }} style={{background:'#dc2626'}}>Kunci Kembali Laporan</button>
              </div>
            </div>
            
            <div className="card" style={{marginBottom:'2rem'}}>
              <h3>Tabel Audit Terperinci</h3>
              <div className="table-responsive" style={{marginTop:'1.5rem'}}>
                <table className="custom-table" style={{fontSize:'0.8rem'}}>
                  <thead>
                    <tr>
                      <th>Resi / Status</th>
                      <th>Pengirim (Audit)</th>
                      <th>Penerima (Audit)</th>
                      <th>Detail Barang & Fisik</th>
                      <th>Deskripsi & Catatan</th>
                      <th>Biaya & Pembayaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map(s => {
                      const { shippingCost } = parseItemData(s);
                      const decInsuranceFee = decryptedData[`insurance_fee_${s.id}`] ? parseInt(decryptedData[`insurance_fee_${s.id}`]) : null;
                      const totalCost = decInsuranceFee !== null ? shippingCost + decInsuranceFee : null;
                      return (
                        <tr key={s.id}>
                          <td style={{ verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{s.tracking_number}</div>
                            <div style={{ marginTop: '5px' }}>
                              <span className={`status-badge status-${s.status.toLowerCase().replace(/ /g, '')}`}>
                                {s.status}
                              </span>
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'top', lineHeight: '1.4' }}>
                            <strong>Nama:</strong> {decryptedData[`sender_${s.id}`] || <span className="locked-data">LOCKED</span>}<br/>
                            <strong>Telp:</strong> {decryptedData[`sender_phone_${s.id}`] || <span className="locked-data">LOCKED</span>}<br/>
                            <strong>Alamat:</strong> {decryptedData[`sender_addr_${s.id}`] && decryptedData[`sender_kec_${s.id}`] ? `${decryptedData[`sender_addr_${s.id}`]}, ${decryptedData[`sender_kec_${s.id}`]}` : <span className="locked-data">LOCKED</span>}
                          </td>
                          <td style={{ verticalAlign: 'top', lineHeight: '1.4' }}>
                            <strong>Nama:</strong> {decryptedData[`receiver_${s.id}`] || <span className="locked-data">LOCKED</span>}<br/>
                            <strong>Telp:</strong> {decryptedData[`receiver_phone_${s.id}`] || <span className="locked-data">LOCKED</span>}<br/>
                            <strong>Alamat:</strong> {decryptedData[`receiver_addr_${s.id}`] ? `${decryptedData[`receiver_addr_${s.id}`]}, ${s.receiver_kec}` : <span className="locked-data">LOCKED</span>}
                          </td>
                          <td style={{ verticalAlign: 'top', lineHeight: '1.4' }}>
                            <strong>Barang:</strong> {decryptedData[`item_name_${s.id}`] || <span className="locked-data">LOCKED</span>} ({decryptedData[`item_cat_${s.id}`] || <span className="locked-data">LOCKED</span>})<br/>
                            <strong>Jumlah:</strong> {s.quantity || 1} pcs<br/>
                            <strong>Dimensi:</strong> {s.length && s.width && s.height ? `${s.length}x${s.width}x${s.height} cm` : '-'}<br/>
                            <strong>Berat:</strong> {s.weight || 1} Kg (Vol: {s.length && s.width && s.height ? `${((s.length * s.width * s.height) / 6000).toFixed(2)} Kg` : '-'})
                          </td>
                          <td style={{ verticalAlign: 'top', lineHeight: '1.4' }}>
                            <strong>Deskripsi:</strong> {decryptedData[`item_desc_${s.id}`] || <span className="locked-data">LOCKED</span>}<br/>
                            <strong>Instruksi:</strong> <span style={{ color: '#c2410c', fontWeight: 600 }}>{s.item_notes || '-'}</span><br/>
                            <strong>Catatan Kurir:</strong> {s.courier_notes || <span style={{ color: 'var(--text-dim)' }}>-</span>}
                          </td>
                          <td style={{ verticalAlign: 'top', lineHeight: '1.4' }}>
                            <strong>Metode:</strong> {s.payment_method || 'Cash'}<br/>
                            {s.payment_method === 'COD' && (
                              <><strong>Nominal COD:</strong> {decryptedData[`cod_amount_${s.id}`] ? formatRupiah(decryptedData[`cod_amount_${s.id}`]) : <span className="locked-data">LOCKED</span>}<br/></>
                            )}
                            <strong>Ongkir:</strong> Rp {shippingCost.toLocaleString()}<br/>
                            {s.use_insurance === 1 && (
                              <><strong>Nilai Barang:</strong> {decryptedData[`item_value_${s.id}`] ? formatRupiah(decryptedData[`item_value_${s.id}`]) : <span className="locked-data">LOCKED</span>}<br/>
                              <strong>Premi Asuransi:</strong> {decryptedData[`insurance_fee_${s.id}`] ? formatRupiah(decryptedData[`insurance_fee_${s.id}`]) : <span className="locked-data">LOCKED</span>}<br/></>
                            )}
                            <strong>Total:</strong> <strong style={{ color: 'var(--primary)' }}>
                              {totalCost !== null ? `Rp ${totalCost.toLocaleString()}` : <span className="locked-data">LOCKED</span>}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="main-grid" style={{gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem'}}>
              <div className="card">
                <h3>Revenue Analysis</h3>
                <div className="table-responsive" style={{marginTop:'1.5rem'}}>
                  <table className="custom-table">
                    <thead><tr><th>Layanan</th><th>Vol</th><th style={{textAlign:'right'}}>Revenue</th></tr></thead>
                    <tbody>
                      {['Reguler', 'Ekspres', 'Same Day'].map(svc => {
                        const filtered = shipments.filter(s => s.service_type === svc);
                        const totalRev = filtered.length * (15000 + (svc === 'Ekspres' ? 10000 : 0));
                        return (
                          <tr key={svc}>
                            <td><span className={`service-badge ${svc !== 'Reguler' ? 'ekspres' : ''}`}>{svc}</span></td>
                            <td>{filtered.length}</td>
                            <td style={{textAlign:'right', fontWeight: '900', color: 'var(--primary)'}}>Rp {totalRev.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="card">
                <h3>Security Audit Log</h3>
                <div className="table-responsive" style={{marginTop:'1.5rem'}}>
                  <table className="custom-table" style={{fontSize:'0.85rem'}}>
                    <thead><tr><th>Waktu</th><th>Event</th></tr></thead>
                    <tbody>
                      {securityLogs.map(log => (
                        <tr key={log.id}>
                          <td>{log.time}</td>
                          <td style={{color: log.type === 'warning' ? 'red' : 'inherit'}}>{log.msg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        
      {checkoutData && (
        <div className="checkout-modal-backdrop">
          <div className="checkout-modal-card">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', background: '#ecfdf5', color: '#10b981', padding: '12px', borderRadius: '50%', marginBottom: '1rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h3 className="invoice-title">Invoice Pembayaran</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '5px 0' }}>Resi: <strong>{checkoutData.trackingNumber}</strong></p>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <div className="invoice-row">
                <span style={{ color: '#64748b' }}>Layanan</span>
                <span style={{ fontWeight: 700 }}>{checkoutData.service}</span>
              </div>
              <div className="invoice-row">
                <span style={{ color: '#64748b' }}>Berat Paket</span>
                <span style={{ fontWeight: 700 }}>{checkoutData.weight} Kg</span>
              </div>
              <div className="invoice-row">
                <span style={{ color: '#64748b' }}>Metode Pembayaran</span>
                <span style={{ fontWeight: 700, color: checkoutData.paymentMethod === 'COD' ? '#ef4444' : '#0f172a' }}>
                  {checkoutData.paymentMethod}
                </span>
              </div>
              {checkoutData.paymentMethod === 'COD' && (
                <div className="invoice-row">
                  <span style={{ color: '#64748b' }}>Tagihan COD</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>Rp {checkoutData.codAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="invoice-row">
                <span style={{ color: '#64748b' }}>Ongkos Kirim</span>
                <span style={{ fontWeight: 700 }}>Rp {checkoutData.shippingCost.toLocaleString()}</span>
              </div>
              {checkoutData.insuranceValue > 0 && (
                <>
                  <div className="invoice-row">
                    <span style={{ color: '#64748b' }}>Nilai Barang</span>
                    <span style={{ fontWeight: 700 }}>Rp {checkoutData.insuranceValue.toLocaleString()}</span>
                  </div>
                  <div className="invoice-row">
                    <span style={{ color: '#64748b' }}>Premi Asuransi (0.2%)</span>
                    <span style={{ fontWeight: 700 }}>Rp {checkoutData.insuranceFee.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="invoice-row total">
                <span>Total Biaya</span>
                <span>Rp {checkoutData.totalCost.toLocaleString()}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={async () => {
                  await updateStatus(checkoutData.id, 'Ready to Ship');
                  setCheckoutData(null);
                  setCurrentView('dashboard');
                }}
                className="btn-primary" 
                style={{ flex: 1, padding: '1rem', background: '#10b981', borderColor: '#10b981', color: '#fff', cursor: 'pointer' }}
              >
                Bayar Sekarang
              </button>
              <button 
                onClick={() => {
                  setCheckoutData(null);
                  setCurrentView('dashboard');
                }}
                className="btn-primary" 
                style={{ flex: 1, padding: '1rem', background: '#64748b', borderColor: '#64748b', color: '#fff', cursor: 'pointer' }}
              >
                Bayar Nanti (Pending)
              </button>
            </div>
          </div>
        </div>
      )}
      
        <footer style={{marginTop:'3rem', textAlign:'center', fontSize:'0.7rem', color:'var(--text-dim)', paddingBottom:'2rem'}}>
          &copy; 2026 Ekspresin Aja - Logistik Aman & Terpercaya.
        </footer>
      </main>
      
      <style>{`
        .modern-select { width: 100%; padding: 1rem; border-radius: 1rem; border: 1px solid var(--border); background: #f8fafc; font-family: inherit; font-size: 0.85rem; }
        .cost-input { background: #eef2ff !important; color: var(--primary) !important; font-weight: bold; border-color: #c7d2fe !important; }
        .btn-action { width: 38px; height: 38px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-action:hover { transform: scale(1.15); filter: brightness(0.95); }
        .service-badge { background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; border: 1px solid #e2e8f0; }
        .service-badge.ekspres { background: #eef2ff; color: #4f46e5; border-color: #c7d2fe; }
        .status-badge { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 50px; text-transform: uppercase; white-space: nowrap; }
        .status-pending { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }
        .status-readytoship { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; }
        .status-intransit { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
        .status-delivered { background: #f0fdf4; color: #15803d; border: 1px solid #dcfce7; }
        .pulse-container { display: flex; align-items: center; gap: 8px; background: #f0fdf4; padding: 5px 12px; border-radius: 50px; border: 1px solid #dcfce7; }
        .pulse-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; animation: pulse-anim 1.5s infinite; }
        @keyframes pulse-anim { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        
        .security-metrics { display: flex; flex-direction: column; gap: 15px; width: 100%; }
        .metric-row { display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
        .metric-label { font-size: 0.8rem; color: var(--text-dim); font-weight: 600; }
        .badge-tech { background: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 0.75rem; border: 1px solid #e2e8f0; }
        
        .checkout-modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }
        .checkout-modal-card {
          background: #fff;
          border-radius: 24px;
          padding: 2.5rem;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid #e2e8f0;
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .invoice-title { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-bottom: 0.5rem; }
        .invoice-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.9rem; }
        .invoice-row.total { border-bottom: none; font-size: 1.25rem; font-weight: 900; color: var(--primary); padding-top: 1.5rem; }
        
        @media (max-width: 992px) {
          .login-screen > div { 
            grid-template-columns: 1fr !important; 
            max-width: 500px !important; 
            gap: 1.5rem !important;
          }
          .main-grid { grid-template-columns: 1fr !important; }
          .sidebar { width: 80px; }
          .sidebar .logo, .nav-item { font-size: 0; padding: 1.5rem 0; text-align: center; }
          .nav-item::before { content: '•'; font-size: 1.5rem; }
          .content { margin-left: 80px; }
        }
      `}</style>
    </div>
  );
}

export default App;
