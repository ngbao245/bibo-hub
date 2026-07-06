// ============================================================
// Polygon 3D scene — pure three.js, no React.
// ============================================================
//
// Public API:
//   const handle = createScene(canvas, { tier: 'low' | 'high' });
//   handle.setPaused(true);
//   handle.dispose();
//
// Tier fork (xem specs/portfolio-landing-perf/design.md):
//   - high (default): antialias + DPR 1.5 + plane 40×50 + bloom + composer
//   - low:            antialias off + DPR 1.0 + plane 20×25 + no bloom + renderer trực tiếp
//
// True pause: setPaused(true) cancelAnimationFrame + null out rafId,
// KHÔNG tick RAF trong background (giải phóng frame budget cho scroll).
//
// Resize throttle: wrap trong rAF, skip nếu đã có pending frame.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { DeviceTier } from './deviceCapability';

export interface SceneOptions {
  /** Default 'high' — giữ backward compat với caller cũ */
  tier?: DeviceTier;
}

export interface SceneHandle {
  setPaused: (paused: boolean) => void;
  dispose: () => void;
}

export function createScene(canvas: HTMLCanvasElement, options: SceneOptions = {}): SceneHandle {
  const tier: DeviceTier = options.tier ?? 'high';
  const isLow = tier === 'low';

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Renderer — antialias off trên low để giảm pixel shading cost
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isLow });
  // DPR cap: high=1.5 (retina crisp), low=1.0 (55% ít pixel hơn trên retina)
  const dprCap = isLow ? 1.0 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  renderer.setSize(width, height, true);

  // Scene + camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(-2.52, -5.23, 10.58);
  camera.lookAt(-2.52, -5.23, 0);

  // Moving point light + helper (focal point visual bay quanh)
  const movingLight = new THREE.PointLight(0xffffff, 400, 1000);
  movingLight.position.set(0, 5, 10);
  scene.add(movingLight);
  const lightHelper = new THREE.PointLightHelper(movingLight, 0.5);
  scene.add(lightHelper);

  // Polygon plane — segments giảm 50% trên low tier
  const segX = isLow ? 20 : 40;
  const segY = isLow ? 25 : 50;
  const geometry = new THREE.PlaneGeometry(50, 50, segX, segY);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    positions.setZ(i, (Math.random() - 0.5) * 1);
  }
  positions.needsUpdate = true;

  // Vertex colors dark base #000915
  const r = 0x00 / 255;
  const g = 0x09 / 255;
  const b = 0x15 / 255;
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    colors.push(r, g, b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
    shininess: 100,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.2;
  scene.add(mesh);

  // Ambient + directional
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(10, 10, 5);
  scene.add(dirLight);

  // Postprocessing bloom — CHỈ high tier
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  if (!isLow) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.25, 0.15, 0.1);
    composer.addPass(bloomPass);
  }

  // Resize throttled qua rAF — coalesce burst events thành 1 frame
  let resizeRafId: number | null = null;
  const applyResize = () => {
    resizeRafId = null;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
    composer?.setSize(w, h);
  };
  const handleResize = () => {
    if (resizeRafId !== null) return;
    resizeRafId = requestAnimationFrame(applyResize);
  };
  window.addEventListener('resize', handleResize);

  // RAF loop với true pause
  let rafId: number | null = null;
  let disposed = false;
  let paused = false;

  const tick = () => {
    rafId = null;
    if (disposed || paused) return;

    const t = Date.now() * 0.001;
    movingLight.position.x = Math.sin(t) * 35;
    movingLight.position.z = Math.cos(t) * 35;
    movingLight.position.y = 5 + Math.sin(t * 0.5) * 3;

    mesh.rotation.z += 0.0005;

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(tick);
  };

  const start = () => {
    if (rafId === null && !disposed && !paused) {
      rafId = requestAnimationFrame(tick);
    }
  };

  start();

  return {
    setPaused: (v: boolean) => {
      if (paused === v) return;
      paused = v;
      if (v) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        start();
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      bloomPass?.dispose();
      composer?.dispose();
      renderer.dispose();
      scene.clear();
    },
  };
}