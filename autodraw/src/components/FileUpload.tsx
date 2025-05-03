"use client";

import Image from "next/image";
import { useState, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Stage } from "@react-three/drei";
import dynamic from "next/dynamic";

// Dynamically import DxfEditor to avoid SSR issues
const DxfEditor = dynamic(() => import("./DxfEditor"), {
  ssr: false,
});

function Model() {
  const { scene } = useGLTF("/flange.gltf");
  return <primitive object={scene} scale={0.5} />;
}

export default function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDxfEditor, setShowDxfEditor] = useState(false);
  const [dxfContent, setDxfContent] = useState<string>("");
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      // Check if it's a DXF file
      if (droppedFile.name.toLowerCase().endsWith('.dxf')) {
        handleDxfFile(droppedFile);
      } else {
        setShowModal(true);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Check if it's a DXF file
      if (selectedFile.name.toLowerCase().endsWith('.dxf')) {
        handleDxfFile(selectedFile);
      } else {
        setShowModal(true);
      }
    }
  };
  
  const handleDxfFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDxfContent(content);
      setShowDxfEditor(true);
    };
    reader.readAsText(file);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFile(null);
  };
  
  const handleCloseDxfEditor = () => {
    setShowDxfEditor(false);
    setDxfContent("");
    setFile(null);
  };

  return (
    <>
      {/* Drag and Drop Area */}
      <div
        ref={dropRef}
        className={`w-full max-w-md h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-6 transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-700"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Image 
          src="/file.svg" 
          alt="File icon" 
          width={64} 
          height={64} 
          className="mb-4 dark:invert" 
        />
        <p className="text-center mb-4">
          {isDragging ? "Drop file here" : "Drag a file here to upload"}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">or</p>
        <label className="cursor-pointer bg-foreground text-background px-4 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-300 transition-colors">
          Select file
          <input 
            type="file" 
            className="hidden" 
            accept=".dxf,.gltf,.glb,.obj"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* 3D Model Viewer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-background p-8 rounded-lg max-w-4xl w-full">
            <h2 className="text-xl font-bold mb-4">3D Model Viewer</h2>
            {file && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
            <div className="w-full h-[600px] mb-4">
              <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
                <Stage environment="city" intensity={0.6}>
                  <Suspense fallback={null}>
                    <Model />
                  </Suspense>
                </Stage>
                <OrbitControls 
                  minPolarAngle={0} 
                  maxPolarAngle={Math.PI / 2}
                  enablePan={true}
                  enableZoom={true}
                />
              </Canvas>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCloseModal}
                className="bg-foreground text-background px-4 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* DXF Editor Modal */}
      {showDxfEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-background p-4 rounded-lg w-[95%] h-[90%] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">DXF Editor</h2>
              <button
                onClick={handleCloseDxfEditor}
                className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition-colors"
              >
                Close
              </button>
            </div>
            {/* @ts-ignore - The component accepts initialDxf prop */}
            <DxfEditor initialDxf={dxfContent} />
          </div>
        </div>
      )}
    </>
  );
} 