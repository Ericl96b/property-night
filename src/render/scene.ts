// Assembles the tabletop scene and owns quality switching (texture regeneration happens here,
// never during play).
import * as THREE from 'three';
import type { BoardData } from '../data/classicBoard';
import { AnimationQueue } from '../director/queue';
import { createBoard, type BoardObject } from './board';
import { createBoardTexture } from './boardTexture';
import { Buildings } from './buildings';
import { CameraDirector } from './cameraDirector';
import { Decals } from './decals';
import { createDecks } from './decks';
import { Signs } from './signs';
import { Dice } from './dice';
import { createLighting, type LightRig } from './lighting';
import { type QualityProfile, type QualitySetting, gpuName, profileFor, resolveLevel } from './quality';
import { Renderer } from './renderer';
import { createTable, generateTableTextures } from './table';
import { TokenLayer } from './tokenLayer';

export interface SceneStats {
  boardMs: number;
  boardSize: number;
  tableMs: number;
  uploadMs: number;
  startupMs: number;
  /** buildGameAssets time (Batch 3). */
  buildingsMs: number;
  gpu: string;
}

export class GameScene {
  readonly renderer: Renderer;
  readonly camera = new CameraDirector();
  readonly queue = new AnimationQueue();
  lights!: LightRig;
  table!: THREE.Mesh;
  board!: BoardObject;
  tokens = new TokenLayer();
  buildings!: Buildings;
  /** SOLD signs on owned properties. */
  signs!: Signs;
  /** Chance and Community Chest card stacks. */
  decks!: THREE.Group;
  decals!: Decals;
  dice!: Dice;
  quality!: QualityProfile;
  qualitySetting: QualitySetting = 'auto';
  stats: SceneStats = { boardMs: 0, boardSize: 0, tableMs: 0, uploadMs: 0, startupMs: 0, buildingsMs: 0, gpu: '' };

  private constructor(container: HTMLElement, private boardData: BoardData) {
    this.renderer = new Renderer(container, this.camera.camera);
  }

  static async create(container: HTMLElement, board: BoardData, setting: QualitySetting): Promise<GameScene> {
    const t0 = performance.now();
    const s = new GameScene(container, board);
    s.qualitySetting = setting;
    const gl = s.renderer.gl;
    s.stats.gpu = gpuName(gl);
    s.quality = profileFor(resolveLevel(setting, gl), gl.capabilities.maxTextureSize);
    s.renderer.applyQuality(s.quality);

    const scene = s.renderer.scene;
    scene.add(s.camera.lightRig);
    s.lights = createLighting(scene, s.camera.lightRig, gl);
    s.lights.setShadowSize(s.quality.shadowMap);
    s.buildings = new Buildings(board);
    s.stats.buildingsMs = s.buildings.lastBuildMs;

    const tableTex = generateTableTextures(s.quality.tableTexture);
    s.stats.tableMs = tableTex.ms;
    s.table = createTable(tableTex, s.renderer.maxAnisotropy);
    scene.add(s.table);

    const bt = await createBoardTexture(board, s.quality.boardTexture, s.renderer.maxAnisotropy);
    s.stats.boardMs = bt.ms;
    s.stats.boardSize = s.quality.boardTexture;
    s.board = createBoard(bt.texture);
    scene.add(s.board.mesh);
    s.decals = new Decals(bt.texture);
    scene.add(s.decals.group, s.tokens.group, s.buildings.group);
    s.dice = new Dice(s.quality.diceAtlas);
    scene.add(s.dice.group);
    // Fonts are ready by now (the board face waited for them).
    s.signs = new Signs();
    s.decks = await createDecks(s.renderer.maxAnisotropy);
    scene.add(s.signs.group, s.decks);

    const u0 = performance.now();
    gl.initTexture(bt.texture);
    s.stats.uploadMs = performance.now() - u0;
    s.stats.startupMs = performance.now() - t0;

    s.renderer.addTicker((dt) => {
      const q = s.queue.update(dt);
      const c = s.camera.update(dt);
      s.tokens.faceYaw(s.camera.viewYaw);
      s.signs.faceYaw(s.camera.viewYaw);
      const g = s.signs.update(dt);
      return q || c || g;
    });
    return s;
  }

  setSpeed(speed: AnimationQueue['speed']): void {
    this.queue.speed = speed;
    this.camera.speed = this.queue.factor;
    this.signs.speed = this.queue.factor;
  }

  /** Switch quality: regenerates board/table textures, shadow map and the post chain. */
  async setQuality(setting: QualitySetting): Promise<void> {
    this.qualitySetting = setting;
    const gl = this.renderer.gl;
    const q = profileFor(resolveLevel(setting, gl), gl.capabilities.maxTextureSize);
    if (q.level === this.quality.level) return;
    this.quality = q;
    const bt = await createBoardTexture(this.boardData, q.boardTexture, this.renderer.maxAnisotropy);
    this.stats.boardMs = bt.ms;
    this.stats.boardSize = q.boardTexture;
    this.board.setFaceTexture(bt.texture);
    this.decals.setBoardTexture(bt.texture);
    const tableTex = generateTableTextures(q.tableTexture);
    this.stats.tableMs = tableTex.ms;
    const old = this.table;
    this.table = createTable(tableTex, this.renderer.maxAnisotropy);
    this.renderer.scene.remove(old);
    old.geometry.dispose();
    const m = old.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.roughnessMap?.dispose();
    m.dispose();
    this.renderer.scene.add(this.table);
    this.lights.setShadowSize(q.shadowMap);
    this.renderer.applyQuality(q);
    this.renderer.requestRender();
  }

  /** Regenerate the board face (board preset changed). Never during play. */
  async setBoard(board: BoardData): Promise<void> {
    this.boardData = board;
    const bt = await createBoardTexture(board, this.quality.boardTexture, this.renderer.maxAnisotropy);
    this.stats.boardMs = bt.ms;
    this.board.setFaceTexture(bt.texture);
    this.decals.setBoardTexture(bt.texture);
    this.buildings.setBoard(board);
    this.stats.buildingsMs = this.buildings.lastBuildMs;
    this.renderer.requestRender();
  }
}
