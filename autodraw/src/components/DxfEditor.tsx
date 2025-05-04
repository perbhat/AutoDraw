// components/DxfEditor.tsx
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DxfParser } from 'dxf-parser';
import Drawing from 'dxf-writer';

// Define the Unit type to match dxf-writer's expected type
type Unit =
  | "Unitless"
  | "Inches"
  | "Feet"
  | "Miles"
  | "Millimeters"
  | "Centimeters"
  | "Meters"
  | "Kilometers"
  | "Microinches"
  | "Mils"
  | "Yards"
  | "Angstroms"
  | "Nanometers"
  | "Microns"
  | "Decimeters"
  | "Decameters"
  | "Hectometers"
  | "Gigameters"
  | "Astronomical units"
  | "Light years"
  | "Parsecs";

// Dynamically import Three-DXF to avoid SSR issues
const ThreeDxfViewer = dynamic(() => import('./index').then(mod => ({ default: mod.ThreeDxfViewer })), {
  ssr: false,
});

interface DxfEditorProps {
  initialDxf?: string;
}

const DxfEditor: React.FC<DxfEditorProps> = ({ initialDxf }) => {
  const [dxfContent, setDxfContent] = useState<string>('');
  const [parsedDxf, setParsedDxf] = useState<any>(null);
  const [placeholder, setPlaceholder] = useState<string>('');
  const [newText, setNewText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    if (initialDxf) {
      loadDxf(initialDxf);
    }
  }, [initialDxf]);

  const loadDxf = (content: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const parser = new DxfParser();
      const parsed = parser.parseSync(content);
      setParsedDxf(parsed);
      setDxfContent(content);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to parse DXF:', err);
      setError(`Failed to parse DXF: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      loadDxf(content);
    };
    reader.readAsText(file);
  };

  const replaceText = () => {
    if (!parsedDxf || !placeholder) return;

    setIsLoading(true);
    
    try {
      // Create a deep copy of the parsed DXF
      const updatedDxf = JSON.parse(JSON.stringify(parsedDxf));
      
      // Find and replace text in entities
      if (updatedDxf.entities) {
        updatedDxf.entities = updatedDxf.entities.map((entity: any) => {
          if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && 
              entity.text && entity.text.includes(placeholder)) {
            return {
              ...entity,
              text: entity.text.replace(placeholder, newText),
            };
          }
          return entity;
        });
      }
      
      setParsedDxf(updatedDxf);
      
      // Create a new DXF from scratch using dxf-writer
      const drawing = new Drawing();
      
      // Set up the units
      if (parsedDxf.header && parsedDxf.header.measurement) {
        // Map measurement values to unit strings
        const unitMapping: Unit[] = [
          "Unitless",      // 0
          "Inches",        // 1
          "Feet",          // 2
          "Miles",         // 3
          "Millimeters",   // 4
          "Centimeters",   // 5
          "Meters",        // 6
          "Kilometers",    // 7
          "Microinches",   // 8
          "Mils",          // 9
          "Yards",         // 10
          "Angstroms",     // 11
          "Nanometers",    // 12
          "Microns",       // 13
          "Decimeters",    // 14
          "Decameters",    // 15
          "Hectometers",   // 16
          "Gigameters",    // 17
          "Astronomical units", // 18
          "Light years",    // 19
          "Parsecs"        // 20
        ];
        
        const unitIndex = parsedDxf.header.measurement;
        if (unitIndex >= 0 && unitIndex < unitMapping.length) {
          drawing.setUnits(unitMapping[unitIndex]);
        } else {
          // Default to millimeters if the unit is not recognized
          drawing.setUnits("Millimeters" as Unit);
        }
      }
      
      // Set up layers
      if (parsedDxf.tables && parsedDxf.tables.layer && parsedDxf.tables.layer.layers) {
        for (const layerName in parsedDxf.tables.layer.layers) {
          const layer = parsedDxf.tables.layer.layers[layerName];
          drawing.addLayer(
            layer.name, 
            layer.color !== undefined ? layer.color : Drawing.ACI.WHITE,
            layer.lineType || 'CONTINUOUS'
          );
        }
      }
      
      // Add entities from the updated DXF
      updatedDxf.entities.forEach((entity: any) => {
        if (entity.layer) {
          drawing.setActiveLayer(entity.layer);
        }
        
        switch (entity.type) {
          case 'TEXT':
            if (entity.position) {
              drawing.drawText(
                entity.position.x || 0,
                entity.position.y || 0,
                entity.height || 10,
                entity.rotation || 0,
                entity.text || ''
              );
            }
            break;
            
          case 'MTEXT':
            if (entity.position) {
              drawing.drawText(
                entity.position.x || 0,
                entity.position.y || 0,
                entity.height || 10,
                entity.rotation || 0,
                entity.text || ''
              );
            }
            break;
            
          case 'LINE':
            if (entity.start && entity.end) {
              drawing.drawLine(
                entity.start.x || 0,
                entity.start.y || 0,
                entity.end.x || 0,
                entity.end.y || 0
              );
            }
            break;
            
          case 'CIRCLE':
            if (entity.center) {
              drawing.drawCircle(
                entity.center.x || 0,
                entity.center.y || 0,
                entity.radius || 1
              );
            }
            break;
            
          case 'ARC':
            if (entity.center) {
              drawing.drawArc(
                entity.center.x || 0,
                entity.center.y || 0,
                entity.radius || 1,
                entity.startAngle || 0,
                entity.endAngle || Math.PI * 2
              );
            }
            break;
            
          case 'POLYLINE':
          case 'LWPOLYLINE':
            if (entity.vertices) {
              const points = entity.vertices.map((vertex: any) => [
                vertex.x || 0,
                vertex.y || 0
              ]);
              drawing.drawPolyline(points, entity.closed || false);
            }
            break;
            
          // Add more entity types as needed
        }
      });
      
      // Convert to DXF string
      const newDxfContent = drawing.toDxfString();
      setDxfContent(newDxfContent);
      
      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to replace text:', err);
      setError(`Failed to replace text: ${err.message}`);
      setIsLoading(false);
    }
  };

  const downloadDxf = () => {
    if (!dxfContent) return;

    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? `edited_${fileName}` : 'edited.dxf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const createNewDxf = () => {
    // Create a simple DXF with some placeholder text
    const drawing = new Drawing();
    drawing.setUnits('Millimeters');
    
    // Default layer
    drawing.drawText(10, 10, 10, 0, 'PLACEHOLDER_TEXT');
    
    // Add a green layer with some elements
    drawing.addLayer('Green_Layer', Drawing.ACI.GREEN, 'CONTINUOUS');
    drawing.setActiveLayer('Green_Layer');
    drawing.drawCircle(50, 50, 25);
    drawing.drawLine(0, 0, 100, 100);
    
    // Convert to string and load it
    const newDxfContent = drawing.toDxfString();
    loadDxf(newDxfContent);
    
    // Set the placeholder text
    setPlaceholder('PLACEHOLDER_TEXT');
  };

  const clearDxf = () => {
    setDxfContent('');
    setParsedDxf(null);
    setPlaceholder('');
    setNewText('');
    setError(null);
    setFileName('');
    
    // Clear the file input
    const fileInput = document.getElementById('dxf-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="dxf-editor-container">
      <div className="dxf-controls">
        <div className="control-section">
          <h3>DXF File {fileName && `- ${fileName}`}</h3>
          <div className="button-group">
            <button onClick={createNewDxf} className="btn">Create New DXF</button>
            <div className="file-upload">
              <label htmlFor="dxf-upload" className="btn upload-btn">Upload DXF</label>
              <input
                id="dxf-upload"
                type="file"
                accept=".dxf"
                onChange={handleFileUpload}
              />
            </div>
            <button 
              onClick={downloadDxf} 
              disabled={!dxfContent}
              className="btn"
            >
              Download DXF
            </button>
            <button 
              onClick={clearDxf} 
              disabled={!dxfContent}
              className="btn clear-btn"
            >
              Clear
            </button>
          </div>
        </div>
        
        <div className="control-section">
          <h3>Edit Text</h3>
          <div className="edit-controls">
            <div className="input-group">
              <label htmlFor="placeholder-text">Find Text:</label>
              <input
                id="placeholder-text"
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Text to replace"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="new-text">Replace With:</label>
              <input
                id="new-text"
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="New text"
              />
            </div>
            
            <button 
              onClick={replaceText} 
              disabled={!parsedDxf || !placeholder}
            >
              Replace Text
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : parsedDxf ? (
        <div className="dxf-viewer-container">
          <ThreeDxfViewer dxf={parsedDxf} width={800} height={600} />
        </div>
      ) : (
        <div className="empty-state">
          <p>No DXF file loaded. Create a new one or upload an existing file.</p>
        </div>
      )}
      
      <style jsx>{`
        .dxf-editor-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .dxf-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .control-section {
          flex: 1;
          min-width: 300px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          background-color: white;
        }
        
        .control-section h3 {
          margin-top: 0;
          margin-bottom: 16px;
          color: #333;
          font-weight: 600;
        }

        .button-group {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background-color: #3b82f6;
          color: white;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .btn:hover {
          background-color: #2563eb;
        }

        .btn:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }

        .upload-btn {
          display: inline-block;
          text-align: center;
        }

        .clear-btn {
          background-color: #ef4444;
        }

        .clear-btn:hover {
          background-color: #dc2626;
        }

        .file-upload input {
          display: none;
        }

        .edit-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-group input {
          padding: 8px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }

        .error-message {
          padding: 12px;
          background-color: #fee2e2;
          border: 1px solid #ef4444;
          border-radius: 4px;
          color: #b91c1c;
          margin-bottom: 16px;
        }

        .loading {
          padding: 20px;
          text-align: center;
          font-style: italic;
          color: #6b7280;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          background-color: #f3f4f6;
          border-radius: 8px;
          color: #4b5563;
        }

        .dxf-viewer-container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          background-color: white;
        }
      `}</style>
    </div>
  );
}

export default DxfEditor;
