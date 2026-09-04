import React, { useState } from 'react';

export default function AppPalette({ apps, onAddNode }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredApps = apps.filter(app => {
    const term = searchTerm.toLowerCase();
    const nameMatch = app.name.toLowerCase().includes(term);
    const descMatch = (app.description || '').toLowerCase().includes(term);
    const actionMatch = (app.actions || []).some(a => a.name.toLowerCase().includes(term));
    return nameMatch || descMatch || actionMatch;
  });

  const categories = {};
  filteredApps.forEach(app => {
    const cat = app.category || 'Other Apps';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(app);
  });

  const onDragStart = (e, app) => {
    e.dataTransfer.setData('application/json', JSON.stringify(app));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar-palette">
      <div className="palette-header">
        <div className="palette-title-row">
          <span className="palette-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Danh Mục Node & Apps
          </span>
        </div>
        <div className="search-input-wrap">
          <span className="search-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm App hoặc Action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="palette-body">
        {Object.entries(categories).map(([catName, appList]) => (
          <div key={catName} className="palette-category">
            <div className="palette-category-title">{catName}</div>
            {appList.map(app => (
              <div
                key={app.id}
                className="palette-item"
                draggable
                onDragStart={(e) => onDragStart(e, app)}
                onDoubleClick={() => onAddNode(app)}
                title={`Kéo vào canvas hoặc nhấp đúp để thêm ${app.name}`}
              >
                <div className="palette-item-icon">
                  <img src={app.image || '/images/apps/generic.svg'} alt="" />
                </div>
                <div className="palette-item-info">
                  <div className="palette-item-name">{app.name}</div>
                  <div className="palette-item-desc">
                    {app.description || `${app.actions?.length || 0} actions`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
