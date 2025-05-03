"use client";

import FileUpload from "@/components/FileUpload";

export default function Home() {

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-8">AutoDraw - DXF File Editor</h1>
      <FileUpload />
    </div>
  );
}