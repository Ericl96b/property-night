// Property Night entry point: tabletop scene + director + game controller + overlay UI.
import './style.css';
import { mount } from 'svelte';
import { CLASSIC_BOARD } from './data/classicBoard';
import { GameScene } from './render/scene';
import { Director } from './director/director';
import { GameController } from './app/controller';
import { loadSettings, saveSettings, type Settings } from './app/settings';
import { renderPortraits } from './render/portraits';
import { startInput, type Intent } from './input/keys';
import type { QualitySetting } from './render/quality';
import type { Speed } from './director/queue';
import type { NewGameConfig, SeatConfig, State } from './engine';
import { rollDie, seedRng } from './engine/rng';
import App from './ui/App.svelte';

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

  const scene = await GameScene.create(root, CLASSIC_BOARD, settings.quality);

  let controller!: GameController;
  const director = new Director(scene, {
    card: (c) => controller.onCard(c),
    moment: (m) => controller.onMoment(m),
    idle: () => controller.onIdle(),
  });
  director.settings = () => settings;
  controller = new GameController(director);

  const applySettings = () => {
    scene.setSpeed(settings.speed);
    controller.speed = settings.speed;
    scene.camera.settings.rotation = settings.boardRotation;
    scene.camera.settings.follow = settings.cameraFollow;
    const rm = scene.camera.settings.reduceMotion !== settings.reduceMotion;
    scene.camera.settings.reduceMotion = settings.reduceMotion;
    if (rm && controller.state) scene.camera.toSide(controller.state.seats[controller.state.turn.seat].boardSide, true);
    scene.camera.apply();
    scene.renderer.requestRender();
  };
  applySettings();

  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  root.append(vignette);
  const overlay = document.createElement('div');
  overlay.className = 'overlay-root';
  root.append(overlay);

  const startGame = (cfg: NewGameConfig) => {
    renderPortraits(cfg.seats.map((s) => ({ token: s.token ?? 'teacup', color: s.color ?? '#7B3FE4' })));
    controller.start(cfg);
    scene.camera.toSide(controller.state.seats[controller.state.turn.seat].boardSide, true);
    scene.renderer.requestRender();
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  const app = mount(App, {
    target: overlay,
    props: {
      controller,
      settings,
      onstart: (seats: SeatConfig[], randomOrder: boolean) => {
        const seed = Number(params.get('seed') ?? Math.floor(Math.random() * 2 ** 31));
        startGame({ seats, seed, turnOrder: randomOrder ? 'random' : 'fixed' });
      },
      onsetting: async (patch: Partial<Settings>) => {
        const qualityChanged = patch.quality !== undefined && patch.quality !== settings.quality;
        Object.assign(settings, patch);
        saveSettings(settings);
        applySettings();
        if (qualityChanged) await scene.setQuality(settings.quality);
      },
      onnewgame: () => {
        controller.reset();
        scene.tokens.clear();
        scene.renderer.requestRender();
      },
      onfullscreen: toggleFullscreen,
    },
  }) as { intent: (i: Intent) => boolean };

  startInput({
    intent: (i) => {
      if (app.intent(i)) return;
      if (i === 'fullscreen') toggleFullscreen();
    },
    nudge: (x, y) => {
      scene.camera.setNudge(x, y);
      scene.renderer.wake();
    },
  });

  // Review helper: ?auto=human,bot,bank starts a game immediately (fixed turn order).
  const auto = params.get('auto');
  if (auto) {
    const kinds = auto.split(',').map((k) => (k === 'bank' ? 'bankBot' : k === 'bot' ? 'bot' : 'human')) as SeatConfig['kind'][];
    const tokens = ['teacup', 'key', 'bicycle', 'cat', 'rocket', 'crown'];
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
  (window as unknown as { __pn: unknown }).__pn = { scene, controller, director, settings, forceDice, patchState };
  scene.renderer.requestRender();
  setTimeout(() => splash.classList.add('gone'), 50);
  setTimeout(() => splash.remove(), 700);
}

boot().catch((e) => {
  console.error(e);
  const root = document.getElementById('app')!;
  root.textContent = `Failed to start: ${e instanceof Error ? e.message : String(e)}`;
  root.style.cssText = 'color:#F3EAD6;padding:40px;font:18px system-ui';
});
