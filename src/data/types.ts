export type Condition = 'like_new' | 'good' | 'worn' | 'damaged';
export type Pickup = 'one_person' | 'two_people' | 'needs_truck' | 'needs_disassembly';
export type WeightClass = 'light' | 'medium' | 'heavy' | 'very_heavy';
export type ActionKind = 'give' | 'sell' | 'donate' | 'dispose';
export type ClaimMode = 'first_come' | 'owner_picks';
export type ListingStatus = 'available' | 'pending' | 'given';
export type Category =
  | 'seating'
  | 'tables'
  | 'storage'
  | 'beds'
  | 'lighting'
  | 'appliances'
  | 'electronics'
  | 'decor'
  | 'bikes'
  | 'other';

export type SafetyFlag =
  | 'mattress'
  | 'car_seat'
  | 'crib'
  | 'hazmat'
  | 'refrigerant'
  | 'prohibited';

export type LatLng = { lat: number; lng: number };

export type User = {
  id: string;
  name: string;
  neighborhood: string;
  verified: 'phone' | 'edu' | null;
  rating: number;
  handoffs: number;
  memberSince: string;
};

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  category: Category;
  subcategory: string;
  color: string;
  material: string;
  condition: Condition;
  /** Inches. Centimeters are derived for display. */
  dims: { w: number; d: number; h: number };
  brand: string | null;
  description: string;
  tags: string[];
  pickup: Pickup;
  weightClass: WeightClass;
  /** 0 means free. */
  priceUsd: number;
  /** What a neighbor would otherwise pay for a used one. Feeds the impact numbers. */
  estValueUsd: number;
  photos: string[];
  neighborhood: string;
  /** Blurred to roughly a block. Safe to show on a map. */
  approx: LatLng;
  /** Only revealed to a claimant the owner has confirmed. */
  address: string;
  mode: ClaimMode;
  status: ListingStatus;
  availableToday: boolean;
  createdAt: number;
};

export type Claim = {
  id: string;
  listingId: string;
  userId: string;
  note: string;
  status: 'waiting' | 'confirmed' | 'passed';
  createdAt: number;
};

export type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  pickupAt: number | null;
  porch: boolean;
  meetSpot: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string | 'system';
  body: string;
  createdAt: number;
};

export type Handoff = {
  id: string;
  listingId: string;
  conversationId: string;
  token: string;
  status: 'pending' | 'done';
  completedAt: number | null;
};

export type Review = {
  id: string;
  handoffId: string;
  fromId: string;
  toId: string;
  stars: number;
};

export type ImpactEvent = {
  id: string;
  userId: string;
  listingId: string | null;
  kind: 'rehomed' | 'donated' | 'recycled';
  title: string;
  lbs: number;
  co2Kg: number;
  savedUsd: number;
  at: number;
};

export type WantedPost = {
  id: string;
  userId: string;
  text: string;
  category: Category;
  createdAt: number;
};

export type PlaceTier = 1 | 2 | 3 | 4 | 5;

export type Place = {
  id: string;
  name: string;
  kind: string;
  tier: PlaceTier;
  location: LatLng;
  address: string;
  phone: string | null;
  url: string | null;
  /**
   * Hours by weekday, Sunday first. A null day means closed. Times are 24h decimals, 8.5 = 8:30.
   * The whole field is null when we have no confirmed hours and the user should call ahead.
   */
  hours: ([number, number] | null)[] | null;
  accepts: Category[];
  /** Worst condition they will take. */
  minCondition: Condition;
  refuses: SafetyFlag[];
  takesFlags: SafetyFlag[];
  pickup: 'free' | 'paid' | 'request' | 'none';
  pickupNote: string | null;
  dropoff: boolean;
  taxReceipt: boolean;
  why: string;
  note: string | null;
  costNote: string | null;
  /** Where the facts came from and when they were last checked. */
  source: string;
  checked: string;
};
