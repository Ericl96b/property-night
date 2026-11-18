// Startup breakdown: scene stats + resource timing (which requests dominate boot).
const base = process.env.PN_URL ?? 'http://localhost:5173/';
const quality = process.env.PN_QUALITY ?? 'low';

export default {
  url: `${base}?quality=${quality}`,
  steps: [
    { until: () => !!window.__pn?.scene, label: 'booted', timeout: 30000 },
    {
      eval: () => {
        const st = window.__pn.scene.stats;
        const res = performance
          .getEntriesByType('resource')
          .map((e) => ({ n: e.name.split('/').slice(-1)[0].slice(0, 40), start: Math.round(e.startTime), end: Math.round(e.responseEnd), kb: Math.round((e.transferSize || 0) / 1024) }))
          .sort((a, b) => b.end - a.end)
          .slice(0, 12);
        const marks = performance.getEntriesByType('mark').map((m) => `${m.name}@${Math.round(m.startTime)}`);
        return { now: Math.round(performance.now()), scene: { startupMs: Math.round(st.startupMs), tableMs: Math.round(st.tableMs), boardMs: Math.round(st.boardMs), uploadMs: Math.round(st.uploadMs) }, marks, res };
      },
      label: 'boot breakdown',
    },
  ],
};
