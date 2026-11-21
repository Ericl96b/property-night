// Types for the approved building asset module (buildingModels.js). Only what the game uses.
import type { BufferGeometry, MeshPhysicalMaterial, Vector3 } from 'three';
import type { GroupId } from '../data/classicBoard';

export declare const FINISH_NAMES: readonly [
  'matte', 'gloss', 'matteDouble', 'metal', 'iron', 'glass', 'railing', 'print',
  'stucco', 'clapboard', 'planks', 'bricks', 'stones', 'shingle', 'scales', 'tile', 'seams', 'copper',
];

export type FinishName = (typeof FINISH_NAMES)[number];

export interface BuildingDesign {
  /** One entry per finish the design uses. Model units; origin at footprint center, ground y = 0, front +Z. */
  parts: { finish: FinishName; geometry: BufferGeometry }[];
  /** Bounding size: x = width, y = height, z = depth (model units). */
  size: Vector3;
}

export interface GameBuildingAssets {
  finishes: Record<FinishName, MeshPhysicalMaterial>;
  castShadow: Record<FinishName, boolean>;
  designs: Record<GroupId, { house: BuildingDesign; hotel: BuildingDesign }>;
  dispose(): void;
}

export declare function buildGameAssets(opts?: { colors?: Partial<Record<GroupId, number>> }): GameBuildingAssets;
