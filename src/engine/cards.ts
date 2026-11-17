// Chance and Community Chest (SPEC §8): 16 cards each, original wording (never Hasbro's text).
// Each card = text + exactly one effect.

export type CardEffect =
  | { kind: 'collect'; amount: number }
  | { kind: 'pay'; amount: number }
  | { kind: 'collectFromEach'; amount: number }
  | { kind: 'payEach'; amount: number }
  | { kind: 'moveTo'; tile: number }
  | { kind: 'nearestRailroad' } // pay the owner twice the rent
  | { kind: 'nearestUtility' } // pay the owner 10× a fresh dice roll
  | { kind: 'back'; spaces: number }
  | { kind: 'goToJail' }
  | { kind: 'getOutOfJail' }
  | { kind: 'repairs'; perHouse: number; perHotel: number };

export interface Card {
  text: string;
  effect: CardEffect;
}

export type DeckId = 'chance' | 'chest';

export const CLASSIC_CHANCE: Card[] = [
  { text: 'Take the express to GO. Collect your salary.', effect: { kind: 'moveTo', tile: 0 } },
  { text: 'Head over to Scarlet Square. Collect your salary if you pass GO.', effect: { kind: 'moveTo', tile: 24 } },
  { text: 'Stroll down to Rose Court. Collect your salary if you pass GO.', effect: { kind: 'moveTo', tile: 11 } },
  { text: 'Walk to the nearest utility. If it is owned, roll the dice and pay the owner ten times the total.', effect: { kind: 'nearestUtility' } },
  { text: 'Catch the nearest train. If the line is owned, pay the owner double the usual fare.', effect: { kind: 'nearestRailroad' } },
  { text: 'Catch the nearest train. If the line is owned, pay the owner double the usual fare.', effect: { kind: 'nearestRailroad' } },
  { text: 'Your savings account pays out. Collect $50.', effect: { kind: 'collect', amount: 50 } },
  { text: 'A pardon in your pocket. Keep this card until you need it, or trade it.', effect: { kind: 'getOutOfJail' } },
  { text: 'You took a wrong turn. Go back three spaces.', effect: { kind: 'back', spaces: 3 } },
  { text: 'Caught red-handed. Go directly to jail without passing GO.', effect: { kind: 'goToJail' } },
  { text: 'Upkeep is due on your buildings: pay $25 per house and $100 per hotel.', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { text: 'Parking ticket on the boulevard. Pay $15.', effect: { kind: 'pay', amount: 15 } },
  { text: 'Ride the North Line. Collect your salary if you pass GO.', effect: { kind: 'moveTo', tile: 5 } },
  { text: 'Take a walk to Midnight Park.', effect: { kind: 'moveTo', tile: 39 } },
  { text: 'You chaired the neighborhood committee. Pay each player $50.', effect: { kind: 'payEach', amount: 50 } },
  { text: 'Your construction bond matures. Collect $150.', effect: { kind: 'collect', amount: 150 } },
];

export const CLASSIC_CHEST: Card[] = [
  { text: 'Take the express to GO. Collect your salary.', effect: { kind: 'moveTo', tile: 0 } },
  { text: 'The bank made a mistake in your favor. Collect $200.', effect: { kind: 'collect', amount: 200 } },
  { text: 'Check-up at the clinic. Pay $50.', effect: { kind: 'pay', amount: 50 } },
  { text: 'You sold some shares. Collect $50.', effect: { kind: 'collect', amount: 50 } },
  { text: 'A friend vouches for you. Keep this card until you need it, or trade it.', effect: { kind: 'getOutOfJail' } },
  { text: 'Caught red-handed. Go directly to jail without passing GO.', effect: { kind: 'goToJail' } },
  { text: 'Your holiday savings club pays out. Collect $100.', effect: { kind: 'collect', amount: 100 } },
  { text: 'The tax office sends a refund. Collect $20.', effect: { kind: 'collect', amount: 20 } },
  { text: "It's your birthday! Collect $10 from each player.", effect: { kind: 'collectFromEach', amount: 10 } },
  { text: 'Your insurance policy matures. Collect $100.', effect: { kind: 'collect', amount: 100 } },
  { text: 'Hospital bill. Pay $100.', effect: { kind: 'pay', amount: 100 } },
  { text: 'Tuition is due. Pay $50.', effect: { kind: 'pay', amount: 50 } },
  { text: 'You did some consulting on the side. Collect $25.', effect: { kind: 'collect', amount: 25 } },
  { text: 'The city repaves your street: pay $40 per house and $115 per hotel.', effect: { kind: 'repairs', perHouse: 40, perHotel: 115 } },
  { text: 'Runner-up in the garden show. Collect $10.', effect: { kind: 'collect', amount: 10 } },
  { text: 'A distant relative leaves you a gift. Collect $100.', effect: { kind: 'collect', amount: 100 } },
];
