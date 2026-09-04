import React, { useEffect } from 'react';

export default function NodeInspector({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onOpenTestModal,
  testOutputs
}) {
  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="sidebar-inspector">
        <div className="inspector-header">
          <span className="inspector-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Cấu Hình Thuộc Tính Node
          </span>
        </div>
        <div className="inspector-body">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 12px auto', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
              </svg>
            </div>
            <p>Chọn một Node hoặc Liên Kết (Đường nối) trên sơ đồ để xem và chỉnh sửa thông số cấu hình chi tiết.</p>
          </div>
        </div>
      </aside>
    );
  }

  if (selectedEdge) {
    return (
      <aside className="sidebar-inspector">
        <div className="inspector-header">
          <span className="inspector-title">Cấu Hình Liên Kết Nối</span>
        </div>
        <div className="inspector-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Mã Liên Kết</label>
            <input type="text" className="form-control form-control-mono" value={selectedEdge.id} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Node Nguồn (Source)</label>
            <input type="text" className="form-control form-control-mono" value={selectedEdge.source} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Node Đích (Destination)</label>
            <input type="text" className="form-control form-control-mono" value={selectedEdge.target} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Nhãn Điều Kiện Rẽ Nhánh</label>
            <input
              type="text"
              className="form-control"
              value={selectedEdge.data?.label || ''}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
              placeholder="Ví dụ: TRUE (Score >= 65)"
            />
          </div>
          <div style={{ marginTop: '10px' }}>
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => onDeleteEdge(selectedEdge.id)}>
              Xóa Liên Kết Nối
            </button>
          </div>
        </div>
      </aside>
    );
  }

  const node = selectedNode.data.node;
  const isScorer = node.name === 'CALCULATE_DYNAMIC_SEVERITY';
  const nodeOutputs = testOutputs[node.id] || null;

  // Only keep outputs that actually have results
  const availableOutputs = (() => {
    if (!nodeOutputs || typeof nodeOutputs !== 'object' || Object.keys(nodeOutputs).length === 0) {
      return [];
    }

    const list = [];
    const seenKeys = new Set();

    // 1. Check predefined outputs in node.outputs that have actual values
    (node.outputs || []).forEach(out => {
      const val = nodeOutputs[out.name];
      if (val !== undefined && val !== null && val !== '' && out.name !== '_resolved_inputs') {
        list.push({
          ...out,
          value: val
        });
        seenKeys.add(out.name);
      }
    });

    // 2. Also include any extra keys from nodeOutputs that were returned
    Object.entries(nodeOutputs).forEach(([k, v]) => {
      if (!seenKeys.has(k) && v !== undefined && v !== null && v !== '' && k !== '_resolved_inputs') {
        list.push({
          name: k,
          type: typeof v,
          description: `Giá trị trả về (${k})`,
          value: v
        });
        seenKeys.add(k);
      }
    });

    return list;
  })();

  const DEFAULT_FORMULA = 'attempt_weight + geo_weight + threat_weight + history_weight + asset_weight';
  const formulaParam = (node.parameters || []).find(p => p.name === 'scoring_formula');
  const activeFormula = (formulaParam && formulaParam.value && formulaParam.value.trim()) ? formulaParam.value : DEFAULT_FORMULA;

  useEffect(() => {
    if (isScorer && (!formulaParam || !formulaParam.value || !formulaParam.value.trim())) {
      const updatedParams = [...(node.parameters || [])];
      const formulaIndex = updatedParams.findIndex(p => p.name === 'scoring_formula');
      if (formulaIndex >= 0) {
        updatedParams[formulaIndex] = { ...updatedParams[formulaIndex], value: DEFAULT_FORMULA };
      } else {
        updatedParams.unshift({
          name: 'scoring_formula',
          value: DEFAULT_FORMULA,
          description: 'Biểu thức tính điểm tự do (0-100)'
        });
      }
      onUpdateNode(node.id, { parameters: updatedParams });
    }
  }, [node.id, isScorer, formulaParam]);

  const handleParamChangeByName = (paramName, value) => {
    const updatedParams = (node.parameters || []).map(p =>
      p.name === paramName ? { ...p, value } : p
    );
    onUpdateNode(node.id, { parameters: updatedParams });
  };

  const handleFormulaChange = (formula) => {
    const updatedParams = [...(node.parameters || [])];
    const formulaIndex = updatedParams.findIndex(p => p.name === 'scoring_formula');
    if (formulaIndex >= 0) {
      updatedParams[formulaIndex] = { ...updatedParams[formulaIndex], value: formula };
    } else {
      updatedParams.unshift({ name: 'scoring_formula', value: formula, description: 'Biểu thức tính điểm tự do (0-100)' });
    }
    onUpdateNode(node.id, { parameters: updatedParams });
  };

  return (
    <aside className="sidebar-inspector">
      <div className="inspector-header">
        <span className="inspector-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Cấu Hình Thuộc Tính Node
        </span>
      </div>

      <div className="inspector-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="form-group">
          <label className="form-label">Tên Node Hiển Thị</label>
          <input
            type="text"
            className="form-control"
            value={node.label || node.name}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Mã Định Danh (Node ID)</label>
          <input type="text" className="form-control form-control-mono" value={node.id} readOnly />
        </div>

        <div className="form-group">
          <label className="form-label">Ứng Dụng (App)</label>
          <input type="text" className="form-control" value={node.app_name || node.app_id} readOnly />
        </div>

        <div className="form-group">
          <label className="form-label">Action Thực Thi</label>
          <input type="text" className="form-control form-control-mono" value={node.name} readOnly />
        </div>

        {/* Formula Editor for Scorer */}
        {isScorer && (
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0, color: '#60a5fa', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
                </svg>
                <span>Biểu Thức Tính Điểm (Formula Editor)</span>
              </label>
              <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>
                output: total_score (Max 100)
              </span>
            </div>
            
            <textarea
              className="form-control form-control-mono"
              rows="3"
              style={{
                fontSize: '0.82rem',
                lineHeight: 1.45,
                resize: 'vertical',
                color: '#38bdf8',
                background: '#090d16',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                fontWeight: 600
              }}
              value={activeFormula}
              onChange={(e) => handleFormulaChange(e.target.value)}
              placeholder="attempt_weight + geo_weight + threat_weight + history_weight + asset_weight"
            />

            {/* Quick Presets */}
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 500 }}>Preset:</span>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '4px' }}
                onClick={() => handleFormulaChange('attempt_weight + geo_weight + threat_weight + history_weight + asset_weight')}
                title="Công thức chuẩn 5 trọng số SOAR (Max 100đ)"
              >
                Trọng số chuẩn SOAR (100đ)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '4px' }}
                onClick={() => handleFormulaChange('(threat_score * 0.35) + (failed_attempts * 2.5) + (history_penalty || 0) + (is_private_lan ? 0 : 15)')}
                title="Công thức linh hoạt biến số Raw"
              >
                Biến số Raw ($exec)
              </button>
            </div>

            {/* 5 Scoring Components breakdown */}
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                5 Thành phần trọng số tự động:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '4px', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                <span style={{ color: '#fbbf24' }}>• attempt_weight: <b>25đ</b></span>
                <span style={{ color: '#34d399' }}>• geo_weight: <b>15đ</b></span>
                <span style={{ color: '#f87171' }}>• threat_weight: <b>25đ</b></span>
                <span style={{ color: '#c084fc' }}>• history_weight: <b>25đ</b></span>
                <span style={{ color: '#60a5fa' }}>• asset_weight: <b>10đ</b></span>
              </div>
            </div>
          </div>
        )}

        {/* Input Parameters */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Tham Số Đầu Vào ($exec)</label>
            <button
              className="btn btn-secondary btn-compact"
              style={{ fontSize: '0.85rem', width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)', borderRadius: '4px', fontWeight: 700 }}
              onClick={() => {
                const paramName = prompt('Nhập tên tham số mới (ví dụ: custom_param):');
                if (!paramName || !paramName.trim()) return;
                const updatedParams = [...(node.parameters || [])];
                updatedParams.push({
                  name: paramName.trim(),
                  value: '',
                  description: 'Tham số tùy chỉnh'
                });
                onUpdateNode(node.id, { parameters: updatedParams });
              }}
              title="Thêm tham số đầu vào mới"
            >
              +
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(node.parameters || []).filter(p => p.name !== 'scoring_formula').length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '6px' }}>Chưa có tham số nào</div>
            ) : (
              (node.parameters || []).filter(p => p.name !== 'scoring_formula').map((p) => (
                <div key={p.name} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Click để đổi tên tham số"
                        onClick={() => {
                          const newName = prompt('Đổi tên tham số:', p.name);
                          if (newName && newName.trim() && newName.trim() !== p.name) {
                            const updatedParams = (node.parameters || []).map(param =>
                              param.name === p.name ? { ...param, name: newName.trim() } : param
                            );
                            onUpdateNode(node.id, { parameters: updatedParams });
                          }
                        }}
                      >
                        {p.name}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{p.description || ''}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Xóa tham số "${p.name}"?`)) {
                          const updatedParams = (node.parameters || []).filter(param => param.name !== p.name);
                          onUpdateNode(node.id, { parameters: updatedParams });
                        }
                      }}
                      title="Xóa tham số này"
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px' }}
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-control form-control-mono"
                    style={{ fontSize: '0.75rem' }}
                    value={p.value || ''}
                    placeholder="Nhập giá trị hoặc $node.variable..."
                    onChange={(e) => handleParamChangeByName(p.name, e.target.value)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Output Schema & Variables */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Biến Đầu Ra ($output Schema)</label>
            {availableOutputs.length > 0 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--color-primary)' }}>Click để sao chép biến</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {availableOutputs.length === 0 ? (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                Chưa có kết quả đầu ra. Hãy bấm "Chạy Thử Action" bên dưới để lấy kết quả.
              </div>
            ) : (
              availableOutputs.map((out, idx) => {
                const varName = `$${node.id}.${out.name}`;
                return (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        onClick={() => {
                          navigator.clipboard.writeText(varName);
                          alert(`Đã sao chép: ${varName}`);
                        }}
                        title="Click để copy biến"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#34d399', fontWeight: 600, cursor: 'pointer', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                      >
                        {varName}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{out.type || 'any'}</span>
                    </div>
                    {out.description && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{out.description}</div>
                    )}
                    <div style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '3px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>Giá trị:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(out.value)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Test Node Button */}
        <div style={{ marginTop: '4px' }}>
          <button className="btn btn-primary" style={{ width: '100%', padding: '8px 12px', fontWeight: 600 }} onClick={() => onOpenTestModal(node)}>
            <span>Chạy Thử Action (Test Node)</span>
          </button>
        </div>

        {/* Delete Node Button */}
        <div style={{ marginTop: '10px' }}>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => onDeleteNode(node.id)}>
            Xóa Node Này
          </button>
        </div>
      </div>
    </aside>
  );
}
