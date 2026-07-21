// ============================================================
// Device capability detection — pure functions, no React.
// ============================================================
//
// Dùng cho Polygon 3D scene fork setting theo device tier.
//
// Detection strategy: kết hợp 2 signal
//   1. Static heuristic — viewport, hardwareConcurrency, pointer
//   2. GPU renderer string — WEBGL_debug_renderer_info extension
//      (Intel Iris/UHD, mobile GPU, software renderer → force low)
//
// SSR-safe: guard `typeof window`.
// ============================================================

export type DeviceTier = 'low' | 'high';

/**
 * Regex patterns cho GPU integrated / weak — match → low tier.
 *
 * - intel: Iris Xe, Iris Plus, UHD Graphics, HD Graphics (Intel iGPU
 *   dùng shared memory, dễ bandwidth-bound khi có composite layer lớn)
 * - adreno: Qualcomm mobile GPU (Snapdragon)
 * - mali:   ARM mobile GPU
 * - powervr: Imagination mobile GPU (iPhone cũ, tablet cheap)
 * - llvmpipe / swiftshader: software fallback — CHẮC CHẮN yếu
 *
 * Apple M1/M2/M3 GPU (integrated nhưng mạnh) KHÔNG match — parse ra
 * "Apple M1" không dính patterns.
 */
const LOW_GPU_PATTERNS = [
  /\bintel\b/i,
  /\badreno\b/i,
  /\bmali\b/i,
  /\bpowervr\b/i,
  /\bllvmpipe\b/i,
  /\bswiftshader\b/i,
];

/**
 * Đọc GL_RENDERER qua WEBGL_debug_renderer_info.
 *
 * Tạo 1×1 hidden canvas, get WebGL context, đọc renderer string,
 * dispose context. Cost ~1ms, chạy 1 lần khi component mount.
 *
 * Return null nếu không detect được (extension bị disable trong
 * Firefox privacy mode, hoặc browser không support WebGL).
 */
export function detectGpuRenderer(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    // Cleanup — force lose context để free GPU resources
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return typeof renderer === 'string' ? renderer : null;
  } catch {
    return null;
  }
}

function isLowEndGpu(rendererString: string): boolean {
  return LOW_GPU_PATTERNS.some((p) => p.test(rendererString));
}

/**
 * Detect device tier để chọn render quality.
 *
 * `low` khi match BẤT KỲ 1 điều kiện:
 *   - Viewport width < 1024px (mobile/tablet)
 *   - hardwareConcurrency ≤ 4 (CPU yếu)
 *   - pointer coarse (touch device)
 *   - GPU renderer match LOW_GPU_PATTERNS (integrated iGPU, software)
 *
 * Ngoài ra → `high`.
 */
export function detectDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'high';

  const narrow = window.innerWidth < 1024;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  const gpuRenderer = detectGpuRenderer();
  const weakGpu = gpuRenderer !== null && isLowEndGpu(gpuRenderer);

  return narrow || fewCores || coarsePointer || weakGpu ? 'low' : 'high';
}

/**
 * Check user OS/browser có bật prefers-reduced-motion không.
 *
 * True → caller nên skip animation/scene, render fallback static.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}