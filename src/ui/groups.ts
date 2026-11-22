// Group colors and names for the overlay (Stage 3 §2). The overlay is not tone-mapped, so it
// keeps its own colors: orange is #FF8200 here and stays #DC5A00 on the 3D board, where that
// value compensates for ACES tone mapping. Every overlay element that shows a group color
// (deeds, chips, vouchers, player badges) reads from here, never from board.groups directly.
import { CLASSIC_GROUPS, type BoardData, type GroupId } from '../data/classicBoard';
import { PROMISE_GROUP_ORDER, type PromiseGroup } from '../engine';

export const UI_GROUP_COLORS: Record<PromiseGroup, string> = {
  brown: '#955436',
  lightBlue: '#AAE0FA',
  yellow: '#E3BC2A',
  orange: '#FF8200',
  red: '#ED1B24',
  pink: '#F569D7',
  green: '#1FB25A',
  darkBlue: '#0072BB',
  railroad: '#2B2119',
  utility: '#2B2119',
};

/** Groups whose band text is light. */
export const UI_GROUP_LIGHT: Record<PromiseGroup, boolean> = {
  brown: true,
  lightBlue: false,
  yellow: false,
  orange: false,
  red: false,
  pink: false,
  green: false,
  darkBlue: true,
  railroad: true,
  utility: true,
};

export const GROUP_LABEL: Record<PromiseGroup, string> = {
  brown: 'Brown',
  lightBlue: 'Light Blue',
  yellow: 'Mustard',
  orange: 'Orange',
  red: 'Red',
  pink: 'Pink',
  green: 'Green',
  darkBlue: 'Dark Blue',
  railroad: 'Railroads',
  utility: 'Utilities',
};

export { PROMISE_GROUP_ORDER };

/**
 * Overlay color for a group. A board preset whose color for the group was edited away from
 * Classic keeps the edited color; Classic colors map to the UI palette.
 */
export function uiGroupColor(board: BoardData | undefined, g: PromiseGroup): string {
  if (g === 'railroad' || g === 'utility') return UI_GROUP_COLORS[g];
  const own = board?.groups[g as GroupId]?.color;
  if (own && own.toUpperCase() !== CLASSIC_GROUPS[g as GroupId].color.toUpperCase()) return own;
  return UI_GROUP_COLORS[g];
}

export function uiGroupLight(board: BoardData | undefined, g: PromiseGroup): boolean {
  if (g === 'railroad' || g === 'utility') return true;
  const grp = board?.groups[g as GroupId];
  if (grp && grp.color.toUpperCase() !== CLASSIC_GROUPS[g as GroupId].color.toUpperCase()) return grp.lightText;
  return UI_GROUP_LIGHT[g];
}
