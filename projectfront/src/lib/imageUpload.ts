/**
 * Upload an image to the backend server
 * @param file - The image file to upload
 * @returns Promise with the uploaded image URL
 */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('http://localhost:5000/api/upload/image', {
    method: 'POST',
    body: formData,
    // Note: Don't set Content-Type header, browser will set it automatically with boundary
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload image');
  }

  const data = await response.json();
  return data.imageUrl;
}

/**
 * Example usage in a React component:
 * 
 * const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0];
 *   if (!file) return;
 *   
 *   try {
 *     const imageUrl = await uploadImage(file);
 *     console.log('Image uploaded:', imageUrl);
 *     // Use imageUrl in your application (save to state, database, etc.)
 *   } catch (error) {
 *     console.error('Upload failed:', error);
 *   }
 * };
 */
