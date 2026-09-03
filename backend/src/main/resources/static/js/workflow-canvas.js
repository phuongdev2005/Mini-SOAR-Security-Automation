/**
 * Mini-SOAR Playbook Canvas Graph Engine - Full Edge & Port Interactivity
 */

class WorkflowCanvas {
  constructor(containerId, svgLayerId, nodesLayerId, onNodeSelect, onEdgeSelect) {
    this.container = document.getElementById(containerId);
    this.viewport = document.getElementById("canvas-viewport");
    this.svgLayer = document.getElementById(svgLayerId);
    this.nodesLayer = document.getElementById(nodesLayerId);
    this.onNodeSelect = onNodeSelect;
    this.onEdgeSelect = onEdgeSelect;

    this.workflow = {
      id: "wf-new",
      name: "New Playbook",
      triggers: [],
      actions: [],
      branches: []
    };

    this.scale = 0.85;
    this.panX = 60;
    this.panY = 60;

    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this.isDraggingNode = false;
    this.draggedNode = null;
    this.nodeDragStartX = 0;
    this.nodeDragStartY = 0;
    this.nodeInitialX = 0;
    this.nodeInitialY = 0;

    // Port connection state
    this.isConnecting = false;
    this.connectingSourceNodeId = null;
    this.connectingSourcePortType = null;
    this.tempEdgePath = null;

    this.selectedNodeId = null;
    this.selectedEdgeId = null;

    this.initEventListeners();
    this.initSvgDefs();
  }

  initSvgDefs() {
    this.svgLayer.innerHTML = `
      <defs>
        <marker id="arrowhead" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0 1, 8 4.5, 0 8" fill="#94a3b8" />
        </marker>
        <marker id="arrowhead-selected" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0 1, 8 4.5, 0 8" fill="#ff8544" />
        </marker>
        <marker id="arrowhead-success" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0 1, 8 4.5, 0 8" fill="#10b981" />
        </marker>
        <marker id="arrowhead-true" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0 1, 8 4.5, 0 8" fill="#10b981" />
        </marker>
        <marker id="arrowhead-false" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0 1, 8 4.5, 0 8" fill="#ef4444" />
        </marker>
        <marker id="arrowhead-executing" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <polygon points="0 1, 8 4.5, 0 8" fill="#3b82f6" />
        </marker>
      </defs>
      <g id="edges-group"></g>
      <path id="temp-edge" d="" style="stroke: #ff8544; stroke-width: 2.2; stroke-dasharray: 5; fill: none; display: none; pointer-events: none;" />
    `;
    this.edgesGroup = document.getElementById("edges-group");
    this.tempEdgePath = document.getElementById("temp-edge");
  }

  initEventListeners() {
    // Canvas Pan on Background Drag
    this.container.addEventListener("mousedown", (e) => {
      // If clicked on interactive elements, don't start canvas panning
      if (
        e.target.closest(".workflow-node") ||
        e.target.closest(".port") ||
        e.target.closest(".edge-hitbox") ||
        e.target.closest(".edge-path") ||
        e.target.closest(".canvas-floating-controls") ||
        e.target.closest(".canvas-stats-badge") ||
        e.target.closest(".edge-label-badge")
      ) {
        return;
      }

      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.container.classList.add("panning");
      this.clearSelection();
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this.updateTransform();
      } else if (this.isDraggingNode && this.draggedNode) {
        const dx = (e.clientX - this.nodeDragStartX) / this.scale;
        const dy = (e.clientY - this.nodeDragStartY) / this.scale;
        
        let newX = Math.round((this.nodeInitialX + dx) / 10) * 10;
        let newY = Math.round((this.nodeInitialY + dy) / 10) * 10;

        this.draggedNode.position.x = newX;
        this.draggedNode.position.y = newY;

        const nodeEl = document.getElementById(`node-${this.draggedNode.id}`);
        if (nodeEl) {
          nodeEl.style.left = `${newX}px`;
          nodeEl.style.top = `${newY}px`;
        }
        this.renderEdges();
      } else if (this.isConnecting) {
        this.updateTempEdge(e);
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.classList.remove("panning");
      }
      if (this.isDraggingNode) {
        this.isDraggingNode = false;
        this.draggedNode = null;
        if (typeof window.scheduleWorkflowAutosave === "function") {
          window.scheduleWorkflowAutosave();
        }
      }
      if (this.isConnecting) {
        // If mouseup occurred directly on an input port
        const portEl = document.elementFromPoint(e.clientX, e.clientY);
        if (portEl && portEl.classList.contains("port-input")) {
          const targetNodeId = portEl.getAttribute("data-node");
          if (targetNodeId && this.connectingSourceNodeId !== targetNodeId) {
            this.addBranch(this.connectingSourceNodeId, targetNodeId, this.connectingSourcePortType);
          }
        }
        this.cancelConnecting();
      }
    });

    // Keyboard shortcuts (Delete / Backspace to delete selected Node or Edge)
    window.addEventListener("keydown", (e) => {
      // Don't delete if user is typing inside an input/textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.selectedNodeId) {
          this.deleteNode(this.selectedNodeId);
        } else if (this.selectedEdgeId) {
          this.deleteEdge(this.selectedEdgeId);
        }
      } else if (e.key === "Escape") {
        this.cancelConnecting();
        this.clearSelection();
      }
    });

    // Zoom on Wheel centered on mouse pointer
    this.container.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = 1.12;
      const oldScale = this.scale;
      let newScale = e.deltaY < 0 ? this.scale * zoomFactor : this.scale / zoomFactor;
      newScale = Math.min(Math.max(0.2, newScale), 3.0);

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newScale / oldScale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / oldScale);
      this.scale = newScale;

      this.updateTransform();
    }, { passive: false });

    // Drag & Drop new nodes from Palette onto Canvas
    this.container.addEventListener("dragover", (e) => e.preventDefault());
    this.container.addEventListener("drop", (e) => {
      e.preventDefault();
      const appData = e.dataTransfer.getData("application/json");
      if (!appData) return;
      try {
        const app = JSON.parse(appData);
        const rect = this.container.getBoundingClientRect();
        const dropX = (e.clientX - rect.left - this.panX) / this.scale;
        const dropY = (e.clientY - rect.top - this.panY) / this.scale;
        this.addNodeFromApp(app, Math.round(dropX), Math.round(dropY));
      } catch (err) {
        console.error("Drop node error:", err);
      }
    });
  }

  updateTransform() {
    const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    if (this.viewport) {
      this.viewport.style.transform = transform;
      this.viewport.style.transformOrigin = "0 0";
    }

    const zoomEl = document.getElementById("zoom-level-display");
    if (zoomEl) {
      zoomEl.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  loadWorkflow(wfData) {
    this.workflow = JSON.parse(JSON.stringify(wfData));
    if (!this.workflow.triggers) this.workflow.triggers = [];
    if (!this.workflow.actions) this.workflow.actions = [];
    if (!this.workflow.branches) this.workflow.branches = [];

    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.render();
    
    setTimeout(() => {
      this.fitToScreen();
    }, 60);
  }

  getWorkflowData() {
    return this.workflow;
  }

  getAllNodes() {
    return [...this.workflow.triggers, ...this.workflow.actions];
  }

  findNode(id) {
    return this.getAllNodes().find(n => n.id === id);
  }

  render() {
    this.renderNodes();
    this.renderEdges();
    this.updateStats();
  }

  getNodeActualDimensions(nodeId) {
    const nodeEl = document.getElementById(`node-${nodeId}`);
    if (nodeEl) {
      return {
        width: nodeEl.offsetWidth || 250,
        height: nodeEl.offsetHeight || 100
      };
    }
    return { width: 250, height: 100 };
  }

  renderNodes() {
    this.nodesLayer.innerHTML = "";
    const allNodes = this.getAllNodes();

    allNodes.forEach(node => {
      const isTrigger = (node.app_type === "trigger" || this.workflow.triggers.some(t => t.id === node.id));
      const isBranch = (node.app_type === "branch" || (node.name && node.name.includes("CONDITION")));
      const isScorer = (node.app_type === "scorer" || (node.name && (node.name.includes("SEVERITY") || node.name.includes("GEOIP") || node.name.includes("MITRE"))));
      const isFirewall = (node.app_type === "firewall" || (node.name && (node.name.includes("DROP") || node.name.includes("IPTABLES") || node.name.includes("QUARANTINE"))));

      let typeClass = "node-type-action";
      let badgeClass = "badge-action";
      let badgeText = "ACTION";

      if (isTrigger) {
        typeClass = "node-type-trigger";
        badgeClass = "badge-trigger";
        badgeText = "TRIGGER";
      } else if (isBranch) {
        typeClass = "node-type-branch";
        badgeClass = "badge-branch";
        badgeText = "DECISION";
      } else if (isScorer) {
        typeClass = "node-type-scorer";
        badgeClass = "badge-scorer";
        badgeText = "SCORER";
      } else if (isFirewall) {
        typeClass = "node-type-firewall";
        badgeClass = "badge-action";
        badgeText = "FIREWALL";
      }

      const nodeEl = document.createElement("div");
      nodeEl.id = `node-${node.id}`;
      nodeEl.className = `workflow-node ${typeClass} ${this.selectedNodeId === node.id ? "selected" : ""}`;
      nodeEl.style.left = `${node.position.x}px`;
      nodeEl.style.top = `${node.position.y}px`;

      const previewParam = (node.parameters && node.parameters.length > 0)
        ? `${node.parameters[0].name}: ${node.parameters[0].value || '...'}`
        : 'Default parameters';

      const iconPath = node.large_image || '/images/apps/generic.svg';

      // Attach Ports directly to the Card root for exact vertical centering
      nodeEl.innerHTML = `
        <!-- Input Port (Middle-Left) -->
        ${!isTrigger ? `<div class="port port-input" data-node="${node.id}" data-port="input" title="Nhấp hoặc thả để kết nối vào Node này"></div>` : ''}

        <div class="node-header">
          <div class="node-title-group">
            <img src="${iconPath}" class="node-header-icon" alt="" />
            <span class="node-title" title="${node.label || node.name}">${node.label || node.name}</span>
          </div>
          <span class="node-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="node-body">
          <div class="node-action-name">${node.name || 'Execute'}</div>
          <div class="node-param-preview" title="${previewParam}">${previewParam}</div>
        </div>

        <!-- Output Ports (Middle-Right) -->
        ${!isBranch ? `<div class="port port-output" data-node="${node.id}" data-port="output" title="Kéo từ đây để nối sang Node tiếp theo"></div>` : `
          <div class="port port-branch-true" data-node="${node.id}" data-port="true" title="Kéo nhánh TRUE (Escalate)"></div>
          <div class="port port-branch-false" data-node="${node.id}" data-port="false" title="Kéo nhánh FALSE (Monitor)"></div>
        `}
      `;

      // Node Dragging & Selection
      nodeEl.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("port")) return;
        e.stopPropagation();
        this.selectNode(node.id);

        this.isDraggingNode = true;
        this.draggedNode = node;
        this.nodeDragStartX = e.clientX;
        this.nodeDragStartY = e.clientY;
        this.nodeInitialX = node.position.x;
        this.nodeInitialY = node.position.y;
      });

      // Port Connecting Event Listeners
      const ports = nodeEl.querySelectorAll(".port");
      ports.forEach(port => {
        port.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          const portType = port.getAttribute("data-port");
          if (portType === "output" || portType === "true" || portType === "false") {
            this.startConnecting(node.id, portType);
          }
        });

        port.addEventListener("click", (e) => {
          e.stopPropagation();
          const portType = port.getAttribute("data-port");
          if (this.isConnecting && portType === "input") {
            // Click-to-connect finish
            if (this.connectingSourceNodeId !== node.id) {
              this.addBranch(this.connectingSourceNodeId, node.id, this.connectingSourcePortType);
            }
            this.cancelConnecting();
          } else if (portType === "output" || portType === "true" || portType === "false") {
            // Click-to-connect start
            this.startConnecting(node.id, portType);
          }
        });
      });

      this.nodesLayer.appendChild(nodeEl);
    });
  }

  startConnecting(nodeId, portType) {
    this.isConnecting = true;
    this.connectingSourceNodeId = nodeId;
    this.connectingSourcePortType = portType;
    this.tempEdgePath.style.display = "block";
    this.container.classList.add("connecting-mode");

    // Highlight valid target input ports
    document.querySelectorAll(".port-input").forEach(p => {
      if (p.getAttribute("data-node") !== nodeId) {
        p.classList.add("port-highlight-target");
      }
    });
  }

  cancelConnecting() {
    this.isConnecting = false;
    this.connectingSourceNodeId = null;
    this.connectingSourcePortType = null;
    if (this.tempEdgePath) this.tempEdgePath.style.display = "none";
    this.container.classList.remove("connecting-mode");
    document.querySelectorAll(".port-input").forEach(p => p.classList.remove("port-highlight-target"));
  }

  renderEdges() {
    if (!this.edgesGroup) return;
    this.edgesGroup.innerHTML = "";

    this.workflow.branches.forEach(branch => {
      const sourceNode = this.findNode(branch.source_id);
      const destNode = this.findNode(branch.destination_id);

      if (!sourceNode || !destNode) return;

      const sourceDim = this.getNodeActualDimensions(sourceNode.id);
      const destDim = this.getNodeActualDimensions(destNode.id);

      const isSourceBranch = (sourceNode.app_type === "branch" || (sourceNode.name && sourceNode.name.includes("CONDITION")));
      const branchType = this.getBranchType(branch);
      let startX = sourceNode.position.x + sourceDim.width + 4;
      let startY = sourceNode.position.y + (sourceDim.height / 2);

      if (isSourceBranch) {
        if (branchType === "true") {
          startY = sourceNode.position.y + (sourceDim.height * 0.32);
        } else if (branchType === "false") {
          startY = sourceNode.position.y + (sourceDim.height * 0.68);
        }
      }

      const endX = destNode.position.x - 7;
      const endY = destNode.position.y + (destDim.height / 2);

      // Smooth Bezier Curve entering horizontally
      const deltaX = Math.max(Math.abs(endX - startX) * 0.55, 45);
      const cp1X = startX + deltaX;
      const cp1Y = startY;
      const cp2X = endX - deltaX;
      const cp2Y = endY;

      const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

      const isSelected = (this.selectedEdgeId === branch.id);
      let markerId = isSelected ? "arrowhead-selected" : "arrowhead";
      if (!isSelected && branchType === "true") markerId = "arrowhead-true";
      if (!isSelected && branchType === "false") markerId = "arrowhead-false";

      // Group for this edge (Hitbox + Visible Stroke + Label)
      const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      edgeGroup.setAttribute("class", `edge-item-group ${isSelected ? 'selected' : ''}`);

      // 1. Invisible thick Hitbox (28px) for effortless clicking
      const hitbox = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitbox.setAttribute("d", pathData);
      hitbox.setAttribute("class", "edge-hitbox");
      hitbox.setAttribute("stroke", "transparent");
      hitbox.setAttribute("stroke-width", "28");
      hitbox.setAttribute("fill", "none");
      hitbox.style.pointerEvents = "stroke";
      hitbox.style.cursor = "pointer";

      // 2. Visible decorative stroke
      const visiblePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      visiblePath.setAttribute("id", `edge-${branch.id}`);
      visiblePath.setAttribute("d", pathData);
      const branchClass = branchType ? ` edge-${branchType}` : "";
      visiblePath.setAttribute("class", `edge-path${branchClass} ${isSelected ? 'selected' : ''}`);
      visiblePath.setAttribute("marker-end", `url(#${markerId})`);

      const onEdgeClick = (e) => {
        e.stopPropagation();
        this.selectEdge(branch.id);
      };

      hitbox.addEventListener("click", onEdgeClick);
      visiblePath.addEventListener("click", onEdgeClick);

      edgeGroup.appendChild(hitbox);
      edgeGroup.appendChild(visiblePath);

      // 3. Render Condition Label Badge
      if (branch.label && branch.label.trim().length > 0) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2 - 10;

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", midX - 70);
        foreignObj.setAttribute("y", midY - 14);
        foreignObj.setAttribute("width", 160);
        foreignObj.setAttribute("height", 36);
        foreignObj.style.overflow = "visible";

        const labelDiv = document.createElement("div");
        labelDiv.className = `edge-label-badge ${isSelected ? 'selected' : ''}`;
        labelDiv.textContent = branch.label;
        labelDiv.title = `Nhấp để cấu hình điều kiện: ${branch.label}`;
        labelDiv.addEventListener("click", onEdgeClick);

        foreignObj.appendChild(labelDiv);
        edgeGroup.appendChild(foreignObj);
      }

      this.edgesGroup.appendChild(edgeGroup);
    });
  }

  getBranchType(branch) {
    const type = String(branch.branch_type || branch.port || branch.source_port || "").toLowerCase();
    if (type === "true" || type === "false") return type;

    const label = String(branch.label || "").toUpperCase();
    if (label.includes("TRUE") || label.includes("ESCALATE") || label.includes(">= 65") || label.includes(">= 75")) return "true";
    if (label.includes("FALSE") || label.includes("MONITOR") || label.includes("BENIGN")) return "false";
    return "";
  }

  updateTempEdge(e) {
    if (!this.isConnecting || !this.connectingSourceNodeId) return;
    const sourceNode = this.findNode(this.connectingSourceNodeId);
    if (!sourceNode) return;

    const sourceDim = this.getNodeActualDimensions(sourceNode.id);
    const startX = sourceNode.position.x + sourceDim.width;
    let startY = sourceNode.position.y + (sourceDim.height / 2);

    if (this.connectingSourcePortType === "true") {
      startY = sourceNode.position.y + (sourceDim.height * 0.32);
    } else if (this.connectingSourcePortType === "false") {
      startY = sourceNode.position.y + (sourceDim.height * 0.68);
    }

    const rect = this.container.getBoundingClientRect();
    const curX = (e.clientX - rect.left - this.panX) / this.scale;
    const curY = (e.clientY - rect.top - this.panY) / this.scale;

    const deltaX = Math.max(Math.abs(curX - startX) * 0.5, 40);
    const pathData = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${curX - deltaX} ${curY}, ${curX} ${curY}`;

    this.tempEdgePath.setAttribute("d", pathData);
  }

  addBranch(sourceId, destId, portType) {
    const exists = this.workflow.branches.some(b => b.source_id === sourceId && b.destination_id === destId);
    if (exists) return;

    let branchLabel = "";
    if (portType === "true") branchLabel = "TRUE (Escalate)";
    else if (portType === "false") branchLabel = "FALSE (Monitor)";

    const newBranch = {
      id: `branch-${Date.now().toString(36)}`,
      source_id: sourceId,
      destination_id: destId,
      branch_type: portType === "true" || portType === "false" ? portType : "",
      label: branchLabel,
      conditions: []
    };

    this.workflow.branches.push(newBranch);
    this.renderEdges();
    this.updateStats();
    this.selectEdge(newBranch.id);
  }

  addNodeFromApp(app, x, y) {
    const isTrigger = (app.type === "trigger" || app.category === "Triggers");
    const count = this.getAllNodes().length + 1;
    const nodeId = isTrigger ? `trig-${Date.now().toString(36)}` : `act-${Date.now().toString(36)}`;
    const actionDef = (app.actions && app.actions.length > 0) ? app.actions[0] : { name: "EXECUTE", parameters: [] };

    const newNode = {
      id: nodeId,
      name: actionDef.name,
      label: `Node ${count}: ${app.name}`,
      app_id: app.id,
      app_name: app.name,
      app_type: app.type || "action",
      large_image: app.image || "/images/apps/generic.svg",
      position: { x: x || 200, y: y || 200 },
      parameters: actionDef.parameters ? JSON.parse(JSON.stringify(actionDef.parameters)) : []
    };

    if (isTrigger) {
      this.workflow.triggers.push(newNode);
    } else {
      this.workflow.actions.push(newNode);
    }

    this.render();
    this.selectNode(newNode.id);
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.selectedEdgeId = null;

    document.querySelectorAll(".workflow-node").forEach(n => n.classList.remove("selected"));
    const el = document.getElementById(`node-${nodeId}`);
    if (el) el.classList.add("selected");

    this.renderEdges();

    const node = this.findNode(nodeId);
    if (this.onNodeSelect) this.onNodeSelect(node);
  }

  selectEdge(edgeId) {
    this.selectedEdgeId = edgeId;
    this.selectedNodeId = null;

    document.querySelectorAll(".workflow-node").forEach(n => n.classList.remove("selected"));
    this.renderEdges();

    const branch = this.workflow.branches.find(b => b.id === edgeId);
    if (this.onEdgeSelect) this.onEdgeSelect(branch);
  }

  clearSelection() {
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    document.querySelectorAll(".workflow-node").forEach(n => n.classList.remove("selected"));
    this.renderEdges();
    if (this.onNodeSelect) this.onNodeSelect(null);
    if (this.onEdgeSelect) this.onEdgeSelect(null);
  }

  deleteNode(nodeId) {
    this.workflow.triggers = this.workflow.triggers.filter(t => t.id !== nodeId);
    this.workflow.actions = this.workflow.actions.filter(a => a.id !== nodeId);
    this.workflow.branches = this.workflow.branches.filter(b => b.source_id !== nodeId && b.destination_id !== nodeId);

    if (this.selectedNodeId === nodeId) {
      this.clearSelection();
    }
    this.render();
  }

  deleteEdge(edgeId) {
    this.workflow.branches = this.workflow.branches.filter(b => b.id !== edgeId);
    if (this.selectedEdgeId === edgeId) {
      this.clearSelection();
    }
    this.renderEdges();
    this.updateStats();
  }

  fitToScreen() {
    const allNodes = this.getAllNodes();
    if (allNodes.length === 0) {
      this.resetView();
      return;
    }

    const containerRect = this.container.getBoundingClientRect();
    const width = containerRect.width || 1200;
    const height = containerRect.height || 700;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodeWidth = 260;
    const nodeHeight = 110;

    allNodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    const contentWidth = Math.max(maxX - minX, 200);
    const contentHeight = Math.max(maxY - minY, 200);
    const padding = 70;

    const scaleX = (width - padding * 2) / contentWidth;
    const scaleY = (height - padding * 2) / contentHeight;
    let optimalScale = Math.min(scaleX, scaleY, 0.9);
    optimalScale = Math.max(optimalScale, 0.35);

    this.scale = optimalScale;
    this.panX = (width - contentWidth * this.scale) / 2 - minX * this.scale;
    this.panY = (height - contentHeight * this.scale) / 2 - minY * this.scale;

    this.updateTransform();
  }

  autoLayout() {
    const triggers = this.workflow.triggers;
    const actions = this.workflow.actions;
    const branches = this.workflow.branches;

    let startX = 60;
    let startY = 160;
    const gapX = 320;

    // Layout triggers
    triggers.forEach((trig, idx) => {
      trig.position = { x: startX, y: startY + (idx * 160) };
    });

    // Topological traversal
    const visited = new Set();
    const queue = [];

    triggers.forEach(t => {
      visited.add(t.id);
      queue.push({ id: t.id, level: 1 });
    });

    const levelNodes = {};

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (!levelNodes[level]) levelNodes[level] = [];
      levelNodes[level].push(id);

      const outgoing = branches.filter(b => b.source_id === id);
      outgoing.forEach(b => {
        if (!visited.has(b.destination_id)) {
          visited.add(b.destination_id);
          queue.push({ id: b.destination_id, level: level + 1 });
        }
      });
    }

    // Assign positions by level
    Object.keys(levelNodes).forEach(lvlStr => {
      const lvl = parseInt(lvlStr);
      const nodeIds = levelNodes[lvl];
      const posX = startX + (lvl - 1) * gapX;

      nodeIds.forEach((nid, i) => {
        const node = this.findNode(nid);
        if (node && node.app_type !== "trigger") {
          const posY = startY + (i * 150);
          node.position = { x: posX, y: posY };
        }
      });
    });

    this.render();
    setTimeout(() => this.fitToScreen(), 60);
  }

  resetView() {
    this.fitToScreen();
  }

  zoomIn() {
    this.scale = Math.min(3.0, this.scale + 0.15);
    this.updateTransform();
  }

  zoomOut() {
    this.scale = Math.max(0.2, this.scale - 0.15);
    this.updateTransform();
  }

  updateStats() {
    const triggerCountEl = document.getElementById("stat-triggers-count");
    const actionCountEl = document.getElementById("stat-actions-count");
    const branchCountEl = document.getElementById("stat-branches-count");

    if (triggerCountEl) triggerCountEl.textContent = this.workflow.triggers.length;
    if (actionCountEl) actionCountEl.textContent = this.workflow.actions.length;
    if (branchCountEl) branchCountEl.textContent = this.workflow.branches.length;
  }

  // Visual Step-by-Step Simulation Execution with Branch Condition Awareness
  async animateExecution(steps, onStepComplete) {
    // Reset highlights
    document.querySelectorAll(".workflow-node").forEach(n => {
      n.classList.remove("node-executing", "node-success", "node-failed");
      n.style.opacity = "";
    });
    document.querySelectorAll(".edge-path").forEach(e => {
      e.classList.remove("edge-executing", "edge-success", "edge-muted");
      const branchId = e.id ? e.id.replace("edge-", "") : "";
      const branch = this.workflow.branches.find(b => b.id === branchId);
      const branchType = branch ? this.getBranchType(branch) : "";
      e.setAttribute(
        "marker-end",
        branchType === "true"
          ? "url(#arrowhead-true)"
          : branchType === "false"
            ? "url(#arrowhead-false)"
            : "url(#arrowhead)"
      );
      e.style.opacity = "";
    });

    const triggers = this.workflow.triggers || [];
    const branches = this.workflow.branches || [];

    // Graph Traversal with branch condition awareness
    const executedNodeIds = new Set();
    const skippedNodeIds = new Set();
    const activeEdges = new Set();
    const mutedEdges = new Set();
    const queue = triggers.map(t => t.id);

    let stepIdx = 0;
    const totalCount = this.getAllNodes().length;

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (executedNodeIds.has(currentId) || skippedNodeIds.has(currentId)) continue;

      const node = this.findNode(currentId);
      if (!node) continue;

      const nodeEl = document.getElementById(`node-${node.id}`);
      if (nodeEl) {
        nodeEl.classList.add("node-executing");
        await new Promise(r => setTimeout(r, 450));
        nodeEl.classList.remove("node-executing");
        nodeEl.classList.add("node-success");
      }

      executedNodeIds.add(currentId);
      stepIdx++;
      if (onStepComplete) {
        onStepComplete(node, stepIdx, totalCount);
      }

      // Check if current node is a decision/branch node
      const isBranch = (node.app_type === "branch" || (node.name && node.name.includes("CONDITION")));
      const outgoing = branches.filter(b => b.source_id === currentId);

      // Determine branch result if it is a branch node
      let branchResult = true;
      if (isBranch) {
        const storedOut = (window.nodeExecutionOutputs && window.nodeExecutionOutputs[node.id]) || {};
        branchResult = (storedOut.result !== undefined) ? !!storedOut.result : true;
      }

      outgoing.forEach(b => {
        const branchType = this.getBranchType(b);
        
        let shouldTakeBranch = true;
        if (isBranch) {
          if (branchType === "true") shouldTakeBranch = branchResult;
          if (branchType === "false") shouldTakeBranch = !branchResult;
        }

        const edgeEl = document.getElementById(`edge-${b.id}`);
        if (shouldTakeBranch) {
          activeEdges.add(b.id);
          if (edgeEl) {
            edgeEl.classList.add("edge-success");
            edgeEl.setAttribute(
              "marker-end",
              branchType === "true"
                ? "url(#arrowhead-true)"
                : branchType === "false"
                  ? "url(#arrowhead-false)"
                  : "url(#arrowhead-success)"
            );
          }
          if (!executedNodeIds.has(b.destination_id)) {
            queue.push(b.destination_id);
          }
        } else {
          mutedEdges.add(b.id);
          if (edgeEl) {
            edgeEl.classList.add("edge-muted");
            edgeEl.style.opacity = "0.2";
          }
          skippedNodeIds.add(b.destination_id);
          const destEl = document.getElementById(`node-${b.destination_id}`);
          if (destEl) {
            destEl.style.opacity = "0.35";
          }
        }
      });

      await new Promise(r => setTimeout(r, 200));
    }
  }
}
