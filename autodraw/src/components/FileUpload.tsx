"use client";

import Image from "next/image";
import { useState, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Stage } from "@react-three/drei";

function Model() {
  const { scene } = useGLTF("/flange.gltf");
  return <primitive object={scene} scale={0.5} />;
}

export default function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);
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
      setFile(e.dataTransfer.files[0]);
      setShowModal(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
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
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-background p-8 rounded-lg max-w-4xl w-full">
            <h2 className="text-xl font-bold mb-4">Thanks for uploading</h2>
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
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 