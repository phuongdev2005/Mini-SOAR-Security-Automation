import React, { useState, useEffect } from 'react';

export default function DashboardTab() {
  const [metrics, setMetrics] = useState({
    totalAlerts: 12,
    criticalAlerts: 4,
    blockedIps: 8,
    automationRate: '100%'
  });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [blockedList, setBlockedList] = useState([]);

  const fetchDashboardData = async () => {
    try {
      const [alertsRes, blockedRes] = await Promise.all([
        fetch('/api/v1/alerts'),
        fetch('/api/v1/actions/blocked-ips')
      ]);

      if (alertsRes.ok) {
        const alerts = await alertsRes.json();
        setRecentAlerts(Array.isArray(alerts) ? alerts.slice(0, 8) : []);
        const total = alerts.length || 0;
        const crit = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;
        setMetrics(prev => ({ ...prev, totalAlerts: total, criticalAlerts: crit }));
      }

      if (blockedRes.ok) {
        const blocked = await blockedRes.json();
        setBlockedList(Array.isArray(blocked) ? blocked : []);
        setMetrics(prev => ({ ...prev, blockedIps: blocked.length || 0 }));
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="tab-content" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Bảng Giám Sát An Ninh & Chỉ Số SOC (SOC Dashboard)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Thống kê tổng hợp sự cố, tỷ lệ tự động hóa và danh sách IP độc hại đã bị cô lập
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDashboardData} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
          🔄 Làm Mới Chỉ Số
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng Cảnh Báo Tiếp Nhận</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>{metrics.totalAlerts}</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Webhook Ingestion (REST)</span>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mức Độ Nguy Cấp (Critical)</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>{metrics.criticalAlerts}</span>
          <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Cần cô lập khẩn cấp</span>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IP Đã Bị Tường Lửa Chặn</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{metrics.blockedIps}</span>
          <span style={{ fontSize: '0.75rem', color: '#fde68a' }}>IPTables & Blacklist</span>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tỷ Lệ Tự Động Hóa (SOAR)</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{metrics.automationRate}</span>
          <span style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>Zero-Touch Response</span>
        </div>
      </div>

      {/* Side-by-side Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)' }}>📋 Cảnh Báo Gần Đây (Alert Feed)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Mã</th>
                  <th style={{ padding: '8px' }}>Loại Cảnh Báo</th>
                  <th style={{ padding: '8px' }}>IP / Host</th>
                  <th style={{ padding: '8px' }}>Mức Độ</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '14px', color: 'var(--text-dim)' }}>Chưa có cảnh báo mới</td></tr>
                ) : (
                  recentAlerts.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px', color: '#60a5fa' }}>#{a.id}</td>
                      <td style={{ padding: '8px' }}>{a.alertType || a.alert_type}</td>
                      <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{a.sourceIp || a.hostname || 'N/A'}</td>
                      <td style={{ padding: '8px' }}>
                        <span className={`node-badge ${a.severity === 'CRITICAL' ? 'badge-trigger' : 'badge-action'}`}>
                          {a.severity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f59e0b' }}>🚫 Danh Sách IP Bị Chặn (Blacklist)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>IP Address</th>
                  <th style={{ padding: '8px' }}>Lý Do Chặn</th>
                  <th style={{ padding: '8px' }}>Thời Gian</th>
                </tr>
              </thead>
              <tbody>
                {blockedList.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '14px', color: 'var(--text-dim)' }}>Chưa có IP bị chặn</td></tr>
                ) : (
                  blockedList.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: '#ef4444' }}>{b.ip_address || b.ip}</td>
                      <td style={{ padding: '8px' }}>{b.reason || 'SSH Brute-Force Attacker'}</td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{b.blocked_at || 'Mới chặn'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
