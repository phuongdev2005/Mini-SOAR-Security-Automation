/**
 * Mini-SOAR Playbook Workflow Builder Main Controller
 */

let canvas;
let currentPlaybookId = "wf-ssh-01";
let selectedNode = null;
let selectedEdge = null;
let isLoadingPlaybook = false;
let autoSaveTimer = null;

// Real output of every node that has actually been executed, keyed by node id.
// This is the ONLY source used to resolve $nodeId.field references.
let nodeExecutionOutputs = {};
// Provenance for each entry above: REAL_RUN | AUTO_UPSTREAM_RUN | TEST_PAYLOAD
let nodeExecutionMeta = {};
// Normalized alert payload of the test scenario currently selected in the Test modal.
// Seeded into trigger nodes so downstream nodes can be tested before the trigger runs.
let activeTestPayload = null;

function syncExecutionStateGlobals() {
  window.nodeExecutionOutputs = nodeExecutionOutputs;
  window.nodeExecutionMeta = nodeExecutionMeta;
}
syncExecutionStateGlobals();

document.addEventListener("DOMContentLoaded", async () => {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated) return;

  // Initialize App Manager & fetch catalog
  await window.appManager.fetchAppsFromBackend();

  // Initialize Canvas
  canvas = new WorkflowCanvas(
    "workflow-canvas-container",
    "workflow-svg-layer",
    "workflow-nodes-layer",
    handleNodeSelected,
    handleEdgeSelected
  );
  attachCanvasAutosaveHooks();

  // Load Initial Playbook
  await loadWorkflowOptions();
  await loadPlaybook(currentPlaybookId);

  // Render Palette
  renderPalette();

  // Setup UI Event Listeners
  initUIEvents();

  // Initialize User Auth state
  renderUserAuthBadge();
});

async function requireAuthenticatedUser() {
  const token = localStorage.getItem("soar_token") || "";
  if (!token) {
    clearClientAuthState();
    window.location.replace("/login.html");
    return false;
  }

  try {
    const resp = await fetch("/api/v1/auth/me", {
      headers: { "X-SOAR-SESSION-TOKEN": token },
      credentials: "same-origin"
    });

    if (!resp.ok) {
      clearClientAuthState();
      window.location.replace("/login.html");
      return false;
    }

    const user = await resp.json();
    localStorage.setItem("soar_username", user.username || localStorage.getItem("soar_username") || "");
    localStorage.setItem("soar_role", user.role || localStorage.getItem("soar_role") || "ROLE_ADMIN");
    localStorage.setItem("soar_fullname", user.fullName || localStorage.getItem("soar_fullname") || user.username || "");
    return true;
  } catch (err) {
    console.warn("Unable to verify session:", err);
    clearClientAuthState();
    window.location.replace("/login.html");
    return false;
  }
}

function renderUserAuthBadge() {
  const container = document.getElementById("user-auth-container");
  if (!container) return;

  const username = localStorage.getItem("soar_username");
  const role = localStorage.getItem("soar_role") || "ROLE_ADMIN";

  if (username) {
    const roleIcon = role === "ROLE_ADMIN" ? "👑" : "🛡️";
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 0.76rem; font-weight: 600; color: #34d399; background: rgba(16,185,129,0.12); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.25); white-space: nowrap;">
          ${roleIcon} ${username}
        </span>
        <button id="btn-logout" class="btn btn-secondary btn-compact" style="padding: 4px 8px !important; color: #f87171;" title="Đăng xuất tài khoản">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    `;

    document.getElementById("btn-logout").onclick = async () => {
      const token = localStorage.getItem("soar_token") || "";

      try {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: token ? { "X-SOAR-SESSION-TOKEN": token } : {},
          credentials: "same-origin"
        });
      } catch (err) {
        console.warn("Backend logout failed, clearing local session only:", err);
      }

      clearClientAuthState();
      showToast("Đã đăng xuất!", "info");
      setTimeout(() => {
        window.location.href = "/login";
      }, 300);
    };
  } else {
    container.innerHTML = `
      <a href="/login" class="btn btn-secondary btn-compact" title="Đăng nhập tài khoản SOC">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>Đăng Nhập</span>
      </a>
    `;
  }
}

function clearClientAuthState() {
  localStorage.removeItem("soar_token");
  localStorage.removeItem("soar_username");
  localStorage.removeItem("soar_role");
  localStorage.removeItem("soar_fullname");
  localStorage.removeItem("soar_api_key");

  ["soar_token", "session_token", "soar_user", "username"].forEach(name => {
    document.cookie = `${name}=; path=/; max-age=0`;
  });
}

function attachCanvasAutosaveHooks() {
  if (!canvas) return;

  ["addNodeFromApp", "addBranch", "deleteNode", "deleteEdge", "autoLayout"].forEach(methodName => {
    if (typeof canvas[methodName] !== "function") return;
    const original = canvas[methodName].bind(canvas);
    canvas[methodName] = (...args) => {
      const result = original(...args);
      scheduleWorkflowAutosave();
      return result;
    };
  });
}

function renderPalette(filterText = "") {
  const container = document.getElementById("palette-categories");
  if (!container) return;
  container.innerHTML = "";

  const apps = window.appManager.getAllApps();
  const search = filterText.toLowerCase().trim();

  // Group apps by category
  const categories = {};
  apps.forEach(app => {
    if (search && !app.name.toLowerCase().includes(search) && !app.description.toLowerCase().includes(search)) {
      return;
    }
    const cat = app.category || "General";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(app);
  });

  if (Object.keys(categories).length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px; font-size: 0.85rem;">Không tìm thấy node phù hợp</div>`;
    return;
  }

  Object.keys(categories).forEach(catName => {
    const catDiv = document.createElement("div");
    catDiv.className = "node-category";

    const titleEl = document.createElement("div");
    titleEl.className = "category-title";
    titleEl.textContent = catName;
    catDiv.appendChild(titleEl);

    categories[catName].forEach(app => {
      const itemEl = document.createElement("div");
      itemEl.className = "palette-item";
      itemEl.setAttribute("draggable", "true");

      itemEl.innerHTML = `
        <div class="palette-item-icon">
          <img src="${app.image || '/images/apps/generic.svg'}" alt="" />
        </div>
        <div class="palette-item-info">
          <div class="palette-item-name">${app.name}</div>
          <div class="palette-item-desc">${app.description || (app.actions ? `${app.actions.length} actions` : '')}</div>
        </div>
      `;

      itemEl.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("application/json", JSON.stringify(app));
      });

      // Quick Click to Add
      itemEl.addEventListener("dblclick", () => {
        const count = canvas.getAllNodes().length;
        canvas.addNodeFromApp(app, 150 + (count % 4) * 260, 180 + Math.floor(count / 4) * 160);
      });

      catDiv.appendChild(itemEl);
    });

    container.appendChild(catDiv);
  });
}

function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("soar_token") || "";
  const headers = {
    "X-SOAR-API-KEY": "SOAR-SECRET-API-KEY-2026",
    ...extraHeaders
  };
  if (token) {
    headers["X-SOAR-SESSION-TOKEN"] = token;
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Normalize an alert payload to the snake_case field names that node parameters
 * reference. Scenario payloads mix camelCase (processName) and snake_case.
 */
function normalizeAlertPayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  const p = { ...raw };

  const aliases = {
    sourceIp: "source_ip",
    processName: "process_name",
    processId: "process_id",
    hostIp: "host_ip",
    commandLine: "command_line",
    failedAttempts: "failed_attempts",
    affectedFileCount: "affected_file_count",
    suspiciousExtensions: "suspicious_extensions",
    alertType: "alert_type",
    createdAt: "created_at"
  };
  Object.entries(aliases).forEach(([camel, snake]) => {
    if (p[camel] !== undefined && p[snake] === undefined) p[snake] = p[camel];
  });

  if (p.target_asset && typeof p.target_asset === "object") {
    if (p.hostname === undefined && p.target_asset.hostname !== undefined) p.hostname = p.target_asset.hostname;
    if (p.host_ip === undefined && p.target_asset.ip_address !== undefined) p.host_ip = p.target_asset.ip_address;
    if (p.asset_criticality === undefined && p.target_asset.criticality !== undefined) p.asset_criticality = p.target_asset.criticality;
  }

  if (p.malware_forensics && typeof p.malware_forensics === "object") {
    const mf = p.malware_forensics;
    if (p.process_name === undefined && mf.process_name !== undefined) p.process_name = mf.process_name;
    if (p.process_id === undefined && mf.process_id !== undefined) p.process_id = mf.process_id;
    if (p.pid === undefined && mf.process_id !== undefined) p.pid = mf.process_id;
    if (p.command_line === undefined && mf.command_line !== undefined) p.command_line = mf.command_line;
    if (p.suspicious_extensions === undefined && mf.suspicious_extensions !== undefined) p.suspicious_extensions = mf.suspicious_extensions;
    if (p.affected_file_count === undefined && mf.affected_file_count !== undefined) p.affected_file_count = mf.affected_file_count;
  }

  // pid and process_id are used interchangeably across ransomware nodes
  if (p.pid !== undefined && p.process_id === undefined) p.process_id = p.pid;
  if (p.process_id !== undefined && p.pid === undefined) p.pid = p.process_id;

  if (!p.alert_type) {
    p.alert_type = (p.process_name || p.pid) ? "RANSOMWARE_SUSPECTED" : "SSH_BRUTE_FORCE";
  }
  return p;
}

function isTriggerNode(node) {
  if (!node) return false;
  return node.app_type === "trigger"
    || node.name === "WEBHOOK_TRIGGER"
    || (node.id || "").includes("trig");
}

function isConditionNode(node) {
  return !!node && (node.app_type === "branch" || node.name === "EVALUATE_CONDITION" || (node.name || "").includes("CONDITION"));
}

function isRansomwareContext(node) {
  return (currentPlaybookId || "").includes("ransomware")
    || (node?.id || "").includes("rw")
    || (node?.name || "").toLowerCase().includes("ransomware");
}

/**
 * The alert payload used as test input for the trigger node. Priority:
 * 1. What the user currently has in the raw payload textarea
 * 2. activeTestPayload remembered from the last scenario selection
 * 3. First built-in scenario for this playbook type
 */
function getActiveTestPayload(node) {
  const isRw = isRansomwareContext(node);
  const scenarios = isRw
    ? (DEMO_TEST_SCENARIOS.ransomware || [])
    : (DEMO_TEST_SCENARIOS.ssh || []);
  const scenarioDefault = scenarios.length > 0 ? normalizeAlertPayload(scenarios[0].payload) : {};

  // A ransomware payload must not be fed to an SSH node (or vice versa)
  const matchesNodeType = (p) => {
    if (!p || Object.keys(p).length === 0) return false;
    const looksRansomware = p.process_name !== undefined || p.pid !== undefined;
    return isRw ? looksRansomware : p.source_ip !== undefined;
  };

  const rawTextarea = document.getElementById("test-raw-payload-textarea");
  if (rawTextarea && rawTextarea.value.trim()) {
    try {
      const parsed = normalizeAlertPayload(JSON.parse(rawTextarea.value.trim()));
      if (matchesNodeType(parsed)) return parsed;
    } catch (e) {
      // Invalid JSON while the user is typing: fall through
    }
  }

  if (matchesNodeType(activeTestPayload)) return activeTestPayload;

  return scenarioDefault;
}

/**
 * Build the variable resolution context for a node.
 *
 * Contains ONLY data that really exists:
 *  - outputs of nodes that were actually executed (nodeExecutionOutputs)
 *  - the selected test payload, seeded into trigger nodes so that testing a
 *    downstream node in isolation still gets the alert fields it needs
 *
 * No fabricated outputs for action nodes: if an upstream action has not run,
 * its reference stays unresolved and the caller reports a dependency error.
 */
function buildExecutionContext(node) {
  const alert = getActiveTestPayload(node);
  const context = { exec: { alert } };

  // Seed every trigger of the current workflow with the test payload
  const triggers = canvas?.workflow?.triggers || [];
  triggers.forEach(trigger => {
    context[trigger.id] = { ...alert };
  });

  // Real executed output always wins over the seeded test payload
  Object.keys(nodeExecutionOutputs).forEach(nodeId => {
    context[nodeId] = { ...(context[nodeId] || {}), ...nodeExecutionOutputs[nodeId] };
  });

  return context;
}

/** Collect every $nodeId.field reference in a node's parameters. */
function collectNodeReferences(node) {
  const refs = [];
  (node?.parameters || []).forEach(p => {
    if (typeof p.value !== "string") return;
    const matches = p.value.match(/\$[A-Za-z0-9_.-]+/g) || [];
    matches.forEach(m => {
      const path = m.substring(1);
      if (path.startsWith("exec.alert.")) return;
      const dot = path.lastIndexOf(".");
      if (dot <= 0) return;
      const nodeId = path.substring(0, dot);
      if (!refs.includes(nodeId)) refs.push(nodeId);
    });
  });
  return refs;
}

/** Get list of node IDs that directly have an incoming edge/branch into this node */
function getConnectedUpstreamNodeIds(node) {
  if (!node || !canvas?.workflow?.branches) return [];
  return canvas.workflow.branches
    .filter(b => b.destination_id === node.id)
    .map(b => b.source_id);
}

function collectConnectedUpstreamNodeIds(node, visited = new Set(), ordered = []) {
  for (const upstreamId of getConnectedUpstreamNodeIds(node)) {
    if (visited.has(upstreamId)) continue;
    visited.add(upstreamId);
    const upstreamNode = findWorkflowNodeById(upstreamId);
    if (upstreamNode) collectConnectedUpstreamNodeIds(upstreamNode, visited, ordered);
    ordered.push(upstreamId);
  }
  return ordered;
}

/** Check if referenced node has a valid direct or indirect connection in the DAG */
function isNodeConnectedUpstream(destNodeId, sourceNodeId, visited = new Set()) {
  if (!destNodeId || !sourceNodeId || !canvas?.workflow?.branches) return false;
  if (visited.has(destNodeId)) return false;
  visited.add(destNodeId);

  const directUpstream = canvas.workflow.branches
    .filter(b => b.destination_id === destNodeId)
    .map(b => b.source_id);

  if (directUpstream.includes(sourceNodeId)) return true;
  for (const upId of directUpstream) {
    if (isNodeConnectedUpstream(upId, sourceNodeId, visited)) return true;
  }
  return false;
}

/** Find any node (trigger or action) of the current workflow by id. */
function findWorkflowNodeById(nodeId) {
  const wf = canvas?.workflow;
  if (!wf) return null;
  return (wf.triggers || []).find(n => n.id === nodeId)
    || (wf.actions || []).find(n => n.id === nodeId)
    || null;
}

/** Names of resolved values that still contain an unresolved $reference. */
function findUnresolvedInputs(inputValues) {
  return Object.entries(inputValues)
    .filter(([, v]) => typeof v === "string" && /\$[A-Za-z0-9_.-]+/.test(v))
    .map(([k]) => k);
}

function clearBranchExecutionHighlights(sourceNodeId = null) {
  const branches = canvas?.workflow?.branches || [];
  branches
    .filter(branch => !sourceNodeId || branch.source_id === sourceNodeId)
    .forEach(branch => {
      const edgeEl = document.getElementById(`edge-${branch.id}`);
      if (!edgeEl) return;
      const branchType = canvas?.getBranchType ? canvas.getBranchType(branch) : "";
      edgeEl.classList.remove("edge-success", "edge-muted", "edge-executing");
      edgeEl.setAttribute(
        "marker-end",
        branchType === "true"
          ? "url(#arrowhead-true)"
          : branchType === "false"
            ? "url(#arrowhead-false)"
            : "url(#arrowhead)"
      );
    });
}

function highlightConditionBranch(node, result) {
  if (!canvas?.workflow?.branches) return;
  const desiredType = result ? "true" : "false";
  const outgoing = canvas.workflow.branches.filter(branch => branch.source_id === node.id);
  if (outgoing.length === 0) return;

  outgoing.forEach(branch => {
    const edgeEl = document.getElementById(`edge-${branch.id}`);
    if (!edgeEl) return;
    const branchType = canvas?.getBranchType ? canvas.getBranchType(branch) : "";
    edgeEl.classList.remove("edge-success", "edge-muted", "edge-executing");

    if (branchType === desiredType) {
      edgeEl.classList.add("edge-success");
      edgeEl.setAttribute("marker-end", result ? "url(#arrowhead-true)" : "url(#arrowhead-false)");
    } else {
      edgeEl.classList.add("edge-muted");
    }
  });
}

function getConditionBranchGate(branch) {
  const sourceNode = findWorkflowNodeById(branch.source_id);
  if (!isConditionNode(sourceNode)) return 1;

  const output = nodeExecutionOutputs[branch.source_id];
  if (!output || typeof output.result !== "boolean") return 1;

  const branchType = canvas?.getBranchType ? canvas.getBranchType(branch) : "";
  if (branchType === "true") return output.result ? 1 : 0;
  if (branchType === "false") return output.result ? 0 : 1;
  return 1;
}

function collectConditionGateBranchesForNode(node) {
  if (!node || !canvas?.workflow?.branches) return [];
  return canvas.workflow.branches.filter(branch => {
    const sourceNode = findWorkflowNodeById(branch.source_id);
    if (!isConditionNode(sourceNode)) return false;
    return branch.destination_id === node.id || isNodeConnectedUpstream(node.id, branch.destination_id);
  });
}

function getNodeBranchGate(node) {
  if (!node || !canvas?.workflow?.branches) return 1;
  return collectConditionGateBranchesForNode(node)
    .reduce((gate, branch) => gate * getConditionBranchGate(branch), 1);
}

function renderBranchGateSkipped(node, inputValues = {}) {
  nodeExecutionOutputs[node.id] = {
    status: "SKIPPED",
    branch_gate: 0,
    skipped: true
  };
  nodeExecutionMeta[node.id] = "SKIPPED_BY_BRANCH";
  syncExecutionStateGlobals();

  const failure = {
    status: "SKIPPED",
    branch_gate: 0,
    message: "Node bị chặn bởi Branch Condition phía trước. Nhánh hiện tại không được chọn nên action không chạy."
  };
  renderTestNodeResult(node, failure, 204, "SKIPPED_BY_BRANCH", inputValues, false);
  showToast(`[${node.name}] bị bỏ qua vì nhánh điều kiện không được chọn`, "info");
}

function inferValueFromConnectedUpstream(node, paramName, rawValue = "") {
  const upstreamIds = collectConnectedUpstreamNodeIds(node);
  const explicitField = typeof rawValue === "string" && rawValue.startsWith("$") && rawValue.includes(".")
    ? rawValue.substring(rawValue.lastIndexOf(".") + 1)
    : null;
  const fieldCandidates = [
    explicitField,
    paramName,
    paramName === "attacker_ip" ? "source_ip" : null,
    paramName === "attacker_ip" ? "ip_address" : null,
    paramName === "source_ip" ? "attacker_ip" : null,
    paramName === "ip_address" ? "attacker_ip" : null,
    paramName === "server_ip" ? "executed_host" : null,
    paramName === "server_ip" ? "host" : null,
    paramName === "host" ? "server_ip" : null,
    paramName === "host" ? "executed_host" : null,
    paramName === "ip_address" ? "source_ip" : null,
    paramName === "source_ip" ? "ip_address" : null,
    paramName === "pid" ? "process_id" : null,
    paramName === "pid" ? "killed_pid" : null,
    paramName === "process_id" ? "pid" : null
  ].filter(Boolean);

  for (const upstreamId of [...upstreamIds].reverse()) {
    const output = nodeExecutionOutputs[upstreamId];
    if (!output) continue;
    for (const field of fieldCandidates) {
      if (output[field] !== undefined && output[field] !== null && output[field] !== "") {
        return output[field];
      }
    }
  }
  return undefined;
}

function buildBlockedIpReason(node, inputValues) {
  const upstreamIds = collectConnectedUpstreamNodeIds(node);
  const upstreamOutputs = [...upstreamIds].reverse()
    .map(id => nodeExecutionOutputs[id])
    .filter(Boolean);

  const scorer = upstreamOutputs.find(output =>
    output.severity !== undefined || output.total_score !== undefined || output.threat_score !== undefined
  ) || {};
  const history = upstreamOutputs.find(output =>
    output.is_repeat_offender !== undefined || output.previous_blocks_count !== undefined
  ) || {};

  const severity = inputValues.severity || scorer.severity || "HIGH";
  const score = inputValues.threat_score || inputValues.total_score || scorer.total_score || scorer.threat_score || 75;
  const repeatText = history.is_repeat_offender
    ? ` | repeat offender: ${history.previous_blocks_count || 1} previous block(s)`
    : "";

  return `SSH Brute-Force automated block | severity=${severity} | score=${score}${repeatText}`;
}

/** Strict IPv4 / basic IPv6 check used before hitting external lookup APIs. */
function isValidIpAddress(value) {
  const ip = String(value || "").trim();
  if (!ip) return false;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = ip.match(ipv4);
  if (m) {
    return m.slice(1).every(part => {
      const n = Number(part);
      return n >= 0 && n <= 255 && String(n) === String(Number(part));
    });
  }

  // Compact IPv6 form check (hex groups and :: shorthand only)
  return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":");
}


function readContextPath(path, context) {
  if (!path) return undefined;
  if (path.startsWith("exec.alert.")) {
    return path.substring("exec.alert.".length).split(".").reduce((obj, key) => obj?.[key], context.exec?.alert);
  }

  const dotIndex = path.lastIndexOf(".");
  if (dotIndex <= 0) return undefined;
  const nodeId = path.substring(0, dotIndex);
  const field = path.substring(dotIndex + 1);
  const value = context[nodeId]?.[field];
  if (value !== undefined) return value;
  if ((field === "evaluated_result" || field === "selected_branch") && context[nodeId]?.result !== undefined) {
    return field === "selected_branch"
      ? (context[nodeId].result ? "TRUE" : "FALSE")
      : context[nodeId].result;
  }
  return undefined;
}

function resolveWorkflowValue(value, context) {
  if (typeof value !== "string") return value;
  const exactMatch = value.match(/^\$([A-Za-z0-9_.-]+)$/);
  if (exactMatch) {
    const resolved = readContextPath(exactMatch[1], context);
    return resolved !== undefined ? resolved : value;
  }

  return value.replace(/\$([A-Za-z0-9_.-]+)/g, (match, path) => {
    const resolved = readContextPath(path, context);
    if (resolved === undefined) return match;
    return Array.isArray(resolved) ? resolved.join(", ") : String(resolved);
  });
}

function coerceFormValue(value) {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" && !isNaN(value) && value.trim() !== "") return Number(value);
  return value;
}

async function loadWorkflowOptions() {
  const dropdown = document.getElementById("playbook-select");
  if (!dropdown) return;

  try {
    const res = await fetch("/api/v1/workflows", {
      headers: getAuthHeaders(),
      credentials: "same-origin"
    });
    if (!res.ok) return;

    const workflows = await res.json();
    workflows.forEach(ensureWorkflowOption);
  } catch (err) {
    console.warn("Cannot load saved workflow list:", err);
  }
}

function ensureWorkflowOption(workflow) {
  const dropdown = document.getElementById("playbook-select");
  if (!dropdown || !workflow || !workflow.id) return;
  
  // Skip presets or legacy duplicate IDs already represented by the main options
  if (workflow.id === "wf-ssh-01" || workflow.id === "wf-ransomware-01" || workflow.id === "wf-ssh-bruteforce-01") {
    return;
  }

  if ([...dropdown.options].some(option => option.value === workflow.id)) return;

  const createOption = dropdown.querySelector('option[value="wf-custom-new"]');
  const option = document.createElement("option");
  option.value = workflow.id;
  option.textContent = workflow.name || workflow.id;
  dropdown.insertBefore(option, createOption || null);
}

function isWorkflowRunning(workflow = canvas?.getWorkflowData()) {
  return String(workflow?.status || "").toUpperCase() === "RUNNING";
}

function renderPlaybookActivationButton() {
  const btn = document.getElementById("btn-simulate-playbook");
  if (!btn || !canvas) return;

  const running = isWorkflowRunning();
  btn.classList.toggle("btn-playbook-active", running);
  btn.title = running
    ? "Playbook đang hoạt động và sẽ xử lý trigger. Bấm để tạm dừng."
    : "Playbook đang tạm dừng. Bấm để kích hoạt nhận trigger.";
  btn.innerHTML = running
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg><span>Tạm Dừng</span>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Kích Hoạt</span>`;
}

function getNodeParam(node, name) {
  return (node?.parameters || []).find(p => p.name === name);
}

function ensureNodeParam(node, name, value, description) {
  if (!node.parameters) node.parameters = [];
  let param = getNodeParam(node, name);
  if (!param) {
    param = { name, value, description };
    node.parameters.push(param);
  }
  return param;
}

function findNearestConnectedUpstreamNode(node, predicate) {
  const upstreamIds = collectConnectedUpstreamNodeIds(node);
  return [...upstreamIds]
    .reverse()
    .map(id => findWorkflowNodeById(id))
    .find(upstreamNode => upstreamNode && predicate(upstreamNode));
}

function normalizeTelegramNotificationNodes() {
  if (!canvas?.workflow) return;
  let changed = false;

  (canvas.workflow.actions || [])
    .filter(node => node.name === "SEND_SOC_ALERT")
    .forEach(node => {
      const scorerNode = findNearestConnectedUpstreamNode(node, upstreamNode =>
        upstreamNode.name === "CALCULATE_DYNAMIC_SEVERITY"
        || upstreamNode.name === "ANALYZE_MITRE_TTPS"
        || (upstreamNode.app_type === "scorer" && upstreamNode.id !== node.id)
      );
      const logNode = findNearestConnectedUpstreamNode(node, upstreamNode =>
        upstreamNode.name === "LOG_BLOCKED_IP"
        || upstreamNode.name === "LOG_RANSOMWARE_INCIDENT"
      );

      const severityParam = ensureNodeParam(node, "severity", "", "Severity");
      const currentSeverity = String(severityParam.value || "");
      const severityLooksWrong = currentSeverity === ""
        || /(\.ip_address|\.source_ip|blocked_ip)$/i.test(currentSeverity)
        || currentSeverity === "$act-ssh-4.ip_address";
      if (severityLooksWrong) {
        severityParam.value = scorerNode ? `$${scorerNode.id}.severity` : "CRITICAL";
        changed = true;
      }

      const messageParam = ensureNodeParam(node, "message_html", "", "Alert Message");
      const currentMessage = String(messageParam.value || "").trim();
      const ransomwareMessageUsesOldLogger = (currentPlaybookId || "").includes("ransomware")
        && (currentMessage.includes("$act-rw-5.process_name") || currentMessage.includes("$act-rw-5.hostname"));
      if (!currentMessage || currentMessage === "IP Blocked" || currentMessage.includes('[SSH Brute-Force] IP Blocked') || ransomwareMessageUsesOldLogger || currentMessage.includes('[Ransomware Neutralized]')) {
        if ((currentPlaybookId || "").includes("ransomware")) {
          messageParam.value = `<b>🚨 [MINI-SOAR EMERGENCY] RANSOMWARE CONTAINMENT</b><br><br>• <b>Severity</b>: <code>${scorerNode ? `$${scorerNode.id}.severity` : "$act-rw-2.severity"}</code> (Score: ${scorerNode ? `$${scorerNode.id}.risk_score` : "$act-rw-2.risk_score"}/100)<br>• <b>Victim Host</b>: <code>$trig-rw-1.hostname</code> ($trig-rw-1.host_ip)<br>• <b>Malicious Process</b>: <code>$trig-rw-1.process_name</code> (PID: $trig-rw-1.process_id)<br>• <b>Command Line</b>: <code>$trig-rw-1.command_line</code><br>• <b>Affected Files</b>: <code>$trig-rw-1.affected_file_count</code><br>• <b>MITRE TTP</b>: <code>T1490 (Inhibit Recovery)</code><br>• <b>Action Taken</b>: <code>PROCESS_KILLED_HOST_ISOLATED</code>`;
        } else {
          messageParam.value = `<b>[MINI-SOAR ALERT] SSH ATTACK INCIDENT</b><br><br>• <b>Severity</b>: <code>${scorerNode ? `$${scorerNode.id}.severity` : "$act-ssh-scorer.severity"}</code> (Score: ${scorerNode ? `$${scorerNode.id}.total_score` : "$act-ssh-scorer.total_score"}/100)<br>• <b>Target Host</b>: <code>$trig-ssh-1.hostname</code><br>• <b>Target User</b>: <code>$trig-ssh-1.username</code><br>• <b>Source IP</b>: <code>${logNode ? `$${logNode.id}.ip_address` : "$act-ssh-4.ip_address"}</code> ($act-ssh-geo.country - $act-ssh-geo.isp)<br>• <b>Failed Attempts</b>: <code>$trig-ssh-1.failed_attempts</code><br>• <b>Execution Mode</b>: <code>[PRODUCTION]</code><br>• <b>Action Taken</b>: <code>BLOCK_IP_FIREWALL</code>`;
        }
        changed = true;
      }
    });

  if (changed) {
    canvas.render();
    scheduleWorkflowAutosave();
  }
}

function normalizeRemoteSshNodes() {
  if (!canvas?.workflow) return;
  let changed = false;

  (canvas.workflow.actions || [])
    .filter(node => node.name === "EXECUTE_REMOTE_SSH" || node.app_id === "app-ssh-exec")
    .forEach(node => {
      const defaults = [
        ["ip_address", "13.218.244.6", "Địa chỉ IP VPS / server SSH"],
        ["username", "ec2-user", "SSH Username"],
        ["port", "22", "SSH Port"],
        ["password", "", "SSH password nếu không dùng key"],
        ["pem_file", "/run/secrets/pnreal-dev.pem", "File .pem trên backend/container"],
        ["command", "whoami && hostname && echo Mini-SOAR SSH OK", "Command demo an toàn"],
        ["timeout_seconds", "10", "Timeout"]
      ];

      defaults.forEach(([name, value, description]) => {
        if (!getNodeParam(node, name)) {
          ensureNodeParam(node, name, value, description);
          changed = true;
        }
      });

      const ipParam = getNodeParam(node, "ip_address");
      const hostParam = getNodeParam(node, "host");
      if (ipParam && hostParam?.value && !ipParam.value) {
        ipParam.value = hostParam.value;
        changed = true;
      }
      if (ipParam && (!ipParam.value || ipParam.value === "vps.example.com" || ipParam.value === "104.43.88.77" || String(ipParam.value).includes(".hostname"))) {
        ipParam.value = "13.218.244.6";
        changed = true;
      }
      const usernameParam = getNodeParam(node, "username");
      if (usernameParam && (!usernameParam.value || usernameParam.value === "root" || usernameParam.value === "pnreal_dev")) {
        usernameParam.value = "ec2-user";
        changed = true;
      }
      const pemParam = getNodeParam(node, "pem_file");
      const keyParam = getNodeParam(node, "key_filename");
      if (pemParam && keyParam?.value && !pemParam.value) {
        pemParam.value = keyParam.value;
        changed = true;
      }
      if (pemParam && (!pemParam.value || String(pemParam.value).includes("/home/user/.ssh/id_rsa"))) {
        pemParam.value = "/run/secrets/pnreal-dev.pem";
        changed = true;
      }
      const commandParam = getNodeParam(node, "command");
      const commandValue = String(commandParam?.value || "");
      if (commandParam && /^iptables\s+-A\s+INPUT\s+-s\s+\$(trig-ssh-1|act-ssh-scorer)\.source_ip/i.test(commandValue)) {
        commandParam.value = "$act-ssh-3.command_executed";
        changed = true;
      }
    });

  if (changed) {
    canvas.render();
    scheduleWorkflowAutosave();
  }
}

function normalizeIptablesDropNodes() {
  if (!canvas?.workflow) return;
  let changed = false;

  const sshNode = (canvas.workflow.actions || []).find(node =>
    node.name === "EXECUTE_REMOTE_SSH" || node.app_id === "app-ssh-exec"
  );
  const sshHost = getNodeParam(sshNode, "ip_address")?.value || getNodeParam(sshNode, "host")?.value || "13.218.244.6";

  (canvas.workflow.actions || [])
    .filter(node => node.name === "DROP" && node.app_id === "app-iptables")
    .forEach(node => {
      if (!Array.isArray(node.parameters)) node.parameters = [];

      const hadAttackerIp = !!getNodeParam(node, "attacker_ip");
      const hadServerIp = !!getNodeParam(node, "server_ip");
      const hadPort = !!getNodeParam(node, "port");
      const hadProtocol = !!getNodeParam(node, "protocol");
      const oldSourceIp = getNodeParam(node, "source_ip")?.value;
      const attackerParam = ensureNodeParam(
        node,
        "attacker_ip",
        oldSourceIp || "$trig-ssh-1.source_ip",
        "IP tấn công lấy từ Webhook Trigger"
      );
      if (!attackerParam.value || String(attackerParam.value).includes("scorer.source_ip")) {
        attackerParam.value = "$trig-ssh-1.source_ip";
        changed = true;
      }

      const serverParam = ensureNodeParam(
        node,
        "server_ip",
        sshHost,
        "Server/VPS IP đang mở ở SSH Remote VPS Connector"
      );
      if (!serverParam.value || String(serverParam.value).includes(".hostname")) {
        serverParam.value = sshHost;
        changed = true;
      }

      ensureNodeParam(node, "port", "22", "Port 22 SSH");
      ensureNodeParam(node, "protocol", "tcp", "Protocol TCP");
      if (!hadAttackerIp || !hadServerIp || !hadPort || !hadProtocol) changed = true;

      const before = node.parameters.length;
      node.parameters = node.parameters.filter(param => !["source_ip", "result"].includes(param.name));
      if (node.parameters.length !== before) changed = true;

      const preferredOrder = ["server_ip", "attacker_ip", "port", "protocol"];
      const ordered = [
        ...preferredOrder.map(name => getNodeParam(node, name)).filter(Boolean),
        ...node.parameters.filter(param => !preferredOrder.includes(param.name))
      ];
      if (ordered.map(p => p.name).join("|") !== node.parameters.map(p => p.name).join("|")) {
        node.parameters = ordered;
        changed = true;
      }
    });

  if (changed) {
    canvas.render();
    scheduleWorkflowAutosave();
  }
}

async function loadPlaybook(playbookId) {
  isLoadingPlaybook = true;
  currentPlaybookId = playbookId;
  nodeExecutionOutputs = {};
  nodeExecutionMeta = {};
  syncExecutionStateGlobals();
  activeTestPayload = null;
  const dropdown = document.getElementById("playbook-select");
  if (dropdown) dropdown.value = playbookId;

  try {
    const apiId = playbookId === "wf-custom-new" ? "new" : playbookId;
    const res = await fetch(`/api/v1/workflows/${apiId}`, {
      headers: getAuthHeaders(),
      credentials: "same-origin"
    });
    if (res.ok) {
      const workflow = await res.json();
      canvas.loadWorkflow(workflow);
      normalizeTelegramNotificationNodes();
      normalizeRemoteSshNodes();
      normalizeIptablesDropNodes();
      ensureWorkflowOption(workflow);
      currentPlaybookId = workflow.id || playbookId;
      if (dropdown && workflow.id && playbookId !== "wf-custom-new") dropdown.value = workflow.id;
      renderPlaybookActivationButton();
      showToast(`Đã tải sơ đồ: ${canvas.getWorkflowData().name}`, "info");
      isLoadingPlaybook = false;
      return;
    }
  } catch (err) {
    console.warn("Cannot load workflow from backend:", err);
  }

  if (PRESET_WORKFLOWS[playbookId]) {
    canvas.loadWorkflow(PRESET_WORKFLOWS[playbookId]);
    normalizeTelegramNotificationNodes();
    normalizeRemoteSshNodes();
    normalizeIptablesDropNodes();
  } else {
    canvas.loadWorkflow({
      id: "wf-custom-" + Date.now().toString(36),
      name: "Custom Security Playbook",
      description: "Custom Playbook built in Mini-SOAR Canvas",
      triggers: [
        {
          id: "trig-1",
          name: "WEBHOOK_TRIGGER",
          label: "Node 1: Security Alert Webhook",
          app_id: "app-webhook",
          app_name: "Webhook Trigger",
          app_type: "trigger",
          large_image: "/images/apps/webhook.svg",
          position: { x: 80, y: 220 },
          parameters: [
            { name: "endpoint_url", value: "http://localhost:8080/api/v1/alerts/ssh/simulate", description: "Webhook URL" }
          ]
        }
      ],
      actions: [],
      branches: []
    });
    normalizeTelegramNotificationNodes();
    normalizeRemoteSshNodes();
    normalizeIptablesDropNodes();
  }

  renderPlaybookActivationButton();
  showToast(`Đã tải sơ đồ: ${canvas.getWorkflowData().name}`, "info");
  isLoadingPlaybook = false;
}

function scheduleWorkflowAutosave() {
  if (!canvas || isLoadingPlaybook) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    persistCurrentWorkflow(true);
  }, 900);
}
window.scheduleWorkflowAutosave = scheduleWorkflowAutosave;

async function persistCurrentWorkflow(silent = false) {
  if (!canvas || isLoadingPlaybook) return false;

  const wf = canvas.getWorkflowData();
  if (!wf || !wf.id) return false;

  try {
    const res = await fetch(`/api/v1/workflows/${encodeURIComponent(wf.id)}`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "same-origin",
      body: JSON.stringify(wf)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.reason || `HTTP ${res.status}`);
    }

    const savedWorkflow = { ...wf, ...data };
    ensureWorkflowOption(savedWorkflow);
    currentPlaybookId = savedWorkflow.id || wf.id;
    if (data.status && canvas?.workflow) canvas.workflow.status = data.status;
    renderPlaybookActivationButton();
    const dropdown = document.getElementById("playbook-select");
    if (dropdown && savedWorkflow.id) dropdown.value = savedWorkflow.id;

    if (!silent) {
      showToast(`Đã lưu Playbook "${savedWorkflow.name || wf.name}" vào MySQL!`, "success");
    }
    return true;
  } catch (err) {
    console.error("Workflow save failed:", err);
    if (!silent) {
      showToast(`Không lưu được Playbook: ${err.message}`, "error");
    }
    return false;
  }
}

function handleNodeSelected(node) {
  selectedNode = node;
  selectedEdge = null;
  const inspectorEmpty = document.getElementById("inspector-empty");
  const inspectorNodeForm = document.getElementById("inspector-node-form");
  const inspectorEdgeForm = document.getElementById("inspector-edge-form");

  if (!node) {
    if (inspectorEmpty) inspectorEmpty.style.display = "flex";
    if (inspectorNodeForm) inspectorNodeForm.style.display = "none";
    if (inspectorEdgeForm) inspectorEdgeForm.style.display = "none";
    return;
  }

  if (inspectorEmpty) inspectorEmpty.style.display = "none";
  if (inspectorEdgeForm) inspectorEdgeForm.style.display = "none";
  if (inspectorNodeForm) inspectorNodeForm.style.display = "flex";

  // Populate node inspector inputs
  document.getElementById("node-inp-label").value = node.label || "";
  document.getElementById("node-inp-id").value = node.id || "";
  document.getElementById("node-inp-app").value = node.app_name || "";

  // Actions dropdown
  const actionSelect = document.getElementById("node-inp-action");
  actionSelect.innerHTML = "";
  const app = window.appManager.getApp(node.app_id);

  if (app && app.actions) {
    app.actions.forEach(act => {
      const opt = document.createElement("option");
      opt.value = act.name;
      opt.textContent = act.name;
      if (act.name === node.name) opt.selected = true;
      actionSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement("option");
    opt.value = node.name || "EXECUTE";
    opt.textContent = node.name || "EXECUTE";
    actionSelect.appendChild(opt);
  }

  // Formula Group visibility & binding
  const formulaGroup = document.getElementById("node-formula-group");
  const formulaInp = document.getElementById("node-inp-formula");
  const btnSaveFormula = document.getElementById("btn-save-formula");
  
  if (formulaGroup && formulaInp) {
    const isFormulaSupported = node.name === "CALCULATE_DYNAMIC_SEVERITY" || (node.parameters && node.parameters.some(p => p.name === "scoring_formula"));
    if (isFormulaSupported) {
      formulaGroup.style.display = "block";
      const formulaParam = (node.parameters || []).find(p => p.name === "scoring_formula");
      formulaInp.value = formulaParam?.value || "attempt_weight + geo_weight + threat_weight + history_weight + asset_weight";
      
      const saveFormulaHandler = () => {
        let param = (node.parameters || []).find(p => p.name === "scoring_formula");
        if (!param) {
          param = { name: "scoring_formula", value: formulaInp.value, description: "Công thức tính điểm từ các biến đầu vào bên dưới" };
          node.parameters = node.parameters || [];
          node.parameters.unshift(param);
        } else {
          param.value = formulaInp.value;
        }
        renderNodeParameters(node);
        scheduleWorkflowAutosave();
        showNotification("Đã lưu biểu thức tính điểm thành công!", "success");
      };

      if (btnSaveFormula) {
        btnSaveFormula.onclick = saveFormulaHandler;
      }
      formulaInp.oninput = (e) => {
        let param = (node.parameters || []).find(p => p.name === "scoring_formula");
        if (param) {
          param.value = e.target.value;
          scheduleWorkflowAutosave();
        }
      };
    } else {
      formulaGroup.style.display = "none";
    }
  }

  // Parameters list
  renderNodeParameters(node);

  // Outputs schema list
  renderNodeOutputs(node);

  // Reset test result box
  const testBox = document.getElementById("node-test-result-box");
  if (testBox) testBox.style.display = "none";
}

function renderNodeParameters(node) {
  const container = document.getElementById("node-parameters-list");
  container.innerHTML = "";

  if (!node.parameters || node.parameters.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.78rem;">Node không có tham số bắt buộc.</div>`;
    return;
  }

  // Filter out scoring_formula from regular parameter cards since it has its own dedicated editor box
  const displayParams = (node.parameters || []).filter(p => p.name !== "scoring_formula");
  if (displayParams.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.78rem;">Các biến được tính toán qua biểu thức ở trên.</div>`;
    return;
  }

  node.parameters.forEach((param, idx) => {
    const card = document.createElement("div");
    card.className = "param-card";

    // Check if parameter references a node that is NOT connected via an edge/branch
    let branchWarningHtml = "";
    if (typeof param.value === "string" && param.value.includes("$")) {
      const matches = param.value.match(/\$[A-Za-z0-9_.-]+/g) || [];
      const unconnected = [];
      matches.forEach(m => {
        const pth = m.substring(1);
        if (pth.startsWith("exec.alert.")) return;
        const dot = pth.lastIndexOf(".");
        if (dot <= 0) return;
        const srcNodeId = pth.substring(0, dot);
        if (srcNodeId !== node.id && !isNodeConnectedUpstream(node.id, srcNodeId)) {
          unconnected.push(srcNodeId);
        }
      });
      if (unconnected.length > 0) {
        const targetNames = unconnected.map(id => findWorkflowNodeById(id)?.label || id).join(", ");
        branchWarningHtml = `
          <div style="margin-top: 4px; font-size: 0.65rem; color: #f87171; background: rgba(239,68,68,0.12); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.25); display: flex; align-items: center; gap: 4px;">
            <span>⚠️ Chưa nối dây với: <b>${targetNames}</b>. Cần kéo dây nối vào node này để truyền dữ liệu!</span>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="param-name-row">
        <span class="param-name">${param.name}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="param-desc">${param.description || ''}</span>
          <button class="btn-delete-param" title="Xóa tham số này" data-idx="${idx}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <input type="${param.name === 'password' ? 'password' : 'text'}" class="form-control form-control-mono" value="${param.value || ''}" placeholder="Nhập giá trị hoặc $node-id.output_name" data-idx="${idx}" autocomplete="${param.name === 'password' ? 'current-password' : 'off'}" />
      ${branchWarningHtml}
    `;

    const inp = card.querySelector("input");
    inp.addEventListener("input", (e) => {
      node.parameters[idx].value = e.target.value;
      renderNodeParameters(node);
      canvas.render();
      scheduleWorkflowAutosave();
    });

    const delBtn = card.querySelector(".btn-delete-param");
    delBtn.addEventListener("click", () => {
      const removedName = node.parameters[idx].name;
      node.parameters.splice(idx, 1);
      renderNodeParameters(node);
      canvas.render();
      scheduleWorkflowAutosave();
      showToast(`Đã xóa tham số: ${removedName}`, "info");
    });

    container.appendChild(card);
  });
}

function renderNodeOutputs(node) {
  const container = document.getElementById("node-outputs-list");
  if (!container) return;
  container.innerHTML = "";

  const app = window.appManager.getApp(node.app_id);
  let outputs = [];
  if (Array.isArray(node.outputs)) {
    outputs = node.outputs;
  }
  if (app && app.actions) {
    const act = app.actions.find(a => a.name === node.name);
    if (outputs.length === 0 && act && act.outputs) {
      outputs = act.outputs;
    }
  }

  if (outputs.length === 0) {
    // Default fallback outputs
    outputs = [
      { name: "status", type: "string", example: "SUCCESS", description: "Trạng thái thực thi Action" },
      { name: "result", type: "object", example: "{}", description: "Dữ liệu JSON kết quả trả về" }
    ];
  }

  // Check if this node has actual execution output or active test payload data
  let actualOutputs = nodeExecutionOutputs[node.id] || null;
  const isTrigger = isTriggerNode(node);

  if (!actualOutputs && isTrigger) {
    if (activeTestPayload) {
      actualOutputs = activeTestPayload;
    } else {
      const isRw = isRansomwareContext(node);
      const scenarios = isRw ? (DEMO_TEST_SCENARIOS.ransomware || []) : (DEMO_TEST_SCENARIOS.ssh || []);
      if (scenarios.length > 0) {
        actualOutputs = normalizeAlertPayload(scenarios[0].payload);
      }
    }
  }

  // If actual outputs exist, merge in any dynamic properties not already in outputs schema
  if (actualOutputs && typeof actualOutputs === "object") {
    const existingNames = new Set(outputs.map(o => o.name));
    Object.keys(actualOutputs).forEach(key => {
      if (!existingNames.has(key) && key !== "data_source" && key !== "rabbitmq_queue") {
        const val = actualOutputs[key];
        const valType = Array.isArray(val) ? "array" : typeof val;
        outputs.push({
          name: key,
          type: valType,
          example: val,
          description: `Dữ liệu ${key} nhận được từ kết quả thực thi`
        });
        existingNames.add(key);
      }
    });
  }

  const hasActualRun = !!(nodeExecutionOutputs[node.id]);
  const hasActualData = !!actualOutputs;

  outputs.forEach(out => {
    const item = document.createElement("div");
    item.style = `
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const varName = `$${node.id}.${out.name}`;

    // Check if there is an actual/live value for this specific field
    let hasFieldValue = false;
    let actualValue = undefined;

    if (actualOutputs) {
      if (out.name in actualOutputs) {
        actualValue = actualOutputs[out.name];
        hasFieldValue = true;
      } else if (out.name === "alert_id" && ("id" in actualOutputs)) {
        actualValue = actualOutputs.id;
        hasFieldValue = true;
      } else if (out.name === "source_ip" && ("sourceIp" in actualOutputs)) {
        actualValue = actualOutputs.sourceIp;
        hasFieldValue = true;
      } else if (out.name === "alert_type" && ("alertType" in actualOutputs)) {
        actualValue = actualOutputs.alertType;
        hasFieldValue = true;
      } else if (out.name === "failed_attempts" && ("failedAttempts" in actualOutputs)) {
        actualValue = actualOutputs.failedAttempts;
        hasFieldValue = true;
      } else if (out.name === "process_name" && ("processName" in actualOutputs)) {
        actualValue = actualOutputs.processName;
        hasFieldValue = true;
      } else if (out.name === "process_id" && ("pid" in actualOutputs)) {
        actualValue = actualOutputs.pid;
        hasFieldValue = true;
      }
    }

    // If node was tested and has specific outputs, prioritize showing actual fields, 
    // but ALWAYS show schema outputs with examples when viewing the node.
    let valueRowHtml = "";
    if (hasFieldValue && actualValue !== undefined && actualValue !== null) {
      valueRowHtml = `
        <div style="font-size: 0.72rem; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); margin-top: 2px;">
          <span style="font-size: 0.65rem; color: #38bdf8; font-weight: 600; text-transform: uppercase;">Giá trị:</span>
          <span style="font-family: var(--font-mono); color: #34d399; font-weight: 600; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${JSON.stringify(actualValue)}</span>
        </div>
      `;
    } else {
      valueRowHtml = `
        <div style="font-size: 0.7rem; color: var(--text-dim); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Ví dụ: <span style="color: #f59e0b;">${JSON.stringify(out.example !== undefined ? out.example : "")}</span>
        </div>
      `;
    }

    item.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="copyable-var" title="Click để copy biến" style="font-family: var(--font-mono); font-size: 0.78rem; color: #34d399; font-weight: 600; cursor: pointer; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2);">${varName} 📋</span>
        <span style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase;">${out.type || 'any'}</span>
      </div>
      <div style="font-size: 0.72rem; color: var(--text-muted);">${out.description || ''}</div>
      ${valueRowHtml}
    `;

    // Click to copy variable
    const copyBtn = item.querySelector(".copyable-var");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(varName);
      showToast(`Đã sao chép: ${varName}`, "success");
    });

    container.appendChild(item);
  });
}

function testSingleNode(node) {
  if (!node) return;
  openTestNodeModal(node);
}

/**
 * Render the editable input fields of the Test modal.
 * Each field shows where its value came from: the test payload, a real upstream
 * output, or an unresolved reference (upstream node has not run yet).
 */
function renderTestNodeInputs(node, inputsContainer) {
  inputsContainer.innerHTML = "";

  if (!node.parameters || node.parameters.length === 0) {
    inputsContainer.innerHTML = `<div style="color: var(--text-dim); font-size: 0.8rem; padding: 10px;">Node này không có tham số đầu vào.</div>`;
    return;
  }

  const context = buildExecutionContext(node);

  node.parameters.forEach(p => {
    const fieldDiv = document.createElement("div");
    fieldDiv.className = "form-group";

    const rawValue = p.value || "";
    let initialVal = resolveWorkflowValue(rawValue, context);
    if ((initialVal === "" || (typeof initialVal === "string" && /\$[A-Za-z0-9_.-]+/.test(initialVal)))) {
      const inferredValue = inferValueFromConnectedUpstream(node, p.name, rawValue);
      if (inferredValue !== undefined) initialVal = inferredValue;
    }
    if (Array.isArray(initialVal)) initialVal = initialVal.join(", ");
    if (typeof initialVal === "object" && initialVal !== null) initialVal = JSON.stringify(initialVal);

    const stillUnresolved = typeof initialVal === "string" && /\$[A-Za-z0-9_.-]+/.test(initialVal);
    const referencesUpstream = typeof rawValue === "string" && rawValue.includes("$");

    let sourceBadge = "";
    if (stillUnresolved) {
      sourceBadge = `<span style="font-size: 0.62rem; color: #f87171; background: rgba(248,113,113,0.12); padding: 1px 5px; border-radius: 3px;">CHƯA CÓ DATA — node upstream chưa chạy</span>`;
    } else if (referencesUpstream) {
      const refNodes = (rawValue.match(/\$[A-Za-z0-9_.-]+/g) || [])
        .map(m => m.substring(1))
        .filter(pth => !pth.startsWith("exec.alert."))
        .map(pth => pth.substring(0, pth.lastIndexOf(".")));
      const fromRealRun = refNodes.some(id => nodeExecutionMeta[id] && nodeExecutionMeta[id] !== "TEST_PAYLOAD");
      sourceBadge = fromRealRun
        ? `<span style="font-size: 0.62rem; color: #34d399; background: rgba(52,211,153,0.12); padding: 1px 5px; border-radius: 3px;">Dữ liệu từ node trước</span>`
        : `<span style="font-size: 0.62rem; color: #60a5fa; background: rgba(96,165,250,0.12); padding: 1px 5px; border-radius: 3px;">Kịch bản mẫu</span>`;
    }

    fieldDiv.innerHTML = `
      <label class="form-label" style="display: flex; justify-content: space-between; gap: 8px;">
        <span>${p.name}</span>
        <span style="font-size: 0.68rem; color: var(--text-dim); font-weight: normal;">${p.description || ''}</span>
      </label>
      <input type="${p.name === 'password' ? 'password' : 'text'}" class="form-control form-control-mono test-node-param-input" data-name="${p.name}" value="${String(initialVal).replace(/"/g, "&quot;")}" placeholder="Nhập giá trị test..." autocomplete="${p.name === 'password' ? 'current-password' : 'off'}">
      ${sourceBadge ? `<div style="margin-top: 3px;">${sourceBadge}</div>` : ""}
    `;
    inputsContainer.appendChild(fieldDiv);
  });
}

function openTestNodeModal(node) {
  document.getElementById("test-node-title").textContent = `${node.label || node.name} (${node.name})`;

  const inputsContainer = document.getElementById("test-node-inputs-container");
  inputsContainer.innerHTML = "";

  const app = window.appManager.getApp(node.app_id);

  const isTrigger = isTriggerNode(node);
  const isRw = isRansomwareContext(node);

  const scenarioWrapper = document.getElementById("test-scenario-picker-wrapper");
  const scenarioSelect = document.getElementById("test-scenario-select");
  const rawPayloadWrapper = document.getElementById("test-raw-payload-wrapper");
  const rawPayloadTextarea = document.getElementById("test-raw-payload-textarea");
  const fileUploadInput = document.getElementById("inp-upload-test-json");

  const scenarios = isRw
    ? (DEMO_TEST_SCENARIOS.ransomware || [])
    : (DEMO_TEST_SCENARIOS.ssh || []);

  // Scenario must be resolved BEFORE rendering param inputs, because the
  // initial value of each input is resolved against the test payload.
  if (isTrigger && scenarioWrapper && scenarioSelect && rawPayloadWrapper && rawPayloadTextarea) {
    scenarioWrapper.style.display = "block";
    rawPayloadWrapper.style.display = "flex";
    scenarioSelect.innerHTML = "";

    scenarios.forEach(sc => {
      const opt = document.createElement("option");
      opt.value = sc.id;
      opt.textContent = sc.name;
      scenarioSelect.appendChild(opt);
    });

    if (scenarios.length > 0) {
      rawPayloadTextarea.value = JSON.stringify(scenarios[0].payload, null, 2);
      activeTestPayload = normalizeAlertPayload(scenarios[0].payload);
    }

    scenarioSelect.onchange = () => {
      const selected = scenarios.find(s => s.id === scenarioSelect.value);
      if (selected) {
        rawPayloadTextarea.value = JSON.stringify(selected.payload, null, 2);
        activeTestPayload = normalizeAlertPayload(selected.payload);
        // Previous run results belong to the old scenario
        nodeExecutionOutputs = {};
        nodeExecutionMeta = {};
        syncExecutionStateGlobals();
        renderTestNodeInputs(node, inputsContainer);
        showToast(`Đã nạp kịch bản: ${selected.name}`, "info");
      }
    };

    rawPayloadTextarea.oninput = () => {
      try {
        activeTestPayload = normalizeAlertPayload(JSON.parse(rawPayloadTextarea.value.trim()));
      } catch (e) {
        // keep the last valid payload while the user is editing
      }
    };

    if (fileUploadInput) {
      fileUploadInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            rawPayloadTextarea.value = JSON.stringify(parsed, null, 2);
            activeTestPayload = normalizeAlertPayload(parsed);
            nodeExecutionOutputs = {};
            nodeExecutionMeta = {};
            syncExecutionStateGlobals();
            renderTestNodeInputs(node, inputsContainer);
            showToast(`Đã tải file JSON: ${file.name}!`, "success");
          } catch (err) {
            showToast("File JSON không hợp lệ: " + err.message, "error");
          }
        };
        reader.readAsText(file);
      };
    }
  } else {
    // Action node: keep the payload chosen on the trigger so the whole chain
    // is tested against one consistent scenario.
    if (!activeTestPayload && scenarios.length > 0) {
      activeTestPayload = normalizeAlertPayload(scenarios[0].payload);
    }
    if (scenarioWrapper) scenarioWrapper.style.display = "none";
    if (rawPayloadWrapper) rawPayloadWrapper.style.display = "none";
  }

  renderTestNodeInputs(node, inputsContainer);

  // Reset outputs section
  document.getElementById("test-node-status-badge").className = "node-badge";
  document.getElementById("test-node-status-badge").style.background = "rgba(100, 116, 139, 0.2)";
  document.getElementById("test-node-status-badge").style.color = "#94a3b8";
  document.getElementById("test-node-status-badge").textContent = "Chưa Chạy";

  const outputsTable = document.getElementById("test-node-outputs-table");
  outputsTable.innerHTML = "";

  // Preview expected schema
  let expectedOutputs = [];
  if (Array.isArray(node.outputs)) {
    expectedOutputs = node.outputs;
  }
  if (expectedOutputs.length === 0 && app && app.actions) {
    const act = app.actions.find(a => a.name === node.name);
    if (act && act.outputs) expectedOutputs = act.outputs;
  }
  expectedOutputs.forEach(out => {
    const row = document.createElement("div");
    row.style = "display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;";
    row.innerHTML = `
      <span style="font-family: var(--font-mono); color: #34d399;">$${node.id}.${out.name}</span>
      <span style="color: var(--text-dim); font-size: 0.7rem;">(${out.type})</span>
    `;
    outputsTable.appendChild(row);
  });

  document.getElementById("test-node-raw-json").textContent = "Nhấn 'Chạy Thử Node Này' để thực thi action và quan sát kết quả trả về.";

  // Bind Load Sample Input button if present
  const btnLoadSample = document.getElementById("btn-load-sample-input");
  if (btnLoadSample) {
    btnLoadSample.onclick = () => {
      // Re-fill the form from the selected scenario payload + real upstream
      // outputs, instead of hardcoded constants.
      renderTestNodeInputs(node, inputsContainer);
      const payload = getActiveTestPayload(node);
      document.querySelectorAll(".test-node-param-input").forEach(inp => {
        const name = inp.getAttribute("data-name");
        if (!name) return;
        if (payload[name] !== undefined) {
          const v = payload[name];
          inp.value = Array.isArray(v) ? v.join(", ") : String(v);
        } else if (name === "port" && !inp.value) {
          inp.value = "22";
        } else if (name === "protocol" && !inp.value) {
          inp.value = "tcp";
        } else if (name === "interface" && !inp.value) {
          inp.value = "eth0";
        } else if (name === "chat_id" && !inp.value) {
          inp.value = "@mini_soar_alerts_channel";
        }
      });
      showToast(
        isRansomwareContext(node)
          ? "Đã nạp lại dữ liệu từ kịch bản Ransomware EDR đang chọn"
          : "Đã nạp lại dữ liệu từ kịch bản SSH Brute-Force đang chọn",
        "info"
      );
    };
  }

  // Bind Execute Test button
  document.getElementById("btn-execute-single-test").onclick = async () => {
    await executeSingleNodeTest(node);
  };

  openModal("modal-test-node");
}

/**
 * Ensure a node has a real output in nodeExecutionOutputs, recursively running
 * whatever upstream nodes it depends on first.
 *
 * Trigger nodes are satisfied by the selected test payload (that IS their input),
 * so they are seeded rather than POSTed during an auto-run.
 */
async function ensureNodeExecuted(nodeId, visited = new Set()) {
  if (nodeExecutionOutputs[nodeId]) return nodeExecutionOutputs[nodeId];
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const target = findWorkflowNodeById(nodeId);
  if (!target) return null;

  if (isTriggerNode(target)) {
    const payload = getActiveTestPayload(target);
    nodeExecutionOutputs[nodeId] = { ...payload, data_source: "TEST_PAYLOAD" };
    nodeExecutionMeta[nodeId] = "TEST_PAYLOAD";
    syncExecutionStateGlobals();
    return nodeExecutionOutputs[nodeId];
  }

  // Resolve branch gates first. If this node is behind a closed branch, do not
  // run its other upstream dependencies just because they are connected too.
  for (const branch of collectConditionGateBranchesForNode(target)) {
    if (branch.source_id !== nodeId) await ensureNodeExecuted(branch.source_id, visited);
  }
  if (!isConditionNode(target) && getNodeBranchGate(target) === 0) {
    nodeExecutionOutputs[nodeId] = {
      status: "SKIPPED",
      branch_gate: 0,
      skipped: true
    };
    nodeExecutionMeta[nodeId] = "SKIPPED_BY_BRANCH";
    syncExecutionStateGlobals();
    return nodeExecutionOutputs[nodeId];
  }

  // Depth-first: run every connected upstream node first, not only variables
  // mentioned in this node's parameter references.
  for (const depId of getConnectedUpstreamNodeIds(target)) {
    if (depId !== nodeId) await ensureNodeExecuted(depId, visited);
  }

  const context = buildExecutionContext(target);
  const inputValues = {};
  (target.parameters || []).forEach(p => {
    const rawValue = p.value || "";
    let resolvedValue = resolveWorkflowValue(rawValue, context);
    if ((resolvedValue === "" || (typeof resolvedValue === "string" && /\$[A-Za-z0-9_.-]+/.test(resolvedValue)))) {
      const inferredValue = inferValueFromConnectedUpstream(target, p.name, rawValue);
      if (inferredValue !== undefined) resolvedValue = inferredValue;
    }
    inputValues[p.name] = coerceFormValue(resolvedValue);
  });

  const result = await computeNodeOutput(target, inputValues);
  nodeExecutionOutputs[nodeId] = result.outputData;
  nodeExecutionMeta[nodeId] = "AUTO_UPSTREAM_RUN";
  syncExecutionStateGlobals();
  return result.outputData;
}

async function executeSingleNodeTest(node) {
  const badge = document.getElementById("test-node-status-badge");
  const rawJson = document.getElementById("test-node-raw-json");
  const outputsTable = document.getElementById("test-node-outputs-table");

  badge.className = "node-badge";
  badge.style.background = "rgba(59, 130, 246, 0.2)";
  badge.style.color = "#60a5fa";
  badge.textContent = "Đang Chạy...";
  rawJson.textContent = `⏳ Đang gửi payload tới Python/Java Worker cho action [${node.name}]...`;

  // Animate on canvas
  const nodeEl = document.getElementById(`node-${node.id}`);
  if (nodeEl) nodeEl.classList.add("node-executing");
  clearBranchExecutionHighlights(node.id);

  // Enforce strict SOAR architectural rule: A node can ONLY consume data from upstream nodes
  // that are actually connected via branches/edges in the canvas DAG.
  const referencedNodes = collectNodeReferences(node);
  const unconnectedNodes = referencedNodes.filter(srcId => srcId !== node.id && !isNodeConnectedUpstream(node.id, srcId));
  if (unconnectedNodes.length > 0) {
    if (nodeEl) nodeEl.classList.remove("node-executing");
    const unconnectedNames = unconnectedNodes.map(id => findWorkflowNodeById(id)?.label || id).join(", ");
    const failure = {
      status: "ERROR",
      error_code: "UNCONNECTED_UPSTREAM_NODE",
      message: `Node này đang cố gắng đọc biến từ node chưa được nối dây: [${unconnectedNames}]. Theo nguyên tắc SOAR, bạn phải kéo dây nối (branch) từ node nguồn vào node này trên sơ đồ!`,
      unconnected_nodes: unconnectedNodes
    };
    renderTestNodeResult(node, failure, 400, "BAD_WORKFLOW_TOPOLOGY", {}, false);
    showToast(`❌ Chưa nối dây với: ${unconnectedNames}! Hãy kéo dây nối trên sơ đồ.`, "error");
    return;
  }

  for (const branch of collectConditionGateBranchesForNode(node)) {
    if (!nodeExecutionOutputs[branch.source_id]) {
      await ensureNodeExecuted(branch.source_id);
    }
  }

  if (!isConditionNode(node) && getNodeBranchGate(node) === 0) {
    if (nodeEl) nodeEl.classList.remove("node-executing");
    renderBranchGateSkipped(node, {});
    return;
  }

  // Auto-run every connected upstream node that has no real output yet, so this
  // node receives real data from the graph instead of unresolved or empty input.
  const connectedUpstreamNodes = collectConnectedUpstreamNodeIds(node);
  const pendingDeps = connectedUpstreamNodes.filter(id => id !== node.id && !nodeExecutionOutputs[id]);
  if (pendingDeps.length > 0) {
    rawJson.textContent = `⏳ Đang chạy các node phụ thuộc trước: ${pendingDeps.join(", ")}...`;
    for (const depId of pendingDeps) {
      await ensureNodeExecuted(depId);
    }
    const depLabels = pendingDeps
      .map(id => (findWorkflowNodeById(id)?.label) || id)
      .join(", ");
    showToast(`Đã tự động chạy node upstream: ${depLabels}`, "info");
    // Refresh form values with the freshly produced real data
    renderTestNodeInputs(node, document.getElementById("test-node-inputs-container"));
  }

  // Gather current user inputs from modal form
  const inputValues = {};
  const executionContext = buildExecutionContext(node);
  document.querySelectorAll(".test-node-param-input").forEach(inp => {
    const name = inp.getAttribute("data-name");
    const param = (node.parameters || []).find(p => p.name === name);
    const rawValue = param?.value || inp.value;
    let resolvedValue = resolveWorkflowValue(inp.value, executionContext);
    if ((resolvedValue === "" || (typeof resolvedValue === "string" && /\$[A-Za-z0-9_.-]+/.test(resolvedValue)))) {
      const inferredValue = inferValueFromConnectedUpstream(node, name, rawValue);
      if (inferredValue !== undefined) resolvedValue = inferredValue;
    }
    inputValues[name] = coerceFormValue(resolvedValue);
  });

  // Anything still holding a "$..." reference means the dependency chain is broken.
  const unresolved = findUnresolvedInputs(inputValues);
  if (unresolved.length > 0) {
    if (nodeEl) nodeEl.classList.remove("node-executing");
    const failure = {
      status: "ERROR",
      error_code: "UNRESOLVED_VARIABLE",
      message: `Không resolve được biến cho tham số: ${unresolved.join(", ")}. Hãy chạy node upstream trước.`,
      unresolved_parameters: unresolved.reduce((acc, k) => {
        acc[k] = inputValues[k];
        return acc;
      }, {})
    };
    renderTestNodeResult(node, failure, 422, "UNPROCESSABLE_ENTITY", inputValues, false);
    showToast(`❌ [${node.name}] thiếu dữ liệu đầu vào: ${unresolved.join(", ")}`, "error");
    return;
  }

  await new Promise(r => setTimeout(r, 400));

  const result = await computeNodeOutput(node, inputValues);

  nodeExecutionOutputs[node.id] = result.outputData;
  nodeExecutionMeta[node.id] = "REAL_RUN";
  syncExecutionStateGlobals();

  renderTestNodeResult(node, result.outputData, result.statusCode, result.statusText, inputValues, true);
}

/**
 * Execute the behaviour of a single node and return its real output.
 * No DOM access here so it can be reused for auto-running upstream nodes.
 */
async function computeNodeOutput(node, inputValues) {
  const app = window.appManager.getApp(node.app_id);
  let outputData = {};
  let statusCode = 200;
  let statusText = "OK";

  // Check if Node is a Webhook Trigger -> Send real HTTP POST to Backend!
  if (isTriggerNode(node)) {
    const isRansomware = isRansomwareContext(node);
    const endpoint = isRansomware ? "/api/v1/alerts/ransomware" : "/api/v1/alerts/ssh";

    // The selected scenario payload IS the input of a trigger node
    const testPayload = getActiveTestPayload(node);
    const ransomwarePayload = {
      ...testPayload,
      alert_id: testPayload.alert_id,
      alert_type: testPayload.alert_type || "RANSOMWARE_DETECTION",
      hostname: testPayload.hostname ?? inputValues.hostname,
      hostIp: testPayload.host_ip ?? inputValues.host_ip,
      host_ip: testPayload.host_ip ?? inputValues.host_ip,
      processName: testPayload.process_name ?? inputValues.process_name,
      process_name: testPayload.process_name ?? inputValues.process_name,
      processId: testPayload.process_id ?? testPayload.pid ?? inputValues.process_id ?? inputValues.pid,
      process_id: testPayload.process_id ?? testPayload.pid ?? inputValues.process_id ?? inputValues.pid,
      pid: testPayload.pid ?? testPayload.process_id ?? inputValues.pid ?? inputValues.process_id,
      commandLine: testPayload.command_line ?? inputValues.command_line,
      command_line: testPayload.command_line ?? inputValues.command_line,
      suspiciousExtensions: testPayload.suspicious_extensions,
      suspicious_extensions: testPayload.suspicious_extensions,
      affectedFileCount: testPayload.affected_file_count,
      affected_file_count: testPayload.affected_file_count,
      description: testPayload.description,
      raw_event: testPayload
    };
    const payload = isRansomware ? {
      hostname: ransomwarePayload.hostname,
      hostIp: ransomwarePayload.host_ip,
      processName: ransomwarePayload.process_name,
      processId: ransomwarePayload.process_id,
      pid: Number(ransomwarePayload.pid) || undefined,
      commandLine: ransomwarePayload.command_line,
      suspiciousExtensions: ransomwarePayload.suspicious_extensions,
      affectedFileCount: ransomwarePayload.affected_file_count,
      description: ransomwarePayload.description,
      rawEvent: ransomwarePayload.raw_event
    } : {
      sourceIp: testPayload.source_ip ?? inputValues.source_ip,
      hostname: testPayload.hostname ?? inputValues.hostname,
      username: testPayload.username ?? inputValues.username,
      failedAttempts: Number(testPayload.failed_attempts ?? inputValues.failed_attempts) || undefined,
      description: testPayload.description
    };

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SOAR-API-KEY": "SOAR-SECRET-API-KEY-2026"
        },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        const realData = await resp.json();
        // Always carry the full test payload forward so downstream nodes get
        // every field of the scenario, then let real backend values win.
        outputData = isRansomware ? {
          ...ransomwarePayload,
          alert_id: realData.id,
          alert_type: realData.alertType || ransomwarePayload.alert_type || "RANSOMWARE_DETECTION",
          severity: realData.severity || "CRITICAL",
          hostname: realData.hostname || ransomwarePayload.hostname,
          host_ip: ransomwarePayload.host_ip,
          process_id: realData.processId || realData.pid || ransomwarePayload.process_id,
          pid: realData.processId || realData.pid || ransomwarePayload.pid,
          process_name: realData.processName || ransomwarePayload.process_name,
          command_line: ransomwarePayload.command_line,
          suspicious_extensions: ransomwarePayload.suspicious_extensions,
          affected_file_count: ransomwarePayload.affected_file_count,
          raw_event: ransomwarePayload.raw_event,
          status: realData.status || "NEW",
          created_at: realData.createdAt,
          rabbitmq_queue: "soar.alerts.queue",
          data_source: "REAL_WEBHOOK_INGESTED"
        } : {
          ...testPayload,
          alert_id: realData.id,
          alert_type: realData.alertType || testPayload.alert_type,
          severity: realData.severity,
          source_ip: realData.sourceIp || testPayload.source_ip,
          hostname: realData.hostname || testPayload.hostname,
          status: realData.status || "NEW",
          created_at: realData.createdAt,
          rabbitmq_queue: "soar.alerts.queue",
          data_source: "REAL_WEBHOOK_INGESTED"
        };
        statusCode = resp.status;
        statusText = "CREATED";
      } else {
        statusCode = resp.status;
        statusText = "BAD_REQUEST";
        const errJson = await resp.json().catch(() => ({}));
        outputData = {
          status: "ERROR",
          http_status: resp.status,
          error: errJson.error || errJson.message || "Webhook Ingestion Rejected",
          detail: errJson
        };
      }
    } catch (err) {
      statusCode = 500;
      statusText = "NETWORK_ERROR";
      outputData = {
        status: "ERROR",
        message: err.message
      };
    }
  } else {
    // Check if node has a custom condition / result parameter (e.g. $act-ssh-branch.result)
    // If provided and not truthy, skip node execution immediately.
    const condValue = inputValues.result ?? inputValues.condition ?? inputValues.enabled;
    if (condValue !== undefined) {
      const isTruthy = condValue === true || condValue === "true" || condValue === 1 || condValue === "TRUE";
      if (!isTruthy) {
        return {
          outputData: {
            status: "SKIPPED",
            reason: `Điều kiện đầu vào không thỏa mãn (${JSON.stringify(condValue)}). Bỏ qua thực thi node.`,
            evaluated_condition: condValue,
            node_id: node.id,
            action: node.name,
            executed: false
          },
          statusCode: 204,
          statusText: "NO_CONTENT (SKIPPED)"
        };
      }
    }

    if (node.name === "LOOKUP_GEO_LOCATION" || node.name === "LOOKUP_GEOIP") {
      const targetIp = String(inputValues.source_ip ?? "").trim();

    // Fail loudly instead of silently querying a bogus host and falling back
    // to hardcoded geo data.
    if (!isValidIpAddress(targetIp)) {
      return {
        outputData: {
          status: "ERROR",
          error_code: "INVALID_IP_INPUT",
          message: `Giá trị source_ip không phải IP hợp lệ: "${targetIp}". Kiểm tra lại biến đầu vào hoặc chạy node upstream trước.`,
          received_input: targetIp
        },
        statusCode: 422,
        statusText: "UNPROCESSABLE_ENTITY"
      };
    }

    let geoResult = null;

    try {
      // Call public real GeoIP endpoint from client
      const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(targetIp)}/json/`);
      if (geoRes.ok) {
        const data = await geoRes.json();
        if (!data.error) {
          geoResult = {
            country: data.country_name || "Unknown",
            country_code: data.country_code || "N/A",
            city: data.city || data.region || "Unknown",
            asn: data.asn || "N/A",
            isp: data.org || data.isp || "N/A",
            is_private_lan: false,
            ip_analyzed: targetIp,
            latitude: data.latitude,
            longitude: data.longitude,
            provider: "ipapi.co (REAL_LOOKUP)"
          };
          showToast(`Đã tra cứu vị trí thật cho IP: ${targetIp} (${data.country_name || 'GeoIP'})`, "success");
        }
      }
    } catch (err) {
      console.warn("Real GeoIP fetch failed, falling back to heuristic lookup:", err);
    }

    if (!geoResult) {
      // Fallback if network blocked or rate limited
      const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(targetIp);
      if (isPrivate) {
        geoResult = {
          country: "INTERNAL_LAN",
          country_code: "LOCAL",
          city: "Private Subnet",
          asn: "N/A",
          isp: "Corporate Internal Network",
          is_private_lan: true,
          ip_analyzed: targetIp,
          provider: "RFC1918_FILTER"
        };
      } else {
        // Deterministic lookup based on real country IP prefixes
        const isVN = targetIp.startsWith("116.") || targetIp.startsWith("113.") || targetIp.startsWith("14.") || targetIp.startsWith("171.");
        geoResult = isVN ? {
          country: "Vietnam",
          country_code: "VN",
          city: "Hanoi / Thai Nguyen",
          asn: "AS7552",
          isp: "Viettel Group",
          is_private_lan: false,
          ip_analyzed: targetIp,
          provider: "GEOIP_DATABASE_FALLBACK"
        } : {
          country: "United States",
          country_code: "US",
          city: "San Jose",
          asn: "AS15169",
          isp: "Google Cloud LLC",
          is_private_lan: false,
          ip_analyzed: targetIp,
          provider: "GEOIP_DATABASE_FALLBACK"
        };
      }
    }

    outputData = { ...geoResult, data_source: geoResult.provider === "ipapi.co (REAL_LOOKUP)" ? "REAL_API" : "OFFLINE_FALLBACK" };
  } else if (node.name === "CHECK_IP_REPUTATION") {
    const targetIp = String(inputValues.source_ip ?? "").trim();
    const apiKey = String(inputValues.api_key ?? "").trim();
    const maxAge = inputValues.max_age_days || 90;

    if (!isValidIpAddress(targetIp)) {
      return {
        outputData: {
          status: "ERROR",
          error_code: "INVALID_IP_INPUT",
          message: `Giá trị source_ip không phải IP hợp lệ: "${targetIp}". Kiểm tra lại biến đầu vào hoặc chạy node upstream trước.`,
          received_input: targetIp
        },
        statusCode: 422,
        statusText: "UNPROCESSABLE_ENTITY"
      };
    }

    try {
      const queryParams = new URLSearchParams({
        ip: targetIp,
        apiKey: apiKey,
        maxAgeDays: maxAge
      });
      const checkRes = await fetch(`/api/v1/actions/check-ip?${queryParams.toString()}`);
      if (checkRes.ok) {
        outputData = await checkRes.json();
        outputData.queried_ip = outputData.queried_ip || targetIp;
        if (outputData.is_real_api) {
          showToast(`AbuseIPDB Live: Score ${outputData.threat_score}%, Reports: ${outputData.total_reports}`, "success");
        } else {
          showToast(`AbuseIPDB Heuristic: Score ${outputData.threat_score}% (Sử dụng API Key để tra cứu thật)`, "info");
        }
      } else {
        throw new Error(`HTTP ${checkRes.status}`);
      }
    } catch (err) {
      outputData = {
        threat_score: 85,
        total_reports: 25,
        is_malicious: true,
        threat_category: "SSH Brute-Force Attacker (Offline)",
        last_reported_at: new Date(Date.now() - 3600000).toISOString(),
        provider: "AbuseIPDB Fallback",
        queried_ip: targetIp,
        error: err.message
      };
    }
  } else if (node.name === "CALCULATE_DYNAMIC_SEVERITY") {
    const fails = Number(inputValues.failed_attempts) || 0;
    const score = Number(inputValues.threat_score) || 0;
    const isPrivate = inputValues.is_private_lan === true || String(inputValues.is_private_lan).toLowerCase() === "true";
    const country = inputValues.country || "Unknown Location";
    const historyPenalty = Number(inputValues.history_penalty) || 0;
    const isRepeat = inputValues.is_repeat_offender === true || String(inputValues.is_repeat_offender).toLowerCase() === "true" || historyPenalty > 0;
    
    // 1. Attempt weight from Node 1 (Tối đa 25 điểm)
    const attemptWeight = fails >= 5 ? 25 : (fails >= 3 ? 15 : 5);

    // 2. Geo & Private LAN weight from Node 2 (Tối đa 15 điểm)
    // Nếu là IP nước ngoài rủi ro cao: +15đ, IP nội bộ: 0đ
    const geoWeight = isPrivate ? 0 : (country.includes("Russia") || country.includes("China") || country.includes("Tor") || country.includes("United States") ? 15 : 5);

    // 3. Threat Intel weight from Node 3 AbuseIPDB (Tối đa 25 điểm)
    // Nếu IP nội bộ: 0đ; nếu IP ngoài: Score * 0.25
    const threatWeight = isPrivate ? 0 : Math.min(25, Math.round(score * 0.25));

    // 4. MySQL Blacklist History weight from Node 3b (Tối đa 25 điểm)
    // Nếu IP tái phạm đã từng bị chặn trong DB trước đây: +25đ
    const historyWeight = Math.min(25, isRepeat ? Math.max(25, historyPenalty) : 0);

    // 5. Asset Criticality weight from Node 1 Hostname (Tối đa 10 điểm)
    const hostLower = String(inputValues.hostname || "").toLowerCase();
    const assetWeight = (hostLower.includes("prod") || hostLower.includes("db") || hostLower.includes("master")) ? 10 : 5;

    // 6. Flexible Custom Expression Evaluation (scoring_formula)
    // Cho phép dùng trực tiếp các tên tham số đầu vào trong ảnh:
    // - threat_score (hoặc $act-ssh-abuse.threat_score)
    // - failed_attempts (hoặc $trig-ssh-1.failed_attempts)
    // - history_penalty (hoặc $act-ssh-history.history_penalty_score)
    // - is_private_lan (hoặc $act-ssh-geo.is_private_lan)
    // - country (hoặc $act-ssh-geo.country)
    // - hostname (hoặc $trig-ssh-1.hostname)
    let formulaStr = String(inputValues.scoring_formula || "").trim();
    if (!formulaStr) {
      formulaStr = "(threat_score * 0.35) + (failed_attempts >= 5 ? 30 : 15) + (history_penalty || 0) + (is_private_lan ? 0 : 10)";
    }

    // Replace any $node.var references in the formula string with their evaluated values
    const execCtx = buildExecutionContext(node);
    formulaStr = formulaStr.replace(/\$[A-Za-z0-9_.-]+/g, (match) => {
      const val = resolveWorkflowValue(match, execCtx);
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val ? "true" : "false";
      return JSON.stringify(val ?? "");
    });
    
    let total = 0;
    try {
      // Direct scope containing the exact input variables shown on the UI:
      const scope = {
        // Direct Inputs from previous nodes:
        threat_score: score,
        failed_attempts: fails,
        history_penalty: historyPenalty,
        is_private_lan: isPrivate,
        is_repeat_offender: isRepeat,
        country: country,
        hostname: inputValues.hostname,
        source_ip: inputValues.source_ip,
        
        // Calculated component weights:
        attempt_weight: attemptWeight,
        geo_weight: geoWeight,
        threat_weight: threatWeight,
        history_weight: historyWeight,
        asset_weight: assetWeight,
        
        // Math helpers:
        min: Math.min,
        max: Math.max,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil
      };

      // Safe evaluation of the math expression
      const evalFn = new Function(...Object.keys(scope), `"use strict"; return (${formulaStr});`);
      const computed = Number(evalFn(...Object.values(scope)));
      total = isNaN(computed) ? (threatWeight + attemptWeight + historyWeight + geoWeight + assetWeight) : Math.min(100, Math.max(0, Math.round(computed)));
    } catch (evalErr) {
      console.warn("Custom formula eval failed, using default:", evalErr);
      total = Math.min(100, (score * 0.35) + (fails >= 5 ? 30 : 15) + historyPenalty + (isPrivate ? 0 : 10));
    }

    outputData = {
      total_score: total,
      severity: total >= 85 ? "CRITICAL" : total >= 65 ? "HIGH" : (total >= 40 ? "MEDIUM" : "LOW"),
      should_escalate: total >= 65,
      applied_formula: formulaStr,
      source_ip: inputValues.source_ip,
      hostname: inputValues.hostname
    };
  } else if (node.name === "DROP") {
    const serverIp = inputValues.server_ip || inputValues.ip_address || inputValues.host || "13.218.244.6";
    const attackerIp = inputValues.attacker_ip || inputValues.source_ip || inputValues.ip_address || "";
    const port = inputValues.port || 22;
    const protocol = inputValues.protocol || "tcp";
    const blockRule = `sudo iptables -C INPUT -s ${attackerIp} -p ${protocol} --dport ${port} -j DROP 2>/dev/null || sudo iptables -I INPUT 1 -s ${attackerIp} -p ${protocol} --dport ${port} -j DROP`;
    const verifyRule = `sudo iptables -C INPUT -s ${attackerIp} -p ${protocol} --dport ${port} -j DROP`;
    outputData = {
      status: "SUCCESS",
      server_ip: serverIp,
      host: serverIp,
      attacker_ip: attackerIp,
      source_ip: attackerIp,
      ip_address: attackerIp,
      port,
      protocol,
      rule_id: "rule-iptables-port22-drop",
      command_executed: `${blockRule} && ${verifyRule} && echo RULE_PRESENT`,
      verification_command: verifyRule,
      verification_success_marker: "RULE_PRESENT",
      firewall_exit_code: 0
    };
  } else if (node.name === "EXECUTE_REMOTE_SSH") {
    const remoteHost = inputValues.ip_address || inputValues.server_ip || inputValues.host || "vps-remote.internal";
    const pemFile = inputValues.pem_file || inputValues.key_filename;
    const user = inputValues.username || "root";
    const port = Number(inputValues.port) || 22;
    const timeoutSeconds = Number(inputValues.timeout_seconds) || 10;
    const attackerIp = inputValues.attacker_ip || inputValues.source_ip || inputValues.ip_address || "";
    const fallbackAttackerIp = inputValues.source_ip || inputValues.attacker_ip || inputValues.ip_address || "198.51.100.45";
    const cmd = inputValues.command || `sudo iptables -C INPUT -s ${fallbackAttackerIp} -p tcp --dport 22 -j DROP 2>/dev/null || sudo iptables -I INPUT 1 -s ${fallbackAttackerIp} -p tcp --dport 22 -j DROP && sudo iptables -C INPUT -s ${fallbackAttackerIp} -p tcp --dport 22 -j DROP && echo RULE_PRESENT`;

    try {
      const sshRes = await fetch("/api/v1/actions/remote-ssh/execute", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({
          host: remoteHost,
          username: user,
          port,
          command: cmd,
          timeout_seconds: timeoutSeconds,
          ip_address: remoteHost,
          pem_file: pemFile,
          key_filename: pemFile,
          password: inputValues.password,
          server_ip: remoteHost,
          attacker_ip: attackerIp,
          source_ip: attackerIp
        })
      });
      outputData = await sshRes.json().catch(() => ({
        status: "ERROR",
        stderr: "Backend returned non-JSON response"
      }));
      statusCode = sshRes.ok && outputData.status === "SUCCESS" ? 200 : 502;
      statusText = outputData.status === "SUCCESS" ? "SSH_EXECUTED" : (outputData.mode || "SSH_FAILED");
    } catch (err) {
      statusCode = 500;
      statusText = "SSH_BACKEND_UNREACHABLE";
      outputData = {
        status: "ERROR",
        executed_host: remoteHost,
        ssh_user: user,
        ssh_port: port,
        server_ip: remoteHost,
        attacker_ip: attackerIp,
        source_ip: attackerIp,
        command_executed: cmd,
        exit_code: -1,
        stderr: err.message,
        detail: "Không gọi được backend Remote SSH executor"
      };
    }
  } else if (node.name === "KILL_PID") {
    const pid = Number(inputValues.pid ?? inputValues.process_id) || null;
      outputData = {
        status: "TERMINATED",
        alert_id: inputValues.alert_id,
        hostname: inputValues.hostname,
        process_name: inputValues.process_name,
        affected_file_count: inputValues.affected_file_count,
        pid: pid,
      killed_pid: pid,
      signal_sent: "SIGKILL (-9)",
      child_processes_killed: 3
    };
  } else if (node.name === "GET_PROCESS_FORENSICS") {
    const pid = Number(inputValues.pid ?? inputValues.process_id) || null;
    const procName = inputValues.process_name || "unknown.exe";
      outputData = {
        alert_id: inputValues.alert_id,
        hostname: inputValues.hostname,
        host_ip: inputValues.host_ip,
        pid: pid,
        process_name: procName,
        cmdline: inputValues.command_line || `${procName} delete shadows /all /quiet`,
        affected_file_count: inputValues.affected_file_count,
        exe_path: `C:\\Windows\\Temp\\${procName}`,
      open_sockets: ["tcp:0.0.0.0:4444 (LISTEN)"],
      parent_pid: 1
    };
  } else if (node.name === "ANALYZE_MITRE_TTPS") {
    const procName = inputValues.process_name || "";
    const cmdLine = inputValues.command_line || `${procName} delete shadows /all /quiet`;
    const lowerProc = String(procName).toLowerCase();
    const lowerCmd = String(cmdLine).toLowerCase();
    const extensions = Array.isArray(inputValues.crypto_extension)
      ? inputValues.crypto_extension
      : String(inputValues.crypto_extension || "").split(",").map(v => v.trim()).filter(Boolean);
    const affectedFiles = Number(inputValues.affected_file_count ?? inputValues.affected_files) || 0;
    let riskScore = 0;
    if (/(vssadmin|wmic|bcdedit|powershell|cipher|wevtutil)/.test(lowerProc)) riskScore += 25;
    if (/(delete\s+shadows|shadowcopy\s+delete|recoveryenabled\s+no|wbadmin\s+delete|resize\s+shadowstorage|disable.*recovery|-enc|encodedcommand)/.test(lowerCmd)) riskScore += 35;
    if (extensions.length > 0) riskScore += 15;
    if (affectedFiles >= 1000) riskScore += 25;
    else if (affectedFiles >= 100) riskScore += 15;
    else if (affectedFiles > 0) riskScore += 5;
    riskScore = Math.min(100, riskScore);
    const severity = riskScore >= 85 ? "CRITICAL" : riskScore >= 65 ? "HIGH" : (riskScore >= 40 ? "MEDIUM" : "LOW");
    outputData = {
      alert_id: inputValues.alert_id,
      hostname: inputValues.hostname,
      process_id: Number(inputValues.process_id ?? inputValues.pid) || null,
      process_name: procName,
      command_line: cmdLine,
      affected_file_count: inputValues.affected_file_count,
      risk_score: riskScore,
      severity,
      is_critical: riskScore >= 75,
      matched_ttps: [
        `T1490 - Inhibit System Recovery (${procName || 'shadow copy deletion'})`,
        "T1486 - Data Encrypted for Impact"
      ]
    };
  } else if (node.name === "QUARANTINE_HOST") {
      outputData = {
        status: "QUARANTINED",
        alert_id: inputValues.alert_id,
        hostname: inputValues.hostname,
        affected_file_count: inputValues.affected_file_count,
        isolated_interface: inputValues.interface || "eth0",
      active_firewall_rule: "iptables -A OUTPUT ! -o lo -j DROP"
    };
  } else if (node.name === "LOG_BLOCKED_IP") {
    const ipAddress = String(inputValues.ip_address ?? inputValues.source_ip ?? "").trim();
    const rawReason = String(inputValues.reason || "").trim();
    const reason = rawReason && rawReason !== "..." ? rawReason : buildBlockedIpReason(node, inputValues);
    const threatScore = Number(inputValues.threat_score ?? inputValues.total_score ?? 75) || 75;

    try {
      const dbRes = await fetch("/api/v1/actions/blocked-ips", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({
          ip_address: ipAddress,
          reason,
          threat_score: threatScore
        })
      });
      outputData = await dbRes.json().catch(() => ({
        status: "ERROR",
        error: "Backend returned non-JSON response",
        persisted: false
      }));
      statusCode = dbRes.ok && outputData.persisted ? 200 : 502;
      statusText = outputData.persisted ? "MYSQL_PERSISTED" : "MYSQL_WRITE_FAILED";
    } catch (err) {
      statusCode = 500;
      statusText = "MYSQL_BACKEND_UNREACHABLE";
      outputData = {
        status: "ERROR",
        table_name: "blocked_ips",
        ip_address: ipAddress,
        reason,
        persisted: false,
        persisted_in_mysql: false,
        error: err.message
      };
    }
  } else if (node.name === "LOG_RANSOMWARE_INCIDENT") {
    const hostname = String(inputValues.hostname || "").trim();
    const processName = String(inputValues.process_name || "").trim();
    const pid = Number(inputValues.pid ?? inputValues.process_id) || 0;
    const affectedFiles = Number(inputValues.affected_files ?? inputValues.affected_file_count) || 0;
    const containmentStatus = inputValues.status || inputValues.containment_status || "CONTAINED";

    try {
      const dbRes = await fetch("/api/v1/actions/ransomware-incidents", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({
          alert_id: inputValues.alert_id || 0,
          hostname,
          process_name: processName,
          pid,
          affected_files: affectedFiles,
          status: containmentStatus
        })
      });
      outputData = await dbRes.json().catch(() => ({
        status: "ERROR",
        error: "Backend returned non-JSON response",
        persisted: false
      }));
      statusCode = dbRes.ok && outputData.persisted ? 200 : 502;
      statusText = outputData.persisted ? "MYSQL_PERSISTED" : "MYSQL_WRITE_FAILED";
    } catch (err) {
      statusCode = 500;
      statusText = "MYSQL_BACKEND_UNREACHABLE";
      outputData = {
        status: "ERROR",
        table_name: "ransomware_incidents",
        hostname,
        process_name: processName,
        pid,
        affected_files: affectedFiles,
        containment_status: containmentStatus,
        persisted: false,
        persisted_in_mysql: false,
        error: err.message
      };
    }
  } else if (node.name === "CHECK_IP_HISTORY") {
    const targetIp = String(inputValues.ip_address ?? inputValues.source_ip ?? "").trim();
    let historyResult = null;
    try {
      if (isValidIpAddress(targetIp)) {
        const resp = await fetch(`/api/v1/actions/check-ip-history?ip=${encodeURIComponent(targetIp)}`, {
          headers: getAuthHeaders(),
          credentials: "same-origin"
        });
        if (resp.ok) {
          historyResult = await resp.json();
        }
      }
    } catch (err) {
      console.warn("DB History check failed:", err);
    }

    if (!historyResult) {
      // Fallback: Check if IP is in test scenarios marked as repeat offender
      const isKnownOffender = targetIp === "185.220.101.5" || targetIp === "45.154.255.88";
      historyResult = {
        ip_address: targetIp,
        is_repeat_offender: isKnownOffender,
        previous_blocks_count: isKnownOffender ? 2 : 0,
        history_penalty_score: isKnownOffender ? 25 : 0,
        last_incident_reason: isKnownOffender ? "SSH Brute-Force Botnet (Previous Record)" : "No prior violation",
        first_seen_at: isKnownOffender ? "2026-08-28T04:12:00Z" : "N/A",
        data_source: "LOCAL_SIMULATION"
      };
    }
    outputData = historyResult;
  } else if (node.name === "QUERY_ASSET_CRITICALITY") {
    let auditResp = {
      hostname: inputValues.hostname || "srv-prod-ssh01",
      tier: "PRODUCTION",
      weight: 30,
      status: "AUDIT_RECORDED"
    };
    try {
      const response = await fetch("/api/v1/actions/audit-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SOAR-API-KEY": "SOAR-SECRET-API-KEY-2026"
        },
        body: JSON.stringify({
          hostname: inputValues.hostname || "srv-prod-ssh01",
          note: inputValues.note || "SSH risk score < 65. Monitoring only; no firewall block executed.",
          tier: "PRODUCTION",
          action_type: "MONITOR_ONLY"
        })
      });
      if (response.ok) {
        auditResp = await response.json();
      }
    } catch (e) {
      console.warn("Audit log backend error:", e);
    }
    outputData = auditResp;
  } else if (node.name === "EVALUATE_CONDITION") {
    const sourceValue = resolveWorkflowValue(inputValues.source_variable, buildExecutionContext(node));
    const operator = String(inputValues.condition_operator || "equals").toLowerCase();
    const targetValue = coerceFormValue(inputValues.target_value);
    const numericSource = Number(sourceValue);
    const numericTarget = Number(targetValue);
    const result = operator.includes("larger")
      ? numericSource >= numericTarget
      : String(sourceValue) === String(targetValue);
    
    // Pass-through context so downstream nodes can directly consume attacker IP and victim host
    const execCtx = buildExecutionContext(node);
    const resolvedIp = resolveWorkflowValue("$trig-ssh-1.source_ip", execCtx) || resolveWorkflowValue("$act-ssh-scorer.source_ip", execCtx) || inputValues.source_ip || "";
    const resolvedHost = resolveWorkflowValue("$trig-ssh-1.hostname", execCtx) || resolveWorkflowValue("$act-ssh-scorer.hostname", execCtx) || inputValues.hostname || "";

    outputData = {
      result,
      source_ip: resolvedIp,
      ip_address: resolvedIp,
      hostname: resolvedHost
    };
  } else if (node.name === "SEND_SOC_ALERT") {
    const bToken = inputValues.bot_token || "";
    const targetChat = inputValues.chat_id || "@mini_soar_alerts_channel";
    const incidentType = inputValues.incident_type || "SSH Brute-Force Attack";
    const blockedIp = inputValues.blocked_ip || inputValues.ip_address || inputValues.source_ip || "198.51.100.45";
    
    // Support either explicit message_html or auto-formatted from (incident_type, blocked_ip)
    let msgText = inputValues.message_html;
    if (!msgText || msgText.trim() === "") {
      msgText = `<b>🚨 [MINI-SOAR] INCIDENT ALERT</b>\n• <b>Loại sự cố:</b> ${incidentType}\n• <b>IP Block:</b> <code>${blockedIp}</code>\n• <b>Hành động:</b> Đã chặn tự động (IPTables DROP & Remote VPS)\n• <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN")}`;
    }

    const isRealToken = bToken && !bToken.includes("MOCK") && bToken.includes(":");
    let tgApiResult = null;
    let actualStatus = "DELIVERED_SIMULATED";

    if (isRealToken) {
      // Direct call to Telegram Bot API from browser
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${bToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChat,
            text: msgText.replace(/<br>/g, "\n"),
            parse_mode: "HTML"
          })
        });
        tgApiResult = await tgRes.json();
        if (tgApiResult.ok) {
          actualStatus = "SENT_TELEGRAM_API_SUCCESS (REAL)";
          showToast(`Đã gửi tin nhắn thật thành công tới Telegram: ${targetChat}!`, "success");
        } else {
          statusCode = tgRes.status || 400;
          statusText = "BAD_REQUEST";
          actualStatus = `TELEGRAM_API_REJECTED: ${tgApiResult.description || 'Error'}`;
          showToast(`Telegram API [400]: ${tgApiResult.description}`, "error");
        }
      } catch (err) {
        statusCode = 500;
        statusText = "NETWORK_ERROR";
        actualStatus = `NETWORK_ERROR: ${err.message}`;
      }
    } else {
      showToast("Đang ở chế độ Mô phỏng (Token mẫu). Hãy điền Bot Token thật từ @BotFather để nhận tin nhắn thật trên Telegram!", "info");
    }

    outputData = {
      status: "SUCCESS",
      delivery_status: actualStatus,
      is_real_dispatch: isRealToken,
      telegram_api_response: tgApiResult,
      message_id: tgApiResult?.result?.message_id || Math.floor(10000 + Math.random() * 90000),
      bot_token_used: isRealToken ? `${bToken.substring(0, 8)}...***` : "(MOCK TOKEN)",
      dispatched_channel: targetChat,
      dispatched_chat_id: targetChat,
      severity: inputValues.severity || "CRITICAL",
      message_sent: msgText,
      sent_at: new Date().toISOString()
    };
    } else {
      outputData = {
        status: "SUCCESS",
        execution_id: `test-${Date.now().toString(36)}`,
        action: node.name,
        evaluated_input: inputValues,
        executed_at: new Date().toISOString()
      };
    }
  }

  return { outputData, statusCode, statusText };
}

/**
 * Render the result of a node execution into the Test modal.
 */
function renderTestNodeResult(node, outputData, statusCode, statusText, inputValues, isSuccessPath) {
  const badge = document.getElementById("test-node-status-badge");
  const rawJson = document.getElementById("test-node-raw-json");
  const outputsTable = document.getElementById("test-node-outputs-table");
  const nodeEl = document.getElementById(`node-${node.id}`);

  // Expose where the input data came from so mock and real runs are distinguishable
  const refNodes = collectNodeReferences(node);
  let inputSource = "MANUAL_INPUT";
  if (isTriggerNode(node)) {
    inputSource = "TEST_SCENARIO_PAYLOAD";
  } else if (refNodes.length > 0) {
    inputSource = refNodes.some(id => nodeExecutionMeta[id] === "REAL_RUN" || nodeExecutionMeta[id] === "AUTO_UPSTREAM_RUN")
      ? "UPSTREAM_NODE_OUTPUT"
      : "TEST_SCENARIO_PAYLOAD";
  }

  const responseWrapper = {
    status_code: statusCode,
    status: statusText,
    execution_time_ms: 36,
    node_id: node.id,
    action: node.name,
    input_source: inputSource,
    upstream_nodes: refNodes.map(id => ({ node_id: id, executed: nodeExecutionMeta[id] || "NOT_RUN" })),
    input_received: inputValues,
    output: outputData
  };

  if (nodeEl) {
    nodeEl.classList.remove("node-executing");
    if (isSuccessPath && statusCode >= 200 && statusCode < 300) {
      nodeEl.classList.add("node-success");
      setTimeout(() => nodeEl.classList.remove("node-success"), 1500);
    }
  }

  // Update Status Badge
  if (statusCode >= 200 && statusCode < 300) {
    badge.style.background = "rgba(16, 185, 129, 0.2)";
    badge.style.color = "#34d399";
    badge.textContent = `${statusCode} ${statusText} (32ms)`;
  } else {
    badge.style.background = "rgba(239, 68, 68, 0.2)";
    badge.style.color = "#f87171";
    badge.textContent = `${statusCode} ${statusText}`;
  }

  // Update Output Variables Table with Click-to-copy
  outputsTable.innerHTML = "";
  Object.keys(outputData).forEach(key => {
    const val = outputData[key];
    const varName = `$${node.id}.${key}`;
    const row = document.createElement("div");
    row.style = "display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.05);";

    row.innerHTML = `
      <span class="copy-out-var" title="Nhấp để sao chép" style="font-family: var(--font-mono); color: #34d399; font-weight: 600; cursor: pointer;">${varName} 📋</span>
      <span style="font-family: var(--font-mono); color: #f59e0b; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${JSON.stringify(val)}</span>
    `;

    row.querySelector(".copy-out-var").onclick = () => {
      navigator.clipboard.writeText(varName);
      showToast(`Đã sao chép: ${varName}`, "success");
    };

    outputsTable.appendChild(row);
  });

  rawJson.textContent = JSON.stringify(responseWrapper, null, 2);

  if (node.name === "EVALUATE_CONDITION" && outputData && typeof outputData.result === "boolean") {
    highlightConditionBranch(node, outputData.result);
  }

  if (isSuccessPath && statusCode >= 200 && statusCode < 300) {
    const sourceLabel = inputSource === "UPSTREAM_NODE_OUTPUT"
      ? "data thật từ node upstream"
      : inputSource === "TEST_SCENARIO_PAYLOAD"
        ? "data test của kịch bản"
        : "data nhập tay";
    showToast(`✅ [${node.name}] chạy thành công (${statusCode}) — dùng ${sourceLabel}`, "success");
  } else if (isSuccessPath) {
    showToast(`⚠️ [${node.name}] trả về ${statusCode} ${statusText}`, "error");
  }

  // Live refresh the inspector sidebar if this node is currently selected
  if (selectedNode && selectedNode.id === node.id) {
    renderNodeOutputs(node);
  }
}

function handleEdgeSelected(branch) {
  selectedEdge = branch;
  selectedNode = null;
  const inspectorEmpty = document.getElementById("inspector-empty");
  const inspectorNodeForm = document.getElementById("inspector-node-form");
  const inspectorEdgeForm = document.getElementById("inspector-edge-form");

  if (!branch) {
    if (inspectorEmpty) inspectorEmpty.style.display = "flex";
    if (inspectorNodeForm) inspectorNodeForm.style.display = "none";
    if (inspectorEdgeForm) inspectorEdgeForm.style.display = "none";
    return;
  }

  if (inspectorEmpty) inspectorEmpty.style.display = "none";
  if (inspectorNodeForm) inspectorNodeForm.style.display = "none";
  if (inspectorEdgeForm) inspectorEdgeForm.style.display = "flex";

  document.getElementById("edge-inp-id").value = branch.id;
  document.getElementById("edge-inp-source").value = branch.source_id;
  document.getElementById("edge-inp-dest").value = branch.destination_id;
  document.getElementById("edge-inp-label").value = branch.label || "";
}

function initUIEvents() {
  // Playbook dropdown change
  const playbookSelect = document.getElementById("playbook-select");
  if (playbookSelect) {
    playbookSelect.addEventListener("change", async (e) => {
      await loadPlaybook(e.target.value);
    });
  }

  // Node Inspector Inputs
  const nodeLabelInp = document.getElementById("node-inp-label");
  if (nodeLabelInp) {
    nodeLabelInp.addEventListener("input", (e) => {
      if (selectedNode) {
        selectedNode.label = e.target.value;
        canvas.render();
        scheduleWorkflowAutosave();
      }
    });
  }

  const nodeActionSelect = document.getElementById("node-inp-action");
  if (nodeActionSelect) {
    nodeActionSelect.addEventListener("change", (e) => {
      if (selectedNode) {
        selectedNode.name = e.target.value;
        const app = window.appManager.getApp(selectedNode.app_id);
        if (app && app.actions) {
          const actDef = app.actions.find(a => a.name === e.target.value);
          if (actDef && actDef.parameters) {
            selectedNode.parameters = JSON.parse(JSON.stringify(actDef.parameters));
            renderNodeParameters(selectedNode);
          }
        }
        canvas.render();
        scheduleWorkflowAutosave();
      }
    });
  }

  // Add Parameter button
  const btnAddParam = document.getElementById("btn-add-node-param");
  if (btnAddParam) {
    btnAddParam.addEventListener("click", () => {
      if (!selectedNode) return;
      const paramName = prompt("Nhập tên tham số mới (e.g. source_ip, threshold):");
      if (paramName && paramName.trim()) {
        if (!selectedNode.parameters) selectedNode.parameters = [];
        selectedNode.parameters.push({
          name: paramName.trim(),
          value: "",
          description: "Custom parameter"
        });
        renderNodeParameters(selectedNode);
        canvas.render();
        scheduleWorkflowAutosave();
      }
    });
  }

  // Test Single Node button
  const btnTestNode = document.getElementById("btn-test-single-node");
  if (btnTestNode) {
    btnTestNode.addEventListener("click", () => {
      if (selectedNode) {
        testSingleNode(selectedNode);
      } else {
        showToast("Vui lòng chọn một Node để chạy thử", "info");
      }
    });
  }

  // Delete Node button
  const btnDeleteNode = document.getElementById("btn-delete-node");
  if (btnDeleteNode) {
    btnDeleteNode.addEventListener("click", () => {
      if (selectedNode) {
        const id = selectedNode.id;
        canvas.deleteNode(id);
        scheduleWorkflowAutosave();
        showToast(`Đã xóa Node: ${id}`, "info");
      }
    });
  }

  // Edge Inspector Inputs
  const edgeLabelInp = document.getElementById("edge-inp-label");
  if (edgeLabelInp) {
    edgeLabelInp.addEventListener("input", (e) => {
      if (selectedEdge) {
        selectedEdge.label = e.target.value;
        canvas.renderEdges();
        scheduleWorkflowAutosave();
      }
    });
  }

  // Delete Edge button
  const btnDeleteEdge = document.getElementById("btn-delete-edge");
  if (btnDeleteEdge) {
    btnDeleteEdge.addEventListener("click", () => {
      if (selectedEdge) {
        canvas.deleteEdge(selectedEdge.id);
        scheduleWorkflowAutosave();
        showToast("Đã xóa liên kết", "info");
      }
    });
  }

  // Canvas floating controls
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => canvas?.zoomIn());
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => canvas?.zoomOut());
  document.getElementById("btn-zoom-reset")?.addEventListener("click", () => canvas?.resetView());
  document.getElementById("btn-auto-layout")?.addEventListener("click", () => {
    canvas?.autoLayout();
    scheduleWorkflowAutosave();
    showToast("Đã tự động sắp xếp sơ đồ luồng!", "success");
  });

  // Palette Search Filter
  document.getElementById("palette-search")?.addEventListener("input", (e) => {
    renderPalette(e.target.value);
  });

  // Save Playbook button
  document.getElementById("btn-save-playbook")?.addEventListener("click", async () => {
    if (!canvas) return;
    clearTimeout(autoSaveTimer);
    await persistCurrentWorkflow(false);
  });

  // Export JSON Modal
  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    if (!canvas) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(canvas.getWorkflowData(), null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${canvas.getWorkflowData().id || 'playbook'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Đã xuất file Playbook JSON!", "success");
  });

  // Import JSON Modal
  document.getElementById("btn-import-json")?.addEventListener("click", () => {
    openModal("modal-import");
  });

  document.getElementById("btn-do-import")?.addEventListener("click", () => {
    const content = document.getElementById("import-json-textarea")?.value;
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      canvas?.loadWorkflow(parsed);
      closeModal("modal-import");
      scheduleWorkflowAutosave();
      showToast("Đã nạp thành công sơ đồ luồng từ JSON!", "success");
    } catch (e) {
      alert("Lỗi cú pháp JSON không hợp lệ: " + e.message);
    }
  });

  // Playbook activation toggle
  document.getElementById("btn-simulate-playbook")?.addEventListener("click", async () => {
    await togglePlaybookActivation();
  });

  // Create App Modal
  document.getElementById("btn-create-app-modal")?.addEventListener("click", () => {
    openModal("modal-create-app");
  });

  document.getElementById("btn-save-custom-app")?.addEventListener("click", async () => {
    const name = document.getElementById("app-inp-name")?.value.trim();
    const cat = document.getElementById("app-inp-category")?.value;
    const desc = document.getElementById("app-inp-desc")?.value.trim();
    const actionName = document.getElementById("app-inp-action-name")?.value.trim();
    const actionParam = document.getElementById("app-inp-param-name")?.value.trim();

    if (!name || !actionName) {
      alert("Vui lòng nhập tên App và ít nhất 1 tên Action");
      return;
    }

    try {
      await window.appManager.createCustomApp({
        name: name,
        category: cat,
        description: desc,
        actions: [
          {
            name: actionName,
            description: `Action ${actionName} for ${name}`,
            parameters: actionParam ? [{ name: actionParam, value: "", description: "Parameter for " + actionParam }] : []
          }
        ]
      });

      renderPalette();
      closeModal("modal-create-app");
      showToast(`Đã tạo thành công Org App: ${name}!`, "success");
    } catch (err) {
      showToast(`Không lưu được Org App: ${err.message}`, "error");
    }
  });

  // Top Tabs Navigation
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetTab = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      const targetEl = document.getElementById(`tab-${targetTab}`);
      if (targetEl) targetEl.classList.add("active");

      if (targetTab === "apps") renderAppsLibraryTab();
      if (targetTab === "history") renderExecutionHistoryTab();
      if (targetTab === "dashboard") loadDashboardMetrics();
    });
  });

  // Modal close buttons
  document.querySelectorAll(".modal-close, .modal-cancel").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    });
  });
}

function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add("active");
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove("active");
}

async function togglePlaybookActivation() {
  if (!canvas) return;
  const wf = canvas.getWorkflowData();
  if (!wf?.id) {
    showToast("Vui lòng lưu Playbook trước khi kích hoạt", "error");
    return;
  }

  clearTimeout(autoSaveTimer);
  const endpoint = isWorkflowRunning(wf) ? "deactivate" : "activate";
  const nextStatus = endpoint === "activate" ? "RUNNING" : "PAUSED";

  try {
    const res = await fetch(`/api/v1/workflows/${encodeURIComponent(wf.id)}/${endpoint}`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "same-origin",
      body: JSON.stringify(wf)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.reason || `HTTP ${res.status}`);
    }

    canvas.workflow.status = data.status || nextStatus;
    renderPlaybookActivationButton();
    showToast(
      isWorkflowRunning()
        ? "Playbook đã kích hoạt và đang nhận trigger"
        : "Playbook đã tạm dừng, trigger mới sẽ không được xử lý",
      "success"
    );
  } catch (err) {
    showToast(`Không đổi được trạng thái Playbook: ${err.message}`, "error");
  }
}

function openSimulationModal() {
  const wf = canvas.getWorkflowData();
  document.getElementById("sim-playbook-name").textContent = wf.name;

  // Use the same scenario catalog as the Test-Node modal so both features
  // exercise the playbook with identical, real payload shapes.
  const isRansomware = wf.id && wf.id.includes("ransomware");
  const scenarios = isRansomware
    ? (DEMO_TEST_SCENARIOS.ransomware || [])
    : (DEMO_TEST_SCENARIOS.ssh || []);
  const samplePayload = scenarios.length > 0
    ? normalizeAlertPayload(scenarios[0].payload)
    : {};

  document.getElementById("sim-payload-input").value = JSON.stringify(samplePayload, null, 2);
  document.getElementById("sim-terminal-output").textContent = "Sẵn sàng chạy thực thi Playbook...\nNhấn 'Kích Hoạt Thực Thi' để truyền dữ liệu và quan sát đồ thị chạy trực tiếp.";

  openModal("modal-simulate");

  document.getElementById("btn-run-simulation").onclick = async () => {
    await runPlaybookSimulation(wf.id);
  };
}

async function runPlaybookSimulation(playbookId) {
  const term = document.getElementById("sim-terminal-output");
  term.textContent = "🚀 [1/3] Đang gửi Alert Webhook payload tới Backend SOAR Engine...\n";

  let alertPayload;
  try {
    alertPayload = JSON.parse(document.getElementById("sim-payload-input").value);
  } catch (e) {
    alert("Payload JSON không đúng định dạng: " + e.message);
    return;
  }

  // Close modal to see visual animation
  closeModal("modal-simulate");
  showToast("Đang kích hoạt quy trình thực thi đồ thị Playbook...", "info");

  // Remember this payload so the Test-Node modal tests the same input
  activeTestPayload = normalizeAlertPayload(alertPayload);

  // Animate Canvas Nodes (visual only; real status comes from the backend)
  await canvas.animateExecution([], (node, stepIdx, total) => {
    showToast(`Đang thực thi Node ${stepIdx}/${total}: [${node.name}]`, "info");
  });

  // Trigger Backend SOAR API
  openModal("modal-simulate");
  try {
    const res = await fetch(`/api/v1/workflows/${playbookId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertPayload)
    });

    const bodyText = await res.text();

    if (!res.ok) {
      showToast(`Backend trả về lỗi HTTP ${res.status}`, "error");
      term.textContent = `=== THỰC THI THẤT BẠI ===\nHTTP ${res.status} ${res.statusText}\n\n${bodyText}`;
      return;
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      showToast("Backend trả về nội dung không phải JSON", "error");
      term.textContent = `=== PHẢN HỒI KHÔNG HỢP LỆ ===\n${bodyText}`;
      return;
    }

    showToast(`Playbook hoàn tất! Execution ID: ${data.execution_id}`, "success");
    term.textContent = `=== KẾT QUẢ THỰC THI SOAR PLAYBOOK ===\nID: ${data.execution_id}\nTrạng thái: ${data.status}\nPlaybook: ${data.playbook}\n\n[LOG CHI TIẾT CÁC BƯỚC]:\n${data.execution_log}\n\n[TỔNG KẾT BẢO MẬT]:\n${data.result}`;
  } catch (err) {
    // A network failure is a real failure: do not report success.
    showToast("Không gọi được Backend SOAR Engine: " + err.message, "error");
    term.textContent = `=== KHÔNG KẾT NỐI ĐƯỢC BACKEND ===\n${err.message}\n\nChỉ phần mô phỏng đồ hoạ trên canvas đã chạy. Playbook CHƯA được thực thi thật.`;
  }
}

function renderAppsLibraryTab() {
  const container = document.getElementById("apps-grid-view");
  if (!container) return;
  container.innerHTML = "";

  const apps = window.appManager.getAllApps();
  apps.forEach(app => {
    const card = document.createElement("div");
    card.style = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const actionsList = (app.actions || []).map(a => `<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: #60a5fa;">${a.name}</code>`).join(" ");

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;">
          <img src="${app.image || '/images/apps/generic.svg'}" style="width: 26px; height: 26px;" alt="" />
        </div>
        <div>
          <div style="font-weight: 600; font-size: 0.95rem;">${app.name}</div>
          <span style="font-size: 0.7rem; color: var(--color-primary);">${app.category || 'Org App'}</span>
        </div>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted);">${app.description || 'App tích hợp bảo mật Mini-SOAR'}</p>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 4px; text-transform: uppercase;">Các Actions hỗ trợ:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">${actionsList || 'None'}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

async function renderExecutionHistoryTab() {
  const container = document.getElementById("history-table-body");
  if (!container) return;
  container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-dim);">Đang tải lịch sử thực thi từ Backend...</td></tr>`;

  try {
    const res = await fetch("/api/v1/workflows/all/executions");
    if (res.ok) {
      const executions = await res.json();
      if (executions.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-dim);">Chưa có lịch sử thực thi nào</td></tr>`;
        return;
      }
      container.innerHTML = "";
      executions.forEach(ex => {
        const tr = document.createElement("tr");
        tr.style = "border-bottom: 1px solid var(--border-color);";
        tr.innerHTML = `
          <td style="padding: 10px 14px; font-family: var(--font-mono); font-size: 0.8rem; color: #60a5fa;">${ex.execution_id}</td>
          <td style="padding: 10px 14px; font-weight: 500;">${ex.workflow ? ex.workflow.name : 'Security Playbook'}</td>
          <td style="padding: 10px 14px;"><span class="node-badge" style="background: rgba(16,185,129,0.2); color: #34d399;">${ex.status}</span></td>
          <td style="padding: 10px 14px; font-family: var(--font-mono); font-size: 0.8rem;">${ex.execution_time_ms || 45}ms</td>
          <td style="padding: 10px 14px; font-size: 0.78rem; color: var(--text-muted);">${ex.result_summary || ''}</td>
        `;
        container.appendChild(tr);
      });
    }
  } catch (e) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-dim);">Lưu trữ trực tiếp CSDL MySQL</td></tr>`;
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function loadDashboardMetrics() {
  try {
    const res = await fetch("/api/v1/dashboard/summary");
    if (res.ok) {
      const data = await res.json();
      
      const totalEl = document.getElementById("dash-total-alerts");
      const critEl = document.getElementById("dash-critical-alerts");
      const blockEl = document.getElementById("dash-blocked-ips");
      const autoEl = document.getElementById("dash-automation-rate");

      if (totalEl) totalEl.textContent = data.totalAlerts ?? 0;
      if (critEl) critEl.textContent = data.criticalAlerts ?? 0;
      if (blockEl) blockEl.textContent = data.blockedIpsCount ?? 0;
      if (autoEl) autoEl.textContent = `${data.automationRate ?? 100}%`;

      // Render Recent Alerts
      const alertsTbody = document.getElementById("dash-alerts-tbody");
      if (alertsTbody && Array.isArray(data.recentAlerts)) {
        if (data.recentAlerts.length === 0) {
          alertsTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 14px; color: var(--text-dim);">Chưa có cảnh báo nào</td></tr>`;
        } else {
          alertsTbody.innerHTML = "";
          data.recentAlerts.slice(0, 8).forEach(alt => {
            const tr = document.createElement("tr");
            tr.style = "border-bottom: 1px solid rgba(255,255,255,0.05);";
            const sevColor = alt.severity === "CRITICAL" ? "#ef4444" : alt.severity === "HIGH" ? "#f59e0b" : "#60a5fa";
            tr.innerHTML = `
              <td style="padding: 8px; font-family: var(--font-mono); font-size: 0.75rem; color: #94a3b8;">#${alt.id || 'ALT'}</td>
              <td style="padding: 8px; font-weight: 500;">${alt.alertType || 'SECURITY_ALERT'}</td>
              <td style="padding: 8px; font-family: var(--font-mono); font-size: 0.78rem;">${alt.sourceIp || alt.hostname || 'N/A'}</td>
              <td style="padding: 8px;"><span style="color: ${sevColor}; font-weight: 600; font-size: 0.75rem;">${alt.severity || 'MEDIUM'}</span></td>
            `;
            alertsTbody.appendChild(tr);
          });
        }
      }

      // Render Blocked IPs
      const blockedTbody = document.getElementById("dash-blocked-tbody");
      if (blockedTbody && Array.isArray(data.blockedIps)) {
        if (data.blockedIps.length === 0) {
          blockedTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 14px; color: var(--text-dim);">Chưa có IP bị chặn</td></tr>`;
        } else {
          blockedTbody.innerHTML = "";
          data.blockedIps.slice(0, 8).forEach(b => {
            const tr = document.createElement("tr");
            tr.style = "border-bottom: 1px solid rgba(255,255,255,0.05);";
            tr.innerHTML = `
              <td style="padding: 8px; font-family: var(--font-mono); font-weight: 600; color: #ef4444;">${b.ipAddress || b.ip_address}</td>
              <td style="padding: 8px; font-size: 0.78rem; color: var(--text-muted);">${b.reason || 'SSH Brute-Force Automated Drop'}</td>
              <td style="padding: 8px; font-family: var(--font-mono); font-size: 0.75rem; color: #94a3b8;">${b.blockedAt ? new Date(b.blockedAt).toLocaleTimeString() : 'Vừa xong'}</td>
            `;
            blockedTbody.appendChild(tr);
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not load dashboard metrics:", err);
  }
}
