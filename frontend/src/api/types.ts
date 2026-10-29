// Typy odpowiadajace widokom zwracanym przez backend (pl.spacepioneers.game.service.Views i in.).

export interface Resources {
  metal: number;
  crystal: number;
  tritium: number;
}

export type ResourceKey = keyof Resources;

export interface PlanetRef {
  id: number;
  name: string;
  coordinates: string;
  planetType: string;
  imageVariant: number;
  homeworld: boolean;
  moon: boolean;
}

export interface ResourceState {
  amount: Resources;
  perHour: Resources;
  capacity: Resources;
  energyProduced: number;
  energyUsed: number;
  efficiency: number;
}

export interface BuildQueueItem {
  id: number;
  building: string;
  level: number;
  demolish: boolean;
  cost: Resources;
  start?: string;
  end?: string;
}

export interface ShipyardItem {
  id: number;
  unit: string;
  count: number;
  done: number;
  secondsPerUnit: number;
  currentUnitStart?: string;
  finishAt?: string;
}

export interface ResearchInProgress {
  research: string;
  level: number;
  planetId: number;
  start: string;
  end: string;
}

export type Mission = 'ATTACK' | 'TRANSPORT' | 'DEPLOY' | 'COLONIZE' | 'RECYCLE' | 'ESPIONAGE' | 'HOLD' | 'EXPEDITION' | 'MISSILE';

export interface FleetMovement {
  id: number;
  mission: Mission;
  status: 'OUTBOUND' | 'HOLDING' | 'RETURNING';
  own: boolean;
  ownerName: string;
  origin: string;
  target: string;
  targetMoon: boolean;
  unionId?: number;
  departAt: string;
  arriveAt: string;
  holdUntil?: string;
  returnAt?: string;
  ships: Record<string, number>;
  cargo?: Resources;
}

export interface Overview {
  serverTime: string;
  playerId: number;
  playerName: string;
  planet: PlanetRef;
  planets: PlanetRef[];
  fieldsUsed: number;
  fieldsMax: number;
  temperatureMin: number;
  temperatureMax: number;
  resources: ResourceState;
  buildQueue: BuildQueueItem[];
  shipyardQueue: ShipyardItem[];
  research?: ResearchInProgress;
  fleets: FleetMovement[];
  points: number;
  rank: number;
  playerCount: number;
  unreadMessages: number;
  branch: Branch;
  canChooseBranch: boolean;
  vacation: boolean;
}

export type Branch = 'NONE' | 'TRADER' | 'WARRIOR';

export interface UpgradeOption {
  key: string;
  category: string;
  level: number;
  nextLevel: number;
  cost: Resources;
  seconds: number;
  missing: string[];
  blocker?: string;
  affordable: boolean;
  branch: Branch;
  energyDelta?: number;
}

export interface UnitOption {
  key: string;
  type: 'SHIP' | 'DEFENSE' | 'MISSILE';
  available: number;
  cost: Resources;
  secondsPerUnit: number;
  missing: string[];
  blocker?: string;
  maxBuildable: number;
  attack: number;
  shield: number;
  hull: number;
  cargo: number;
  speed: number;
  branch: Branch;
}

export interface ProductionLine {
  source: string;
  level: number;
  percent?: number;
  perHour: Resources;
  energy?: number;
}

export interface ResourcesView {
  planet: PlanetRef;
  amount: Resources;
  capacity: Resources;
  perHour: Resources;
  energyProduced: number;
  energyUsed: number;
  efficiency: number;
  lines: ProductionLine[];
}

export interface GalaxyRow {
  position: number;
  planetId?: number;
  planetName?: string;
  planetType?: string;
  imageVariant: number;
  ownerId?: number;
  ownerName?: string;
  ownerRank?: number;
  allianceId?: number;
  allianceTag?: string;
  flags: string[];
  debris?: Resources;
  own: boolean;
  moonId?: number;
  moonName?: string;
  moonImageVariant: number;
}

export interface GalaxyView {
  galaxy: number;
  system: number;
  galaxies: number;
  systems: number;
  rows: GalaxyRow[];
}

export interface RankingRow {
  rank: number;
  id: number;
  name: string;
  allianceTag?: string;
  allianceId?: number;
  points: number;
  members?: number;
}

export interface RankingPage {
  type: 'players' | 'alliances';
  category: string;
  page: number;
  pageSize: number;
  total: number;
  rows: RankingRow[];
}

export interface Profile {
  id: number;
  username: string;
  email: string;
  branch: Branch;
  canChooseBranch: boolean;
  vacation: boolean;
  vacationMinimumEnd?: string;
  language: string;
  points: number;
  rank: number;
  allianceId?: number;
  allianceRank?: 'FOUNDER' | 'OFFICER' | 'MEMBER';
  homePlanetId: number;
  admin: boolean;
  pendingApplicationAllianceId?: number;
  emailVerified: boolean;
  deletionAt?: string;
}

export interface EmpirePlanet {
  planet: PlanetRef;
  fieldsUsed: number;
  fieldsMax: number;
  resources: Resources;
  perHour: Resources;
  energyBalance: number;
  buildings: Record<string, number>;
  units: Record<string, number>;
}

export interface AuthResponse {
  token: string;
  profile: Profile;
}

export type MessageType = 'PRIVATE' | 'COMBAT' | 'ESPIONAGE' | 'FLEET' | 'ALLIANCE' | 'SYSTEM';

export interface GameMessage {
  id: number;
  senderId?: number;
  senderName?: string;
  type: MessageType;
  subject: string;
  body: string;
  payload?: CombatReport | EspionageReport;
  createdAt: string;
  read: boolean;
}

export interface CombatSide {
  playerId: number;
  playerName: string;
  coordinates: string;
  weapons: number;
  shielding: number;
  armour: number;
}

export interface CombatRound {
  number: number;
  attackerShots: number;
  attackerDamage: number;
  absorbedByDefender: number;
  defenderShots: number;
  defenderDamage: number;
  absorbedByAttacker: number;
  attackerUnits: Record<string, number>[];
  defenderUnits: Record<string, number>[];
}

export interface CombatReport {
  at: string;
  coordinates: string;
  planetName: string;
  attackers: CombatSide[];
  defenders: CombatSide[];
  attackerStart: Record<string, number>[];
  defenderStart: Record<string, number>[];
  rounds: CombatRound[];
  outcome: 'ATTACKER' | 'DEFENDER' | 'DRAW';
  attackerLosses: Record<string, number>[];
  defenderLosses: Record<string, number>[];
  defenseRebuilt: Record<string, number>;
  loot: Resources;
  debris: Resources;
  attackerLostValue: Resources;
  defenderLostValue: Resources;
  moonChancePercent: number;
  moonCreated: boolean;
}

export interface EspionageReport {
  at: string;
  coordinates: string;
  planetName: string;
  ownerId: number;
  ownerName: string;
  moon: boolean;
  resources: Resources;
  fleet?: Record<string, number>;
  defense?: Record<string, number>;
  buildings?: Record<string, number>;
  research?: Record<string, number>;
  counterEspionageChancePercent: number;
  probesDestroyed: boolean;
}

export interface AllianceSummary {
  id: number;
  tag: string;
  name: string;
  members: number;
  points: number;
  rank: number;
  open: boolean;
}

export interface AllianceMember {
  playerId: number;
  name: string;
  rank: 'FOUNDER' | 'OFFICER' | 'MEMBER';
  points: number;
  playerRank: number;
  lastActivity?: string;
  homeCoordinates?: string;
}

export interface AllianceApplication {
  id: number;
  playerId: number;
  playerName: string;
  points: number;
  text: string;
  createdAt: string;
}

export type TreatyType = 'DEFENSE_PACT' | 'TRADE_PACT' | 'NON_AGGRESSION' | 'WAR';

export interface TreatyView {
  id: number;
  otherAllianceId: number;
  otherTag: string;
  otherName: string;
  type: TreatyType;
  status: 'PROPOSED' | 'ACTIVE';
  proposedByUs: boolean;
  createdAt: string;
}

export interface AllianceView {
  id: number;
  tag: string;
  name: string;
  description: string;
  homepage: string;
  open: boolean;
  createdAt: string;
  points: number;
  rank: number;
  memberCount: number;
  members: AllianceMember[];
  applications: AllianceApplication[];
  treaties: TreatyView[];
  myRank?: 'FOUNDER' | 'OFFICER' | 'MEMBER';
}

export interface DispatchInfo {
  planet: PlanetRef;
  ships: Record<string, number>;
  speeds: Record<string, number>;
  slotsUsed: number;
  slotsMax: number;
  resources: Resources;
  expeditionsUsed: number;
  expeditionsMax: number;
  missiles: number;
  missileRange: number;
}

export interface UnionView {
  id: number;
  name: string;
  target: string;
  targetMoon: boolean;
  arriveAt: string;
  ownerName: string;
  own: boolean;
  fleets: number;
  invited: string[];
}

export interface BuddyView {
  id: number;
  playerId: number;
  name: string;
  status: 'PENDING' | 'ACCEPTED';
  incoming: boolean;
  text: string;
  lastActivity?: string;
  allianceTag?: string;
  points: number;
  homeCoordinates?: string;
}

export interface FleetEstimate {
  distance: number;
  speed: number;
  durationSeconds: number;
  fuel: number;
  capacity: number;
}

export interface MarketOffer {
  available: boolean;
  fee: number;
  tradeCenterLevel: number;
}

export interface Requirements {
  buildings: Record<string, number>;
  research: Record<string, number>;
}

export interface GrowthFormula {
  resource?: string;
  base: number;
  growth: number;
}

export interface BuildingDef {
  key: string;
  category: string;
  branch: Branch;
  baseCost: Resources;
  costFactor: number;
  maxLevel?: number;
  location?: 'PLANET' | 'MOON' | 'ANY';
  production?: GrowthFormula;
  energyUse?: GrowthFormula;
  energyProduction?: GrowthFormula;
  requirements: Requirements;
}

export interface ResearchDef {
  key: string;
  branch: Branch;
  baseCost: Resources;
  costFactor: number;
  requirements: Requirements;
}

export interface UnitDef {
  key: string;
  type: 'SHIP' | 'DEFENSE' | 'MISSILE';
  branch: Branch;
  cost: Resources;
  attack: number;
  shield: number;
  cargo: number;
  speed: number;
  drive?: string;
  fuel: number;
  stationary?: boolean;
  maxCount?: number;
  requirements: Requirements;
}

export interface UniverseConfig {
  galaxies: number;
  systems: number;
  positions: number;
  economySpeed: number;
  researchSpeed: number;
  fleetSpeed: number;
  debrisRatio: number;
  defenseRebuildRate: number;
  lootRatio: number;
  maxCombatRounds: number;
  newbieProtectionPoints: number;
  newbieRatio: number;
}

export interface GameConfig {
  universeName: string;
  universe: UniverseConfig;
  branchMinPoints: number;
  buildings: BuildingDef[];
  research: ResearchDef[];
  ships: UnitDef[];
  defenses: UnitDef[];
  missiles: UnitDef[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface PilloryEntry {
  at: string;
  adminName: string;
  playerName: string;
  reason: string;
  until?: string;
}

export interface AdminStats {
  players: number;
  online15m: number;
  active24h: number;
  banned: number;
  pendingDeletion: number;
  unverified: number;
  planets: number;
  moons: number;
  fleetsInFlight: number;
  alliances: number;
  now: string;
}

export interface AdminPlayerRow {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  admin: boolean;
  points: number;
  rank: number;
  createdAt: string;
  lastActivity?: string;
  bannedUntil?: string;
  banReason?: string;
  vacation: boolean;
  deletionAt?: string;
  allianceTag?: string;
  planets: number;
}

export interface AdminPlayerDetail {
  player: AdminPlayerRow;
  planets: { id: number; name: string; coordinates: string; moon: boolean; fieldsUsed: number; fields: number }[];
  fleetsInFlight: number;
}

export interface AdminLogEntry {
  id: number;
  at: string;
  adminName: string;
  action: string;
  targetId?: number;
  targetName?: string;
  details?: string;
  until?: string;
}
