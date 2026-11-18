// SPEC §10.10: Auto quality picks Low on integrated GPUs.
import { describe, expect, it } from 'vitest';
import { autoLevelFor, isIntegratedGpu, profileFor } from '../src/render/quality';

describe('auto quality', () => {
  it('integrated, mobile and software GPUs get Low', () => {
    for (const n of [
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Mali-G78',
      'Adreno (TM) 650',
      'Google SwiftShader',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
    ])
      expect(autoLevelFor(n, 16384)).toBe('low');
  });

  it('discrete GPUs get High (unless textures are small)', () => {
    for (const n of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ])
      expect(autoLevelFor(n, 16384)).toBe('high');
    expect(isIntegratedGpu('NVIDIA GeForce GTX 1060')).toBe(false);
    expect(autoLevelFor('NVIDIA GeForce GTX 1060', 4096)).toBe('low');
  });

  it('profiles stay within the texture limit', () => {
    expect(profileFor('high', 4096).boardTexture).toBe(4096);
    expect(profileFor('low', 16384).boardTexture).toBe(4096);
    expect(profileFor('high', 16384).msaa).toBe(4);
  });
});
