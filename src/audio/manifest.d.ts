declare module 'virtual:audio-manifest' {
  /** Sound ID → file URLs relative to the site base (see scripts/audio-manifest.ts). */
  const manifest: Record<string, string[]>;
  export default manifest;
}
