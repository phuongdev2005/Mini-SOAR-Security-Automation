import React, { useState, useEffect } from 'react';

export default function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchHistory = async (isInitial = true) => {
    if (isInitial) setLoading(true);
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
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(true);
    // Auto-polling every 3 seconds so pending & in-progress updates appear live
    const interval = setInterval(() => {
      fetchHistory(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getPlaybookDisplayName = (name) => {
    if (!name) return 'SOAR Playbook';
    const lower = name.toLowerCase();
    if (lower.includes('ssh')) return 'SSH Brute-Force Response Playbook';
    if (lower.includes('ransomware')) return 'Ransomware Containment Playbook';
    return name;
  };

  const totalCount = history.length;
  const pendingCount = history.filter(h => h.status === 'PENDING').length;
  const inProgressCount = history.filter(h => h.status === 'IN_PROGRESS').length;
  const completedCount = history.filter(h => h.status === 'COMPLETED').length;
  const failedCount = history.filter(h => h.status === 'FAILED').length;

  const filteredHistory = history.filter(item => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const idMatch = String(item.id).includes(term);
    const alertIdMatch = String(item.alertId || '').includes(term);
    const playbookMatch = (item.playbookName || '').toLowerCase().includes(term);
    const summaryMatch = (item.resultSummary || '').toLowerCase().includes(term);
    const statusMatch = (item.status || '').toLowerCase().includes(term);
    return idMatch || alertIdMatch || playbookMatch || summaryMatch || statusMatch;
  });

  // Render badge corresponding to each SOAR lifecycle state
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            padding: '4px 9px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.74rem',
            letterSpacing: '0.3px',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.2)'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ĐANG CHỜ (QUEUE)
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#a5b4fc',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            padding: '4px 9px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.74rem',
            letterSpacing: '0.3px',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.5s linear infinite' }}>
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
            ĐANG CHẠY
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '4px 9px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.74rem',
            letterSpacing: '0.3px'
          }}>
            <span style={{ fontWeight: 800 }}>✓</span>
            THÀNH CÔNG
          </span>
        );
      case 'FAILED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '4px 9px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.74rem',
            letterSpacing: '0.3px'
          }}>
            <span style={{ fontWeight: 800 }}>✕</span>
            THẤT BẠI
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(148, 163, 184, 0.15)',
            color: '#cbd5e1',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            padding: '4px 9px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.74rem'
          }}>
            {status}
          </span>
        );
    }
  };

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
          <span style={{ fontSize: '0.78rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '5px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            Trực tiếp (Live Polling 3s)
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }}>
            Tổng cộng: <strong style={{ color: '#60a5fa' }}>{history.length}</strong> phiên
          </span>
          <button className="btn btn-secondary" onClick={() => fetchHistory(true)} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
            Làm Mới
          </button>
        </div>
      </div>

      {/* Filter Row: Search & Status Pill Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search Filter */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1', minWidth: '280px', maxWidth: '420px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Tìm kiếm theo Mã thực thi, Alert ID, Playbook, từ khóa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: '0.82rem', width: '100%' }}
          />
          {searchTerm && (
            <button className="btn btn-secondary" onClick={() => setSearchTerm('')} style={{ fontSize: '0.8rem', padding: '6px 10px' }}>
              Xóa Lọc
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setStatusFilter('ALL')}
            style={{
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: statusFilter === 'ALL' ? '#3b82f6' : 'var(--border-color)',
              background: statusFilter === 'ALL' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
              color: statusFilter === 'ALL' ? '#60a5fa' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Tất Cả ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            style={{
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: statusFilter === 'PENDING' ? '#f59e0b' : 'var(--border-color)',
              background: statusFilter === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
              color: statusFilter === 'PENDING' ? '#f59e0b' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Đang Chờ ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            style={{
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: statusFilter === 'IN_PROGRESS' ? '#818cf8' : 'var(--border-color)',
              background: statusFilter === 'IN_PROGRESS' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
              color: statusFilter === 'IN_PROGRESS' ? '#a5b4fc' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Đang Chạy ({inProgressCount})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            style={{
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: statusFilter === 'COMPLETED' ? '#10b981' : 'var(--border-color)',
              background: statusFilter === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
              color: statusFilter === 'COMPLETED' ? '#34d399' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Thành Công ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter('FAILED')}
            style={{
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: statusFilter === 'FAILED' ? '#ef4444' : 'var(--border-color)',
              background: statusFilter === 'FAILED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)',
              color: statusFilter === 'FAILED' ? '#f87171' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Thất Bại ({failedCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.72rem' }}>
              <th style={{ padding: '12px 14px', width: '110px' }}>Mã Thực Thi</th>
              <th style={{ padding: '12px 14px', width: '220px' }}>Playbook</th>
              <th style={{ padding: '12px 14px', width: '160px' }}>Trạng Thái</th>
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
                    {renderStatusBadge(item.status)}
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
                  <div style={{ marginTop: '4px' }}>
                    {renderStatusBadge(selectedExecution.status)}
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
