import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflow.css';

import { DEFAULT_APPS, PRESET_WORKFLOWS } from './workflow-data';
import AppHeader from './components/AppHeader';
import AppPalette from './components/AppPalette';
import CustomNode from './components/CustomNode';
import CustomEdge from './components/CustomEdge';
import NodeInspector from './components/NodeInspector';
import TestNodeModal from './components/TestNodeModal';
import HistoryTab from './components/HistoryTab';
import DashboardTab from './components/DashboardTab';

const nodeTypes = {
  customNode: CustomNode
};

const edgeTypes = {
  customEdge: CustomEdge
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState('canvas');
  const [currentPlaybookId, setCurrentPlaybookId] = useState('wf-ssh-01');
  const [playbookData, setPlaybookData] = useState(PRESET_WORKFLOWS['wf-ssh-01']);
  const [apps, setApps] = useState(DEFAULT_APPS);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [testModalNode, setTestModalNode] = useState(null);
  const [isPlaybookRunning, setIsPlaybookRunning] = useState(false);
  const [executionOutputs, setExecutionOutputs] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // 1. Check Authentication Guard
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('soar_token');
      if (!token) {
        window.location.replace('/login');
        return;
      }

      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { 'X-SOAR-SESSION-TOKEN': token },
          credentials: 'same-origin'
        });

        if (!res.ok) {
          localStorage.removeItem('soar_token');
          window.location.replace('/login');
          return;
        }

        const userData = await res.json();
        setCurrentUser(userData);
      } catch (err) {
        console.warn('Auth check network failed:', err);
        localStorage.removeItem('soar_token');
        window.location.replace('/login');
        return;
      } finally {
        setAuthChecking(false);
      }
    };

    verifyAuth();
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('soar_token');
    try {
      if (token) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'X-SOAR-SESSION-TOKEN': token }
        });
      }
    } catch (e) {
      console.warn('Logout error:', e);
    }
    localStorage.removeItem('soar_token');
    localStorage.removeItem('soar_username');
    localStorage.removeItem('soar_role');
    window.location.replace('/login');
  };

  // Transform workflow json to React Flow nodes/edges
  const loadWorkflowIntoCanvas = useCallback((wf) => {
    setPlaybookData(wf);
    setIsPlaybookRunning(wf.status === 'RUNNING' || wf.status === 'EXECUTING');
    const flowNodes = [];

    (wf.triggers || []).forEach(trig => {
      flowNodes.push({
        id: trig.id,
        type: 'customNode',
        position: trig.position || { x: 50, y: 200 },
        data: { node: trig }
      });
    });

    (wf.actions || []).forEach(act => {
      flowNodes.push({
        id: act.id,
        type: 'customNode',
        position: act.position || { x: 300, y: 200 },
        data: { node: act }
      });
    });

    const flowEdges = (wf.branches || []).map(b => ({
      id: b.id || `edge-${b.source_id}-${b.destination_id}`,
      source: b.source_id,
      target: b.destination_id,
      sourceHandle: b.branch_type || (b.label?.toLowerCase().includes('true') ? 'true' : b.label?.toLowerCase().includes('false') ? 'false' : 'output'),
      targetHandle: 'input',
      type: 'customEdge',
      data: { label: b.label || '', branch_type: b.branch_type }
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setNodes, setEdges]);

  // Load playbook from backend or preset
  const loadPlaybook = async (id) => {
    setCurrentPlaybookId(id);
    const token = localStorage.getItem('soar_token') || '';

    if (id === 'wf-custom-new') {
      const newCustomWf = {
        id: `wf-custom-${Date.now().toString(36)}`,
        name: 'Custom Security Playbook',
        description: 'Playbook tùy chỉnh tạo mới trên Canvas',
        triggers: [
          {
            id: 'trig-custom-1',
            name: 'WEBHOOK_TRIGGER',
            label: 'Node 1: Security Alert Webhook',
            app_id: 'app-webhook',
            app_name: 'Webhook Trigger',
            app_type: 'trigger',
            large_image: '/images/apps/webhook.svg',
            position: { x: 80, y: 220 },
            parameters: [
              { name: 'endpoint_url', value: 'http://localhost:8080/api/v1/alerts/ssh', description: 'Webhook Ingestion URL' },
              { name: 'auth_header', value: 'X-SOAR-API-KEY', description: 'Secret Token' }
            ],
            outputs: [
              { name: 'source_ip', example: '185.220.101.5' },
              { name: 'hostname', example: 'srv-prod-ssh' }
            ]
          }
        ],
        actions: [],
        branches: []
      };
      loadWorkflowIntoCanvas(newCustomWf);
      return;
    }

    try {
      const res = await fetch(`/api/v1/workflows/${id}?_t=${Date.now()}`, {
        headers: token ? { 'X-SOAR-SESSION-TOKEN': token } : {}
      });
      if (res.ok) {
        const wf = await res.json();
        loadWorkflowIntoCanvas(wf);
        return;
      }
    } catch (err) {
      console.warn('Cannot load from backend, using preset:', err);
    }

    if (PRESET_WORKFLOWS[id]) {
      loadWorkflowIntoCanvas(PRESET_WORKFLOWS[id]);
    }
  };

  useEffect(() => {
    if (!authChecking && currentUser) {
      loadPlaybook('wf-ssh-01');
    }
  }, [authChecking, currentUser]);

  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      type: 'customEdge',
      data: {
        label: params.sourceHandle === 'true' ? 'TRUE' : params.sourceHandle === 'false' ? 'FALSE' : '',
        branch_type: params.sourceHandle
      }
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((_, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  // Keyboard shortcut: Delete or Backspace to delete selected node or edge
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger delete if typing inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) {
          e.preventDefault();
          setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
          setEdges((eds) => eds.filter((ed) => ed.source !== selectedNode.id && ed.target !== selectedNode.id));
          setSelectedNode(null);
        } else if (selectedEdge) {
          e.preventDefault();
          setEdges((eds) => eds.filter((ed) => ed.id !== selectedEdge.id));
          setSelectedEdge(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdge, setNodes, setEdges]);

  const handleNodeDragStop = useCallback((_, node) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            position: { ...node.position },
            data: {
              ...n.data,
              node: {
                ...n.data.node,
                position: { ...node.position }
              }
            }
          };
        }
        return n;
      });

      // Trigger automatic save to database immediately after dragging
      const token = localStorage.getItem('soar_token') || '';
      const currentWf = {
        id: currentPlaybookId,
        name: playbookData.name || 'Custom Playbook',
        description: playbookData.description || 'SOAR Playbook',
        status: isPlaybookRunning ? 'RUNNING' : 'PAUSED',
        triggers: updatedNodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({
          ...n.data.node,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        })),
        actions: updatedNodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({
          ...n.data.node,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        })),
        branches: edges.map(e => ({
          id: e.id,
          source_id: e.source,
          destination_id: e.target,
          branch_type: e.data?.branch_type || e.sourceHandle || 'default',
          label: e.data?.label || ''
        }))
      };

      fetch(`/api/v1/workflows/${currentPlaybookId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
        },
        body: JSON.stringify(currentWf)
      }).catch((e) => console.warn('Auto-save error:', e));

      return updatedNodes;
    });
  }, [currentPlaybookId, playbookData, edges]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Drop node from palette
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const appData = event.dataTransfer.getData('application/json');
    if (!appData) return;

    const app = JSON.parse(appData);
    const action = (app.actions && app.actions[0]) || {};

    const newNodeId = `node-${Date.now().toString(36)}`;
    const newNode = {
      id: newNodeId,
      name: action.name || app.name,
      label: `${app.name}`,
      app_id: app.id,
      app_name: app.name,
      app_type: app.type || 'action',
      large_image: app.image || '/images/apps/generic.svg',
      parameters: action.parameters ? JSON.parse(JSON.stringify(action.parameters)) : [],
      outputs: action.outputs ? JSON.parse(JSON.stringify(action.outputs)) : []
    };

    let dropPosition = { x: event.clientX - 350, y: event.clientY - 120 };
    if (reactFlowInstance) {
      dropPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
    }

    const flowNode = {
      id: newNodeId,
      type: 'customNode',
      position: { x: Math.round(dropPosition.x), y: Math.round(dropPosition.y) },
      data: { node: newNode }
    };

    setNodes((nds) => {
      const nextNodes = nds.concat(flowNode);
      // Auto-save the new node into MySQL
      const token = localStorage.getItem('soar_token') || '';
      const currentWf = {
        id: currentPlaybookId,
        name: playbookData.name || 'Custom Playbook',
        description: playbookData.description || 'SOAR Playbook',
        triggers: nextNodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({
          ...n.data.node,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        })),
        actions: nextNodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({
          ...n.data.node,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        })),
        branches: edges.map(e => ({
          id: e.id,
          source_id: e.source,
          destination_id: e.target,
          branch_type: e.data?.branch_type || e.sourceHandle || 'default',
          label: e.data?.label || ''
        }))
      };

      fetch(`/api/v1/workflows/${currentPlaybookId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
        },
        body: JSON.stringify(currentWf)
      }).catch(e => console.warn('Add node auto-save failed:', e));

      return nextNodes;
    });
  }, [setNodes, reactFlowInstance, currentPlaybookId, playbookData, edges]);

  const handleAddNodeFromPalette = (app) => {
    const action = (app.actions && app.actions[0]) || {};
    const newNodeId = `node-${Date.now().toString(36)}`;
    const newNode = {
      id: newNodeId,
      name: action.name || app.name,
      label: `${app.name}`,
      app_id: app.id,
      app_name: app.name,
      app_type: app.type || 'action',
      large_image: app.image || '/images/apps/generic.svg',
      parameters: action.parameters ? JSON.parse(JSON.stringify(action.parameters)) : [],
      outputs: action.outputs ? JSON.parse(JSON.stringify(action.outputs)) : []
    };

    const flowNode = {
      id: newNodeId,
      type: 'customNode',
      position: { x: 300 + (nodes.length % 4) * 50, y: 200 + (nodes.length % 4) * 50 },
      data: { node: newNode }
    };

    setNodes((nds) => nds.concat(flowNode));
  };

  const handleUpdateNode = (nodeId, updates) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              node: { ...n.data.node, ...updates }
            }
          };
        }
        return n;
      });

      // Auto-save parameter update to MySQL
      const token = localStorage.getItem('soar_token') || '';
      const currentWf = {
        id: currentPlaybookId,
        name: playbookData.name || 'Custom Playbook',
        description: playbookData.description || 'SOAR Playbook',
        status: isPlaybookRunning ? 'RUNNING' : 'PAUSED',
        triggers: updatedNodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({
          ...n.data.node,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        })),
        actions: updatedNodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({
          ...n.data.node,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
        })),
        branches: edges.map(e => ({
          id: e.id,
          source_id: e.source,
          destination_id: e.target,
          branch_type: e.data?.branch_type || e.sourceHandle || 'default',
          label: e.data?.label || ''
        }))
      };

      fetch(`/api/v1/workflows/${currentPlaybookId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
        },
        body: JSON.stringify(currentWf)
      }).catch((e) => console.warn('Update param auto-save error:', e));

      return updatedNodes;
    });

    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          node: { ...prev.data.node, ...updates }
        }
      }));
    }
  };

  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => {
      const remainingNodes = nds.filter((n) => n.id !== nodeId);
      setEdges((eds) => {
        const remainingEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);

        // Auto-save deletion to MySQL
        const token = localStorage.getItem('soar_token') || '';
        const currentWf = {
          id: currentPlaybookId,
          name: playbookData.name || 'Custom Playbook',
          description: playbookData.description || 'SOAR Playbook',
          triggers: remainingNodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({
            ...n.data.node,
            position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
          })),
          actions: remainingNodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({
            ...n.data.node,
            position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
          })),
          branches: remainingEdges.map(e => ({
            id: e.id,
            source_id: e.source,
            destination_id: e.target,
            branch_type: e.data?.branch_type || e.sourceHandle || 'default',
            label: e.data?.label || ''
          }))
        };

        fetch(`/api/v1/workflows/${currentPlaybookId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
          },
          body: JSON.stringify(currentWf)
        }).then((res) => {
          if (res.ok) {
            showToast('Đã xóa Node và tự động cập nhật CSDL');
          }
        }).catch((e) => console.warn('Delete auto-save failed:', e));

        return remainingEdges;
      });

      return remainingNodes;
    });
    setSelectedNode(null);
  }, [currentPlaybookId, playbookData, setNodes, setEdges]);

  const handleUpdateEdge = (edgeId, updates) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === edgeId) {
          return { ...e, data: { ...e.data, ...updates } };
        }
        return e;
      })
    );
  };

  const handleDeleteEdge = (edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdge(null);
  };

  // Auto Layout
  const handleAutoLayout = () => {
    setNodes((nds) =>
      nds.map((n, idx) => ({
        ...n,
        position: {
          x: 80 + idx * 270,
          y: idx % 2 === 0 ? 220 : 340
        }
      }))
    );
  };

  // Save Playbook to Backend
  const handleSavePlaybook = async (isAuto = false) => {
    const token = localStorage.getItem('soar_token') || '';
    const currentWf = {
      id: currentPlaybookId,
      name: playbookData.name || 'Custom Playbook',
      description: playbookData.description || 'SOAR Playbook',
      triggers: nodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({
        ...n.data.node,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
      })),
      actions: nodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({
        ...n.data.node,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
      })),
      branches: edges.map(e => ({
        id: e.id,
        source_id: e.source,
        destination_id: e.target,
        branch_type: e.data?.branch_type || e.sourceHandle || 'default',
        label: e.data?.label || ''
      }))
    };

    try {
      const res = await fetch(`/api/v1/workflows/${currentPlaybookId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
        },
        body: JSON.stringify(currentWf)
      });
      if (res.ok) {
        showToast(isAuto ? 'Đã tự động lưu Playbook vào CSDL' : 'Lưu Playbook vào CSDL MySQL thành công!');
      } else {
        showToast('Lưu thất bại: ' + res.statusText, 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối Backend: ' + err.message, 'error');
    }
  };

  // Import JSON
  const handleImportJson = () => {
    const raw = prompt('Dán nội dung JSON Playbook vào đây:');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      loadWorkflowIntoCanvas(parsed);
      alert('Nạp JSON thành công!');
    } catch (e) {
      alert('JSON không hợp lệ: ' + e.message);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const currentWf = {
      id: currentPlaybookId,
      name: playbookData.name || 'Custom Playbook',
      description: playbookData.description || 'SOAR Playbook',
      triggers: nodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({ ...n.data.node, position: n.position })),
      actions: nodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({ ...n.data.node, position: n.position })),
      branches: edges.map(e => ({
        id: e.id,
        source_id: e.source,
        destination_id: e.target,
        branch_type: e.data?.branch_type || e.sourceHandle || 'default',
        label: e.data?.label || ''
      }))
    };
    const str = JSON.stringify(currentWf, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPlaybookId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Execute single node test
  const handleExecuteTest = async (node, inputs) => {
    let output = {};
    if (node.app_type === 'trigger') {
      const endpoint = currentPlaybookId.includes('ransomware') ? '/api/v1/alerts/ransomware' : '/api/v1/alerts/ssh';
      const payload = currentPlaybookId.includes('ransomware') ? {
        hostname: inputs.hostname,
        hostIp: inputs.host_ip,
        processName: inputs.process_name,
        processId: inputs.process_id,
        description: inputs.description
      } : {
        sourceIp: inputs.source_ip,
        hostname: inputs.hostname,
        username: inputs.username,
        failedAttempts: Number(inputs.failed_attempts) || 5,
        description: inputs.description
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SOAR-API-KEY': 'SOAR-SECRET-API-KEY-2026' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const real = await res.json();
        setIsPlaybookRunning(true);
        showToast(`🚀 Đã bắn Alert #${real.id} vào RabbitMQ! Playbook đang tự động xử lý...`);
        output = {
          alert_id: real.id,
          source_ip: real.sourceIp || inputs.source_ip,
          hostname: real.hostname,
          severity: real.severity,
          status: real.status || 'NEW',
          created_at: real.createdAt
        };

        // Playbook execution pulse for 6 seconds while RabbitMQ processes
        setTimeout(() => {
          setIsPlaybookRunning(false);
          showToast('✓ Playbook đã hoàn tất quy trình xử lý tự động!');
        }, 6000);
      } else {
        showToast('Bắn Alert thất bại!', 'error');
        output = { status: 'ERROR', error: 'Webhook Ingestion Failed' };
      }
    } else if (node.name === 'CHECK_IP_REPUTATION') {
      const ip = inputs.source_ip || '185.220.101.5';
      const res = await fetch(`/api/v1/actions/check-ip?ip=${encodeURIComponent(ip)}`);
      if (res.ok) {
        output = await res.json();
      }
    } else if (node.name === 'LOOKUP_GEO_LOCATION') {
      output = {
        country: 'Russia',
        country_code: 'RU',
        city: 'Moscow',
        asn: 'AS12389',
        isp: 'Rostelecom PJSC',
        is_private_lan: false,
        ip_analyzed: inputs.source_ip || '185.220.101.5'
      };
    } else if (node.name === 'CALCULATE_DYNAMIC_SEVERITY') {
      const score = Number(inputs.threat_score) || 81;
      const fails = Number(inputs.failed_attempts) || 6;
      output = {
        calculated_severity: 'CRITICAL',
        risk_score: Math.min(100, Math.round(score * 0.7 + fails * 5)),
        threat_level: 'SEV-1_EMERGENCY',
        should_isolate: true
      };
    } else if (node.name === 'BLOCK_IP_IPTABLES') {
      output = {
        command_executed: `iptables -A INPUT -s ${inputs.source_ip || '185.220.101.5'} -j DROP`,
        status: 'SUCCESS',
        ip_blocked: inputs.source_ip || '185.220.101.5',
        action: 'IPTABLES_DROP_ADDED'
      };
    } else if (node.name === 'SEND_SOC_ALERT') {
      try {
        const token = localStorage.getItem('soar_token') || '';
        const msg = inputs.message_html || `<b>[MINI-SOAR MANUAL TEST]</b> Node 8 Telegram Incident Alert is Working!`;
        const res = await fetch('/api/v1/actions/send-telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
          },
          body: JSON.stringify({
            bot_token: inputs.bot_token,
            chat_id: inputs.chat_id,
            message_html: msg
          })
        });
        if (res.ok) {
          output = await res.json();
          showToast('✓ Đã bắn tin nhắn test thật qua Telegram API!');
        } else {
          output = { status: 'ERROR', message: 'Telegram API returned non-200 status' };
        }
      } catch (err) {
        output = { status: 'ERROR', error: err.message };
      }
    } else {
      output = {
        status: 'SUCCESS',
        executed_at: new Date().toISOString(),
        result: 'Node executed successfully'
      };
    }

    setExecutionOutputs(prev => ({
      ...prev,
      [node.id]: output
    }));

    return output;
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-main)', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-primary)' }}>Mini-SOAR Studio</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Đang kiểm tra phiên làm việc SOC...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <AppHeader
        currentPlaybookId={currentPlaybookId}
        onSelectPlaybook={loadPlaybook}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onAutoLayout={handleAutoLayout}
        onImportJson={handleImportJson}
        onExportJson={handleExportJson}
        onSavePlaybook={handleSavePlaybook}
        onSimulate={() => {
          const nextState = !isPlaybookRunning;
          setIsPlaybookRunning(nextState);

          const token = localStorage.getItem('soar_token') || '';
          const currentWf = {
            id: currentPlaybookId,
            name: playbookData.name || 'Custom Playbook',
            description: playbookData.description || 'SOAR Playbook',
            status: nextState ? 'RUNNING' : 'PAUSED',
            triggers: nodes.filter(n => n.data.node.app_type === 'trigger').map(n => ({
              ...n.data.node,
              position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
            })),
            actions: nodes.filter(n => n.data.node.app_type !== 'trigger').map(n => ({
              ...n.data.node,
              position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }
            })),
            branches: edges.map(e => ({
              id: e.id,
              source_id: e.source,
              destination_id: e.target,
              branch_type: e.data?.branch_type || e.sourceHandle || 'default',
              label: e.data?.label || ''
            }))
          };

          fetch(`/api/v1/workflows/${currentPlaybookId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'X-SOAR-SESSION-TOKEN': token } : {})
            },
            body: JSON.stringify(currentWf)
          }).catch(e => console.warn('Toggle status failed:', e));
        }}
        isRunning={isPlaybookRunning}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="app-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'canvas' && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <AppPalette apps={apps} onAddNode={handleAddNodeFromPalette} />

            <div className="canvas-wrapper" onDragOver={onDragOver} onDrop={onDrop} style={{ flex: 1, height: '100%' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onNodeDragStop={handleNodeDragStop}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                fitView
                fitViewOptions={{ padding: 0.25, minZoom: 0.6, maxZoom: 1.0 }}
                onInit={setReactFlowInstance}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1e293b" gap={24} size={1.2} />
                <Controls />
              </ReactFlow>

              {/* Stats Badge */}
              <div className="canvas-stats-badge">
                <div className="stat-item">
                  <span>Triggers:</span>
                  <strong>{nodes.filter(n => n.data.node.app_type === 'trigger').length}</strong>
                </div>
                <div className="stat-item">
                  <span>Actions:</span>
                  <strong>{nodes.filter(n => n.data.node.app_type !== 'trigger').length}</strong>
                </div>
                <div className="stat-item">
                  <span>Liên Kết:</span>
                  <strong>{edges.length}</strong>
                </div>
              </div>
            </div>

            <NodeInspector
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onUpdateEdge={handleUpdateEdge}
              onDeleteEdge={handleDeleteEdge}
              onOpenTestModal={(node) => setTestModalNode(node)}
              testOutputs={executionOutputs}
            />
          </div>
        )}

        {activeTab === 'apps' && (
          <div className="tab-content" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Quản Lý 5 Org Apps & Custom Integrations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {apps.map(app => (
                <div key={app.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={app.image} style={{ width: '32px', height: '32px' }} alt="" />
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{app.name}</h4>
                      <span className={`node-badge ${app.badge || 'badge-action'}`}>{app.category}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{app.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'dashboard' && <DashboardTab />}
      </main>

      {/* Test Node Modal */}
      {testModalNode && (
        <TestNodeModal
          node={testModalNode}
          workflow={playbookData}
          onClose={() => setTestModalNode(null)}
          onExecuteTest={handleExecuteTest}
          executionOutputs={executionOutputs}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`soar-toast soar-toast-${toast.type}`}>
          <span>{toast.type === 'error' ? '❌' : '✓'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
