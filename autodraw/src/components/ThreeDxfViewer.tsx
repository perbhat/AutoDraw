// components/ThreeDxfViewer.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ThreeDxfViewerProps {
  dxf: any;
  width: number;
  height: number;
  onDxfChange?: (updatedDxf: any) => void;
}

interface Entity {
  id: string;
  type: string;
  vertices?: {x: number, y: number}[];
  position?: {x: number, y: number};
  text?: string;
  selected?: boolean;
}

// Helper function to draw a line on canvas
const drawLine = (
  ctx: CanvasRenderingContext2D, 
  start: [number, number], 
  end: [number, number], 
  color = '#ffffff',
  scale: number,
  offsetX: number,
  offsetY: number,
  lineWidth = 1,
  selected = false
) => {
  ctx.beginPath();
  ctx.strokeStyle = selected ? '#00AAFF' : color;
  ctx.lineWidth = selected ? lineWidth * 2 : lineWidth;
  ctx.moveTo(start[0] * scale + offsetX, -start[1] * scale + offsetY);
  ctx.lineTo(end[0] * scale + offsetX, -end[1] * scale + offsetY);
  ctx.stroke();
  
  // Draw selection handles if selected
  if (selected) {
    ctx.fillStyle = '#00AAFF';
    ctx.beginPath();
    ctx.arc(start[0] * scale + offsetX, -start[1] * scale + offsetY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(end[0] * scale + offsetX, -end[1] * scale + offsetY, 5, 0, Math.PI * 2);
    ctx.fill();
  }
};

// Helper function to draw text on canvas
const drawText = (
  ctx: CanvasRenderingContext2D, 
  text: string,
  position: [number, number], 
  color = '#ffffff',
  scale: number,
  offsetX: number,
  offsetY: number,
  selected = false
) => {
  ctx.fillStyle = selected ? '#00AAFF' : color;
  ctx.font = selected ? 'bold 12px Arial' : '12px Arial';
  ctx.fillText(text, position[0] * scale + offsetX, -position[1] * scale + offsetY);
  
  // Draw selection box if selected
  if (selected) {
    const metrics = ctx.measureText(text);
    const height = 14; // Approximate text height
    ctx.strokeStyle = '#00AAFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      position[0] * scale + offsetX - 2, 
      -position[1] * scale + offsetY - height + 2,
      metrics.width + 4,
      height + 2
    );
  }
};

// Function to calculate bounds of DXF entities
const calculateBounds = (entities: Entity[]) => {
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

// Helper function to check if a point is near a line
const isPointNearLine = (
  point: {x: number, y: number},
  lineStart: {x: number, y: number},
  lineEnd: {x: number, y: number},
  threshold: number
): boolean => {
  // Calculate the distance from point to line segment
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy) < threshold;
};

// Generate unique ID for entities
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

const ThreeDxfViewer: React.FC<ThreeDxfViewerProps> = ({ dxf, width, height, onDxfChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [entities, setEntities] = useState<Entity[]>([]);
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const animationFrameRef = useRef<number | null>(null);
  
  // Selection state
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [isMovingSelection, setIsMovingSelection] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    x: number, y: number, width: number, height: number
  } | null>(null);
  const [mode, setMode] = useState<'select' | 'move'>('select');
  
  // Key modifiers
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
  
  // Extract entities from DXF and ensure they have IDs
  useEffect(() => {
    if (!dxf || !dxf.entities) return;
    
    // Ensure all entities have an ID
    const entitiesWithIds = dxf.entities.map((entity: any) => {
      if (!entity.id) {
        return { ...entity, id: generateId() };
      }
      return entity;
    });
    
    setEntities(entitiesWithIds);
  }, [dxf]);
  
  // Set up high-DPI canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(pixelRatio, pixelRatio);
    }
  }, [width, height, pixelRatio]);
  
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
  
  // Update entities with selection state
  useEffect(() => {
    setEntities(prevEntities => 
      prevEntities.map(entity => ({
        ...entity,
        selected: selectedEntityIds.includes(entity.id)
      }))
    );
  }, [selectedEntityIds]);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      
      // Delete selected entities
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEntityIds.length > 0) {
          const newEntities = entities.filter(entity => !selectedEntityIds.includes(entity.id));
          setEntities(newEntities);
          setSelectedEntityIds([]);
          
          // Call the change handler if provided
          if (onDxfChange) {
            const updatedDxf = { ...dxf, entities: newEntities };
            onDxfChange(updatedDxf);
          }
        }
      }
      
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedEntityIds([]);
        setSelectionBox(null);
        setSelectionStart(null);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [entities, selectedEntityIds, dxf, onDxfChange]);
  
  // Render function using requestAnimationFrame for smooth rendering
  const renderCanvas = useCallback(() => {
    if (!canvasRef.current || !entities.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with better color
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
      ctx.moveTo(Math.floor(x + pan.x % (gridSize * gridScale)) + 0.5, 0);
      ctx.lineTo(Math.floor(x + pan.x % (gridSize * gridScale)) + 0.5, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize * gridScale) {
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(y + pan.y % (gridSize * gridScale)) + 0.5);
      ctx.lineTo(width, Math.floor(y + pan.y % (gridSize * gridScale)) + 0.5);
      ctx.stroke();
    }
    
    // Draw entities with anti-aliasing
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw non-selected entities first
    entities.filter(entity => !entity.selected).forEach((entity) => {
      if (entity.type === 'LINE' && entity.vertices) {
        const start: [number, number] = [
          entity.vertices[0].x || 0,
          entity.vertices[0].y || 0
        ];
        const end: [number, number] = [
          entity.vertices[1].x || 0,
          entity.vertices[1].y || 0
        ];
        drawLine(ctx, start, end, '#ffffff', scale, pan.x, pan.y, 1.5, false);
      }
      
      if (entity.type === 'TEXT' && entity.position) {
        const position: [number, number] = [
          entity.position.x || 0,
          entity.position.y || 0
        ];
        drawText(ctx, entity.text || '', position, '#ffffff', scale, pan.x, pan.y, false);
      }
    });
    
    // Draw selected entities on top
    entities.filter(entity => entity.selected).forEach((entity) => {
      if (entity.type === 'LINE' && entity.vertices) {
        const start: [number, number] = [
          entity.vertices[0].x || 0,
          entity.vertices[0].y || 0
        ];
        const end: [number, number] = [
          entity.vertices[1].x || 0,
          entity.vertices[1].y || 0
        ];
        drawLine(ctx, start, end, '#ffffff', scale, pan.x, pan.y, 1.5, true);
      }
      
      if (entity.type === 'TEXT' && entity.position) {
        const position: [number, number] = [
          entity.position.x || 0,
          entity.position.y || 0
        ];
        drawText(ctx, entity.text || '', position, '#ffffff', scale, pan.x, pan.y, true);
      }
    });
    
    // Draw selection box if active
    if (selectionBox) {
      ctx.strokeStyle = '#00AAFF';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(
        selectionBox.x,
        selectionBox.y,
        selectionBox.width,
        selectionBox.height
      );
      ctx.setLineDash([]);
    }
    
    // Draw editor mode indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText(`Mode: ${mode === 'select' ? 'Select' : 'Move'}`, 10, 24);
    if (selectedEntityIds.length > 0) {
      ctx.fillText(`Selected: ${selectedEntityIds.length} ${selectedEntityIds.length === 1 ? 'entity' : 'entities'}`, 10, 44);
    }
  }, [entities, scale, pan, width, height, selectionBox, mode, selectedEntityIds]);
  
  // Use requestAnimationFrame for smooth rendering
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const animate = () => {
      renderCanvas();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderCanvas]);
  
  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((x: number, y: number) => {
    return {
      x: (x - pan.x) / scale,
      y: -((y - pan.y) / scale)
    };
  }, [pan, scale]);
  
  // Find entity at a given position
  const findEntityAtPosition = useCallback((x: number, y: number) => {
    const worldPos = screenToWorld(x, y);
    const selectionThreshold = 10 / scale; // Adjust selection area based on zoom level
    
    // Check all entities
    for (const entity of entities) {
      if (entity.type === 'LINE' && entity.vertices) {
        const start = { 
          x: entity.vertices[0].x || 0, 
          y: entity.vertices[0].y || 0 
        };
        const end = { 
          x: entity.vertices[1].x || 0, 
          y: entity.vertices[1].y || 0 
        };
        
        if (isPointNearLine(worldPos, start, end, selectionThreshold)) {
          return entity.id;
        }
      }
      
      if (entity.type === 'TEXT' && entity.position) {
        const textX = entity.position.x || 0;
        const textY = entity.position.y || 0;
        const textLen = (entity.text || '').length * 8 / scale; // Approximate text width
        
        // Check if point is within text bounds
        if (
          worldPos.x >= textX - 2 / scale && 
          worldPos.x <= textX + textLen + 2 / scale &&
          worldPos.y >= textY - 14 / scale && 
          worldPos.y <= textY + 2 / scale
        ) {
          return entity.id;
        }
      }
    }
    
    return null;
  }, [entities, scale, screenToWorld]);
  
  // Handle mouse events for interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a selected entity to move it
    const entityId = findEntityAtPosition(x, y);
    
    if (entityId && (selectedEntityIds.includes(entityId) || e.button === 0)) {
      // Right-click to enter move mode
      if (e.button === 2) {
        e.preventDefault();
        setMode('move');
        if (!selectedEntityIds.includes(entityId)) {
          setSelectedEntityIds([entityId]);
        }
        setIsMovingSelection(true);
      } 
      // Left-click on already selected entity to move
      else if (selectedEntityIds.includes(entityId)) {
        setMode('move');
        setIsMovingSelection(true);
      } 
      // Left-click on non-selected entity to select
      else {
        if (!isShiftPressed) {
          setSelectedEntityIds([entityId]);
        } else {
          setSelectedEntityIds(prev => [...prev, entityId]);
        }
      }
    } 
    // Clicking on empty space
    else if (e.button === 0) {
      // Start a selection box or pan based on mode
      if (mode === 'select') {
        // Begin selection box
        setSelectionStart({ x, y });
        setSelectionBox({ x, y, width: 0, height: 0 });
        
        // Clear selection if not holding shift
        if (!isShiftPressed) {
          setSelectedEntityIds([]);
        }
      } else {
        // Start panning
        setIsDragging(true);
      }
    }
    
    setDragStart({ x: e.clientX, y: e.clientY });
    
    if (canvasRef.current) {
      canvasRef.current.style.cursor = mode === 'move' && (entityId || isMovingSelection) 
        ? 'move' 
        : mode === 'select' 
          ? 'crosshair' 
          : 'grab';
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update selection box if we're making a selection
    if (selectionStart && mode === 'select') {
      setSelectionBox({
        x: Math.min(selectionStart.x, x),
        y: Math.min(selectionStart.y, y),
        width: Math.abs(x - selectionStart.x),
        height: Math.abs(y - selectionStart.y)
      });
      return;
    }
    
    // Move selected entities
    if (isMovingSelection && selectedEntityIds.length > 0) {
      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale * -1; // Invert Y for DXF coordinate system
      
      const updatedEntities = entities.map(entity => {
        if (!selectedEntityIds.includes(entity.id)) return entity;
        
        if (entity.type === 'LINE' && entity.vertices) {
          return {
            ...entity,
            vertices: [
              { 
                x: (entity.vertices[0].x || 0) + dx, 
                y: (entity.vertices[0].y || 0) + dy 
              },
              { 
                x: (entity.vertices[1].x || 0) + dx, 
                y: (entity.vertices[1].y || 0) + dy 
              }
            ]
          };
        }
        
        if (entity.type === 'TEXT' && entity.position) {
          return {
            ...entity,
            position: {
              x: (entity.position.x || 0) + dx,
              y: (entity.position.y || 0) + dy
            }
          };
        }
        
        return entity;
      });
      
      setEntities(updatedEntities);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // Pan the view
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      setPan(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // Update cursor based on what's under it
    const entityId = findEntityAtPosition(x, y);
    if (canvasRef.current) {
      if (entityId) {
        canvasRef.current.style.cursor = mode === 'move' ? 'move' : 'pointer';
      } else {
        canvasRef.current.style.cursor = mode === 'select' ? 'crosshair' : 'grab';
      }
    }
  };
  
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Finalize selection box if we were drawing one
    if (selectionStart && selectionBox && mode === 'select') {
      // Convert screen coordinates of selection box to world coordinates
      const worldSelectionBox = {
        minX: (selectionBox.x - pan.x) / scale,
        minY: -((selectionBox.y + selectionBox.height - pan.y) / scale),
        maxX: (selectionBox.x + selectionBox.width - pan.x) / scale,
        maxY: -((selectionBox.y - pan.y) / scale)
      };
      
      // Find entities in the selection box
      const selectedEntities = entities.filter(entity => {
        if (entity.type === 'LINE' && entity.vertices) {
          const x1 = entity.vertices[0].x || 0;
          const y1 = entity.vertices[0].y || 0;
          const x2 = entity.vertices[1].x || 0;
          const y2 = entity.vertices[1].y || 0;
          
          // Check if either point is in selection box
          return (
            (x1 >= worldSelectionBox.minX && x1 <= worldSelectionBox.maxX &&
             y1 >= worldSelectionBox.minY && y1 <= worldSelectionBox.maxY) ||
            (x2 >= worldSelectionBox.minX && x2 <= worldSelectionBox.maxX &&
             y2 >= worldSelectionBox.minY && y2 <= worldSelectionBox.maxY)
          );
        }
        
        if (entity.type === 'TEXT' && entity.position) {
          const x = entity.position.x || 0;
          const y = entity.position.y || 0;
          
          return (
            x >= worldSelectionBox.minX && x <= worldSelectionBox.maxX &&
            y >= worldSelectionBox.minY && y <= worldSelectionBox.maxY
          );
        }
        
        return false;
      });
      
      if (isShiftPressed) {
        // Add to existing selection
        setSelectedEntityIds(prev => {
          const newIds = selectedEntities.map(e => e.id);
          return [...new Set([...prev, ...newIds])];
        });
      } else {
        // New selection
        setSelectedEntityIds(selectedEntities.map(e => e.id));
      }
    }
    
    // Finalize moving entities
    if (isMovingSelection && selectedEntityIds.length > 0 && onDxfChange) {
      const updatedDxf = { ...dxf, entities };
      onDxfChange(updatedDxf);
    }
    
    // Reset states
    setIsDragging(false);
    setIsMovingSelection(false);
    setSelectionStart(null);
    setSelectionBox(null);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && canvasRef.current) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const entityId = findEntityAtPosition(x, y);
      
      canvasRef.current.style.cursor = entityId 
        ? mode === 'move' ? 'move' : 'pointer'
        : mode === 'select' ? 'crosshair' : 'grab';
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setMode(prev => prev === 'select' ? 'move' : 'select');
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Smoother zoom with smaller increments
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
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
    <div style={{ 
      width, 
      height, 
      background: '#1a1a1a', 
      borderRadius: '4px', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
      />
      
      <div style={{ 
        position: 'absolute', 
        bottom: 10, 
        right: 10, 
        background: 'rgba(0,0,0,0.6)',
        padding: '5px 10px',
        borderRadius: '4px',
        display: 'flex',
        gap: '8px'
      }}>
        <button 
          onClick={() => setMode('select')}
          style={{ 
            background: mode === 'select' ? '#00AAFF' : '#444',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Select
        </button>
        <button 
          onClick={() => setMode('move')}
          style={{ 
            background: mode === 'move' ? '#00AAFF' : '#444',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Move
        </button>
        <button 
          onClick={() => setSelectedEntityIds([])}
          style={{ 
            background: '#444',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};

export default ThreeDxfViewer;
