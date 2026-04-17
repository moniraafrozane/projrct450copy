'use client';

import React, { useState } from 'react';
import { uploadImage } from '@/lib/imageUpload';
import { Button } from './button';

interface ImageUploadProps {
  onImageUploaded?: (imageUrl: string) => void;
  currentImage?: string;
}

export function ImageUpload({ onImageUploaded, currentImage }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const imageUrl = await uploadImage(file);
      
      // Notify parent component
      if (onImageUploaded) {
        onImageUploaded(imageUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="image-upload" className="text-sm font-medium">
          Upload Image
        </label>
        
        {preview && (
          <div className="relative w-full max-w-md">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg border"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => document.getElementById('image-upload')?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : preview ? 'Change Image' : 'Choose Image'}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        
        <p className="text-xs text-gray-500">
          Accepted formats: JPEG, JPG, PNG, GIF, WebP (Max 5MB)
        </p>
      </div>
    </div>
  );
}
