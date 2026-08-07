// ============================================================
// Image Studio — Operations library
// ============================================================
// Share Edge Function service-executor for credential selection.
// iLoveIMG API uses same public_key as iLovePDF.
// ============================================================

import { serverExecutor } from '@/lib/service-registry/server-executor';
import type { IlovepdfDescriptor } from '@/lib/service-registry/server-executor';

// iLoveIMG base: https://api.iloveimg.com (used when iLoveIMG bindings configured)

// ─── Helpers ────────────────────────────────────────────────

async function getDescriptor(tool: string): Promise<IlovepdfDescriptor | null> {
  const result = await serverExecutor.execute({
    toolCode: 'image_studio',
    capability: `image.${tool}`,
    payload: { tool },
  });
  if (!result.success || !result.descriptor) return null;
  if (result.descriptor.type !== 'direct_upload') return null;
  return result.descriptor as IlovepdfDescriptor;
}

async function uploadToProvider(
  descriptor: IlovepdfDescriptor,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append('task', descriptor.task);
  form.append('file', file, file.name);

  const res = await fetch(`https://${descriptor.server}/v1/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${descriptor.token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.server_filename;
}

async function processAndDownload(
  descriptor: IlovepdfDescriptor,
  tool: string,
  files: Array<{ server_filename: string; filename: string }>,
  extraParams?: Record<string, unknown>,
): Promise<Blob> {
  const processRes = await fetch(`https://${descriptor.server}/v1/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${descriptor.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task: descriptor.task, tool, files, ...extraParams }),
  });
  if (!processRes.ok) {
    const err = await processRes.json().catch(() => ({}));
    throw new Error(`Process failed: ${(err as { error?: { message?: string } }).error?.message ?? `HTTP ${processRes.status}`}`);
  }

  const downloadRes = await fetch(
    `https://${descriptor.server}/v1/download/${descriptor.task}`,
    { headers: { Authorization: `Bearer ${descriptor.token}` } },
  );
  if (!downloadRes.ok) throw new Error('Download failed');
  return downloadRes.blob();
}

// ─── Operations ─────────────────────────────────────────────

/**
 * Merge images into 1 PDF (each image = 1 page).
 * Uses iLovePDF imagepdf tool (same API, same key).
 */
export async function mergeImagesToPdf(files: File[]): Promise<Blob> {
  if (files.length === 0) throw new Error('Cần ít nhất 1 ảnh');

  // Use iLovePDF (not iLoveIMG) for imagepdf
  const result = await serverExecutor.execute({
    toolCode: 'pdf_studio',
    capability: 'pdf.convert',
    payload: { tool: 'imagepdf' },
  });

  if (!result.success || !result.descriptor || result.descriptor.type !== 'direct_upload') {
    throw new Error('Không lấy được credential');
  }

  const descriptor = result.descriptor as IlovepdfDescriptor;

  // Upload all images
  const serverFiles: Array<{ server_filename: string; filename: string }> = [];
  for (const file of files) {
    const sf = await uploadToProvider(descriptor, file);
    serverFiles.push({ server_filename: sf, filename: file.name });
  }

  // Process
  const processRes = await fetch(`https://${descriptor.server}/v1/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${descriptor.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task: descriptor.task,
      tool: 'imagepdf',
      files: serverFiles,
    }),
  });
  if (!processRes.ok) throw new Error('Gộp ảnh thất bại');

  const downloadRes = await fetch(
    `https://${descriptor.server}/v1/download/${descriptor.task}`,
    { headers: { Authorization: `Bearer ${descriptor.token}` } },
  );
  if (!downloadRes.ok) throw new Error('Download failed');
  return downloadRes.blob();
}

/**
 * Compress image via iLoveIMG API.
 * Note: iLoveIMG uses same public_key as iLovePDF.
 */
export async function compressImage(file: File): Promise<Blob> {
  // Try getting descriptor for image compress
  // Fallback: use client-side canvas compression
  const desc = await getDescriptor('compressimage');

  if (desc) {
    const sf = await uploadToProvider(desc, file);
    return processAndDownload(desc, 'compressimage', [
      { server_filename: sf, filename: file.name },
    ]);
  }

  // Fallback: client-side canvas compression (JPEG quality reduction)
  return compressImageClientSide(file);
}

async function compressImageClientSide(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        0.7, // 70% quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cannot load image')); };
    img.src = url;
  });
}

/**
 * OCR image to text.
 * Uses CloudConvert (image → txt) or Gemini Vision as fallback.
 */
export async function imageToText(file: File): Promise<string> {
  // Try via server executor (CloudConvert image OCR)
  const result = await serverExecutor.execute({
    toolCode: 'image_studio',
    capability: 'image.ocr',
    payload: { tool: 'ocr', output_format: 'txt' },
  });

  if (result.success && result.descriptor) {
    // If we got a descriptor, try OCR via provider
    if (result.descriptor.type === 'direct_upload') {
      const desc = result.descriptor as IlovepdfDescriptor;
      const sf = await uploadToProvider(desc, file);
      const blob = await processAndDownload(desc, 'ocr', [
        { server_filename: sf, filename: file.name },
      ]);
      return blob.text();
    }
  }

  // Fallback: use browser Tesseract or return error
  throw new Error(
    'Image OCR chưa có binding/credential. Cần thêm capability image.ocr vào service registry.',
  );
}


// ─── Upscale Image (Enhance) ────────────────────────────────

/**
 * Upscale image via iLoveIMG upscaleimage tool.
 * Fallback: client-side canvas scale (lower quality).
 */
export async function upscaleImage(file: File, scale: 2 | 4 = 2): Promise<Blob> {
  const desc = await getDescriptor('upscaleimage');

  if (desc) {
    const sf = await uploadToProvider(desc, file);
    return processAndDownload(desc, 'upscaleimage', [
      { server_filename: sf, filename: file.name },
    ], { scale });
  }

  // Fallback: client-side canvas upscale (basic, no AI)
  return upscaleClientSide(file, scale);
}

async function upscaleClientSide(file: File, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Upscale failed')); },
        'image/png',
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cannot load image')); };
    img.src = url;
  });
}

// ─── Add Watermark to Image ─────────────────────────────────

export interface WatermarkImageOptions {
  text: string;
  position: 'center' | 'bottom-right' | 'top-left';
  opacity: number; // 10-100
}

/**
 * Add text watermark to image.
 * Uses client-side canvas (no provider needed for text watermark).
 */
export async function addWatermarkImage(file: File, options: WatermarkImageOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Configure watermark text
      const fontSize = Math.max(16, Math.min(img.width, img.height) * 0.05);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.globalAlpha = options.opacity / 100;
      ctx.fillStyle = 'rgba(128, 128, 128, 1)';

      const metrics = ctx.measureText(options.text);
      let x: number;
      let y: number;

      switch (options.position) {
        case 'top-left':
          x = fontSize;
          y = fontSize * 1.5;
          break;
        case 'bottom-right':
          x = img.width - metrics.width - fontSize;
          y = img.height - fontSize;
          break;
        default: // center
          x = (img.width - metrics.width) / 2;
          y = img.height / 2;
      }

      ctx.fillText(options.text, x, y);
      ctx.globalAlpha = 1;

      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Watermark failed')); },
        file.type || 'image/png',
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cannot load image')); };
    img.src = url;
  });
}
