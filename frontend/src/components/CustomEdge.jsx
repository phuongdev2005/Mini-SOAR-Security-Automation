import React, { memo } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const branchType = data?.branch_type || (data?.label?.toLowerCase().includes('false') ? 'false' : data?.label?.toLowerCase().includes('true') ? 'true' : 'default');
  
  let strokeColor = '#94a3b8';
  let badgeColor = '#64748b';
  let badgeBg = 'rgba(30, 41, 59, 0.9)';

  if (branchType === 'true') {
    strokeColor = '#10b981';
    badgeColor = '#34d399';
    badgeBg = 'rgba(6, 78, 59, 0.9)';
  } else if (branchType === 'false') {
    strokeColor = '#ef4444';
    badgeColor = '#f87171';
    badgeBg = 'rgba(127, 29, 29, 0.9)';
  }

  if (selected) {
    strokeColor = '#ff8544';
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.8 : 2,
          transition: 'stroke 0.2s, stroke-width 0.2s'
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              backgroundColor: badgeBg,
              border: `1px solid ${strokeColor}`,
              color: badgeColor,
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.68rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)'
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(CustomEdge);
