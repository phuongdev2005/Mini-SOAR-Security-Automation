import React, { useState, useEffect } from 'react';

export default function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('soar_token') || '';
      const res = await fetch('/api/v1/executions', {
        headers: {
          'X-SOAR-API-KEY': 'SOAR-SECRET-API-KEY-2026',
          ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Sort descending so the latest execution is always on top
          data.sort((a, b) => b.id - a.id);
          setHistory(data);
        } else {
          setHistory([]);
        }
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

  const getPlaybookDisplayName = (name) => {
    if (!name) return 'SOAR Playbook';
    const lower = name.toLowerCase();
    if (lower.includes('ssh')) return 'SSH Brute-Force Response Playbook';
    if (lower.includes('ransomware')) return 'Ransomware Containment Playbook';
    return name;
  };

  const filteredHistory = history.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const idMatch = String(item.id).includes(term);
    const alertIdMatch = String(item.alertId || '').includes(term);
    const playbookMatch = (item.playbookName || '').toLowerCase().includes(term);
    const summaryMatch = (item.resultSummary || '').toLowerCase().includes(term);
    const statusMatch = (item.status || '').toLowerCase().includes(term);
    return idMatch || alertIdMatch || playbookMatch || summaryMatch || statusMatch;
  });

  // Parse execution log JSON if possible
  const parseLog = (rawLog) => {
    if (!rawLog) return null;
    try {
      return typeof rawLog === 'string' ? JSON.parse(rawLog) : rawLog;
    } catch (e) {
      return null;
    }
  };

  const parsedLogData = selectedExecution ? parseLog(selectedExecution.executionLog) : null;

  const handleCopyLog = () => {
    if (!selectedExecution) return;
    const textToCopy = typeof selectedExecution.executionLog === 'string' 
      ? selectedExecution.executionLog 
      : JSON.stringify(selectedExecution.executionLog, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tab-content" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Lịch Sử Thực Thi Playbook (Workflow Executions)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Nhật ký lưu trữ chi tiết các phiên thực thi tự động hóa trong CSDL MySQL (Mới nhất ở trên đầu)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>
            Tổng cộng: <strong style={{ color: '#60a5fa' }}>{history.length}</strong> phiên chạy
          </span>
          <button className="btn btn-secondary" onClick={fetchHistory} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
            Làm Mới
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Tìm kiếm theo Mã thực thi, Alert ID, Playbook, IP, từ khóa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '400px', fontSize: '0.82rem' }}
        />
        {searchTerm && (
          <button className="btn btn-secondary" onClick={() => setSearchTerm('')} style={{ fontSize: '0.8rem', padding: '6px 10px' }}>
            Xóa Lọc
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.72rem' }}>
              <th style={{ padding: '12px 14px', width: '110px' }}>Mã Thực Thi</th>
              <th style={{ padding: '12px 14px', width: '220px' }}>Playbook</th>
              <th style={{ padding: '12px 14px', width: '120px' }}>Trạng Thái</th>
              <th style={{ padding: '12px 14px', width: '180px' }}>Thời Gian Chạy</th>
              <th style={{ padding: '12px 14px' }}>Tổng Kết Hành Động</th>
              <th style={{ padding: '12px 14px', width: '110px', textAlign: 'center' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                  Đang tải lịch sử thực thi...
                </td>
              </tr>
            ) : filteredHistory.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                  {searchTerm ? 'Không tìm thấy phiên thực thi phù hợp từ khóa.' : 'Chưa có bản ghi thực thi nào trong hệ thống.'}
                </td>
              </tr>
            ) : (
              filteredHistory.map(item => (
                <tr 
                  key={item.id} 
                  onClick={() => setSelectedExecution(item)}
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 700 }}>
                    #{item.id}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                    {getPlaybookDisplayName(item.playbookName || item.playbook_name)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`node-badge ${item.status === 'COMPLETED' ? 'badge-trigger' : 'badge-action'}`}>
                      {item.status === 'COMPLETED' ? 'THÀNH CÔNG' : item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                    {item.startedAt || item.started_at || 'Vừa xong'}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#cbd5e1', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.resultSummary || item.result_summary || 'Thực thi thành công'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedExecution(item);
                      }}
                    >
                      Xem Chi Tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Execution Detail Modal */}
      {selectedExecution && (
        <div className="modal-overlay active" style={{ display: 'flex', opacity: 1, pointerEvents: 'auto', zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Chi Tiết Thực Thi: #{selectedExecution.id}
                </span>
                <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: '#94a3b8' }}>
                  {getPlaybookDisplayName(selectedExecution.playbookName || selectedExecution.playbook_name)}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelectedExecution(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* Top Key Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Mã Alert Kích Hoạt</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                    {selectedExecution.alertId ? `#${selectedExecution.alertId}` : 'Thủ công / Test'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Trạng Thái</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: selectedExecution.status === 'COMPLETED' ? '#34d399' : '#f87171', marginTop: '2px' }}>
                    {selectedExecution.status === 'COMPLETED' ? 'THÀNH CÔNG' : selectedExecution.status}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Thời Gian Xử Lý</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#60a5fa', marginTop: '2px' }}>
                    {selectedExecution.executionTimeMs ? `${selectedExecution.executionTimeMs} ms` : 'N/A'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Bắt Đầu Lúc</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginTop: '4px' }}>
                    {selectedExecution.startedAt || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Result Summary */}
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Tổng Kết Hành Động:
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                  {selectedExecution.resultSummary || 'Thực thi thành công'}
                </div>
              </div>

              {/* Pipeline Steps if parsed */}
              {parsedLogData && Array.isArray(parsedLogData.steps) && parsedLogData.steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Quy Trình Các Bước Đã Xử Lý ({parsedLogData.steps.length} Bước):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {parsedLogData.steps.map((st, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          background: 'rgba(0, 0, 0, 0.3)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '6px', 
                          padding: '10px 14px' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8' }}>
                            {st.stage || `Bước ${idx + 1}`}: {st.name || ''}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {st.timestamp || ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {st.detail || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON Log */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Toàn Bộ Log Thực Thi Chi Tiết (Raw JSON):
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleCopyLog}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    {copied ? 'Đã Sao Chép!' : 'Sao Chép Log'}
                  </button>
                </div>
                <div className="terminal-view" style={{ maxHeight: '240px', overflowY: 'auto', fontSize: '0.75rem' }}>
                  {parsedLogData 
                    ? JSON.stringify(parsedLogData, null, 2) 
                    : (selectedExecution.executionLog || 'Không có log chi tiết')}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedExecution(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
