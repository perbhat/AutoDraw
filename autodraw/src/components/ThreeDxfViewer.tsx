// components/ThreeDxfViewer.tsx
import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';

interface ThreeDxfViewerProps {
  dxf: any;
  width: number;
  height: number;
}

// Simple line component to render DXF lines
const DxfLine = ({ start, end, color = 'white' }: { start: [number, number, number], end: [number, number, number], color?: string }) => {
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([...start, ...end]), 3, false]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} />
    </line>
  );
};

// Simple text component to render DXF text
const DxfText = ({ position, text, color = 'white' }: { position: [number, number, number], text: string, color?: string }) => {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

// Component to render DXF entities
const DxfEntities = ({ dxf }: { dxf: any }) => {
  const [entities, setEntities] = useState<any[]>([]);

  useEffect(() => {
    if (!dxf || !dxf.entities) return;
    
    // Extract entities from DXF
    setEntities(dxf.entities);
  }, [dxf]);

  return (
    <group>
      {entities.map((entity, index) => {
        if (entity.type === 'LINE' && entity.vertices) {
          const start: [number, number, number] = [
            entity.vertices[0].x || 0,
            entity.vertices[0].y || 0,
            entity.vertices[0].z || 0
          ];
          const end: [number, number, number] = [
            entity.vertices[1].x || 0,
            entity.vertices[1].y || 0,
            entity.vertices[1].z || 0
          ];
          return <DxfLine key={`line-${index}`} start={start} end={end} />;
        }
        
        if (entity.type === 'TEXT' && entity.position) {
          const position: [number, number, number] = [
            entity.position.x || 0,
            entity.position.y || 0,
            entity.position.z || 0
          ];
          return <DxfText key={`text-${index}`} position={position} text={entity.text || ''} />;
        }
        
        return null;
      })}
    </group>
  );
};

const ThreeDxfViewer: React.FC<ThreeDxfViewerProps> = ({ dxf, width, height }) => {
  return (
    <div style={{ width, height, background: '#1a1a1a', borderRadius: '4px', overflow: 'hidden' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[10, 10, 10]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <Grid infiniteGrid cellSize={1} cellThickness={0.5} sectionSize={5} sectionThickness={1} />
        {dxf && <DxfEntities dxf={dxf} />}
        <OrbitControls enableDamping dampingFactor={0.25} />
      </Canvas>
    </div>
  );
};

export default ThreeDxfViewer;
