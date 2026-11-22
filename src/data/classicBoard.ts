// Classic 40-tile board (SPEC §8). Names are the stand-ins from reference/board-face.html;
// prices, rents and house costs are the standard US values.

export type GroupId =
  | 'brown'
  | 'lightBlue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkBlue';

export type TileType =
  | 'go'
  | 'street'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'freeParking'
  | 'goToJail';

export type UtilityKind = 'power' | 'water';
export type TaxKind = 'income' | 'luxury';

export interface Tile {
  index: number;
  type: TileType;
  name: string;
  group?: GroupId;
  price?: number;
  /** Streets: [base, 1h, 2h, 3h, 4h, hotel]. Railroads: [1, 2, 3, 4 owned]. */
  rents?: number[];
  houseCost?: number;
  mortgage?: number;
  utility?: UtilityKind;
  tax?: TaxKind;
  taxAmount?: number;
  /** Printed tax line override (e.g. "Pay 10%"), set from the active rules at game start. */
  taxLabel?: string;
}

export interface Group {
  id: GroupId;
  color: string;
  /** Band text uses light ink on dark groups (SPEC §10.1). */
  lightText: boolean;
}

export interface BoardData {
  /** Center emblem title. */
  title: string;
  subtitle: string;
  goSalary: number;
  /** Utility rent multipliers: one owned, both owned. */
  utilityMultipliers?: [number, number];
  groups: Record<GroupId, Group>;
  tiles: Tile[];
}

export const CLASSIC_GROUPS: Record<GroupId, Group> = {
  brown: { id: 'brown', color: '#955436', lightText: true },
  lightBlue: { id: 'lightBlue', color: '#AAE0FA', lightText: false },
  yellow: { id: 'yellow', color: '#E3BC2A', lightText: false },
  orange: { id: 'orange', color: '#DC5A00', lightText: false },
  red: { id: 'red', color: '#ED1B24', lightText: false },
  pink: { id: 'pink', color: '#F569D7', lightText: false },
  green: { id: 'green', color: '#1FB25A', lightText: false },
  darkBlue: { id: 'darkBlue', color: '#0072BB', lightText: true },
};

const street = (
  index: number,
  name: string,
  group: GroupId,
  price: number,
  rents: number[],
  houseCost: number,
): Tile => ({ index, type: 'street', name, group, price, rents, houseCost, mortgage: price / 2 });

const railroad = (index: number, name: string): Tile => ({
  index,
  type: 'railroad',
  name,
  price: 200,
  rents: [25, 50, 100, 200],
  mortgage: 100,
});

const utility = (index: number, name: string, kind: UtilityKind): Tile => ({
  index,
  type: 'utility',
  name,
  price: 150,
  mortgage: 75,
  utility: kind,
});

const simple = (index: number, type: TileType, name: string): Tile => ({ index, type, name });

export const CLASSIC_BOARD: BoardData = {
  title: 'Property Night',
  subtitle: 'Houses & Hotels · Est. 2026',
  goSalary: 200,
  utilityMultipliers: [4, 10],
  groups: CLASSIC_GROUPS,
  tiles: [
    simple(0, 'go', 'Go'),
    street(1, 'Hazel Lane', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
    simple(2, 'chest', 'Community Chest'),
    street(3, 'Briar Street', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
    { index: 4, type: 'tax', name: 'Income Tax', tax: 'income', taxAmount: 200 },
    railroad(5, 'North Line'),
    street(6, 'Lilac Row', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
    simple(7, 'chance', 'Chance'),
    street(8, 'Bluebell Way', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
    street(9, 'Harbor View', 'lightBlue', 120, [8, 40, 100, 300, 450, 600], 50),
    simple(10, 'jail', 'Jail'),
    street(11, 'Goldfinch Lane', 'yellow', 140, [10, 50, 150, 450, 625, 750], 100),
    utility(12, 'Power Works', 'power'),
    street(13, 'Honey Street', 'yellow', 140, [10, 50, 150, 450, 625, 750], 100),
    street(14, 'Buttercup Row', 'yellow', 160, [12, 60, 180, 500, 700, 900], 100),
    railroad(15, 'East Line'),
    street(16, 'Amber Avenue', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
    simple(17, 'chest', 'Community Chest'),
    street(18, 'Marigold Street', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
    street(19, 'Sunset Drive', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
    simple(20, 'freeParking', 'Free Parking'),
    street(21, 'Cardinal Road', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
    simple(22, 'chance', 'Chance'),
    street(23, 'Ruby Street', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
    street(24, 'Scarlet Square', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
    railroad(25, 'South Line'),
    street(26, 'Rose Court', 'pink', 260, [22, 110, 330, 800, 975, 1150], 150),
    street(27, 'Peony Place', 'pink', 260, [22, 110, 330, 800, 975, 1150], 150),
    utility(28, 'Water Works', 'water'),
    street(29, 'Rosewood Lane', 'pink', 280, [24, 120, 360, 850, 1025, 1200], 150),
    simple(30, 'goToJail', 'Go to Jail'),
    street(31, 'Fernwood Avenue', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
    street(32, 'Ivy Terrace', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
    simple(33, 'chest', 'Community Chest'),
    street(34, 'Evergreen Place', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
    railroad(35, 'West Line'),
    simple(36, 'chance', 'Chance'),
    street(37, 'Sapphire Heights', 'darkBlue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
    { index: 38, type: 'tax', name: 'Luxury Tax', tax: 'luxury', taxAmount: 100 },
    street(39, 'Midnight Park', 'darkBlue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
  ],
};
