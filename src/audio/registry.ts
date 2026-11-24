// Sound registry (audio Phase 0 §1): the single source of truth for every sound in the game.
// Each sound has a string ID; call sites only ever name an ID. What an ID actually plays is
// resolved at run time: recorded files from public/audio/ → the synth fallback → silence.
//
// Files: public/audio/<category>/<id with dots as underscores>_01.ogg (_02, … ; .wav also works).
// Dropping a file there is enough: the build-time manifest (vite.config.ts) picks it up.

export type Bus = 'ui' | 'sfx' | 'music';

/** The synthesized fallbacks (the game's original sounds, see synths.ts). */
export type SynthName = 'dice' | 'tap' | 'coins' | 'card' | 'tock' | 'tockLow' | 'stingGood' | 'stingBad' | 'generativeMusic';

export interface SoundDef {
  bus: Bus;
  /** Plain-English trigger (the docs/audio-registry.md table). */
  desc: string;
  /** Extra files on top of the ones the manifest finds (normally empty). */
  files: readonly string[];
  synth?: SynthName;
  /** Per-sound level (linear). For synths this is the old loudest peak; the synth is normalized to 1. */
  gain: number;
  /** Random ± semitones per play. */
  pitchJitter: number;
  /** Random ± dB per play. */
  gainJitter: number;
  /** Minimum gap between two plays of this ID. */
  cooldownMs: number;
  /** Most simultaneous voices of this ID. */
  maxVoices: number;
  /** Level multiplier when a bot triggers it. */
  botGain: number;
  /** Voice cap and batching: higher wins. */
  priority: number;
  /** Duck the music under this sound. */
  duck?: { db: number; ms: number };
  /** Loops until stopped (music). */
  loop?: boolean;
}

export const PRIORITY = { banner: 50, money: 40, building: 30, card: 20, other: 10 } as const;

function priorityFor(category: string): number {
  if (category === 'banner') return PRIORITY.banner;
  if (category === 'money') return PRIORITY.money;
  if (category === 'building' || category === 'property') return PRIORITY.building;
  if (category === 'card') return PRIORITY.card;
  return PRIORITY.other;
}

type Opts = Partial<SoundDef> & { desc: string };

/** Entry builder: the category (first ID segment) picks the default bus and priority. */
function def(o: Opts): (id: string) => SoundDef {
  return (id) => {
    const cat = id.split('.')[0];
    return {
      bus: cat === 'ui' ? 'ui' : cat === 'music' ? 'music' : 'sfx',
      files: [],
      gain: 1,
      pitchJitter: 0,
      gainJitter: 0,
      cooldownMs: 0,
      maxVoices: 6,
      botGain: 1,
      priority: priorityFor(cat),
      ...o,
    };
  };
}

const silent = (desc: string, extra: Partial<SoundDef> = {}) => def({ desc, ...extra });

const BANNER_DUCK = { db: -6, ms: 900 };
const moneyEntry = (desc: string) => def({ desc, synth: 'coins', gain: 0.09 });

const ENTRIES = {
  // ---- dice ----------------------------------------------------------------------------------
  'dice.bounce.wood': def({ desc: 'A die hits the board, a wall or a card stack', synth: 'dice', gain: 0.5, cooldownMs: 30 }),
  'dice.bounce.die': def({ desc: 'A die hits the other die', synth: 'dice', gain: 0.5, cooldownMs: 30 }),
  'dice.instant': def({ desc: 'Dice land at Instant speed (one knock)', synth: 'dice', gain: 0.5, cooldownMs: 30 }),
  'dice.pickup': silent('Dice are picked up (a roll starts)'),
  'dice.throw': silent('Dice leave the hand'),
  'dice.settle': silent('Dice come to rest'),
  'dice.doubles': silent('Doubles rolled'),
  // ---- movement ------------------------------------------------------------------------------
  'token.step': def({ desc: 'Token hops one tile (every hop except the landing tile)', synth: 'tap', gain: 0.12, cooldownMs: 45 }),
  'token.land': def({ desc: 'Token lands on its destination tile', synth: 'tap', gain: 0.12, cooldownMs: 45 }),
  'token.instant': def({ desc: 'Token arrives at Instant speed', synth: 'tap', gain: 0.12, cooldownMs: 45 }),
  'token.glide': silent('Token glides directly to a tile (Go to Jail)'),
  'token.removed': silent('Token leaves the table (bankrupt, bots leave)'),
  // ---- money ---------------------------------------------------------------------------------
  'money.rent': moneyEntry('Rent is paid'),
  'money.salary': moneyEntry('GO salary is collected'),
  'money.tax': moneyEntry('Income or Luxury tax is paid'),
  'money.freeParking': moneyEntry('Free Parking pot is paid out'),
  'money.purchase': moneyEntry('A property is bought (or won at auction)'),
  'money.build': moneyEntry('A house or hotel is paid for'),
  'money.sellBuilding': moneyEntry('A house or hotel is sold back'),
  'money.mortgage': moneyEntry('A property is mortgaged'),
  'money.unmortgage': moneyEntry('A mortgage is lifted (or its interest paid)'),
  'money.jailFine': moneyEntry('The jail fine is paid'),
  'money.loanTaken': moneyEntry('A bank loan is paid out'),
  'money.loanInstallment': moneyEntry('A loan installment is paid'),
  'money.loanPayoff': moneyEntry('A loan is paid off'),
  'money.seizureRefund': moneyEntry('The bank refunds a seizure surplus'),
  'money.generic': moneyEntry('Any other payment (cards, repairs, trades, bankruptcy)'),
  // ---- property and buildings ----------------------------------------------------------------
  'property.transfer': def({ desc: 'A property gets a new owner (SOLD sign pops)', synth: 'tock', gain: 0.35 }),
  'property.toBank': silent('A property returns to the bank (sign sinks)'),
  'building.house': def({ desc: 'A house is built', synth: 'tock', gain: 0.35 }),
  'building.hotel': def({ desc: 'A hotel is built', synth: 'tock', gain: 0.35 }),
  'building.sell': def({ desc: 'A house or hotel is sold', synth: 'tockLow', gain: 0.35 }),
  // ---- cards ---------------------------------------------------------------------------------
  'card.chance.draw': def({ desc: 'A Chance card is drawn', synth: 'card', gain: 0.35 }),
  'card.chest.draw': def({ desc: 'A Community Chest card is drawn', synth: 'card', gain: 0.35 }),
  'card.reveal': silent('A drawn card is shown'),
  'card.dismiss': silent('A drawn card goes away'),
  // ---- banners -------------------------------------------------------------------------------
  'banner.setComplete': def({ desc: 'Banner: a full colour set is owned', synth: 'stingGood', gain: 0.16, duck: BANNER_DUCK, maxVoices: 2 }),
  'banner.auctionWon': def({ desc: 'Banner: an auction is won', synth: 'stingGood', gain: 0.16, duck: BANNER_DUCK, maxVoices: 2 }),
  'banner.rentFree': def({ desc: 'Banner: a rent-free voucher is used', synth: 'stingGood', gain: 0.16, duck: BANNER_DUCK, maxVoices: 2 }),
  'banner.seizure': def({ desc: 'Banner: the bank seizes loan collateral', synth: 'stingBad', gain: 0.22, duck: BANNER_DUCK, maxVoices: 2 }),
  'banner.bankrupt': def({ desc: 'Banner: a player is bankrupt', synth: 'stingBad', gain: 0.22, duck: BANNER_DUCK, maxVoices: 2 }),
  'banner.botsLeave': def({ desc: 'Banner: bank-backed bots lose backing or leave', synth: 'stingGood', gain: 0.16, duck: BANNER_DUCK, maxVoices: 2 }),
  // ---- turns and board events ----------------------------------------------------------------
  'turn.start': silent('A turn starts'),
  'turn.start.local': silent("A human player's turn starts"),
  'turn.end': silent('A turn ends'),
  'go.pass': silent('A token passes GO'),
  'debt.pending': silent("A player can't pay and must raise funds"),
  // ---- jail ----------------------------------------------------------------------------------
  'jail.enter': silent('A player goes to jail'),
  'jail.release': silent('A player leaves jail (fine, doubles or max turns)'),
  'jail.release.card': silent('A Get Out of Jail Free card is used'),
  'jail.doublesFail': silent('A roll for doubles in jail fails'),
  // ---- auctions ------------------------------------------------------------------------------
  'auction.start': silent('An auction starts'),
  'auction.bid': silent('A bid is placed', { cooldownMs: 80 }),
  'auction.leaderChange': silent('A different player takes the lead', { cooldownMs: 80 }),
  'auction.pass': silent('A player drops out of the auction'),
  'auction.tick': silent('The auction countdown ticks (each second)'),
  'auction.noWinner': silent('An auction ends with no winner'),
  // ---- trades and promises -------------------------------------------------------------------
  'trade.open': silent('The Trade screen opens'),
  'trade.addItem': silent('A deed, card or cash is added to an offer'),
  'trade.removeItem': silent('A deed, card or cash is removed from an offer'),
  'trade.addPromise': silent('A promise voucher is added to an offer'),
  'trade.removePromise': silent('A promise voucher is removed from an offer'),
  'trade.propose': silent('A trade is proposed'),
  'trade.holdProgress': silent('Hold-to-accept starts filling'),
  'trade.accept': silent('A trade is accepted'),
  'trade.decline': silent('A trade is declined'),
  'trade.counter': silent('A trade is countered'),
  'trade.incomingFromBot': silent('A bot sends a human a trade offer'),
  'promise.ended': silent('A promise expires or is voided'),
  // ---- game flow -----------------------------------------------------------------------------
  'game.start': silent('A new game starts'),
  'game.over': silent('The game is over'),
  'game.undo': silent('An action is undone'),
  'save.write': silent('The game is saved to a slot'),
  'save.load': silent('A save is loaded or resumed'),
  'camera.move': silent('Reserved: camera moves'),
  // ---- UI ------------------------------------------------------------------------------------
  'ui.focus.move': silent('Focus moves with the D-pad, stick or arrow keys'),
  'ui.focus.hover': silent('Focus moves under the mouse', { cooldownMs: 60 }),
  'ui.confirm': silent('A button is pressed (mouse or Confirm)'),
  'ui.back': silent('Back closes a menu level'),
  'ui.denied': silent('Back is pressed on a decision that cannot be backed out of'),
  'ui.tab': silent('Tabs cycle on Inventory or Trade (L1/R1)'),
  'ui.open': silent('A menu or panel opens'),
  'ui.close': silent('A menu or panel closes'),
  'ui.pause': silent('The game is paused'),
  'ui.resume': silent('The game resumes'),
  'ui.error': silent('An action is rejected, or a read-only controller is used'),
  'ui.step': silent('A stepper or dropdown changes value'),
  'ui.toggle': silent('A settings switch is toggled'),
  'ui.volumePreview': silent('A volume level changes (plays on the changed bus)', { cooldownMs: 120 }),
  'ui.skip': silent('An animation is skipped'),
  'ui.controller.lost': silent('A controller disconnects'),
  'ui.controller.found': silent('A controller reconnects'),
  'ui.lobby.join': silent('A controller claims a seat in the lobby'),
  'ui.lobby.start': silent('The game is started from the lobby'),
  // ---- music ---------------------------------------------------------------------------------
  'music.main': def({ desc: 'Background music (generative loop)', synth: 'generativeMusic', gain: 1, maxVoices: 1, loop: true }),
} as const;

export type SoundId = keyof typeof ENTRIES;

export const REGISTRY: Readonly<Record<SoundId, SoundDef>> = Object.fromEntries(
  Object.entries(ENTRIES).map(([id, make]) => [id, make(id)]),
) as Record<SoundId, SoundDef>;

export const SOUND_IDS = Object.keys(REGISTRY) as SoundId[];

export function isSoundId(id: string): id is SoundId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}

export function categoryOf(id: string): string {
  return id.split('.')[0];
}

/** The expected file stem: dice.bounce.wood → audio/dice/dice_bounce_wood */
export function fileStem(id: string): string {
  return `audio/${categoryOf(id)}/${id.replace(/\./g, '_')}`;
}

/** The ID a file name belongs to (dice_bounce_wood_01.ogg → dice.bounce.wood), or null. */
export function idFromFileName(name: string): string | null {
  const m = /^([A-Za-z0-9_]+?)_(\d{2,})\.(ogg|wav)$/.exec(name);
  return m ? m[1].replace(/_/g, '.') : null;
}
