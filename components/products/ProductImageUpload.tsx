'use client';

// React
import { useState, useRef } from 'react';

// Next Js
import Image from 'next/image';

// Icons
import { Upload, Loader2 } from 'lucide-react';

// Dependencies
import imageCompression from 'browser-image-compression';
import posthog from 'posthog-js';

// Actions
import { getPresignedUploadUrl } from '@/actions/s3';

// Constants
import { CLICK_TO_UPLOAD, DRAG_AND_DROP, IMAGE_UPLOAD_ATTEMPT } from '@/lib/posthog/constants';

// Types
interface ImageUploadProps {
  value: string; // The S3 URL or Key
  onChange: (url: string) => void;
}

export const ProductImageUpload = ({ value, onChange }: ImageUploadProps) => {
  // States
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Functions
  const handleUpload = async (file: File, uploadType: string) => {
    // Record PostHog event
    posthog.capture(IMAGE_UPLOAD_ATTEMPT, { method: uploadType });

    if (!file.type.startsWith('image/')) return alert('Please upload an image.');

    try {
      setIsUploading(true);

      // 1. Client-Side Compression
      const options = {
        maxSizeMB: 0.8, // Target < 800KB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp' as string, // Force conversion to WebP
      };

      const compressedFile = await imageCompression(file, options);

      // 2. Get the Pre-signed URL from your Server Action
      const { success, url, resourceKey } = await getPresignedUploadUrl(compressedFile.name, compressedFile.type, compressedFile.size);
      if (!success || !url) throw new Error('Failed to get upload URL');

      // 3. PUT the file directly to S3
      const uploadResponse = await fetch(url, { method: 'PUT', body: compressedFile, headers: { 'Content-Type': compressedFile.type } });
      if (!uploadResponse.ok) throw new Error('S3 Upload Failed');

      // 4. Success! Update the form state with the S3 Resource Key or URL
      const finalUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${resourceKey}`;
      onChange(finalUrl);
    } catch (error) {
      console.error('Upload Error:', error);
      alert('Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Product Image</label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0], DRAG_AND_DROP);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex min-h-37.5 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-950 hover:border-slate-500'} ${value ? 'p-0' : 'p-6'}`}>
        <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], CLICK_TO_UPLOAD)} />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-400">Crushing & Uploading...</p>
          </div>
        ) : value ? (
          <div className="group relative h-40 w-full">
            <Image src={value} alt="Preview" fill sizes="(max-width: 768px) 100vw, 300px" className="rounded-lg object-contain" />

            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-xs font-medium text-white">Click to Replace</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 rounded-full bg-slate-800 p-2">
              <Upload className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
            </p>
            <p className="mt-1 text-xs text-slate-500">WEBP, PNG, JPG (Max 5MB)</p>
          </div>
        )}
      </div>
    </div>
  );
};
