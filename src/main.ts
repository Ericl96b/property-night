// Property Night entry point: tabletop scene + director + game controller + overlay UI.
import './style.css';
import { mount } from 'svelte';
import { CLASSIC_BOARD } from './data/classicBoard';
import { GameScene } from './render/scene';
import { Director } from './director/director';
import { GameController } from './app/controller';
import { startInput } from './input/keys';
import type { QualitySetting } from './render/quality';
import type { Speed } from './director/queue';
import App from './ui/App.svelte';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  root.textContent = '';
  const splash = document.createElement('div');
  splash.className = 'splash';
  splash.textContent = 'Setting the table…';
  root.append(splash);

  const params = new URLSearchParams(location.search);
  const q = params.get('quality');
  const quality: QualitySetting = q === 'high' || q === 'low' ? q : 'auto';
  const scene = await GameScene.create(root, CLASSIC_BOARD, quality);
  const speedParam = params.get('speed') as Speed | null;
  const speed: Speed = speedParam && ['slow', 'normal', 'fast', 'instant'].includes(speedParam) ? speedParam : 'normal';
  scene.setSpeed(speed);

  let controller!: GameController;
  const director = new Director(scene, { card: (c) => controller.onCard(c), idle: () => controller.onIdle() });
  controller = new GameController(director);
  controller.speed = speed;

  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  root.append(vignette);
  const overlay = document.createElement('div');
  overlay.className = 'overlay-root';
  root.append(overlay);

  const app = mount(App, {
    target: overlay,
    props: {
      controller,
      onstart: (seats: import("./engine").SeatConfig[], randomOrder: boolean) => {
        const seed = Number(params.get('seed') ?? Math.floor(Math.random() * 2 ** 31));
        controller.start({ seats, seed, turnOrder: randomOrder ? 'random' : 'fixed' });
        scene.camera.toSide(controller.state.seats[controller.state.turn.seat].boardSide, true);
        scene.renderer.requestRender();
      },
    },
  }) as { intent: (i: import('./input/keys').Intent) => boolean };

  startInput({
    intent: (i) => {
      if (app.intent(i)) return;
      if (i === 'fullscreen') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    },
    nudge: (x, y) => {
      scene.camera.setNudge(x, y);
      scene.renderer.wake();
    },
  });

  // Review helper: ?auto=human,bot,bot starts a game immediately (fixed turn order).
  const auto = params.get('auto');
  if (auto) {
    const kinds = auto.split(',').map((k) => (k === 'bank' ? 'bankBot' : k === 'bot' ? 'bot' : 'human')) as ('human' | 'bot' | 'bankBot')[];
    const tokens = ['teacup', 'key', 'bicycle', 'cat', 'rocket', 'crown'];
    const colors = ['#7B3FE4', '#0F9C84', '#C0582B', '#5B6472', '#C8326E', '#2E7DD7'];
    const seats = kinds.map((kind, i) => ({ kind, name: kind === 'human' ? `Player ${i + 1}` : `Bot ${i + 1}`, token: tokens[i], color: colors[i] }));
    controller.start({ seats, seed: Number(params.get('seed') ?? 7), turnOrder: 'fixed' });
    scene.camera.toSide(controller.state.seats[0].boardSide, true);
  }

  (window as unknown as { __pn: unknown }).__pn = { scene, controller, director };
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
