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

    const readFileAsDataUrl = (f: File): Promise<string> => {
      return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = (e) => rej(e);
        reader.readAsDataURL(f);
      });
    };

    const item = await new Promise<PostImageItem>((resolve) => {
      let isDone = false;
      const timeoutTimer = setTimeout(async () => {
        if (!isDone) {
          isDone = true;
          console.warn(`Storage upload timed out for ${file.name}, using local Data URL fallback.`);
          try {
            const dataUrl = await readFileAsDataUrl(file);
            resolve({ storagePath: `local_${Date.now()}_${cleanName}`, downloadUrl: dataUrl });
          } catch {
            resolve({ storagePath: `local_${Date.now()}_${cleanName}`, downloadUrl: '' });
          }
        }
      }, 7000);

      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(idx, progress);
        },
        async (error) => {
          console.error(`Storage error uploading post image ${file.name}, using fallback:`, error);
          if (!isDone) {
            isDone = true;
            clearTimeout(timeoutTimer);
            try {
              const dataUrl = await readFileAsDataUrl(file);
              resolve({ storagePath: `local_${Date.now()}_${cleanName}`, downloadUrl: dataUrl });
            } catch {
              resolve({ storagePath: `local_${Date.now()}_${cleanName}`, downloadUrl: '' });
            }
          }
        },
        async () => {
          if (!isDone) {
            isDone = true;
            clearTimeout(timeoutTimer);
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ storagePath, downloadUrl });
            } catch {
              const dataUrl = await readFileAsDataUrl(file);
              resolve({ storagePath, downloadUrl: dataUrl });
            }
          }
        }
      );
    });

    results.push(item);
  }

  return results;
};

/**
 * Uploads a single story photo to storyMedia/{userId}/{storyId}/{filename}.
 */
export const uploadSingleStoryImage = async (
  file: File,
  userId: string,
  storyId: string
): Promise<{ url: string; storagePath: string }> => {
  if (!file) throw new Error('File required.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image size exceeds 10MB limit.');
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Unsupported image format.');

  const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
  const storagePath = `storyMedia/${userId}/${storyId}/${filename}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      null,
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, storagePath });
      }
    );
  });
};
