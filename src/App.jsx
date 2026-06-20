import React, { useState, useEffect } from 'react';
import REGIONS_DATA from './indonesia_regions.json';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); // { id, username, role }
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  
  const [shipments, setShipments] = useState([]);
  const [serverKey, setServerKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [decryptedData, setDecryptedData] = useState({});
  const [currentView, setCurrentView] = useState('login');
  const [dbConnected, setDbConnected] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', password: '', confirmPassword: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutData, setCheckoutData] = useState(null);
  
  // Custom Role & Fitur States
  const [branches, setBranches] = useState([]);
  const [addressBook, setAddressBook] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditActive, setAuditActive] = useState(false);

  // Customer Form Options
  const [customerRole, setCustomerRole] = useState('sender'); // 'sender' | 'receiver'
  const [deliveryType, setDeliveryType] = useState('pickup'); // 'pickup' | 'dropoff'
  const [selectedBranchName, setSelectedBranchName] = useState('');
  const [saveSenderAddress, setSaveSenderAddress] = useState(false);
  const [saveReceiverAddress, setSaveReceiverAddress] = useState(false);

  const [selectedSavedSender, setSelectedSavedSender] = useState('');
  const [selectedSavedReceiver, setSelectedSavedReceiver] = useState('');

  // Branch Management state
  const [newBranch, setNewBranch] = useState({ name: '', address: '' });

  // Address Book manual add state
  const [newAddress, setNewAddress] = useState({
    name: '', phone: '', province: '', city: '', district: '', street: '', rt: '', rw: ''
  });

  const [formData, setFormData] = useState({
    senderName: '', senderPhone: '', senderKec: '', senderAddr: '',
    receiverName: '', receiverPhone: '', receiverKec: '', receiverAddr: '',
    itemName: '', itemCategory: 'Pakaian', itemDesc: '', 
    service: 'Reguler', insuranceValue: 0, weight: 1, itemValue: 0,
    paymentMethod: 'Cash', codAmount: 0, useInsurance: false,
    
    senderJalan: '', senderRT: '', senderRW: '',
    receiverJalan: '', receiverRT: '', receiverRW: '',
    
    senderProv: '', senderCity: '',
    receiverProv: '', receiverCity: '',
    
    quantity: 1, length: '', width: '', height: '',
    itemNotes: 'Jangan dibanting (Fragile)', courierNotes: ''
  });

  const API_URL = `http://${window.location.hostname}:5000/api`;

  // Sync auth and views
  useEffect(() => {
    fetchKey();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (isLoggedIn && user) {
      if (user.role === 'admin') {
        setCurrentView('dashboard');
        fetchShipments();
        fetchAuditLogs();
      } else {
        setCurrentView('customer_dashboard');
        fetchShipments(user.id);
        fetchAddressBook(user.id);
      }
    } else {
      setCurrentView('login');
    }
  }, [isLoggedIn, user]);

  // Auto-decrypt for customer shipments
  useEffect(() => {
    if (isLoggedIn && user && user.role === 'customer' && shipments.length > 0) {
      autoDecryptCustomerShipments();
    }
  }, [shipments]);

  const fetchKey = async () => {
    try {
      const response = await fetch(`${API_URL}/key`);
      if (!response.ok) throw new Error('Failed to fetch key');
      const data = await response.json();
      setServerKey(data.key);
      setDbConnected(true);
    } catch (err) { 
      console.error(err);
      setDbConnected(false);
    }
  }

  const fetchShipments = async (customerId = null) => {
    try {
      const url = customerId 
        ? `${API_URL}/shipments?customer_id=${customerId}` 
        : `${API_URL}/shipments`;
      const response = await fetch(url);
      const data = await response.json();
      setShipments(data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_URL}/branches`);
      const data = await response.json();
      setBranches(data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchAddressBook = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/address-book?userId=${userId}`);
      const data = await response.json();
      setAddressBook(data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch(`${API_URL}/audit-logs`);
      const data = await response.json();
      setAuditLogs(data);
    } catch (err) { 
      console.error(err); 
    }
  };

  const logAuditEvent = async (action) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, action })
      });
      fetchAuditLogs();
    } catch (err) {
      console.error('Audit logging failed:', err);
    }
  };

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
        setIsLoggedIn(true);
      } else {
        alert(data.error || 'Gagal masuk');
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      return alert('Konfirmasi password tidak cocok!');
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerData.username,
          password: registerData.password
        })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Registrasi berhasil! Silakan masuk.');
        setAuthMode('login');
        setRegisterData({ username: '', password: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Gagal daftar');
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setUser(null);
    setDecryptedData({});
    setAuditActive(false);
    setLoginData({ username: '', password: '' });
  };

  // Auto-decrypt all customer shipments in background
  const autoDecryptCustomerShipments = async () => {
    for (const item of shipments) {
      if (decryptedData[`receiver_${item.id}`]) continue; // already decrypted
      
      const payload = {
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
      };

      try {
        const decryptedResults = {};
        for (const [key, encryptedData] of Object.entries(payload)) {
          if (!encryptedData) continue;
          const res = await fetch(`${API_URL}/decrypt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData, nonceBase64: item.nonce })
          });
          const data = await res.json();
          decryptedResults[`${key}_${item.id}`] = data.decrypted;
        }
        setDecryptedData(prev => ({ ...prev, ...decryptedResults }));
      } catch (err) {
        console.error('Auto-decrypt error for shipment:', item.id, err);
      }
    }
  };

  // Branch operations
  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranch.name || !newBranch.address) return;
    try {
      const response = await fetch(`${API_URL}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBranch)
      });
      if (response.ok) {
        fetchBranches();
        setNewBranch({ name: '', address: '' });
        logAuditEvent(`Added new branch: ${newBranch.name}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBranch = async (id, branchName) => {
    if (!window.confirm(`Hapus cabang ${branchName}?`)) return;
    try {
      const response = await fetch(`${API_URL}/branches/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchBranches();
        logAuditEvent(`Deleted branch: ${branchName}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Address Book operations
  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddress.name || !newAddress.phone) return alert('Nama dan No. Telp wajib diisi!');
    try {
      const street = newAddress.street || '';
      const rt = newAddress.rt || '';
      const rw = newAddress.rw || '';
      const response = await fetch(`${API_URL}/address-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: newAddress.name,
          phone: newAddress.phone,
          province: newAddress.province,
          city: newAddress.city,
          district: newAddress.district,
          street, rt, rw
        })
      });
      if (response.ok) {
        fetchAddressBook(user.id);
        setNewAddress({
          name: '', phone: '', province: '', city: '', district: '', street: '', rt: '', rw: ''
        });
        alert('Alamat berhasil disimpan!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Pre-fill fields from Address Book selection
  const handleSelectSavedAddress = (type, addressId) => {
    if (!addressId) {
      if (type === 'sender') {
        setSelectedSavedSender('');
        setFormData(prev => ({
          ...prev,
          senderName: '', senderPhone: '', senderProv: '', senderCity: '', senderKec: '',
          senderJalan: '', senderRT: '', senderRW: ''
        }));
      } else {
        setSelectedSavedReceiver('');
        setFormData(prev => ({
          ...prev,
          receiverName: '', receiverPhone: '', receiverProv: '', receiverCity: '', receiverKec: '',
          receiverJalan: '', receiverRT: '', receiverRW: ''
        }));
      }
      return;
    }

    const selected = addressBook.find(a => a.id === parseInt(addressId));
    if (!selected) return;

    if (type === 'sender') {
      setSelectedSavedSender(addressId);
      setFormData(prev => ({
        ...prev,
        senderName: selected.name,
        senderPhone: selected.phone,
        senderProv: selected.province,
        senderCity: selected.city,
        senderKec: selected.district,
        senderJalan: selected.street,
        senderRT: selected.rt,
        senderRW: selected.rw
      }));
    } else {
      setSelectedSavedReceiver(addressId);
      setFormData(prev => ({
        ...prev,
        receiverName: selected.name,
        receiverPhone: selected.phone,
        receiverProv: selected.province,
        receiverCity: selected.city,
        receiverKec: selected.district,
        receiverJalan: selected.street,
        receiverRT: selected.rt,
        receiverRW: selected.rw
      }));
    }
  };

  // Handle Customer Role Changes (Sender vs Receiver pre-fill)
  useEffect(() => {
    if (isLoggedIn && user && user.role === 'customer') {
      if (customerRole === 'sender') {
        // Pre-fill sender with customer info, clear receiver
        setFormData(prev => ({
          ...prev,
          senderName: user.username.toUpperCase(),
          senderPhone: '08123456789', // default mock phone
          receiverName: '', receiverPhone: '', receiverProv: '', receiverCity: '', receiverKec: '',
          receiverJalan: '', receiverRT: '', receiverRW: ''
        }));
      } else {
        // Pre-fill receiver with customer info, clear sender
        setFormData(prev => ({
          ...prev,
          receiverName: user.username.toUpperCase(),
          receiverPhone: '08123456789',
          senderName: '', senderPhone: '', senderProv: '', senderCity: '', senderKec: '',
          senderJalan: '', senderRT: '', senderRW: ''
        }));
      }
    }
  }, [customerRole, isLoggedIn, user]);

  // Main Submit Handler (Shipment Registration)
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
        itemValue: formData.useInsurance ? formData.itemValue : 0,
        
        customerId: user ? user.id : null,
        roleType: customerRole,
        deliveryType: deliveryType,
        branchName: deliveryType === 'dropoff' ? selectedBranchName : null
      };
      
      const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Save to address book if checked
        if (saveSenderAddress && customerRole !== 'sender') {
          // If customer role is receiver, we might want to save the entered sender address
          await saveToAddressBook(
            formData.senderName, formData.senderPhone, formData.senderProv,
            formData.senderCity, formData.senderKec, formData.senderJalan,
            formData.senderRT, formData.senderRW
          );
        }
        if (saveReceiverAddress && customerRole !== 'receiver') {
          // If customer role is sender, save the entered receiver address
          await saveToAddressBook(
            formData.receiverName, formData.receiverPhone, formData.receiverProv,
            formData.receiverCity, formData.receiverKec, formData.receiverJalan,
            formData.receiverRT, formData.receiverRW
          );
        }

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

        // Reset
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

        setSaveSenderAddress(false);
        setSaveReceiverAddress(false);
        setSelectedSavedSender('');
        setSelectedSavedReceiver('');
        setSelectedBranchName('');

        fetchShipments(user.id);
        fetchAddressBook(user.id);
      } else {
        const errorData = await response.json();
        alert(`Gagal menyimpan: ${errorData.error || 'Server error'}`);
      }
    } catch (err) { 
      console.error(err); 
      alert("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  const saveToAddressBook = async (name, phone, prov, city, dist, street, rt, rw) => {
    try {
      await fetch(`${API_URL}/address-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name, phone, province: prov, city, district: dist, street, rt, rw
        })
      });
    } catch (e) {
      console.error('Failed to save to address book:', e);
    }
  };

  // Status updates (Admin only)
  const updateStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/shipments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (response.ok && data.message === 'Success') {
        await fetchShipments(user.role === 'customer' ? user.id : null);
        logAuditEvent(`Updated shipment status ID ${id} to ${newStatus}`);
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleCycleStatus = (item) => {
    if (user && user.role !== 'admin') return; // strictly admin
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

  // Decryption for Auditing
  const handleDecrypt = async (id, itemsToDecrypt, nonce, silent = false) => {
    try {
      const decryptedResults = {};
      for (const [key, encryptedData] of Object.entries(itemsToDecrypt)) {
        if (!encryptedData) continue;
        const res = await fetch(`${API_URL}/decrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedData, nonceBase64: nonce })
        });
        const data = await res.json();
        decryptedResults[`${key}_${id}`] = data.decrypted;
      }
      setDecryptedData(prev => ({ ...prev, ...decryptedResults }));
      if (!silent) {
        logAuditEvent(`Decrypted shipment data ID ${id} for security auditing`);
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleDecryptAll = async () => {
    if (shipments.length === 0) return;
    setAuditActive(true);
    logAuditEvent('Admin started full access manifest audit decryption');
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
      }, item.nonce, true); // silent because we already logged the main event
    }
  };

  const handleLock = (id) => {
    const newDecrypted = { ...decryptedData };
    Object.keys(newDecrypted).forEach(key => {
      if (key.endsWith(`_${id}`)) {
        delete newDecrypted[key];
      }
    });
    setDecryptedData(newDecrypted);
    logAuditEvent(`Re-locked shipment ID ${id}`);
  };

  const parseItemData = (item) => {
    const service = item.service_type || 'Reguler';
    const weight = item.weight || 1;
    const baseRate = 10000;
    const multiplier = service === 'Ekspres' ? 1.5 : service === 'Same Day' ? 2 : 1;
    const shippingCost = (weight * baseRate * multiplier) + 5000;
    return { service, weight, type: 'Paket', shippingCost };
  };

  const formatRupiah = (val) => {
    const num = parseInt(val) || 0;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  const calculateTotalRevenue = () => {
    return shipments.reduce((total, item) => total + parseItemData(item).shippingCost, 0);
  };

  // Printing Layouts
  const printReceipt = async (item) => {
    let sender = decryptedData[`sender_${item.id}`];
    let receiver = decryptedData[`receiver_${item.id}`];
    let addr = decryptedData[`receiver_addr_${item.id}`];
    let phone = decryptedData[`receiver_phone_${item.id}`];
    let kec = item.receiver_kec || '';
    
    if (!sender || !receiver || !addr) {
      return alert("Akses Ditolak! Mohon dekripsi data terlebih dahulu sebelum mencetak resi.");
    }
    
    if (user.role === 'admin' && item.status === 'Pending') {
      updateStatus(item.id, 'Ready to Ship');
    }
    
    const { service } = parseItemData(item);
    const win = window.open('', '_blank');
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
          ${item.delivery_type === 'dropoff' ? `
          <div class="address-box" style="background:#f0fdf4; border-top: 1px dashed #000;">
            <div class="label-small" style="color:#16803d;">DROP OFF LOCATION</div>
            <div class="address-val" style="font-size:13px; font-weight:700;">${item.branch_name || 'Kantor Cabang'}</div>
          </div>` : ''}
          ${item.item_notes ? `
          <div class="address-box" style="background:#fff7ed; border-top: 1px dashed #000;">
            <div class="label-small" style="color:#c2410c;">INSTRUKSI PENANGANAN</div>
            <div class="address-val" style="font-size:14px; font-weight:900; text-transform:uppercase;">${item.item_notes}</div>
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
        <title>Laporan Manifest & Audit - Admin Gateway</title>
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
        <h1>LAPORAN MANIFEST & OPERASIONAL GATEWAY</h1>
        <div class="meta-info">
          <div><strong>EKSPRESIN AJA</strong> - Secure Logistics System</div>
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
                    <strong>Layanan:</strong> ${s.delivery_type === 'dropoff' ? 'Drop Off (' + (s.branch_name || 'Cabang') + ')' : 'Pick Up'}
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
        <div class="footer">Total Revenue: Rp ${totalRev.toLocaleString()} <span style="font-size:0.7rem; font-weight:normal;">(Premi asuransi terenkripsi/tidak masuk total revenue)</span></div>
      </body></html>
    `);
    win.document.close(); win.print();
  };

  const filteredShipments = shipments.filter(s => 
    s.tracking_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // LOGIN & REGISTER SCREEN
  if (currentView === 'login') {
    return (
      <div className="login-screen">
        <div className="login-card fade-in">
          <div className="logo" style={{ marginBottom: '0.5rem', textAlign: 'center', width: '100%', fontSize: '2rem' }}>Ekspresin Aja</div>
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginBottom: '2.5rem', fontWeight: 600 }}>
            {authMode === 'login' ? 'Secure Gateway Portal' : 'Register Customer Account'}
          </p>
          
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '5px', borderRadius: '12px', marginBottom: '2rem' }}>
            <button 
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Sign In
            </button>
            <button 
              className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => setAuthMode('register')}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Sign Up (Customer)
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group"><label>Username</label><input type="text" placeholder="Masukkan username" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required /></div>
              <div className="form-group"><label>Password</label><input type="password" placeholder="••••••••" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required /></div>
              <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '1.5rem', padding: '1rem'}} disabled={loading}>
                {loading ? 'AUTHENTICATING...' : 'Sign In & Connect Gateway'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group"><label>Username Baru</label><input type="text" placeholder="Pilih username" value={registerData.username} onChange={e => setRegisterData({...registerData, username: e.target.value})} required /></div>
              <div className="form-group"><label>Password</label><input type="password" placeholder="••••••••" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} required /></div>
              <div className="form-group"><label>Konfirmasi Password</label><input type="password" placeholder="••••••••" value={registerData.confirmPassword} onChange={e => setRegisterData({...registerData, confirmPassword: e.target.value})} required /></div>
              <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '1.5rem', padding: '1rem'}} disabled={loading}>
                {loading ? 'REGISTERING...' : 'Create Account'}
              </button>
            </form>
          )}
          <p style={{marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)'}}>Sistem Informasi Ekspedisi Aman Terintegrasi // ChaCha20</p>
        </div>
      </div>
    );
  }

  // PROTECTED RENDERING (Admin vs Customer)
  return (
    <div className="dashboard-layout">
      {/* SIDEBAR NAVIGATION */}
      <nav className="sidebar">
        <div className="logo" style={{ padding: '2.5rem 2rem' }}>Ekspresin Aja</div>
        <div className="nav-items">
          {user && user.role === 'admin' ? (
            <>
              <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>Dashboard</div>
              <div className={`nav-item ${currentView === 'manifest' ? 'active' : ''}`} onClick={() => setCurrentView('manifest')}>Global Manifest</div>
              <div className={`nav-item ${currentView === 'branches' ? 'active' : ''}`} onClick={() => setCurrentView('branches')}>Kelola Cabang</div>
              <div className={`nav-item ${currentView === 'reports' ? 'active' : ''}`} onClick={() => setCurrentView('reports')}>Keamanan & Audit</div>
            </>
          ) : (
            <>
              <div className={`nav-item ${currentView === 'customer_dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('customer_dashboard')}>Dashboard</div>
              <div className={`nav-item ${currentView === 'customer_registration' ? 'active' : ''}`} onClick={() => setCurrentView('customer_registration')}>Kirim Paket</div>
              <div className={`nav-item ${currentView === 'customer_tracking' ? 'active' : ''}`} onClick={() => setCurrentView('customer_tracking')}>Tracking Paket</div>
              <div className={`nav-item ${currentView === 'customer_address' ? 'active' : ''}`} onClick={() => setCurrentView('customer_address')}>Buku Alamat</div>
            </>
          )}
        </div>
        <div className="logout-btn" onClick={handleSignOut}>Sign Out</div>
      </nav>

      {/* CONTENT REGION */}
      <main className="content">
        <div className="header-dashboard fade-in">
          <div>
            <h1>
              {user && user.role === 'admin' ? (
                currentView === 'dashboard' ? 'Dashboard Admin' : 
                currentView === 'manifest' ? 'Global Manifest' :
                currentView === 'branches' ? 'Manajemen Cabang' : 'Keamanan & Audit Manifest'
              ) : (
                currentView === 'customer_dashboard' ? `Welcome back, ${user?.username}!` :
                currentView === 'customer_registration' ? 'Kirim Paket Baru' :
                currentView === 'customer_tracking' ? 'Tracking & Riwayat Paket' : 'Buku Alamat Saya'
              )}
            </h1>
            <p style={{ color: 'var(--text-dim)', fontWeight: 500 }}>
              {user?.role === 'admin' ? 'Operasional Keamanan Jaringan Ekspedisi' : 'Portal Logistik Pelanggan'}
            </p>
          </div>
          <div className="user-profile">
            <div className="status-dot"></div>
            <span>Peran: {user?.role.toUpperCase()} ({user?.username})</span>
          </div>
        </div>

        {/* -------------------- ADMIN VIEWS -------------------- */}
        {user?.role === 'admin' && currentView === 'dashboard' && (
          <div className="fade-in">
            <div className="stats-grid">
              <div className="stat-card" style={{borderLeft:'5px solid var(--primary)'}}><span className="stat-label">Total Shipments (Global)</span><div className="stat-value" style={{color:'var(--primary)'}}>{shipments.length}</div><div className="stat-trend" style={{color: 'var(--success)'}}>Operational Database Live</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid var(--success)'}}><span className="stat-label">Cabang Aktif</span><div className="stat-value">{branches.length}</div><div className="stat-trend">Branch Management Sync</div></div>
              <div className="stat-card" style={{borderLeft:'5px solid #6366f1'}}><span className="stat-label">Total Revenue</span><div className="stat-value" style={{fontSize:'1.5rem'}}>Rp {calculateTotalRevenue().toLocaleString()}</div><div className="stat-trend" style={{color:'var(--success)'}}>Live Income</div></div>
            </div>

            <div className="main-grid" style={{gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem'}}>
              <div className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                  <h3>Recent Global Shipments</h3>
                  <button className="btn-primary" style={{padding:'5px 15px', fontSize:'11px'}} onClick={() => setCurrentView('manifest')}>View All</button>
                </div>
                <div className="table-responsive">
                   <table className="custom-table" style={{fontSize:'0.85rem'}}>
                     <thead><tr><th>Resi</th><th>Tujuan</th><th>Layanan</th><th>Status</th></tr></thead>
                     <tbody>
                       {shipments.slice(0, 6).map(s => {
                         const { service } = parseItemData(s);
                         return (
                           <tr key={s.id}>
                             <td style={{fontWeight:'bold', padding:'1rem 5px'}}>{s.tracking_number}</td>
                             <td>{s.receiver_kec || '••••••••'}</td>
                             <td><span className={`service-badge ${service === 'Ekspres' ? 'ekspres' : ''}`}>{service}</span></td>
                             <td>
                               <span className={`status-badge status-${s.status.toLowerCase().replace(/ /g, '')}`}>
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
                    <span style={{fontSize:'9px', fontWeight:'900', color:'var(--success)'}}>AUDITING LIVE</span>
                  </div>
                </div>
                
                <div className="security-metrics" style={{flex: 1}}>
                  <div className="metric-row"><span className="metric-label">Algorithm</span><span className="badge-tech">ChaCha20 (256-bit)</span></div>
                  <div className="metric-row"><span className="metric-label">Data Integrity</span><span style={{color:'var(--success)', fontWeight:'900', fontSize: '0.8rem'}}>Verified ✅</span></div>
                  <div className="metric-row"><span className="metric-label">Total Audit Events</span><span className="badge-tech">{auditLogs.length} Events</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL MANIFEST (ADMIN ONLY) */}
        {user?.role === 'admin' && currentView === 'manifest' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div className="search-bar-container" style={{ margin: 0, flex: 1, maxWidth: '400px' }}>
                <input type="text" placeholder="Cari Resi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
              </div>
              <button className="btn-primary" onClick={handleDecryptAll} style={{ background: '#059669', padding: '0.75rem 1.5rem' }}>
                🔑 Audit Dekripsi (Full Access)
              </button>
            </div>

            {auditActive && (
              <div className="card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: '1rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
                ℹ️ <strong>Mode Audit Aktif:</strong> Semua dataset yang dimuat di bawah ini telah ter-dekripsi untuk monitoring keamanan. Tindakan ini tercatat di database audit log.
              </div>
            )}

            <div className="card table-card">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead><tr><th>No. Resi</th><th>Kecamatan Tujuan</th><th>Pengirim (Decrypted)</th><th>Penerima (Decrypted)</th><th>Layanan</th><th>Status</th><th>Biaya</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {filteredShipments.map(item => {
                      const { service, shippingCost } = parseItemData(item);
                      const isDecrypted = !!decryptedData[`receiver_${item.id}`];
                      return (
                        <tr key={item.id}>
                          <td className="tracking-id">{item.tracking_number}</td>
                          <td style={{fontWeight: 700}}>{item.receiver_kec || '-'}</td>
                          <td style={{fontWeight: 700}}>{decryptedData[`sender_${item.id}`] || '🔒 LOCKED'}</td>
                          <td style={{fontWeight: 700}}>{decryptedData[`receiver_${item.id}`] || '🔒 LOCKED'}</td>
                          <td><span className={`service-badge ${service === 'Ekspres' ? 'ekspres' : ''}`}>{service}</span></td>
                          <td>
                             <span className={`status-badge status-${item.status.toLowerCase().replace(/ /g, '')}`} onClick={() => handleCycleStatus(item)} style={{cursor:'pointer'}}>
                               {item.status}
                             </span>
                          </td>
                          <td style={{fontWeight: 700}}>Rp {shippingCost.toLocaleString()}</td>
                          <td>
                            <div className="action-btns">
                              {!isDecrypted ? (
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
                                }, item.nonce)} title="Audit Dekripsi Baris">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><path d="M12 11v-4"></path></svg>
                                </button>
                              ) : (
                                <button className="btn-action lock" onClick={() => handleLock(item.id)} title="Kunci Kembali Data">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </button>
                              )}
                              <button className="btn-action print" onClick={() => printReceipt(item)} title="Cetak Label Resi">
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

        {/* KELOLA CABANG (ADMIN ONLY) */}
        {user?.role === 'admin' && currentView === 'branches' && (
          <div className="fade-in">
            <div className="main-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div className="card">
                <h3>Tambah Cabang Baru</h3>
                <form onSubmit={handleAddBranch} style={{ marginTop: '1.5rem' }}>
                  <div className="form-group">
                    <label>Nama Cabang</label>
                    <input type="text" placeholder="Contoh: Yogyakarta Hub" value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Alamat Lengkap</label>
                    <input type="text" placeholder="Contoh: Jl. Solo KM 10, Sleman" value={newBranch.address} onChange={e => setNewBranch({ ...newBranch, address: e.target.value })} required />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>
                    Simpan Cabang
                  </button>
                </form>
              </div>

              <div className="card">
                <h3>Daftar Cabang Aktif</h3>
                <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                  <table className="custom-table">
                    <thead><tr><th>Nama Cabang</th><th>Alamat</th><th style={{ width: '80px' }}>Aksi</th></tr></thead>
                    <tbody>
                      {branches.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 'bold' }}>{b.name}</td>
                          <td>{b.address}</td>
                          <td>
                            <button className="btn-action" style={{ background: '#fee2e2', color: '#ef4444' }} onClick={() => handleDeleteBranch(b.id, b.name)} title="Hapus Cabang">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {branches.length === 0 && (
                        <tr><td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8' }}>Tidak ada cabang terdaftar</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KEAMANAN & AUDIT (ADMIN ONLY) */}
        {user?.role === 'admin' && currentView === 'reports' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Security Audit Ledger & Report</h2>
              <button className="btn-primary" onClick={printFullReport} style={{ background: '#6366f1' }}>
                🖨️ Cetak Audit Manifest (PDF)
              </button>
            </div>

            <div className="main-grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              <div className="card">
                <h3>Kejadian & Log Aktivitas Enkripsi (Database)</h3>
                <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead><tr><th>Timestamp</th><th>Operator</th><th>Tindakan / Event</th></tr></thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ color: '#64748b' }}>{new Date(log.timestamp).toLocaleString('id-ID')}</td>
                          <td style={{ fontWeight: 'bold' }}>{log.username}</td>
                          <td style={{ color: log.action.includes('audit') || log.action.includes('Decrypted') ? '#4f46e5' : 'inherit', fontWeight: log.action.includes('audit') ? 'bold' : 'normal' }}>
                            {log.action}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr><td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8' }}>Belum ada logs audit tercatat</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h3>Informasi Integritas Sistem</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>METODE AUDIT</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '5px', fontWeight: 600 }}>ChaCha20 Stream Decryption</div>
                  </div>
                  <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 'bold' }}>INTEGRITAS CHIPERTEXT</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '5px', fontWeight: 600, color: '#15803d' }}>Semua Record PII Terenkripsi Aman</div>
                  </div>
                  <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 'bold' }}>AKSES SENSITIF</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '5px', fontWeight: 600, color: '#b91c1c' }}>Hanya untuk Kebutuhan Operasional & Audit Jaringan</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- CUSTOMER VIEWS -------------------- */}
        {user?.role === 'customer' && currentView === 'customer_dashboard' && (
          <div className="fade-in">
            <div className="card" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', marginBottom: '2rem', border: 'none' }}>
              <h2>Halo, {user.username.toUpperCase()}!</h2>
              <p style={{ marginTop: '0.5rem', opacity: 0.9 }}>Selamat datang di Portal Logistik Ekspresin Aja. Silakan kirim paket baru atau lacak pengiriman Anda secara instan di bawah ini.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                <button className="btn-primary" style={{ background: '#fff', color: '#4f46e5', border: 'none' }} onClick={() => setCurrentView('customer_registration')}>Kirim Paket Baru</button>
                <button className="btn-primary" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'transparent' }} onClick={() => setCurrentView('customer_tracking')}>Lacak Paket Anda</button>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card" style={{ borderLeft: '5px solid var(--primary)' }}>
                <span className="stat-label">Pengiriman Saya</span>
                <div className="stat-value">{shipments.length} Paket</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid var(--success)' }}>
                <span className="stat-label">Buku Alamat</span>
                <div className="stat-value">{addressBook.length} Alamat</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '5px solid #a855f7' }}>
                <span className="stat-label">Status Keamanan Akun</span>
                <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--success)' }}>Terenkripsi ChaCha20 ✅</div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER REGISTRATION FORM */}
        {user?.role === 'customer' && currentView === 'customer_registration' && (
          <div className="fade-in card" style={{ maxWidth: '1000px', padding: '0', background: '#f8fafc' }}>
            <div style={{ padding: '2rem', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Formulir Pengiriman Baru</h2>
              <div className="service-badge ekspres">{formData.service}</div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
              {/* OPSI PERAN CUSTOMER */}
              <div className="form-section-card" style={{ marginBottom: '2rem' }}>
                <div className="section-header">PERAN PENGIRIMAN</div>
                <div className="form-group">
                  <label>Pilih Peran Anda dalam Pengiriman ini:</label>
                  <div style={{ display: 'flex', gap: '30px', marginTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      <input type="radio" name="customerRole" checked={customerRole === 'sender'} onChange={() => setCustomerRole('sender')} style={{ width: '18px', height: '18px' }} />
                      Saya bertindak sebagai PENGIRIM (Sender)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      <input type="radio" name="customerRole" checked={customerRole === 'receiver'} onChange={() => setCustomerRole('receiver')} style={{ width: '18px', height: '18px' }} />
                      Saya bertindak sebagai PENERIMA (Receiver)
                    </label>
                  </div>
                </div>
              </div>

              {/* TIPE PENGIRIMAN (PICK UP / DROP OFF) */}
              <div className="form-section-card" style={{ marginBottom: '2rem' }}>
                <div className="section-header">LAYANAN EKSPEDISI</div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Metode Penyerahan Paket</label>
                    <div style={{ display: 'flex', gap: '30px', marginTop: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        <input type="radio" name="deliveryType" checked={deliveryType === 'pickup'} onChange={() => setDeliveryType('pickup')} />
                        Pick Up (Jemput di Alamat Asal)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        <input type="radio" name="deliveryType" checked={deliveryType === 'dropoff'} onChange={() => setDeliveryType('dropoff')} />
                        Drop Off (Taruh di Cabang Terdekat)
                      </label>
                    </div>
                  </div>
                  {deliveryType === 'dropoff' && (
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Cabang Penyerahan Paket</label>
                      <select value={selectedBranchName} onChange={e => setSelectedBranchName(e.target.value)} className="modern-select" required>
                        <option value="">-- Pilih Cabang Terdekat --</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.name}>{b.name} - {b.address}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION PENGIRIM */}
              <div className="form-section-card">
                <div className="section-header">PENGIRIM (SENDER)</div>
                
                {/* Autocomplete Dropdown if not customer */}
                {customerRole === 'receiver' && (
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Isi Alamat dari Buku Alamat Anda (Opsional)</label>
                    <select value={selectedSavedSender} onChange={e => handleSelectSavedAddress('sender', e.target.value)} className="modern-select">
                      <option value="">-- Pilih Alamat Tersimpan --</option>
                      {addressBook.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.street}, {a.city})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Nama Pengirim</label>
                    <input type="text" value={formData.senderName} onChange={e => setFormData({...formData, senderName: e.target.value})} placeholder="Nama Lengkap" required disabled={customerRole === 'sender'} />
                  </div>
                  <div className="form-group">
                    <label>No. Telp/HP</label>
                    <input type="number" value={formData.senderPhone} onChange={e => setFormData({...formData, senderPhone: e.target.value})} placeholder="08xxxxxxxxxx" required disabled={customerRole === 'sender'} />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group"><label>Provinsi Asal</label>
                    <select value={formData.senderProv} onChange={e => setFormData({...formData, senderProv: e.target.value, senderCity: '', senderKec: ''})} className="modern-select" required disabled={customerRole === 'sender'}>
                      <option value="">-- Pilih Provinsi --</option>
                      {Object.keys(REGIONS_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kota/Kabupaten Asal</label>
                    <select value={formData.senderCity} onChange={e => setFormData({...formData, senderCity: e.target.value, senderKec: ''})} className="modern-select" disabled={!formData.senderProv || customerRole === 'sender'} required>
                      <option value="">-- Pilih Kota/Kabupaten --</option>
                      {formData.senderProv && Object.keys(REGIONS_DATA[formData.senderProv]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kecamatan Asal</label>
                    <select value={formData.senderKec} onChange={e => setFormData({...formData, senderKec: e.target.value})} className="modern-select" disabled={!formData.senderCity || customerRole === 'sender'} required>
                      <option value="">-- Pilih Kecamatan --</option>
                      {formData.senderProv && formData.senderCity && REGIONS_DATA[formData.senderProv][formData.senderCity].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}><label>Nama Jalan / No. Rumah</label>
                    <input type="text" value={formData.senderJalan} onChange={e => setFormData({...formData, senderJalan: e.target.value})} placeholder="Cth: Jl. Mawar No. 12" required disabled={customerRole === 'sender'} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RT</label>
                    <input type="number" value={formData.senderRT} onChange={e => setFormData({...formData, senderRT: e.target.value})} placeholder="Cth: 02" required disabled={customerRole === 'sender'} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RW</label>
                    <input type="number" value={formData.senderRW} onChange={e => setFormData({...formData, senderRW: e.target.value})} placeholder="Cth: 05" required disabled={customerRole === 'sender'} />
                  </div>
                </div>

                {customerRole === 'receiver' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
                    <input type="checkbox" id="saveSenderAddress" checked={saveSenderAddress} onChange={e => setSaveSenderAddress(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="saveSenderAddress" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: '#4f46e5' }}>💾 Simpan alamat pengirim ini ke Buku Alamat</label>
                  </div>
                )}
              </div>

              {/* SECTION PENERIMA */}
              <div className="form-section-card" style={{ marginTop: '2rem' }}>
                <div className="section-header" style={{ color: '#ef4444' }}>PENERIMA (RECEIVER)</div>
                
                {/* Autocomplete Dropdown if not customer */}
                {customerRole === 'sender' && (
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Isi Alamat dari Buku Alamat Anda (Opsional)</label>
                    <select value={selectedSavedReceiver} onChange={e => handleSelectSavedAddress('receiver', e.target.value)} className="modern-select">
                      <option value="">-- Pilih Alamat Tersimpan --</option>
                      {addressBook.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.street}, {a.city})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Nama Penerima</label>
                    <input type="text" value={formData.receiverName} onChange={e => setFormData({...formData, receiverName: e.target.value})} placeholder="Nama Lengkap" required disabled={customerRole === 'receiver'} />
                  </div>
                  <div className="form-group">
                    <label>No. Telp/HP</label>
                    <input type="number" value={formData.receiverPhone} onChange={e => setFormData({...formData, receiverPhone: e.target.value})} placeholder="08xxxxxxxxxx" required disabled={customerRole === 'receiver'} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group"><label>Provinsi Tujuan</label>
                    <select value={formData.receiverProv} onChange={e => setFormData({...formData, receiverProv: e.target.value, receiverCity: '', receiverKec: ''})} className="modern-select" required disabled={customerRole === 'receiver'}>
                      <option value="">-- Pilih Provinsi --</option>
                      {Object.keys(REGIONS_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kota/Kabupaten Tujuan</label>
                    <select value={formData.receiverCity} onChange={e => setFormData({...formData, receiverCity: e.target.value, receiverKec: ''})} className="modern-select" disabled={!formData.receiverProv || customerRole === 'receiver'} required>
                      <option value="">-- Pilih Kota/Kabupaten --</option>
                      {formData.receiverProv && Object.keys(REGIONS_DATA[formData.receiverProv]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kecamatan Tujuan</label>
                    <select value={formData.receiverKec} onChange={e => setFormData({...formData, receiverKec: e.target.value})} className="modern-select" disabled={!formData.receiverCity || customerRole === 'receiver'} required>
                      <option value="">-- Pilih Kecamatan --</option>
                      {formData.receiverProv && formData.receiverCity && REGIONS_DATA[formData.receiverProv][formData.receiverCity].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}><label>Nama Jalan / No. Rumah</label>
                    <input type="text" value={formData.receiverJalan} onChange={e => setFormData({...formData, receiverJalan: e.target.value})} placeholder="Cth: Jl. Melati No. 45" required disabled={customerRole === 'receiver'} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RT</label>
                    <input type="number" value={formData.receiverRT} onChange={e => setFormData({...formData, receiverRT: e.target.value})} placeholder="Cth: 01" required disabled={customerRole === 'receiver'} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}><label>RW</label>
                    <input type="number" value={formData.receiverRW} onChange={e => setFormData({...formData, receiverRW: e.target.value})} placeholder="Cth: 07" required disabled={customerRole === 'receiver'} />
                  </div>
                </div>

                {customerRole === 'sender' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
                    <input type="checkbox" id="saveReceiverAddress" checked={saveReceiverAddress} onChange={e => setSaveReceiverAddress(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="saveReceiverAddress" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: '#ef4444' }}>💾 Simpan alamat penerima ini ke Buku Alamat</label>
                  </div>
                )}
              </div>

              {/* GOODS INFO & DETAILS */}
              <div className="form-section-card" style={{ marginTop: '2rem' }}>
                <div className="section-header" style={{ color: 'var(--primary)' }}>INFORMASI BARANG & FISIK PAKET</div>
                <div className="form-row">
                  <div className="form-group"><label>Nama Barang</label><input type="text" value={formData.itemName} onChange={e => setFormData({...formData, itemName: e.target.value})} placeholder="Cth: Laptop" required /></div>
                  <div className="form-group"><label>Jenis Barang</label>
                    <select value={formData.itemCategory} onChange={e => setFormData({...formData, itemCategory: e.target.value})} className="modern-select">
                      <option>Pakaian</option><option>Elektronik</option><option>Makanan</option><option>Dokumen</option><option>Lainnya</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group"><label>Jumlah Barang (Kuantitas)</label>
                    <input type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} required />
                  </div>
                  <div className="form-group"><label>Dimensi Paket (P x L x T) - cm</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" min="0" value={formData.length} onChange={e => setFormData({...formData, length: parseFloat(e.target.value) || ''})} placeholder="P (cm)" required />
                      <input type="number" min="0" value={formData.width} onChange={e => setFormData({...formData, width: parseFloat(e.target.value) || ''})} placeholder="L (cm)" required />
                      <input type="number" min="0" value={formData.height} onChange={e => setFormData({...formData, height: parseFloat(e.target.value) || ''})} placeholder="T (cm)" required />
                    </div>
                  </div>
                </div>

                {formData.length && formData.width && formData.height ? (
                  <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.8rem', marginBottom: '1.5rem', fontWeight: 600 }}>
                    ℹ️ Estimasi Berat Volume: {((formData.length * formData.width * formData.height) / 6000).toFixed(2)} Kg
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
                        const ins = val * 0.002;
                        setFormData({...formData, itemValue: val, insuranceValue: ins});
                      }} required={formData.useInsurance} />
                    </div>
                    <div className="form-group"><label>Premi Asuransi (0.2%)</label>
                      <input type="text" value={`Rp ${formData.insuranceValue.toLocaleString()}`} readOnly className="cost-input" />
                    </div>
                  </div>
                )}

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
                    </div>
                  )}
                </div>

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

                <div className="form-group" style={{ marginTop: '1rem' }}><label>Deskripsi Detail Barang (Isi Paket) - <i>Di-enkripsi</i></label>
                  <textarea rows="2" value={formData.itemDesc} onChange={e => setFormData({...formData, itemDesc: e.target.value})} placeholder="Cth: Baju batik sutra warna merah ukuran XL" required></textarea>
                </div>
              </div>

              <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, padding: '1.2rem' }}>
                  {loading ? '🔐 MENGAMANKAN DATA...' : 'KONFIRMASI & KIRIM PAKET'}
                </button>
                <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TOTAL Ongkir & Asuransi</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>
                    Rp {((formData.weight * 10000 * (formData.service === 'Ekspres' ? 1.5 : formData.service === 'Same Day' ? 2 : 1)) + 5000 + formData.insuranceValue).toLocaleString()}
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* CUSTOMER TRACKING VIEW (AUTO-DECRYPTED) */}
        {user?.role === 'customer' && currentView === 'customer_tracking' && (
          <div className="fade-in">
            <div className="search-bar-container"><input type="text" placeholder="Cari berdasarkan No. Resi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" /></div>
            
            <div className="card table-card">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead><tr><th>No. Resi</th><th>Layanan</th><th>Pengirim</th><th>Penerima</th><th>Tujuan</th><th>Fisik / Barang</th><th>Status</th><th>Metode</th><th>Label</th></tr></thead>
                  <tbody>
                    {filteredShipments.map(item => {
                      const { service } = parseItemData(item);
                      
                      const senderDec = decryptedData[`sender_${item.id}`] || 'Decryption...';
                      const receiverDec = decryptedData[`receiver_${item.id}`] || 'Decryption...';
                      const itemNameDec = decryptedData[`item_name_${item.id}`] || 'Decryption...';
                      const receiverAddrDec = decryptedData[`receiver_addr_${item.id}`] || '';

                      return (
                        <tr key={item.id}>
                          <td className="tracking-id">{item.tracking_number}</td>
                          <td>
                            <span className={`service-badge ${service === 'Ekspres' ? 'ekspres' : ''}`}>{service}</span>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                              {item.delivery_type === 'dropoff' ? 'Drop Off (' + (item.branch_name || 'Hub') + ')' : 'Pick Up Service'}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{senderDec}</td>
                          <td style={{ fontWeight: 700 }}>{receiverDec}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.receiver_kec}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{receiverAddrDec}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{itemNameDec}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.weight} Kg // {item.quantity} Pcs</div>
                          </td>
                          <td>
                            <span className={`status-badge status-${item.status.toLowerCase().replace(/ /g, '')}`}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {item.payment_method}
                            {item.payment_method === 'COD' && decryptedData[`cod_amount_${item.id}`] && (
                              <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Rp {parseInt(decryptedData[`cod_amount_${item.id}`]).toLocaleString()}</div>
                            )}
                          </td>
                          <td>
                            <button className="btn-action print" onClick={() => printReceipt(item)} title="Cetak Label Resi">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredShipments.length === 0 && (
                      <tr><td colSpan="9" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Belum ada riwayat pengiriman paket.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER ADDRESS BOOK VIEW */}
        {user?.role === 'customer' && currentView === 'customer_address' && (
          <div className="fade-in">
            <div className="main-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div className="card">
                <h3>Tambah Alamat Baru</h3>
                <form onSubmit={handleAddAddress} style={{ marginTop: '1.5rem' }}>
                  <div className="form-group"><label>Nama Penerima/Kontak</label><input type="text" placeholder="Masukkan nama" value={newAddress.name} onChange={e => setNewAddress({...newAddress, name: e.target.value})} required /></div>
                  <div className="form-group"><label>No. Telp</label><input type="number" placeholder="08xxxxxxxxxx" value={newAddress.phone} onChange={e => setNewAddress({...newAddress, phone: e.target.value})} required /></div>
                  <div className="form-group"><label>Provinsi</label>
                    <select value={newAddress.province} onChange={e => setNewAddress({...newAddress, province: e.target.value, city: '', district: ''})} className="modern-select" required>
                      <option value="">-- Pilih Provinsi --</option>
                      {Object.keys(REGIONS_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kota/Kabupaten</label>
                    <select value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value, district: ''})} className="modern-select" disabled={!newAddress.province} required>
                      <option value="">-- Pilih Kota --</option>
                      {newAddress.province && Object.keys(REGIONS_DATA[newAddress.province]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Kecamatan</label>
                    <select value={newAddress.district} onChange={e => setNewAddress({...newAddress, district: e.target.value})} className="modern-select" disabled={!newAddress.city} required>
                      <option value="">-- Pilih Kecamatan --</option>
                      {newAddress.province && newAddress.city && REGIONS_DATA[newAddress.province][newAddress.city].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Jalan & No. Rumah</label><input type="text" placeholder="Jl. Raya No. 4" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} /></div>
                  <div className="form-row">
                    <div className="form-group"><label>RT</label><input type="number" placeholder="01" value={newAddress.rt} onChange={e => setNewAddress({...newAddress, rt: e.target.value})} /></div>
                    <div className="form-group"><label>RW</label><input type="number" placeholder="02" value={newAddress.rw} onChange={e => setNewAddress({...newAddress, rw: e.target.value})} /></div>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>Simpan Alamat</button>
                </form>
              </div>

              <div className="card">
                <h3>Buku Alamat Saya</h3>
                <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                  <table className="custom-table">
                    <thead><tr><th>Nama</th><th>Telepon</th><th>Alamat Lengkap</th></tr></thead>
                    <tbody>
                      {addressBook.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 'bold' }}>{a.name}</td>
                          <td>{a.phone}</td>
                          <td>
                            <div>{a.street}, RT {a.rt}/RW {a.rw}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.district}, {a.city}, {a.province}</div>
                          </td>
                        </tr>
                      ))}
                      {addressBook.length === 0 && (
                        <tr><td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Belum ada alamat tersimpan</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- INVOICE MODAL -------------------- */}
        {checkoutData && (
          <div className="checkout-modal-backdrop">
            <div className="checkout-modal-card">
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', background: '#ecfdf5', color: '#10b981', padding: '12px', borderRadius: '50%', marginBottom: '1rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3 className="invoice-title">Invoice Pengiriman Paket</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '5px 0' }}>Nomor Resi: <strong>{checkoutData.trackingNumber}</strong></p>
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <div className="invoice-row"><span style={{ color: '#64748b' }}>Layanan</span><span style={{ fontWeight: 700 }}>{checkoutData.service}</span></div>
                <div className="invoice-row"><span style={{ color: '#64748b' }}>Berat Paket</span><span style={{ fontWeight: 700 }}>{checkoutData.weight} Kg</span></div>
                <div className="invoice-row"><span style={{ color: '#64748b' }}>Metode Pembayaran</span><span style={{ fontWeight: 700, color: checkoutData.paymentMethod === 'COD' ? '#ef4444' : '#0f172a' }}>{checkoutData.paymentMethod}</span></div>
                {checkoutData.paymentMethod === 'COD' && (
                  <div className="invoice-row"><span style={{ color: '#64748b' }}>Tagihan COD</span><span style={{ fontWeight: 700, color: '#ef4444' }}>Rp {checkoutData.codAmount.toLocaleString()}</span></div>
                )}
                <div className="invoice-row"><span style={{ color: '#64748b' }}>Biaya Ongkos Kirim</span><span style={{ fontWeight: 700 }}>Rp {checkoutData.shippingCost.toLocaleString()}</span></div>
                {checkoutData.insuranceValue > 0 && (
                  <>
                    <div className="invoice-row"><span style={{ color: '#64748b' }}>Nilai Barang</span><span style={{ fontWeight: 700 }}>Rp {checkoutData.insuranceValue.toLocaleString()}</span></div>
                    <div className="invoice-row"><span style={{ color: '#64748b' }}>Premi Asuransi</span><span style={{ fontWeight: 700 }}>Rp {checkoutData.insuranceFee.toLocaleString()}</span></div>
                  </>
                )}
                <div className="invoice-row total"><span>Total Biaya</span><span>Rp {checkoutData.totalCost.toLocaleString()}</span></div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={async () => {
                    await updateStatus(checkoutData.id, 'Ready to Ship');
                    setCheckoutData(null);
                    setCurrentView(user.role === 'admin' ? 'dashboard' : 'customer_dashboard');
                  }}
                  className="btn-primary" 
                  style={{ flex: 1, padding: '1rem', background: '#10b981', borderColor: '#10b981', color: '#fff', cursor: 'pointer' }}
                >
                  Bayar Sekarang (Lunas)
                </button>
                <button 
                  onClick={() => {
                    setCheckoutData(null);
                    setCurrentView(user.role === 'admin' ? 'dashboard' : 'customer_dashboard');
                  }}
                  className="btn-primary" 
                  style={{ flex: 1, padding: '1rem', background: '#64748b', borderColor: '#64748b', color: '#fff', cursor: 'pointer' }}
                >
                  Bayar Nanti
                </button>
              </div>
            </div>
          </div>
        )}

        <footer style={{marginTop:'3rem', textAlign:'center', fontSize:'0.7rem', color:'var(--text-dim)', paddingBottom:'2rem'}}>
          &copy; 2026 Ekspresin Aja - Logistik Terenkripsi Jaringan & PII Aman.
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
        
        .auth-tab { transition: 0.3s; }
        .auth-tab.active { background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); color: var(--primary); }
        .auth-tab:not(.active) { background: transparent; color: #64748b; }
        .auth-tab:not(.active):hover { color: var(--primary); }

        .locked-data { background: #fef2f2; color: #b91c1c; font-family: monospace; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecaca; }

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
