// components/ThreeDxfViewer.tsx
import React, { useEffect, useRef, useState } from 'react';

interface ThreeDxfViewerProps {
  dxf: any;
  width: number;
  height: number;
}

// Helper function to draw a line on canvas
const drawLine = (
  ctx: CanvasRenderingContext2D, 
  start: [number, number], 
  end: [number, number], 
  color = '#ffffff',
  scale: number,
  offsetX: number,
  offsetY: number
) => {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.moveTo(start[0] * scale + offsetX, -start[1] * scale + offsetY);
  ctx.lineTo(end[0] * scale + offsetX, -end[1] * scale + offsetY);
  ctx.stroke();
};

// Helper function to draw text on canvas
const drawText = (
  ctx: CanvasRenderingContext2D, 
  text: string,
  position: [number, number], 
  color = '#ffffff',
  scale: number,
  offsetX: number,
  offsetY: number
) => {
  ctx.fillStyle = color;
  ctx.font = '12px Arial';
  ctx.fillText(text, position[0] * scale + offsetX, -position[1] * scale + offsetY);
};

// Function to calculate bounds of DXF entities
const calculateBounds = (entities: any[]) => {
  if (!entities || entities.length === 0) return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  entities.forEach(entity => {
    if (entity.type === 'LINE' && entity.vertices) {
      const x1 = entity.vertices[0].x || 0;
      const y1 = entity.vertices[0].y || 0;
      const x2 = entity.vertices[1].x || 0;
      const y2 = entity.vertices[1].y || 0;
      
      minX = Math.min(minX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxX = Math.max(maxX, x1, x2);
      maxY = Math.max(maxY, y1, y2);
    }
    
    if (entity.type === 'TEXT' && entity.position) {
      const x = entity.position.x || 0;
      const y = entity.position.y || 0;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  });
  
  // Add some padding
  const padding = Math.max((maxX - minX), (maxY - minY)) * 0.1;
  
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  };
};

const ThreeDxfViewer: React.FC<ThreeDxfViewerProps> = ({ dxf, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [entities, setEntities] = useState<any[]>([]);
  
  // Extract entities from DXF
  useEffect(() => {
    if (!dxf || !dxf.entities) return;
    setEntities(dxf.entities);
  }, [dxf]);
  
  // Draw the DXF on canvas
  useEffect(() => {
    if (!canvasRef.current || !entities.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate bounds to center and scale the drawing
    const bounds = calculateBounds(entities);
    const boundWidth = bounds.maxX - bounds.minX;
    const boundHeight = bounds.maxY - bounds.minY;
    
    // Calculate scale to fit the drawing in the canvas with some margin
    const scaleX = width / boundWidth;
    const scaleY = height / boundHeight;
    const newScale = Math.min(scaleX, scaleY) * 0.9;
    setScale(newScale);
    
    // Calculate center offset
    const centerX = width / 2 - (bounds.minX + boundWidth / 2) * newScale;
    const centerY = height / 2 + (bounds.minY + boundHeight / 2) * newScale;
    setPan({ x: centerX, y: centerY });
    
  }, [entities, width, height]);
  
  // Redraw when scale or pan changes
  useEffect(() => {
    if (!canvasRef.current || !entities.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5;
    
    const gridSize = 10;
    const gridScale = scale;
    
    // Draw grid lines
    for (let x = 0; x < width; x += gridSize * gridScale) {
      ctx.beginPath();
      ctx.moveTo(x + pan.x % (gridSize * gridScale), 0);
      ctx.lineTo(x + pan.x % (gridSize * gridScale), height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize * gridScale) {
      ctx.beginPath();
      ctx.moveTo(0, y + pan.y % (gridSize * gridScale));
      ctx.lineTo(width, y + pan.y % (gridSize * gridScale));
      ctx.stroke();
    }
    
    // Draw entities
    ctx.lineWidth = 1;
    entities.forEach((entity, index) => {
      if (entity.type === 'LINE' && entity.vertices) {
        const start: [number, number] = [
          entity.vertices[0].x || 0,
          entity.vertices[0].y || 0
        ];
        const end: [number, number] = [
          entity.vertices[1].x || 0,
          entity.vertices[1].y || 0
        ];
        drawLine(ctx, start, end, '#ffffff', scale, pan.x, pan.y);
      }
      
      if (entity.type === 'TEXT' && entity.position) {
        const position: [number, number] = [
          entity.position.x || 0,
          entity.position.y || 0
        ];
        drawText(ctx, entity.text || '', position, '#ffffff', scale, pan.x, pan.y);
      }
    });
    
  }, [entities, scale, pan, width, height]);
  
  // Handle mouse events for pan and zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setPan(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setScale(prevScale => prevScale * zoomFactor);
    
    // Adjust pan to zoom toward mouse position
    setPan(prev => ({
      x: mouseX - (mouseX - prev.x) * zoomFactor,
      y: mouseY - (mouseY - prev.y) * zoomFactor
    }));
  };
  
  return (
    <div style={{ width, height, background: '#1a1a1a', borderRadius: '4px', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};

export default ThreeDxfViewer;
