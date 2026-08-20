export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MAX_DIMENSION = 1600;
const QUALITY = 0.8;
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

export type CompressionResult = {
  file: File;
  originalSize: number;
  compressed: boolean;
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });

const scaledSize = (width: number, height: number) => {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height };
  }
  const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
};

export const compressImage = async (file: File): Promise<CompressionResult> => {
  const originalSize = file.size;

  if (!COMPRESSIBLE.includes(file.type)) {
    return { file, originalSize, compressed: false };
  }

  try {
    const img = await loadImage(file);
    const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, originalSize, compressed: false };

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    );

    if (!blob || blob.size >= originalSize) {
      return { file, originalSize, compressed: false };
    }

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    const compressedFile = new File([blob], name, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    return { file: compressedFile, originalSize, compressed: true };
  } catch {
    return { file, originalSize, compressed: false };
  }
};
