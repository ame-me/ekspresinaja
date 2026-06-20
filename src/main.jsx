import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo
    });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', background: '#fee2e2', color: '#b91c1c', border: '2px solid #fecaca', margin: '40px', borderRadius: '12px', fontFamily: 'sans-serif' }}>
          <h2 style={{ marginBottom: '10px' }}>⚠️ Error Terdeteksi di Aplikasi</h2>
          <p style={{ marginBottom: '20px', fontSize: '0.9rem' }}>Terjadi kesalahan saat merender halaman UI. Silakan lihat detail di bawah ini:</p>
          <pre style={{ background: '#fef2f2', padding: '15px', borderRadius: '8px', overflowX: 'auto', fontSize: '0.85rem', border: '1px solid #fee2e2' }}>
            {this.state.error && this.state.error.toString()}
            {"\n\nComponent Stack:\n"}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
