import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import type { PostImageItem } from '../types/models';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const sanitizeFilename = (filename: string): string => {
  if (!filename) return 'media_file';
  const clean = filename.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  return clean.slice(0, 100);
};

/**
 * Uploads up to 5 image files to Firebase Storage path postMedia/{userId}/{postId}/{filename}.
 */
export const uploadPostImages = async (
  files: File[],
  postId: string,
  userId: string,
  onProgress?: (fileIndex: number, pct: number) => void
): Promise<PostImageItem[]> => {
  if (!files || files.length === 0) return [];
  if (files.length > 5) {
    throw new Error('Maximum of 5 images allowed per post.');
  }

  const results: PostImageItem[] = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];

    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File '${file.name}' exceeds the 10MB limit.`);
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`File '${file.name}' is not a supported image format. Allowed: JPEG, PNG, WEBP.`);
    }

    const cleanName = sanitizeFilename(file.name);
    const storagePath = `postMedia/${userId}/${postId}/${Date.now()}_${idx}_${cleanName}`;
    const storageRef = ref(storage, storagePath);

    const item = await new Promise<PostImageItem>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(idx, progress);
        },
        (error) => {
          console.error(`Error uploading post image ${file.name}:`, error);
          reject(new Error(`Failed to upload ${file.name}.`));
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            storagePath,
            downloadUrl,
          });
        }
      );
    });

    results.push(item);
  }

  return results;
};
