import React, { useState, useEffect } from 'react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [serverKey, setServerKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [decryptedData, setDecryptedData] = useState({});
  const [currentView, setCurrentView] = useState('dashboard');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [securityLogs, setSecurityLogs] = useState([
    { id: 1, time: '10:00 AM', msg: 'System initialized with IP Master Key.', type: 'info' },
    { id: 2, time: '10:05 AM', msg: 'ChaCha20 ARX Rounds validated.', type: 'success' }
  ]);
  
  const [formData, setFormData] = useState({
    sender: '', receiver: '', phone: '', address: '', 
    item_type: 'Dokumen', weight: 1, service: 'Reguler', notes: ''
  });

  const API_URL = 'http://127.0.0.1:5000/api';

  useEffect(() => {
    if (isLoggedIn) {
      fetchShipments();
      fetchKey();
    }
  }, [isLoggedIn]);

  const fetchKey = async () => {
    try {
      const response = await fetch(`${API_URL}/key`);
      const data = await response.json();
      setServerKey(data.key);
    } catch (err) { console.error(err); }
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
    if (loginData.username === 'admin' && loginData.password === 'uts123') {
      setIsLoggedIn(true);
      addLog('Admin authenticated via secure gateway.', 'success');
    } else {
      alert("Akses Ditolak!");
      addLog('Unauthorized login attempt.', 'warning');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus data pengiriman ini secara permanen?")) return;
    try {
      const response = await fetch(`${API_URL}/shipments/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchShipments();
        addLog(`Record ${id} deleted.`, 'warning');
      }
    } catch (err) { console.error(err); }
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

  const handleCycleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'In Transit' : 
                     currentStatus === 'In Transit' ? 'Delivered' : 
                     currentStatus === 'Ready to Ship' ? 'In Transit' : 'Pending';
    updateStatus(id, nextStatus);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fullDescription = `${formData.item_type} (${formData.weight}kg) - ${formData.service}. Notes: ${formData.notes}`;
      const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: formData.sender,
          receiver: formData.receiver,
          phone: formData.phone,
          address: formData.address,
          description: fullDescription
        })
      });
      if (response.ok) {
        setFormData({ sender: '', receiver: '', phone: '', address: '', item_type: 'Dokumen', weight: 1, service: 'Reguler', notes: '' });
        fetchShipments();
        addLog(`New shipment secured and saved.`, 'success');
        setCurrentView('dashboard');
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDecrypt = async (id, encryptedAddress, encryptedPhone, nonce) => {
    try {
      addLog(`Decrypting dataset ${id}...`, 'info');
      const resAddr = await fetch(`${API_URL}/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData: encryptedAddress, nonceBase64: nonce })
      });
      const dataAddr = await resAddr.json();

      const resPhone = await fetch(`${API_URL}/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData: encryptedPhone, nonceBase64: nonce })
      });
      const dataPhone = await resPhone.json();

      setDecryptedData(prev => ({ 
        ...prev, 
        [`addr_${id}`]: dataAddr.decrypted,
        [`phone_${id}`]: dataPhone.decrypted 
      }));
      addLog(`ChaCha20 Decryption completed for ${id}.`, 'success');
    } catch (err) { console.error(err); }
  };

  const handleLock = (id) => {
    const newDecrypted = { ...decryptedData };
    delete newDecrypted[`addr_${id}`];
    delete newDecrypted[`phone_${id}`];
    setDecryptedData(newDecrypted);
    addLog(`Record ${id} re-locked.`, 'info');
  };

  const parseItemData = (desc) => {
    const service = desc.split(' - ')[1]?.split('. ')[0] || 'Reguler';
    const weight = parseFloat(desc.match(/\((.*?)kg\)/)?.[1] || '1');
    const type = desc.split(' (')[0] || 'Paket';
    const cost = weight * (service === 'Ekspres' ? 25000 : 15000);
    return { service, weight, type, cost };
  };

  const printReceipt = async (item) => {
    let addr = decryptedData[`addr_${item.id}`];
    let phone = decryptedData[`phone_${item.id}`];
    if (!addr || !phone) {
      addLog(`Akses Ditolak: Data masih terenkripsi.`, 'warning');
      return alert("Akses Ditolak! Mohon dekripsi data (klik gembok biru) terlebih dahulu sebelum mencetak resi untuk alasan keamanan.");
    }
    
    updateStatus(item.id, 'Ready to Ship');
    const { service, weight, type } = parseItemData(item.item_description);
    const win = window.open('', '_blank');
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
        .address-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2px solid #000; }
        .address-box { padding: 12px; border-right: 2px solid #000; }
        .label-small { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; opacity: 0.7; }
        .address-val { font-size: 14px; font-weight: 700; line-height: 1.2; }
        .receiver-main { padding: 15px; background: #fff; border-bottom: 2px solid #000; }
        .receiver-name { font-size: 24px; font-weight: 900; margin-bottom: 5px; }
        .receiver-addr { font-size: 16px; font-weight: 400; color: #333; }
        .item-info { display: flex; justify-content: space-between; padding: 10px 15px; font-size: 12px; font-weight: 800; border-bottom: 2px solid #000; }
        .footer-sig { display: grid; grid-template-columns: 1fr 1fr; height: 80px; }
        .sig-box { border-right: 2px solid #000; padding: 10px; text-align: center; }
        .sig-line { margin-top: 35px; border-top: 1px dashed #000; width: 80%; margin-left: 10%; }
        .security-footer { font-size: 8px; text-align: center; padding: 5px; background: #f4f4f4; border-top: 1px solid #000; font-weight: 700; }
      </style></head>
      <body>
        <div class="label-container">
          <div class="receipt-header"><div class="brand">EKSPRESIN AJA</div><div class="service-badge">${service.toUpperCase()}</div></div>
          <div class="barcode-section"><div class="barcode-visual"></div><div class="tracking-text">${item.tracking_number}</div></div>
          <div class="address-grid">
            <div class="address-box"><div class="label-small">PENGIRIM (FROM)</div><div class="address-val">${item.sender_name}</div></div>
            <div class="address-box"><div class="label-small">BERAT (WEIGHT)</div><div class="address-val" style="font-size:20px;">${weight} Kg</div></div>
          </div>
          <div class="receiver-main">
            <div class="label-small" style="color:red;">PENERIMA (TO)</div><div class="receiver-name">${item.receiver_name}</div>
            <div class="address-val" style="font-size:18px; margin-bottom:8px;">${phone}</div><div class="receiver-addr">${addr}</div>
          </div>
          <div class="item-info"><div>ISI: ${type.toUpperCase()}</div><div>TGL: ${new Date().toLocaleDateString('id-ID')}</div></div>
          <div class="footer-sig">
            <div class="sig-box"><div class="label-small">PETUGAS</div><div class="sig-line"></div></div>
            <div class="sig-box" style="border-right:none;"><div class="label-small">PENERIMA</div><div class="sig-line"></div></div>
          </div>
          <div class="security-footer">SECURED BY CHACHA20 // KEY: ${serverKey}</div>
        </div>
      </body></html>
    `);
    win.document.close(); win.print();
  };

  const calculateTotalRevenue = () => {
    return shipments.reduce((total, item) => total + parseItemData(item.item_description).cost, 0);
  };

  const filteredShipments = shipments.filter(s => 
    s.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.receiver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sender_name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="stats-grid">
              <div className="stat-card" style={{borderLeft:'5px solid var(--primary)'}}><span className="stat-label">Total Shipments</span><div className="stat-value" style={{color:'var(--primary)'}}>{shipments.length}</div><div className="stat-trend">DB Status: Connected</div></div>
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
                       {[...shipments].reverse().slice(0, 6).map(s => {
                         const { service } = parseItemData(s.item_description);
                         return (
                           <tr key={s.id}>
                             <td style={{fontWeight:'bold', padding:'1rem 5px'}}>{s.tracking_number}</td>
                             <td>{s.receiver_name}</td>
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
          <div className="fade-in card" style={{maxWidth: '1000px'}}>
            <h2>Form Pendaftaran Paket (Secured)</h2>
            <form onSubmit={handleSubmit} style={{marginTop: '2rem'}}>
              <div className="form-row">
                <div className="form-group"><label>Nama Pengirim</label><input type="text" value={formData.sender} onChange={e => setFormData({...formData, sender: e.target.value})} required /></div>
                <div className="form-group"><label>Nama Penerima</label><input type="text" value={formData.receiver} onChange={e => setFormData({...formData, receiver: e.target.value})} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Nomor HP (Secured)</label><input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required /></div>
                <div className="form-group"><label>Jenis Layanan</label><select value={formData.service} onChange={e => setFormData({...formData, service: e.target.value})} className="modern-select"><option>Reguler</option><option>Ekspres</option><option>Same Day</option></select></div>
              </div>
              <div className="form-row" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                <div className="form-group"><label>Jenis Barang</label><select value={formData.item_type} onChange={e => setFormData({...formData, item_type: e.target.value})} className="modern-select"><option>Dokumen</option><option>Elektronik</option><option>Pakaian</option></select></div>
                <div className="form-group"><label>Berat (Kg)</label><input type="number" min="1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} required /></div>
                <div className="form-group"><label>Biaya Estimasi</label><input type="text" value={`Rp ${(formData.weight * (formData.service === 'Ekspres' ? 25000 : 15000)).toLocaleString()}`} disabled className="cost-input" /></div>
              </div>
              <div className="form-group"><label>Alamat Lengkap (Secured)</label><textarea rows="3" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required></textarea></div>
              <button type="submit" className="btn-primary" disabled={loading} style={{padding:'1.2rem 4rem'}}>{loading ? 'Mengamankan Data...' : 'Konfirmasi & Kirim Paket'}</button>
            </form>
          </div>
        )}

        {currentView === 'manifest' && (
          <div className="fade-in">
            <div className="search-bar-container"><input type="text" placeholder="Cari Resi atau Penerima..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" /></div>
            <div className="card table-card">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead><tr><th>No. Resi</th><th>Penerima</th><th>Layanan</th><th>Berat</th><th>Status (Klik)</th><th>Data Penerima (Secured)</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {[...filteredShipments].reverse().map(item => {
                      const { service, weight } = parseItemData(item.item_description);
                      return (
                        <tr key={item.id}>
                          <td className="tracking-id">{item.tracking_number}</td>
                          <td style={{fontWeight: 700}}>{item.receiver_name}</td>
                          <td><span className={`service-badge ${service === 'Ekspres' ? 'ekspres' : ''}`}>{service}</span></td>
                          <td>{weight} Kg</td>
                          <td>
                             <span 
                               className={`status-badge status-${item.status.toLowerCase().replace(/ /g, '')}`} 
                               onClick={() => handleCycleStatus(item.id, item.status)}
                               style={{cursor:'pointer'}}
                               title="Klik untuk ubah status"
                             >
                               {item.status}
                             </span>
                          </td>
                          <td>
                            <div style={{display:'flex', gap:'5px'}}>
                              <div className="cipher-box">{decryptedData[`phone_${item.id}`] || item.receiver_phone.substring(0, 10) + '...'}</div>
                              <div className="cipher-box">{decryptedData[`addr_${item.id}`] || item.address_encrypted.substring(0, 15) + '...'}</div>
                            </div>
                          </td>
                          <td>
                            <div className="action-btns">
                              {decryptedData[`addr_${item.id}`] ? (
                                <button className="btn-action lock" onClick={() => handleLock(item.id)} title="Kunci Kembali" style={{background:'#eef2ff', color:'var(--primary)'}}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </button>
                              ) : (
                                <button className="btn-action decrypt" onClick={() => handleDecrypt(item.id, item.address_encrypted, item.receiver_phone, item.nonce)} title="Dekripsi Data" style={{background:'#eff6ff', color:'#2563eb'}}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><path d="M12 11v-4"></path></svg>
                                </button>
                              )}
                              <button className="btn-action print" onClick={() => printReceipt(item)} title="Cetak Resi" style={{background:'#f0fdf4', color:'#16a34a'}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                              </button>
                              <button className="btn-action delete" onClick={() => handleDelete(item.id)} title="Hapus Data" style={{background:'#fff1f2', color:'#e11d48'}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
            <div className="stats-grid">
              <div className="stat-card" style={{borderLeft:'5px solid var(--primary)'}}><span className="stat-label">Total Revenue</span><div className="stat-value" style={{color:'var(--primary)'}}>Rp {calculateTotalRevenue().toLocaleString()}</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid var(--success)'}}><span className="stat-label">Avg Weight</span><div className="stat-value">{(shipments.reduce((acc, s) => acc + parseItemData(s.item_description).weight, 0) / (shipments.length || 1)).toFixed(1)} Kg</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid #6366f1'}}><span className="stat-label">Active Users</span><div className="stat-value">Admin Gateway</div></div>
            </div>

            <div className="main-grid" style={{gridTemplateColumns: '1.2fr 0.8fr', marginTop: '2rem', gap: '2rem'}}>
              <div className="card">
                <h3>Revenue Analysis</h3>
                <div className="table-responsive" style={{marginTop:'1.5rem'}}>
                  <table className="custom-table">
                    <thead><tr><th>Layanan</th><th>Vol (%)</th><th>Berat</th><th style={{textAlign:'right'}}>Revenue</th></tr></thead>
                    <tbody>
                      {['Reguler', 'Ekspres', 'Same Day'].map(svc => {
                        const filtered = shipments.filter(s => parseItemData(s.item_description).service === svc);
                        const volume = filtered.length;
                        const pct = shipments.length ? ((volume / shipments.length) * 100).toFixed(0) : 0;
                        const totalWeight = filtered.reduce((acc, s) => acc + parseItemData(s.item_description).weight, 0);
                        const totalRev = filtered.reduce((acc, s) => acc + parseItemData(s.item_description).cost, 0);
                        return (
                          <tr key={svc}>
                            <td><span className={`service-badge ${svc !== 'Reguler' ? 'ekspres' : ''}`}>{svc}</span></td>
                            <td>{volume} <span style={{fontSize:'0.7rem', opacity:0.5}}>({pct}%)</span></td>
                            <td>{totalWeight} Kg</td>
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
                    <thead><tr><th>Waktu</th><th>Target</th></tr></thead>
                    <tbody>
                      {[...shipments].reverse().slice(0, 5).map(s => (
                        <tr key={s.id}>
                          <td style={{color:'var(--text-dim)'}}>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{fontFamily:'monospace', fontWeight:'bold'}}>{s.tracking_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div style={{marginTop:'2rem', textAlign:'right'}}>
              <button className="btn-primary" style={{padding:'1rem 2rem'}} onClick={() => window.print()}>Export Audit Report (PDF)</button>
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
