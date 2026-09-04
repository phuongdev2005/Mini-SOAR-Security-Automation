import React, { useState, useEffect } from 'react';
import { DEMO_TEST_SCENARIOS, resolveValue } from '../workflow-data';

export default function TestNodeModal({
  node,
  workflow,
  onClose,
  onExecuteTest,
  onSyncLatest,
  executionOutputs
}) {
  if (!node) return null;

  const isTrigger = node.app_type === 'trigger';
  const isRansomware = workflow.id?.includes('ransomware');
  const scenarios = isRansomware ? DEMO_TEST_SCENARIOS.ransomware : DEMO_TEST_SCENARIOS.ssh;

  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '');
  const [inputValues, setInputValues] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine effective predecessor node
  const predecessorBranch = (workflow?.branches || []).find(b => (b.destination_id === node.id || b.target === node.id));
  const predParam = (node.parameters || []).find(p => typeof p.value === 'string' && p.value.startsWith('$'));
  const fallbackPredId = predParam ? predParam.value.substring(1).split('.')[0] : null;
  const effectivePredId = predecessorBranch ? (predecessorBranch.source_id || predecessorBranch.source) : fallbackPredId;
  const predecessorOutputs = effectivePredId ? executionOutputs[effectivePredId] : null;

  // Sync latest data from predecessor / backend
  const handleSyncLatest = async () => {
    setIsSyncing(true);
    try {
      if (onSyncLatest) {
        const fresh = await onSyncLatest();
        const merged = { ...executionOutputs, ...fresh };
        const predOut = effectivePredId ? merged[effectivePredId] : null;
        const updated = {};
        (node.parameters || []).forEach(p => {
          let val = p.value || '';
          if (p.name === 'target_value' && (!val || val === '20')) {
            val = isRansomware ? '75' : '65';
          }
          updated[p.name] = resolveValue(val, merged, workflow?.id);
        });

        if (predOut) {
          const predIp = predOut.source_ip || predOut.ip_address || predOut.attacker_ip;
          if (predIp) {
            if (updated.source_ip !== undefined) updated.source_ip = predIp;
            if (updated.attacker_ip !== undefined) updated.attacker_ip = predIp;
            if (updated.ip_address !== undefined) updated.ip_address = predIp;
          }
          if (predOut.hostname && updated.hostname !== undefined) {
            updated.hostname = predOut.hostname;
          }
          if (predOut.total_score !== undefined && updated.source_variable !== undefined) {
            updated.source_variable = predOut.total_score;
          }
        }
        setInputValues(updated);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync if predecessor data is not yet in executionOutputs
  useEffect(() => {
    if (!isTrigger && (!predecessorOutputs || Object.keys(predecessorOutputs).length === 0)) {
      handleSyncLatest();
    }
  }, [node.id, isTrigger]);

  // Initialize inputs
  useEffect(() => {
    const initialInputs = {};
    (node.parameters || []).forEach(p => {
      let val = p.value || '';
      if (p.name === 'target_value' && (!val || val === '20')) {
        val = isRansomware ? '75' : '65';
      }
      initialInputs[p.name] = resolveValue(val, executionOutputs, workflow?.id);
    });

    if (predecessorOutputs) {
      const predIp = predecessorOutputs.source_ip || predecessorOutputs.ip_address || predecessorOutputs.attacker_ip;
      if (predIp) {
        if (initialInputs.source_ip !== undefined) initialInputs.source_ip = predIp;
        if (initialInputs.attacker_ip !== undefined) initialInputs.attacker_ip = predIp;
        if (initialInputs.ip_address !== undefined) initialInputs.ip_address = predIp;
      }
      if (predecessorOutputs.hostname && initialInputs.hostname !== undefined) {
        initialInputs.hostname = predecessorOutputs.hostname;
      }
      if (predecessorOutputs.total_score !== undefined && initialInputs.source_variable !== undefined) {
        initialInputs.source_variable = predecessorOutputs.total_score;
      }
    }

    if (isTrigger && scenarios.length > 0) {
      const scen = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
      if (scen && scen.payload) {
        Object.assign(initialInputs, scen.payload);
      }
    }

    setInputValues(initialInputs);
    setTestResult(executionOutputs[node.id] || null);
  }, [node, selectedScenarioId, executionOutputs, workflow?.id, predecessorOutputs]);

  const handleRun = async (isDemo = false) => {
    setIsRunning(true);
    try {
      const runInputs = { ...inputValues };
      if (isDemo) {
        runInputs.is_demo = true;
        runInputs.api_key = 'DEMO';
      }
      const res = await onExecuteTest(node, runInputs);
      setTestResult(res);
      if (res && res._resolved_inputs) {
        setInputValues(prev => ({ ...prev, ...res._resolved_inputs }));
      }
    } catch (err) {
      setTestResult({ error: err.message, status: 'ERROR', status_code: 500 });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-overlay active" style={{ display: 'flex', opacity: 1, pointerEvents: 'auto', zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '840px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <span className="modal-title">
            {isTrigger ? 'Chạy Playbook' : `Chạy Thử Node: ${node.label || node.name}`}
          </span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '18px' }}>
          {/* Left: Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                {isTrigger ? '1. Dữ Liệu Đầu Vào Alert' : '1. Dữ Liệu Đầu Vào (Input)'}
              </span>
            </div>

            {isTrigger && (
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', background: 'rgba(59, 130, 246, 0.08)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                Bấm nút bên dưới để bắt đầu chạy quy trình tự động hóa Playbook.
              </div>
            )}

            {!isTrigger && effectivePredId && (
              <div style={{ fontSize: '0.74rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>Dữ liệu từ Node trước ({effectivePredId}):</span>
                  <button
                    type="button"
                    onClick={handleSyncLatest}
                    disabled={isSyncing}
                    style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd', borderRadius: '4px', padding: '2px 8px', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600 }}
                    title="Lấy dữ liệu mới nhất từ node trước"
                  >
                    {isSyncing ? 'Đang Lấy...' : 'Lấy Dữ Liệu Mới Nhất'}
                  </button>
                </div>
                {predecessorOutputs && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#34d399', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {predecessorOutputs.source_ip && <span>IP: <strong>{predecessorOutputs.source_ip}</strong></span>}
                    {predecessorOutputs.ip_address && !predecessorOutputs.source_ip && <span>IP: <strong>{predecessorOutputs.ip_address}</strong></span>}
                    {predecessorOutputs.hostname && <span>| Host: <strong>{predecessorOutputs.hostname}</strong></span>}
                    {predecessorOutputs.severity && <span>| Sev: <strong>{predecessorOutputs.severity}</strong></span>}
                    {(predecessorOutputs.total_score !== undefined || predecessorOutputs.risk_score !== undefined) && (
                      <span>| Điểm: <strong>{predecessorOutputs.total_score ?? predecessorOutputs.risk_score}</strong></span>
                    )}
                    {predecessorOutputs.country && <span>| QG: <strong>{predecessorOutputs.country}</strong></span>}
                  </div>
                )}
              </div>
            )}

            {/* Scenario Picker for Triggers */}
            {isTrigger && (
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.15)' }}>
                <label className="form-label" style={{ fontSize: '0.72rem', color: '#f59e0b', marginBottom: '4px' }}>
                  Chọn Kịch Bản Tấn Công Mẫu:
                </label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                >
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
              {Object.entries(inputValues).map(([key, val]) => {
                if (key === 'condition_operator') {
                  const operators = [
                    { value: 'larger than or equal', label: '>= (Lớn hơn hoặc bằng)' },
                    { value: 'larger than', label: '> (Lớn hơn)' },
                    { value: 'less than or equal', label: '<= (Nhỏ hơn hoặc bằng)' },
                    { value: 'less than', label: '< (Nhỏ hơn)' },
                    { value: 'equal', label: '== (Bằng)' },
                    { value: 'not equal', label: '!= (Khác)' }
                  ];
                  return (
                    <div key={key} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>{key}</label>
                      <select
                        className="form-control"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        value={val}
                        onChange={(e) => setInputValues({ ...inputValues, [key]: e.target.value })}
                      >
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={key} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>{key}</label>
                    <input
                      type="text"
                      className="form-control form-control-mono"
                      style={{ fontSize: '0.75rem' }}
                      value={typeof val === 'object' ? JSON.stringify(val) : val}
                      onChange={(e) => setInputValues({ ...inputValues, [key]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px', fontWeight: 600, background: isTrigger ? 'linear-gradient(135deg, #f97316, #ea580c)' : undefined, borderColor: isTrigger ? '#ea580c' : undefined }}
                onClick={() => handleRun(false)}
                disabled={isRunning}
              >
                <span>{isRunning ? 'Đang Chạy...' : isTrigger ? 'Chạy Playbook' : 'Chạy Thử Node Này'}</span>
              </button>

              {(node.app_id === 'app-abuseipdb' || (node.parameters || []).some(p => p.name === 'api_key')) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '10px 12px', fontSize: '0.72rem', fontWeight: 600, borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
                  onClick={() => handleRun(true)}
                  disabled={isRunning}
                  title="Chạy thử với dữ liệu giả lập mô phỏng (không cần API Key thật)"
                >
                  Giả Lập Demo
                </button>
              )}
            </div>
          </div>

          {/* Right: Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {(() => {
              const validOutputs = Object.entries(testResult || {}).filter(([k, v]) => {
                if (k === '_resolved_inputs') return false;
                if (v === null || v === undefined || v === '') return false;
                return true;
              });
              const cleanResult = validOutputs.length > 0 ? Object.fromEntries(validOutputs) : null;
              const hasOutputs = cleanResult !== null;

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                      2. Dữ Liệu Đầu Ra (Output)
                    </span>
                    {(() => {
                      if (!hasOutputs) {
                        return <span className="node-badge" style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' }}>Chưa Chạy</span>;
                      }
                      const isErr = testResult?.error || testResult?.status === 'ERROR' || (testResult?.status_code && testResult.status_code >= 400);
                      if (isErr) {
                        return (
                          <span className="node-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                            {testResult.status_code ? `${testResult.status_code} ERROR` : 'ERROR'}
                          </span>
                        );
                      }
                      if (testResult?.status === 'DEMO_SIMULATED' || testResult?.is_real_api === false) {
                        return (
                          <span className="node-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                            DEMO MOCK
                          </span>
                        );
                      }
                      return (
                        <span className="node-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                          200 OK
                        </span>
                      );
                    })()}
                  </div>

                  {hasOutputs && (testResult?.error || testResult?.status === 'ERROR' || (testResult?.status_code && testResult.status_code >= 400)) && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '0.74rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>❌</span>
                        <span>{testResult.error === 'MISSING_API_KEY' ? 'Thiếu API Key Thực Tế' : `Lỗi Thực Thi: ${testResult.error || 'ERROR'}`}</span>
                      </div>
                      <div style={{ color: '#fca5a5', fontSize: '0.72rem', lineHeight: 1.4 }}>
                        {testResult.message || 'Không thể thực thi node do thiếu cấu hình hoặc lỗi API.'}
                      </div>
                    </div>
                  )}

                  {hasOutputs && !testResult?.error && testResult?.status !== 'ERROR' && (!testResult?.status_code || testResult?.status_code < 400) && (testResult?.status === 'DEMO_SIMULATED' || testResult?.is_real_api === false) && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '0.72rem',
                      color: '#fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>⚠️</span>
                      <span>Chế độ <strong>Giả Lập Demo</strong> (Mô phỏng Threat Intel, không gọi API thật).</span>
                    </div>
                  )}

                  {hasOutputs && cleanResult.branch_taken && (
                    <div style={{
                      background: cleanResult.branch_taken === 'TRUE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      border: `1px solid ${cleanResult.branch_taken === 'TRUE' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '0.74rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}>
                      <div style={{ fontWeight: 700, color: cleanResult.branch_taken === 'TRUE' ? '#34d399' : '#f87171' }}>
                        Kết Quả Đánh Giá: Nhánh {cleanResult.branch_taken} ({cleanResult.status})
                      </div>
                      {cleanResult.matched_condition && (
                        <div style={{ color: '#cbd5e1', fontSize: '0.71rem' }}>
                          Điều kiện: <code>{cleanResult.matched_condition}</code>
                        </div>
                      )}
                      {cleanResult.next_node && (
                        <div style={{ color: '#93c5fd', fontSize: '0.72rem' }}>
                          Rẽ nhánh sang: <strong>{cleanResult.next_node}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {hasOutputs && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Các Biến Xuất Ra:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                        {validOutputs.map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                            <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>${node.id}.{k}</span>
                            <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginTop: '4px' }}>
                    Chi Tiết JSON Output (Response):
                  </div>
                  <div className="terminal-view" style={{ flex: 1, minHeight: '140px', maxHeight: '200px', fontSize: '0.75rem', overflowY: 'auto' }}>
                    {hasOutputs ? JSON.stringify(cleanResult, null, 2) : 'Chưa có kết quả. Nhấn "Chạy Thử Node Này".'}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
