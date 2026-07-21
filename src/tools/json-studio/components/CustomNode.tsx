import React from 'react';
import type { NodeProps } from 'reaflow';
import { Node } from 'reaflow';
import type { NodeData } from '@/tools/json-studio/lib/types';
import { ObjectNode } from './ObjectNode';
import { TextNode } from './TextNode';

// ============================================================
// CustomNode - wrapper Reaflow Node, route sang ObjectNode / TextNode
// Extract từ jsoncrack-react. Apache 2.0 license.
// ============================================================

type CustomNodeProps = NodeProps<NodeData> & {
  onNodeClick?: (node: NodeData) => void;
};

const CustomNodeBase = ({ onNodeClick, ...nodeProps }: CustomNodeProps) => {
  const handleNodeClick = React.useCallback(
    (_: React.MouseEvent<SVGGElement, MouseEvent>, data: NodeData) => {
      onNodeClick?.(data);
    },
    [onNodeClick]
  );

  return (
    <Node
      {...nodeProps}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick={handleNodeClick as any}
      animated={false}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label={null as any}
      onEnter={(event) => {
        event.currentTarget.style.stroke = '#3B82F6';
      }}
      onLeave={(event) => {
        event.currentTarget.style.stroke = 'var(--node-stroke)';
      }}
      style={{
        fill: 'var(--node-fill)',
        stroke: 'var(--node-stroke)',
        strokeWidth: 1,
      }}
    >
      {({ node, x, y }) => {
        if (nodeProps.properties.text[0]?.key == null) {
          return <TextNode node={nodeProps.properties as NodeData} x={x} y={y} />;
        }

        return <ObjectNode node={node as NodeData} x={x} y={y} />;
      }}
    </Node>
  );
};

export const CustomNode = React.memo(CustomNodeBase);