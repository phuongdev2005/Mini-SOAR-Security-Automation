import React from 'react';

export default function AppHeader({
  currentPlaybookId,
  onSelectPlaybook,
  activeTab,
  onSelectTab,
  onAutoLayout,
  onImportJson,
  onExportJson,
  onSavePlaybook,
  onSimulate,
  isRunning = false,
  currentUser,
  onLogout
}) {
  return (
    <header className="app-header">
      {/* Left: Brand & Selector */}
      <div className="brand-section">
        <a href="/" className="brand-logo" title="Mini-SOAR Security Automation">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <polyline points="9 12 11 14 15 10"></polyline>
          </svg>
          <span>Mini-SOAR</span>
        </a>
        <span className="brand-badge">Builder</span>

        <div className="playbook-selector-group">
          <select
            className="playbook-dropdown"
            value={currentPlaybookId}
            onChange={(e) => onSelectPlaybook(e.target.value)}
          >
            <option value="wf-ssh-01">Playbook 1: SSH Brute-Force Response</option>
            <option value="wf-ransomware-01">Playbook 2: Ransomware Containment</option>
            <option value="wf-custom-new">Tạo Playbook Tùy Chỉnh</option>
          </select>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="header-nav">
        <button
          className={`nav-tab ${activeTab === 'canvas' ? 'active' : ''}`}
          onClick={() => onSelectTab('canvas')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span>Sơ Đồ Luồng</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'apps' ? 'active' : ''}`}
          onClick={() => onSelectTab('apps')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Ứng Dụng</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Lịch Sử</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Giám Sát SOC</span>
        </button>
      </nav>

      {/* Right: Actions */}
      <div className="header-actions">
        <button className="btn btn-secondary btn-compact" title="Tự động căn chỉnh các Node" onClick={onAutoLayout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
          <span>Căn Chỉnh</span>
        </button>

        <button className="btn btn-secondary btn-compact" title="Nạp cấu hình Playbook từ JSON" onClick={onImportJson}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Nhập</span>
        </button>

        <button className="btn btn-secondary btn-compact" title="Xuất Playbook ra file JSON" onClick={onExportJson}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>Xuất</span>
        </button>



        <button
          className={`btn btn-compact ${isRunning ? 'btn-running' : 'btn-primary btn-activate'}`}
          title={isRunning ? 'Playbook đang chạy tự động trong nền' : 'Kích hoạt Playbook'}
          onClick={onSimulate}
        >
          {isRunning ? (
            <>
              {/* Icon 2 gạch (Pause / Running) */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
              <span>Đang Chạy...</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Kích Hoạt</span>
            </>
          )}
        </button>

        <div className="user-auth-wrapper">
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#34d399', background: 'rgba(16,185,129,0.12)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.25)', whiteSpace: 'nowrap' }}>
                {currentUser.username}
              </span>
              <button
                className="btn btn-secondary btn-compact"
                style={{ padding: '4px 8px', color: '#f87171' }}
                title="Đăng xuất tài khoản"
                onClick={onLogout}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          ) : (
            <a href="/login" className="btn btn-secondary btn-compact">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Đăng Nhập</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
