import React, { useState } from 'react';
import type { PostImageItem } from '../../types/models';
import { X, Maximize2 } from 'lucide-react';

interface PostImageGalleryProps {
  images?: PostImageItem[];
  imageUrl?: string;
}

export const PostImageGallery: React.FC<PostImageGalleryProps> = ({ images = [], imageUrl }) => {
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);

  // Normalise legacy imageUrl into gallery array if images prop is missing or contains strings
  let gallery: PostImageItem[] = [];
  if (Array.isArray(images) && images.length > 0) {
    gallery = images.map((img: any) => 
      typeof img === 'string' ? { downloadUrl: img, storagePath: '' } : img
    );
  } else if (imageUrl) {
    gallery = [{ downloadUrl: imageUrl, storagePath: '' }];
  }

  if (gallery.length === 0) return null;

  const count = gallery.length;

  const getGridClasses = () => {
    switch (count) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2 sm:grid-cols-3';
      default:
        return 'grid-cols-2 sm:grid-cols-4';
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <div className={`grid gap-2 rounded-2xl overflow-hidden ${getGridClasses()}`}>
        {gallery.slice(0, 5).map((img, idx) => (
          <div
            key={idx}
            onClick={() => setActiveModalImage(img.downloadUrl)}
            className="relative aspect-video sm:aspect-square bg-slate-950 overflow-hidden cursor-pointer group rounded-xl border border-slate-800/80"
          >
            <img
              src={img.downloadUrl}
              alt={`Post media ${idx + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="w-5 h-5 text-white drop-shadow-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Fullscreen Modal */}
      {activeModalImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setActiveModalImage(null)}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={activeModalImage}
            alt="Expanded post media"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl border border-slate-800 shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
