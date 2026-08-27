import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { storage, logAnalyticsEvent } from '../lib/firebase';
import type { ChatFileAttachment } from '../types/chat';

export const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CHAT_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/zip': 'ZIP',
};

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.ps1', '.js', '.vbs', '.scr', '.msi', '.jar', '.com', '.sh'
];

/**
 * Sanitizes filename to prevent path traversal or unsafe characters.
 */
export const sanitizeFileName = (fileName: string): string => {
  if (!fileName) return 'file';
  const clean = fileName.replace(/[\/\\?%*:|"<>]/g, '_').trim();
  return clean.length > 100 ? clean.slice(-100) : clean;
};

/**
 * Helper to categorize file size for analytics without exposing raw sizes
 */
const getFileSizeBucket = (size: number): string => {
  if (size < 1024 * 1024) return '<1MB';
  if (size < 5 * 1024 * 1024) return '1-5MB';
  return '5-10MB';
};

/**
 * Compresses an image client-side and uploads it to Firebase Storage.
 */
export const uploadPostImage = async (file: File, userId: string): Promise<string> => {
  if (!file || !userId) {
    throw new Error('File and User ID are required for image upload');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image size exceeds 10MB limit. Please select a smaller photo.');
  }

  try {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    };

    const compressedFile = await imageCompression(file, options);
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `posts/${userId}/${timestamp}_${cleanFileName}`;

    const imageRef = ref(storage, storagePath);
    await uploadBytes(imageRef, compressedFile);

    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (error: any) {
    console.error('Error in uploadPostImage:', error);
    throw new Error(error.message || 'Failed to upload image. Please try again.');
  }
};

/**
 * Compresses a chat image client-side and uploads it to Firebase Storage.
 * Storage path: chatMedia/{channelId}/{userId}/{timestamp}_{filename}
 */
export const uploadChatImage = async (
  file: File, 
  channelId: string, 
  userId: string
): Promise<string> => {
  if (!file || !channelId || !userId) {
    throw new Error('File, Channel ID and User ID are required for chat image upload');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (JPEG, PNG, WebP) are allowed.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Chat image exceeds 5MB limit. Please select a smaller photo.');
  }

  try {
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    };

    const compressedFile = await imageCompression(file, options);
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `chatMedia/${channelId}/${userId}/${timestamp}_${cleanFileName}`;

    const imageRef = ref(storage, storagePath);
    await uploadBytes(imageRef, compressedFile);

    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (error: any) {
    console.error('Error in uploadChatImage:', error);
    throw new Error(error.message || 'Failed to upload chat image. Please try again.');
  }
};

/**
 * Uploads a non-image document file to Firebase Storage.
 * Storage path: chatFiles/{channelId}/{userId}/{timestamp}_{cleanFileName}
 */
export const uploadChatFile = async (
  file: File,
  channelId: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<ChatFileAttachment> => {
  if (!file || !channelId || !userId) {
    throw new Error('File, Channel ID and User ID are required for document upload.');
  }

  // File size validation (10MB)
  if (file.size > MAX_CHAT_FILE_SIZE) {
    throw new Error('Files must be 10 MB or smaller.');
  }

  // Extension validation
  const lowerName = file.name.toLowerCase();
  const isDangerous = DANGEROUS_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (isDangerous) {
    throw new Error('Executable and script files are not allowed for security reasons.');
  }

  // MIME type validation
  if (file.type && !ALLOWED_CHAT_FILE_TYPES[file.type]) {
    throw new Error('This file type isn\'t supported. Allowed: PDF, DOC, XLSX, PPT, TXT, CSV, ZIP.');
  }

  const fileBucket = getFileSizeBucket(file.size);
  logAnalyticsEvent('chat_file_upload_started', {
    channelId,
    fileType: file.type || 'unknown',
    fileSizeBucket: fileBucket,
  });

  try {
    const timestamp = Date.now();
    const cleanName = sanitizeFileName(file.name);
    const storagePath = `chatFiles/${channelId}/${userId}/${timestamp}_${cleanName}`;
    const fileRef = ref(storage, storagePath);

    const metadata = {
      contentType: file.type || 'application/octet-stream',
    };

    if (onProgress) {
      const uploadTask = uploadBytesResumable(fileRef, file, metadata);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(progress);
          },
          (err) => reject(err),
          () => resolve()
        );
      });
    } else {
      await uploadBytes(fileRef, file, metadata);
    }

    const downloadUrl = await getDownloadURL(fileRef);

    logAnalyticsEvent('chat_file_upload_completed', {
      channelId,
      fileType: file.type || 'unknown',
      fileSizeBucket: fileBucket,
    });

    return {
      type: 'file',
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      storagePath,
      downloadUrl,
    };
  } catch (error: any) {
    console.error('Error uploading chat document:', error);
    logAnalyticsEvent('chat_file_upload_failed', {
      channelId,
      fileType: file.type || 'unknown',
      error: error.message || 'upload_failed',
    });
    throw new Error(error.message || 'File upload failed. Your message draft is still here.');
  }
};

/**
 * Attempts orphan file cleanup from Storage if message creation fails.
 */
export const deleteChatFile = async (storagePath: string): Promise<void> => {
  if (!storagePath) return;
  try {
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (err) {
    console.error('Failed to cleanup orphan chat file:', err);
  }
};
