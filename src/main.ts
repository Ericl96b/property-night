// Property Night entry point: tabletop scene + director + game controller + overlay UI.
import './style.css';
import { mount } from 'svelte';
import { CLASSIC_BOARD } from './data/classicBoard';
import { GameScene } from './render/scene';
import { Director } from './director/director';
import { GameController } from './app/controller';
import { loadSettings, saveSettings, type Settings } from './app/settings';
import { renderPortraits } from './render/portraits';
import { startKeyboard, type Intent } from './input/keys';
import { InputManager, browserStore } from './input/manager';
import type { QualitySetting } from './render/quality';
import type { Speed } from './director/queue';
import type { NewGameConfig, SeatConfig, State } from './engine';
import { rollDie, seedRng } from './engine/rng';
import App from './ui/App.svelte';
import { boardMaxNdcX } from './ui/stage';
import { sideOfTile } from './render/layout';
import { openKV } from './storage/db';
import { runMigrations } from './storage/migrations';
import { RulesPresets } from './app/presets';
import { BoardPresets, printView } from './app/boardPresets';
import { AUTOSAVE_ID, Saves, makeSave, type SaveFile } from './app/saves';
import { downloadText } from './app/presets';
import { CLASSIC_RULES } from './engine';
import { Sound } from './audio/sound';
import * as THREE from 'three';
import { BOARD_TOP, tileAt } from './render/layout';
import { TestBoard } from './bench/testBoard';
import { BenchHistory } from './bench/history';
import { runBenchmark } from './bench/benchmark';
import type { PerfApi } from './bench/perfApi';
import type { State as GameState } from './engine';

/**
 * PWA (SPEC §2): offline play after the first visit. Production only (the dev server must
 * never be cached). Once the worker is active, hand it everything this page loaded so the
 * first visit is cached in full.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sendLoaded = (sw: ServiceWorker | null) => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    sw?.postMessage({ type: 'cache', urls: [location.href, ...urls] });
  };
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => sendLoaded(reg.active))
    .catch(() => {
      /* offline support is optional */
    });
}

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  root.textContent = '';
  const splash = document.createElement('div');
  splash.className = 'splash';
  splash.textContent = 'Setting the table…';
  root.append(splash);

  const params = new URLSearchParams(location.search);
  const settings: Settings = loadSettings();
  const q = params.get('quality');
  if (q === 'high' || q === 'low' || q === 'auto') settings.quality = q as QualitySetting;
  const sp = params.get('speed') as Speed | null;
  if (sp && ['slow', 'normal', 'fast', 'instant'].includes(sp)) settings.speed = sp;

  const ao = params.get('ao');
  if (ao === '1' || ao === '0') settings.ambientOcclusion = ao === '1';

  const scene = await GameScene.create(root, CLASSIC_BOARD, settings.quality);
  performance.mark('pn-scene');
  // The board is sized to the free width between the overlay's side panels (re-fit on resize).
  const fitCamera = (w: number, h: number) => scene.camera.setViewport(w, h, boardMaxNdcX(w, h));
  scene.renderer.onResize = fitCamera;
  fitCamera(window.innerWidth, window.innerHeight);

  let controller!: GameController;
  const director = new Director(scene, {
    card: (c) => controller.onCard(c),
    moment: (m) => controller.onMoment(m),
    idle: () => controller.onIdle(),
  });
  director.settings = () => settings;
  // Sound starts on the first key, click, touch or controller button (browser autoplay rules).
  const sound = new Sound();
  director.sound = sound;
  const unlockAudio = () => sound.unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlockAudio, { capture: true });
  document.addEventListener('visibilitychange', () => sound.setHidden(document.hidden));
  controller = new GameController(director);

  const input = new InputManager(undefined, undefined, browserStore);
  // Controller buttons may not count as a user gesture for autoplay, but try anyway.
  input.onAnyButton = unlockAudio;
  const kv = await openKV();
  // One-time wipe of data from older layouts (Batch 5). A failed wipe must not block startup.
  try {
    await runMigrations(kv);
  } catch (e) {
    console.error('Data migration failed', e);
  }
  const presets = new RulesPresets(kv);
  const boards = new BoardPresets(kv);
  const saves = new Saves(kv);
  // The board texture is regenerated only when the printed board changes (never during play).
  let boardKey = JSON.stringify(printView(CLASSIC_BOARD, CLASSIC_RULES));

  const applySettings = () => {
    sound.setVolumes(settings);
    input.swapNintendo = settings.swapNintendo;
    controller.undoEnabled = settings.undo;
    scene.setSpeed(settings.speed);
    controller.speed = settings.speed;
    scene.camera.settings.rotation = settings.boardRotation;
    scene.camera.settings.follow = settings.cameraFollow;
    const rm = scene.camera.settings.reduceMotion !== settings.reduceMotion;
    scene.camera.settings.reduceMotion = settings.reduceMotion;
    if (rm && controller.state) scene.camera.toSide(sideOfTile(controller.state.players[controller.state.turn.seat].position), true);
    scene.camera.apply();
    scene.renderer.setGraphics({ ao: settings.ambientOcclusion, exposure: settings.brightness, toneMapping: settings.toneMapping });
    scene.renderer.requestRender();
  };
  applySettings();

  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  root.append(vignette);
  const overlay = document.createElement('div');
  overlay.className = 'overlay-root';
  root.append(overlay);

  const ensureBoard = async (board: import('./data/classicBoard').BoardData, rules: import('./engine').Rules) => {
    const view = printView(board, rules);
    const key = JSON.stringify(view);
    if (key !== boardKey) {
      await scene.setBoard(view);
      boardKey = key;
    }
  };

  // Autosave after every action (debounced so a burst of bot actions writes once).
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let createdAt = Date.now();
  const snapshotSave = (id: string, name: string): SaveFile =>
    makeSave(id, name, controller.state, controller.actions, controller.seed, scene.camera.side, { createdAt });
  controller.onChange = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (controller.state) void saves.autosave(snapshotSave(AUTOSAVE_ID, 'Autosave'));
    }, 250);
  };

  const resume = async (raw: SaveFile) => {
    // Plain copy: saves picked in the UI may be reactive proxies, which IndexedDB cannot store.
    const f: SaveFile = JSON.parse(JSON.stringify(raw));
    renderPortraits(f.snapshot.seats.map((s) => ({ token: s.token, color: s.color })));
    await ensureBoard(f.snapshot.board, f.snapshot.rules);
    createdAt = f.createdAt;
    controller.load(f.snapshot, f.actions, f.seed);
    input.clearBindings();
    f.snapshot.seats.forEach((s, i) => s.controllerId && input.bind(s.controllerId, i));
    scene.camera.toSide((f.view?.cameraSide ?? sideOfTile(f.snapshot.players[f.snapshot.turn.seat].position)) as 0 | 1 | 2 | 3, true);
    scene.renderer.requestRender();
  };

  const startGame = (cfg: NewGameConfig) => {
    createdAt = Date.now();
    renderPortraits(cfg.seats.map((s) => ({ token: s.token ?? 'teacup', color: s.color ?? '#7B3FE4' })));
    controller.start(cfg);
    // Seats are shuffled into turn order: bind each controller to its seat's final index.
    input.clearBindings();
    controller.state.seats.forEach((s, i) => s.controllerId && input.bind(s.controllerId, i));
    scene.camera.toSide(sideOfTile(controller.state.players[controller.state.turn.seat].position), true);
    scene.renderer.requestRender();
  };
  // Leave a clean board behind: no tokens, owner discs, stamps, ribbons, locks or buildings.
  const clearScene = () => {
    scene.queue.flush();
    scene.tokens.clear();
    for (let i = 0; i < 40; i++) {
      scene.decals.setOwner(i, null);
      scene.decals.setMortgaged(i, false);
      scene.decals.setPromise(i, false);
      scene.decals.setPledged(i, false);
      scene.buildings.set(i, 0, false);
    }
    scene.decals.setHighlight(null);
    scene.signs.clear();
    scene.renderer.requestRender();
  };

  // Batch 4: benchmark and test board. Both draw their own data-only state through the director
  // and never touch the controller, so no game, save, autosave or Continue is affected.
  let app!: {
    intent: (i: Intent, seat?: number | null) => boolean;
    padLost: (seat: number) => void;
    padBack: (seat: number) => void;
    setBenchState: (s: GameState | null) => void;
    testBoardChanged: () => void;
  };
  let testBoard: TestBoard | null = null;
  let inTestBoard = false;
  const perf: PerfApi = {
    renderer: scene.renderer,
    history: new BenchHistory(kv),
    run: (mode, onProgress, signal) =>
      runBenchmark(
        { scene, director, settings, ensureBoard: (b) => ensureBoard(b, CLASSIC_RULES), setBenchState: (st) => app.setBenchState(st) },
        mode,
        onProgress,
        signal,
      ),
    enterTestBoard: () => {
      testBoard ??= new TestBoard({ scene, director, sound, ensureBoard: (b) => ensureBoard(b, CLASSIC_RULES), onChange: () => app.testBoardChanged() }, CLASSIC_BOARD);
      clearScene();
      testBoard.enter();
      inTestBoard = true;
      return testBoard;
    },
    leaveTestBoard: () => {
      testBoard?.exit();
      inTestBoard = false;
      clearScene();
    },
    clearScene,
    qualityLabel: () => (scene.quality.level === 'high' ? 'High' : 'Low'),
    setNudgeAnyPad: (on) => (input.nudgeAnyPad = on),
  };

  // Test board: click a property on the board to select it.
  const ray = new THREE.Raycaster();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);
  scene.renderer.gl.domElement.addEventListener('pointerdown', (e) => {
    if (!inTestBoard || !testBoard) return;
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, scene.camera.camera);
    const hit = ray.ray.intersectPlane(boardPlane, new THREE.Vector3());
    const tile = hit ? tileAt(hit.x, hit.z) : null;
    if (tile !== null) testBoard.select(tile);
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  app = mount(App, {
    target: overlay,
    props: {
      controller,
      input,
      presets,
      boards,
      saves,
      oncontinue: async () => {
        const f = await saves.continueGame();
        if (f) await resume(f);
      },
      onloadsave: (f: SaveFile) => void resume(f),
      onimport: (text: string) => {
        try {
          const f = saves.parseImport(text);
          void resume(f);
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      },
      onsaveslot: async (slot: number, name: string) => {
        await saves.saveSlot(slot, snapshotSave(`slot-${slot}`, name));
      },
      onexport: () => {
        const f = snapshotSave('export', `Game ${new Date().toLocaleDateString()}`);
        downloadText(`property-night-${new Date().toISOString().slice(0, 10)}.save.json`, saves.exportJSON(f));
      },
      settings,
      onstart: async (seats: SeatConfig[], randomOrder: boolean, rulesId: string, boardId: string) => {
        const seed = Number(params.get('seed') ?? Math.floor(Math.random() * 2 ** 31));
        // The game keeps its own copies of the rules, board and cards (editing a preset never
        // changes a game in progress).
        const rules = { ...(await presets.get(rulesId)).rules };
        const bp = await boards.get(boardId);
        const board = JSON.parse(JSON.stringify(bp.board));
        const decks = JSON.parse(JSON.stringify(bp.decks));
        await ensureBoard(board, rules);
        startGame({ seats, seed, rules, board, decks, turnOrder: randomOrder ? 'random' : 'fixed' });
      },
      onsetting: async (patch: Partial<Settings>) => {
        const qualityChanged = patch.quality !== undefined && patch.quality !== settings.quality;
        Object.assign(settings, patch);
        saveSettings(settings);
        applySettings();
        if (qualityChanged) await scene.setQuality(settings.quality);
      },
      onnewgame: () => {
        input.clearBindings();
        controller.reset();
        clearScene();
      },
      onfullscreen: toggleFullscreen,
      perf,
    },
  }) as typeof app;

  startKeyboard({
    intent: (i) => {
      if (app.intent(i, null)) return;
      if (i === 'fullscreen') toggleFullscreen();
    },
    nudge: (x, y) => {
      scene.camera.setNudge(x, y);
      scene.renderer.wake();
    },
  });

  // Gamepads: poll every frame on a light loop (no rendering); intents carry the device's seat.
  input.onIntent = (e) => {
    // Unbound pads only act on the setup screen (joining) — never in a running game.
    if (controller.state && e.seat === null) return;
    app.intent(e.intent, e.seat);
  };
  input.onNudge = (x, y) => {
    scene.camera.setNudge(x, y);
    scene.renderer.wake();
  };
  input.onDisconnect = (_id, seat) => {
    if (controller.state && seat !== null) app.padLost(seat);
  };
  input.onReconnect = (_id, seat) => {
    if (seat !== null) app.padBack(seat);
  };
  const pollPads = () => {
    input.poll();
    requestAnimationFrame(pollPads);
  };
  requestAnimationFrame(pollPads);

  // Review helper: ?auto=human,bot,bank starts a game immediately (fixed turn order).
  const auto = params.get('auto');
  if (auto) {
    const kinds = auto.split(',').map((k) => (k === 'bank' ? 'bankBot' : k === 'bot' ? 'bot' : 'human')) as SeatConfig['kind'][];
    const tokens = ['teacup', 'gummy', 'bicycle', 'cat', 'rocket', 'crown'];
    const colors = ['#7B3FE4', '#0F9C84', '#C0582B', '#5B6472', '#C8326E', '#2E7DD7'];
    const seats = kinds.map((kind, i) => ({ kind, name: kind === 'human' ? `Player ${i + 1}` : kind === 'bankBot' ? 'Bank' : `Bot ${i + 1}`, token: tokens[i], color: colors[i] }));
    startGame({ seats, seed: Number(params.get('seed') ?? 7), turnOrder: 'fixed' });
  }

  // Review helpers for scripted UI checks (scripts/cdp.mjs): steer the next dice and edit state.
  const forceDice = (...rolls: number[]) => {
    for (let seed = 1; seed < 5_000_000; seed++) {
      const st = seedRng(seed);
      const probe = [...st] as typeof st;
      if (rolls.every((r) => rollDie(probe) === r)) {
        controller.state.rng = st;
        return true;
      }
    }
    return false;
  };
  const patchState = (f: (s: State) => void) => {
    const s = structuredClone(controller.state);
    f(s);
    controller.load(s);
  };
  (window as unknown as { __pn: unknown }).__pn = { scene, controller, director, settings, forceDice, patchState, input, app, saves, kv, sound, perf, testBoard: () => testBoard };
  scene.renderer.requestRender();
  // Startup budget (SPEC §10.10): navigation start → interactive menu.
  performance.mark('pn-ready');
  registerServiceWorker();
  setTimeout(() => splash.classList.add('gone'), 50);
  setTimeout(() => splash.remove(), 700);
}

boot().catch((e) => {
  console.error(e);
  const root = document.getElementById('app')!;
  root.textContent = `Failed to start: ${e instanceof Error ? e.message : String(e)}`;
  root.style.cssText = 'color:#F3EAD6;padding:40px;font:18px system-ui';
});
