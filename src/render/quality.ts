// Quality setting (SPEC §10.10): Auto picks by GPU and resolution; High and Low are explicit.
import type * as THREE from 'three';

export type QualitySetting = 'auto' | 'high' | 'low';
export type QualityLevel = 'high' | 'low';

export interface QualityProfile {
  level: QualityLevel;
  boardTexture: number;
  tableTexture: number;
  shadowMap: number;
  msaa: number;
  fxaa: boolean;
  diceAtlas: number;
}

export function profileFor(level: QualityLevel, maxTextureSize: number): QualityProfile {
  if (level === 'high') {
    return {
      level,
      boardTexture: Math.min(8192, maxTextureSize),
      tableTexture: 2048,
      shadowMap: 4096,
      msaa: 4,
      fxaa: false,
      diceAtlas: 512,
    };
  }
  return {
    level,
    boardTexture: Math.min(4096, maxTextureSize),
    tableTexture: 1024,
    shadowMap: 2048,
    msaa: 0,
    fxaa: true,
    diceAtlas: 256,
  };
}

export function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return String(name ?? 'unknown');
}

/** Integrated, mobile and software GPUs, by their WebGL renderer string. */
export function isIntegratedGpu(name: string): boolean {
  const n = name.toLowerCase();
  // Intel Arc is discrete; every other Intel GPU is integrated.
  if (/intel.*\barc\b/.test(n)) return false;
  return /(intel|uhd|iris|hd graphics|mali|adreno|powervr|apple|swiftshader|llvmpipe|microsoft basic|radeon\(tm\) graphics|vega \d+ graphics|radeon \d{3}m\b)/.test(n);
}

/** Auto picks a level from the GPU name and texture limit. */
export function autoLevelFor(name: string, maxTextureSize: number): QualityLevel {
  if (isIntegratedGpu(name)) return 'low';
  if (maxTextureSize < 8192) return 'low';
  return 'high';
}

/** Auto: integrated / mobile GPUs get Low; discrete GPUs get High. */
export function autoLevel(renderer: THREE.WebGLRenderer): QualityLevel {
  return autoLevelFor(gpuName(renderer), renderer.capabilities.maxTextureSize);
}

export function resolveLevel(setting: QualitySetting, renderer: THREE.WebGLRenderer): QualityLevel {
  return setting === 'auto' ? autoLevel(renderer) : setting;
}
