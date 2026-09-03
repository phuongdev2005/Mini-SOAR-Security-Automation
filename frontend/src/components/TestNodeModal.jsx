import React, { useState, useEffect } from 'react';
import { DEMO_TEST_SCENARIOS } from '../workflow-data';

export default function TestNodeModal({
  node,
  workflow,
  onClose,
  onExecuteTest,
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

  // Initialize inputs
  useEffect(() => {
    const initialInputs = {};
    (node.parameters || []).forEach(p => {
      let val = p.value || '';
      // Resolve references if available in executionOutputs
      if (typeof val === 'string' && val.startsWith('$')) {
        const parts = val.substring(1).split('.');
        if (parts.length === 2) {
          const [sourceId, key] = parts;
          if (executionOutputs[sourceId] && executionOutputs[sourceId][key] !== undefined) {
            val = executionOutputs[sourceId][key];
          }
        }
      }
      initialInputs[p.name] = val;
    });

    if (isTrigger && scenarios.length > 0) {
      const scen = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
      if (scen && scen.payload) {
        Object.assign(initialInputs, scen.payload);
      }
    }

    setInputValues(initialInputs);
    setTestResult(executionOutputs[node.id] || null);
  }, [node, selectedScenarioId, executionOutputs]);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await onExecuteTest(node, inputValues);
      setTestResult(res);
    } catch (err) {
      setTestResult({ error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-content" style={{ maxWidth: '840px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <span className="modal-title">
            🛠️ Kiểm Thử Node Đơn Lẻ: <span style={{ color: 'var(--color-primary)', marginLeft: '6px' }}>{node.label || node.name}</span>
          </span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '18px' }}>
          {/* Left: Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                1. Dữ Liệu Đầu Vào (Input)
              </span>
            </div>

            {/* Scenario Picker for Triggers */}
            {isTrigger && (
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.15)' }}>
                <label className="form-label" style={{ fontSize: '0.72rem', color: '#f59e0b', marginBottom: '4px' }}>
                  🧪 Chọn Kịch Bản Kiểm Thử Mẫu:
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
              {Object.entries(inputValues).map(([key, val]) => (
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
              ))}
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: 'auto', padding: '10px', fontWeight: 600 }}
              onClick={handleRun}
              disabled={isRunning}
            >
              <span>{isRunning ? '⏳ Đang Chạy...' : 'Chạy Thử Node Này'}</span>
            </button>
          </div>

          {/* Right: Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                2. Dữ Liệu Đầu Ra (Output)
              </span>
              <span className="node-badge" style={{ background: testResult ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)', color: testResult ? '#34d399' : '#94a3b8' }}>
                {testResult ? '200 OK' : 'Chưa Chạy'}
              </span>
            </div>

            {testResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Các Biến Xuất Ra:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {Object.entries(testResult).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                      <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>${node.id}.{k}</span>
                      <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(v)}
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
              {testResult ? JSON.stringify(testResult, null, 2) : 'Chưa có kết quả. Nhấn "Chạy Thử Node Này".'}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
