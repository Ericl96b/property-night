<script lang="ts" module>
  // Approved banknote designs (reference/bills.html), $1–$500.
  export const NOTE_COLOR: Record<number, string> = {
    1: '#F7F1E3',
    5: '#F3D3D6',
    10: '#F4E7A8',
    20: '#CFE3C6',
    50: '#C9DDEE',
    100: '#E9D9BC',
    500: '#F2C79E',
  };
  const WORDS: Record<number, string> = {
    1: 'ONE DOLLARS',
    5: 'FIVE DOLLARS',
    10: 'TEN DOLLARS',
    20: 'TWENTY DOLLARS',
    50: 'FIFTY DOLLARS',
    100: 'ONE HUNDRED DOLLARS',
    500: 'FIVE HUNDRED DOLLARS',
  };
  let uid = 0;
</script>

<script lang="ts">
  let { value, width = 150 }: { value: number; width?: number } = $props();
  const id = `guil-${++uid}`;
  const fill = $derived(NOTE_COLOR[value] ?? '#F7F1E3');
</script>

<svg viewBox="0 0 300 150" width={width} height={width / 2} aria-label="${value} bill" role="img">
  <defs>
    <pattern {id} width="9" height="9" patternUnits="userSpaceOnUse">
      <circle cx="4.5" cy="4.5" r="3.6" fill="none" stroke="rgba(43,33,25,.35)" stroke-width="0.6" />
      <circle cx="0" cy="0" r="3.6" fill="none" stroke="rgba(43,33,25,.22)" stroke-width="0.6" />
      <circle cx="9" cy="9" r="3.6" fill="none" stroke="rgba(43,33,25,.22)" stroke-width="0.6" />
    </pattern>
  </defs>
  <rect width="300" height="150" rx="5" {fill} />
  <rect x="7" y="7" width="286" height="136" rx="3" fill="url(#{id})" stroke="rgba(43,33,25,.55)" stroke-width="1" />
  <rect x="20" y="20" width="260" height="110" rx="2" {fill} stroke="rgba(43,33,25,.55)" stroke-width="1" />
  <circle cx="150" cy="75" r="40" fill="none" stroke="rgba(43,33,25,.35)" stroke-width="1" />
  <circle cx="150" cy="75" r="34" fill="url(#{id})" stroke="rgba(43,33,25,.5)" stroke-width="1" />
  <circle cx="150" cy="75" r="25" {fill} stroke="rgba(43,33,25,.5)" stroke-width="1" />
  <text x="150" y="84" text-anchor="middle" font-family="Fraunces, serif" font-weight="800" font-size="26" fill="#2B2119">{value}</text>
  <text x="150" y="38" text-anchor="middle" font-family="Source Sans 3, sans-serif" font-weight="700" font-size="9" letter-spacing="2.4" fill="#5E4C3B">THE BANK</text>
  <text x="150" y="122" text-anchor="middle" font-family="Fraunces, serif" font-weight="600" font-size="11" letter-spacing="2" fill="#5E4C3B">{WORDS[value]}</text>
  <text x="34" y="46" font-family="Fraunces, serif" font-weight="800" font-size="20" fill="#2B2119">{value}</text>
  <text x="266" y="118" text-anchor="end" font-family="Fraunces, serif" font-weight="800" font-size="20" fill="#2B2119">{value}</text>
</svg>

<style>
  svg {
    display: block;
    filter: drop-shadow(0 6px 8px rgba(15, 7, 2, 0.35));
  }
</style>
