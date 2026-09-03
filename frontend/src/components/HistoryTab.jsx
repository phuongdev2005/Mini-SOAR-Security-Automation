import React, { useState, useEffect } from 'react';

export default function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/executions');
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="tab-content" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Lịch Sử Thực Thi Playbook (Workflow Executions)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nhật ký lưu trữ chi tiết các phiên thực thi tự động hóa trong CSDL MySQL
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchHistory} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
          🔄 Làm Mới
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.72rem' }}>
              <th style={{ padding: '12px 14px' }}>Mã Thực Thi</th>
              <th style={{ padding: '12px 14px' }}>Playbook</th>
              <th style={{ padding: '12px 14px' }}>Trạng Thái</th>
              <th style={{ padding: '12px 14px' }}>Thời Gian Chạy</th>
              <th style={{ padding: '12px 14px' }}>Tổng Kết Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)' }}>
                  Đang tải lịch sử thực thi...
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)' }}>
                  Chưa có bản ghi thực thi nào trong hệ thống.
                </td>
              </tr>
            ) : (
              history.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>#{item.id}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                    {(() => {
                      const name = item.playbookName || item.playbook_name || '';
                      if (name.includes('ssh')) return 'SSH Brute-Force Response Playbook';
                      if (name.includes('ransomware')) return 'Ransomware Containment Playbook';
                      return name || 'SOAR Playbook';
                    })()}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`node-badge ${item.status === 'COMPLETED' ? 'badge-trigger' : 'badge-action'}`}>
                      {item.status === 'COMPLETED' ? 'THÀNH CÔNG' : item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                    {item.startedAt || item.started_at || 'Vừa xong'}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>
                    {item.resultSummary || item.result_summary || 'Thực thi thành công'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
