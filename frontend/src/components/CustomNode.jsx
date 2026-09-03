import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const CustomNode = ({ data, selected }) => {
  const { node } = data;
  const isTrigger = node.app_type === 'trigger';
  const isBranch = node.app_type === 'branch' || (node.name && node.name.includes('CONDITION'));
  const isScorer = node.app_type === 'scorer' || (node.name && node.name.includes('SEVERITY'));
  const isFirewall = node.app_id === 'app-iptables';

  let typeClass = 'node-type-action';
  let badgeClass = 'badge-action';
  let badgeText = 'ACTION';

  if (isTrigger) {
    typeClass = 'node-type-trigger';
    badgeClass = 'badge-trigger';
    badgeText = 'TRIGGER';
  } else if (isBranch) {
    typeClass = 'node-type-branch';
    badgeClass = 'badge-branch';
    badgeText = 'ROUTER';
  } else if (isScorer) {
    typeClass = 'node-type-scorer';
    badgeClass = 'badge-scorer';
    badgeText = 'SCORER';
  } else if (isFirewall) {
    typeClass = 'node-type-firewall';
    badgeClass = 'badge-action';
    badgeText = 'FIREWALL';
  }

  const previewParam = (node.parameters && node.parameters.length > 0)
    ? `${node.parameters[0].name}: ${node.parameters[0].value || '...'}`
    : 'Default parameters';

  const iconPath = node.large_image || '/images/apps/generic.svg';

  return (
    <div 
      className={`workflow-node ${typeClass} ${selected ? 'selected' : ''}`}
      style={{ position: 'relative' }}
    >
      {/* Input Handle */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="port port-input"
          style={{ top: '50%' }}
        />
      )}

      {/* Node Header */}
      <div className="node-header">
        <div className="node-title-group">
          <img src={iconPath} className="node-header-icon" alt="" />
          <span className="node-title" title={node.label || node.name}>
            {node.label || node.name}
          </span>
        </div>
        <span className={`node-badge ${badgeClass}`}>{badgeText}</span>
      </div>

      {/* Node Body */}
      <div className="node-body">
        <div className="node-action-name">{node.name || 'Execute'}</div>
        <div className="node-param-preview" title={previewParam}>{previewParam}</div>
      </div>

      {/* Output Handles */}
      {!isBranch ? (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="port port-output"
          style={{ top: '50%' }}
        />
      ) : (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="port port-branch-true"
            style={{ top: '32%' }}
            title="Nhánh TRUE (Escalate)"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="port port-branch-false"
            style={{ top: '68%' }}
            title="Nhánh FALSE (Monitor)"
          />
        </>
      )}
    </div>
  );
};

export default memo(CustomNode);
