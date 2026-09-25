// Kompresi foto dokumentasi TTD ke WebP (client-side, Canvas API, tanpa dependensi).
// Alur: createImageBitmap (hormati orientasi EXIF) -> scale-to-fit maxDim ->
// canvas.toBlob('image/webp', q). Tangga kualitas 0.82 -> 0.7/0.55/0.4 pada
// dimensi penuh dulu, lalu turun ke dimensi 1024/800 sampai di bawah budget
// atau throw error eksplisit. File mentah TIDAK PERNAH diunggah.

export interface CompressOptions {
  maxDim?: number;
  maxBytes?: number;
}

export interface CompressResult {
  blob: Blob;
  beforeKB: number;
  afterKB: number;
}

const DEFAULT_MAX_DIM = 1280;
const DEFAULT_MAX_BYTES = 256000;

const QUALITY_LADDER = [0.82, 0.7, 0.55, 0.4];
const DIM_FALLBACKS = [1024, 800];

function scaleToFit(width: number, height: number, maxDim: number): { w: number; h: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { w: width, h: height };
  const scale = maxDim / longest;
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

function canvasToWebBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal mengompresi gambar (browser tidak mendukung WebP).'));
      },
      'image/webp',
      quality,
    );
  });
}

export async function compressToWebP(file: File, options?: CompressOptions): Promise<CompressResult> {
  const maxDim = options?.maxDim ?? DEFAULT_MAX_DIM;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const beforeKB = file.size / 1024;

  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPEG/PNG/WebP).');
  }

  let bitmap: ImageBitmap;
  try {
    // imageOrientation 'from-image' = hormati orientasi EXIF (foto HP tidak miring).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Gagal membaca file gambar. Pastikan file tidak rusak.');
  }

  try {
    const dims = [maxDim, ...DIM_FALLBACKS.filter((d) => d < maxDim)];
    let lastBlob: Blob | null = null;
    for (const dim of dims) {
      const { w, h } = scaleToFit(bitmap.width, bitmap.height, dim);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Gagal mengompresi gambar (Canvas tidak tersedia).');
      ctx.drawImage(bitmap, 0, 0, w, h);
      for (const q of QUALITY_LADDER) {
        const blob = await canvasToWebBlob(canvas, q);
        lastBlob = blob;
        if (blob.size <= maxBytes) {
          return { blob, beforeKB, afterKB: blob.size / 1024 };
        }
      }
    }
    const afterKB = (lastBlob?.size ?? 0) / 1024;
    throw new Error(
      `Foto terlalu besar (hasil terkecil ${formatSizeId(afterKB * 1024)} melebihi batas ${formatSizeId(maxBytes)}). Coba foto lain dengan resolusi lebih kecil.`,
    );
  } finally {
    bitmap.close();
  }
}

// Format ukuran gaya id-ID untuk label kompres ("3,1 MB → 184 KB").
export function formatSizeId(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
  }
  const kb = bytes / 1024;
  return `${Math.round(kb).toLocaleString('id-ID')} KB`;
}
