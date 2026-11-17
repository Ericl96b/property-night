// Milestone 0 visual prototype (SPEC §14.0). No rules: table, generated board face, lighting,
// all nine tokens, houses and hotels, the §11 dice pipeline, camera rotation and token hops.
import './style.css';
import { CLASSIC_BOARD } from './data/classicBoard';
import { Rng, rollDie, seedRng } from './engine/rng';
import { GameScene } from './render/scene';
import { SIDE_YAW, BOARD_TOP, type Side } from './render/layout';
import { placeFlat, simulateThrow } from './render/diceSim';
import type { TokenId } from './render/tokens/tokens';
import { Hud } from './ui/hud';
import { startInput } from './input/keys';
import type { QualitySetting } from './render/quality';
import type { Speed } from './director/queue';

const PLAYER_COLORS = ['#7B3FE4', '#0F9C84', '#C0582B', '#5B6472', '#C8326E', '#2E7DD7'];
const SIDE_NAMES = ['Bottom', 'Left', 'Top', 'Right'];

interface Seat {
  token: TokenId;
  name: string;
  color: string;
  side: Side;
  cash: number;
}

const SEATS: Seat[] = [
  { token: 'teacup', name: 'Teacup', color: PLAYER_COLORS[0], side: 0, cash: 1500 },
  { token: 'key', name: 'Key', color: PLAYER_COLORS[1], side: 1, cash: 1500 },
  { token: 'bicycle', name: 'Bicycle', color: PLAYER_COLORS[2], side: 2, cash: 1500 },
  { token: 'cat', name: 'Cat', color: PLAYER_COLORS[3], side: 3, cash: 1500 },
];

// The other five tokens, placed around the board so every token can be reviewed.
const LINEUP: [TokenId, string, number][] = [
  ['rocket', PLAYER_COLORS[4], 10],
  ['crown', PLAYER_COLORS[5], 10],
  ['sailboat', PLAYER_COLORS[0], 23],
  ['umbrella', PLAYER_COLORS[1], 16],
  ['gramophone', PLAYER_COLORS[2], 20],
];

// Sample board state: houses and hotels on several bands, owners, mortgages, a promise.
const BUILDINGS: [number, number, boolean][] = [
  [1, 4, false],
  [3, 0, true],
  [6, 2, false],
  [16, 0, true],
  [18, 1, false],
  [21, 2, false],
  [23, 3, false],
  [24, 4, false],
  [31, 2, false],
];
const OWNERS: [number, number][] = [
  [1, 0], [3, 0], [6, 1], [8, 1], [9, 1], [12, 2], [16, 3], [18, 3], [19, 3],
  [21, 2], [23, 2], [24, 2], [26, 0], [31, 1], [32, 1], [34, 1], [37, 3], [39, 0],
];
const MORTGAGED = [12, 37];
const PROMISES = [26];

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  app.textContent = '';
  const splash = document.createElement('div');
  splash.className = 'splash';
  splash.textContent = 'Setting the table…';
  app.append(splash);

  const params = new URLSearchParams(location.search);
  const qualityParam = params.get('quality');
  const initialQuality: QualitySetting = qualityParam === 'high' || qualityParam === 'low' ? qualityParam : 'auto';
  const scene = await GameScene.create(app, CLASSIC_BOARD, initialQuality);

  // Engine RNG (seeded, serializable) decides values; a separate cosmetic RNG throws the dice.
  const seed = Number(params.get('seed') ?? Date.now() % 2 ** 31);
  const engineRng = seedRng(seed);
  const cosmetic = new Rng(seed ^ 0x5bd1e995);

  // Review mode: ?lineup=1 stands all nine tokens on the bottom row (tiles 1–9).
  const lineup = params.get('lineup') === '1';
  if (lineup) {
    const all: TokenId[] = [...SEATS.map((s) => s.token), ...LINEUP.map(([id]) => id)];
    all.forEach((id, i) => scene.tokens.add(id, PLAYER_COLORS[i % PLAYER_COLORS.length], i + 1));
  } else {
    for (const s of SEATS) scene.tokens.add(s.token, s.color, 0);
    for (const [id, color, tile] of LINEUP) scene.tokens.add(id, color, tile);
  }
  for (const [tile, houses, hotel] of BUILDINGS) scene.buildings.set(tile, houses, hotel);
  for (const [tile, seat] of OWNERS) scene.decals.setOwner(tile, PLAYER_COLORS[seat]);
  for (const t of MORTGAGED) scene.decals.setMortgaged(t, true);
  for (const t of PROMISES) scene.decals.setPromise(t, true);

  let active = 0;
  let speed: Speed = 'normal';
  scene.setSpeed(speed);
  const renderer = scene.renderer;

  const hud = new Hud(
    app,
    {
      roll,
      build,
      sell,
      rotate: (d) => {
        if (scene.queue.busy) return;
        const side = ((scene.camera.side + d + 4) % 4) as Side;
        scene.camera.toSide(side);
        renderer.requestRender();
      },
      nextPlayer,
      fullscreen: toggleFullscreen,
      quality: async (q) => {
        hud.setBusy('Generating textures…');
        await new Promise((r) => setTimeout(r, 30));
        await scene.setQuality(q);
        hud.setBusy(null);
        updateStats();
      },
      speed: (s) => {
        speed = s;
        scene.setSpeed(s);
      },
      rotation: (on) => {
        scene.camera.settings.rotation = on;
        scene.camera.toSide(on ? SEATS[active].side : 0);
        renderer.requestRender();
      },
      follow: (on) => {
        scene.camera.settings.follow = on;
      },
      reduceMotion: (on) => {
        scene.camera.settings.reduceMotion = on;
        scene.camera.toSide(SEATS[active].side, true);
        scene.camera.apply();
        renderer.requestRender();
      },
    },
    { quality: initialQuality, speed },
  );
  const refreshSeats = () =>
    hud.setSeats(
      SEATS.map((s) => ({ name: s.name, color: s.color, side: SIDE_NAMES[s.side], cash: s.cash })),
      active,
    );
  refreshSeats();

  function roll(): void {
    if (scene.queue.busy) {
      scene.queue.skip();
      renderer.requestRender();
      return;
    }
    const seat = SEATS[active];
    const values: [number, number] = [rollDie(engineRng), rollDie(engineRng)];
    const opts = { sideYaw: SIDE_YAW[seat.side], floorY: BOARD_TOP };
    const t0 = performance.now();
    const th = speed === 'instant' ? placeFlat(values, cosmetic, opts) : simulateThrow(values, cosmetic, opts);
    const simMs = performance.now() - t0;
    hud.setRoll(values[0], values[1], `${simMs.toFixed(1)} ms pre-sim · ${th.attempts} throw${th.attempts === 1 ? '' : 's'}`);
    hud.log(`${seat.name} rolled ${values[0]} + ${values[1]}${values[0] === values[1] ? ' (doubles)' : ''}`);
    scene.queue.push(
      {
        label: 'dice',
        start: () => scene.dice.play(th, scene.queue.factor),
        finish: () => scene.dice.pose(th, Infinity),
      },
      scene.tokens.hop(
        seat.token,
        values[0] + values[1],
        () => scene.queue.factor,
        (tok, dest) => scene.camera.setFollow(tok, dest),
      ),
    );
    renderer.requestRender();
  }

  function nextPlayer(): void {
    if (scene.queue.busy) return;
    active = (active + 1) % SEATS.length;
    refreshSeats();
    scene.camera.toSide(SEATS[active].side);
    hud.log(`${SEATS[active].name}'s turn`);
    renderer.requestRender();
  }

  function currentStreet(): number | undefined {
    const tile = scene.tokens.tokens.get(SEATS[active].token)!.tile;
    return CLASSIC_BOARD.tiles[tile].type === 'street' ? tile : undefined;
  }

  const DEMO_BUILD = [1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39];
  function build(): void {
    let tile = currentStreet();
    if (tile === undefined || scene.buildings.countOn(tile).hotel) {
      tile = DEMO_BUILD.find((t) => !scene.buildings.countOn(t).hotel && !MORTGAGED.includes(t));
    }
    if (tile === undefined) return;
    const t = tile;
    scene.queue.push({ label: 'build', start: () => scene.buildings.add(t, speed === 'instant' ? 0 : 1 / scene.queue.factor) });
    hud.log(`Built on ${CLASSIC_BOARD.tiles[t].name}`);
    renderer.requestRender();
  }

  function sell(): void {
    let tile = currentStreet();
    if (tile === undefined || !scene.buildings.countOn(tile).houses && !scene.buildings.countOn(tile).hotel) {
      tile = DEMO_BUILD.slice().reverse().find((t) => scene.buildings.countOn(t).houses || scene.buildings.countOn(t).hotel);
    }
    if (tile === undefined) return;
    const t = tile;
    scene.queue.push({ label: 'sell', start: () => scene.buildings.remove(t, speed === 'instant' ? 0 : 1 / scene.queue.factor) });
    hud.log(`Sold a building on ${CLASSIC_BOARD.tiles[t].name}`);
    renderer.requestRender();
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  startInput({
    intent: (i) => {
      switch (i) {
        case 'confirm':
          return roll();
        case 'back':
          if (scene.queue.busy) scene.queue.skip();
          return renderer.requestRender();
        case 'manage':
          return build();
        case 'trade':
          return sell();
        case 'cycleLeft':
        case 'cycleRight':
          if (scene.queue.busy) return;
          scene.camera.toSide(((scene.camera.side + (i === 'cycleLeft' ? -1 : 1) + 4) % 4) as Side);
          return renderer.requestRender();
        case 'nextPlayer':
          return nextPlayer();
        case 'fullscreen':
          return toggleFullscreen();
        case 'log':
          return hud.toggle();
      }
    },
    nudge: (x, y) => {
      scene.camera.setNudge(x, y);
      renderer.wake();
    },
  });

  let lastStats = 0;
  function updateStats(): void {
    const info = renderer.lastRenderInfo;
    const st = scene.stats;
    const b = scene.buildings.totals;
    hud.setStats(
      [
        `<b>${renderer.isRunning ? `${renderer.fps} fps` : 'idle'}</b> · ${info.calls} draw calls · ${(info.triangles / 1000).toFixed(0)}k tris`,
        `Quality <b>${scene.quality.level}</b> (${scene.qualitySetting}) · ${renderer.gl.getPixelRatio()}× DPR · ${renderer.gl.domElement.width}×${renderer.gl.domElement.height}`,
        `Board texture ${st.boardSize}² in <b>${st.boardMs.toFixed(0)} ms</b> · table ${st.tableMs.toFixed(0)} ms · startup ${st.startupMs.toFixed(0)} ms`,
        `Houses ${b.houses}/32 · hotels ${b.hotels}/12 · seed ${seed}`,
        `<span style="opacity:.75">${st.gpu}</span>`,
      ].join('<br>'),
    );
  }
  renderer.onFrame = () => {
    const now = performance.now();
    if (now - lastStats > 250) {
      lastStats = now;
      updateStats();
    }
  };
  // Show "idle" once the loop stops (render on demand).
  setInterval(() => {
    if (!renderer.isRunning) updateStats();
  }, 1000);

  // Review helpers: ?side=0–3 starts facing that side; ?focus=x,z,zoom frames a board point;
  // ?roll=1 rolls once on load; ?hud=0 hides the overlay.
  const sideParam = params.get('side');
  if (sideParam !== null) {
    active = Number(sideParam) % SEATS.length;
    refreshSeats();
    scene.camera.toSide(SEATS[active].side, true);
  }
  const focus = params.get('focus');
  if (focus) {
    const [fx, fz, fk] = focus.split(',').map(Number);
    scene.camera.frame(fx, fz, fk || 0.5);
  }
  if (params.get('hud') === '0') hud.toggle();
  if (params.get('roll') === '1') setTimeout(roll, 300);

  renderer.requestRender();
  hud.log('Prototype ready — press Space or Cross to roll');
  (window as unknown as { __pn: unknown }).__pn = { scene, roll, nextPlayer, build, sell };
  setTimeout(() => splash.classList.add('gone'), 50);
  setTimeout(() => splash.remove(), 700);
  updateStats();
}

boot().catch((e) => {
  console.error(e);
  const app = document.getElementById('app')!;
  app.textContent = `Failed to start: ${e instanceof Error ? e.message : String(e)}`;
  app.style.cssText = 'color:#F3EAD6;padding:40px;font:18px system-ui';
});
