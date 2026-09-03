import React from 'react';

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
            <div className="empty-state-icon">👆</div>
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

  const handleParamChange = (index, value) => {
    const updatedParams = [...(node.parameters || [])];
    updatedParams[index] = { ...updatedParams[index], value };
    onUpdateNode(node.id, { parameters: updatedParams });
  };

  const handleFormulaChange = (formula) => {
    const updatedParams = [...(node.parameters || [])];
    const formulaIndex = updatedParams.findIndex(p => p.name === 'scoring_formula');
    if (formulaIndex >= 0) {
      updatedParams[formulaIndex] = { ...updatedParams[formulaIndex], value: formula };
    } else {
      updatedParams.push({ name: 'scoring_formula', value: formula, description: 'Biểu thức tính điểm' });
    }
    onUpdateNode(node.id, { parameters: updatedParams });
  };

  const formulaParam = (node.parameters || []).find(p => p.name === 'scoring_formula');

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
          <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0, color: '#60a5fa', fontWeight: 600 }}>
                Biểu Thức Tính Điểm (Formula Editor)
              </label>
              <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                output: total_score
              </span>
            </div>
            <textarea
              className="form-control form-control-mono"
              rows="3"
              style={{ fontSize: '0.78rem', lineHeight: 1.4, resize: 'vertical' }}
              value={formulaParam ? formulaParam.value : ''}
              onChange={(e) => handleFormulaChange(e.target.value)}
              placeholder="attempt_weight + geo_weight + threat_weight + history_weight"
            />
          </div>
        )}

        {/* Input Parameters */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Tham Số Đầu Vào ($exec)</label>
            <button
              className="btn btn-secondary btn-compact"
              style={{ fontSize: '0.7rem', padding: '2px 8px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
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
              + Thêm Tham Số
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(node.parameters || []).length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '6px' }}>Chưa có tham số nào</div>
            ) : (
              (node.parameters || []).map((p, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', cursor: 'pointer' }}
                        title="Click để đổi tên tham số"
                        onClick={() => {
                          const newName = prompt('Đổi tên tham số:', p.name);
                          if (newName && newName.trim() && newName.trim() !== p.name) {
                            const updatedParams = [...(node.parameters || [])];
                            updatedParams[idx] = { ...updatedParams[idx], name: newName.trim() };
                            onUpdateNode(node.id, { parameters: updatedParams });
                          }
                        }}
                      >
                        {p.name} ✎
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{p.description || ''}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Xóa tham số "${p.name}"?`)) {
                          const updatedParams = (node.parameters || []).filter((_, i) => i !== idx);
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
                    onChange={(e) => handleParamChange(idx, e.target.value)}
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
            <span style={{ fontSize: '0.68rem', color: 'var(--color-primary)' }}>Click để sao chép biến</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Render dynamic outputs */}
            {(node.outputs || [
              { name: 'status', type: 'string', example: 'SUCCESS', description: 'Trạng thái thực thi Action' },
              { name: 'result', type: 'object', example: {}, description: 'Dữ liệu JSON kết quả trả về' }
            ]).map((out, idx) => {
              const varName = `$${node.id}.${out.name}`;
              const actualVal = nodeOutputs ? nodeOutputs[out.name] : undefined;
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
                      {varName} 📋
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{out.type || 'any'}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{out.description || ''}</div>
                  {actualVal !== undefined ? (
                    <div style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '3px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>Giá trị:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(actualVal)}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      Ví dụ: <span style={{ color: '#f59e0b' }}>{JSON.stringify(out.example || '')}</span>
                    </div>
                  )}
                </div>
              );
            })}
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
