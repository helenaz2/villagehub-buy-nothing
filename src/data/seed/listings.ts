import type { Claim, Conversation, ImpactEvent, Listing, Message, WantedPost } from '../types';
import { DEMO_NEIGHBOR, ME, NEIGHBORHOODS } from './people';
import { PHOTO, unsplash } from './photos';

const MIN = 60_000;
const HOUR = 60 * MIN;

type Seed = Omit<Listing, 'approx' | 'createdAt' | 'photos' | 'status'> & {
  photo: string;
  minutesAgo: number;
  /** Small offset from the neighborhood center, in degrees. */
  nudge: [number, number];
  status?: Listing['status'];
};

const seeds: Seed[] = [
  {
    id: 'l_chair', ownerId: 'u_priya', title: 'Rolling desk chair', category: 'seating', subcategory: 'Office chair',
    color: 'Brown and black', material: 'Faux leather, metal base', condition: 'good', dims: { w: 25, d: 25, h: 38 }, brand: null,
    description: 'Got me through two years of problem sets. Rolls fine, height lever works, a little wear on the armrests. I am moving out Friday so it needs to go.',
    tags: ['desk chair', 'dorm', 'rolling', 'study'], pickup: 'one_person', weightClass: 'medium', priceUsd: 0, estValueUsd: 35,
    photo: PHOTO.rollingChair, neighborhood: 'Southside', address: '2424 Haste St, Apt 3', mode: 'first_come', availableToday: true, minutesAgo: 14, nudge: [0.001, -0.002],
  },
  {
    id: 'l_sectional', ownerId: 'u_daniel', title: 'Tan leather sectional', category: 'seating', subcategory: 'Sectional sofa',
    color: 'Tan', material: 'Leather', condition: 'good', dims: { w: 104, d: 64, h: 33 }, brand: null,
    description: 'We are downsizing and this will not fit the new place. Leather has softened nicely, one small scuff on the chaise side. Comes apart into two pieces. Bring a truck and a friend.',
    tags: ['sofa', 'sectional', 'leather', 'living room'], pickup: 'needs_truck', weightClass: 'very_heavy', priceUsd: 0, estValueUsd: 320,
    photo: PHOTO.sofaTanSectional, neighborhood: 'Rockridge', address: '5631 Ocean View Dr', mode: 'owner_picks', availableToday: false, minutesAgo: 52, nudge: [-0.001, 0.002],
  },
  {
    id: 'l_lamp', ownerId: 'u_omar', title: 'Black floor lamp', category: 'lighting', subcategory: 'Floor lamp',
    color: 'Black', material: 'Steel', condition: 'like_new', dims: { w: 11, d: 11, h: 62 }, brand: null,
    description: 'Bought it in August, then my roommate brought a better one. Works perfectly. Bulb included.',
    tags: ['lamp', 'floor lamp', 'dorm', 'lighting'], pickup: 'one_person', weightClass: 'light', priceUsd: 0, estValueUsd: 25,
    photo: PHOTO.floorLamp, neighborhood: 'Southside', address: '2650 Durant Ave, front desk', mode: 'first_come', availableToday: true, minutesAgo: 95, nudge: [0.002, 0.001], status: 'pending',
  },
  {
    id: 'l_desk', ownerId: 'u_kenji', title: 'Solid wood writing desk', category: 'tables', subcategory: 'Desk',
    color: 'Natural oak', material: 'Solid wood', condition: 'good', dims: { w: 47, d: 24, h: 30 }, brand: null,
    description: 'Simple and sturdy. A few pen marks on the top that would sand out. The plant is not included, sorry.',
    tags: ['desk', 'wood', 'study', 'home office'], pickup: 'two_people', weightClass: 'heavy', priceUsd: 0, estValueUsd: 90,
    photo: PHOTO.desk, neighborhood: 'Northside', address: '1721 Euclid Ave', mode: 'owner_picks', availableToday: true, minutesAgo: 3 * 60, nudge: [0.001, 0.001],
  },
  {
    id: 'l_dresser', ownerId: 'u_lucia', title: 'Low walnut dresser', category: 'storage', subcategory: 'Dresser',
    color: 'Walnut brown', material: 'Wood veneer', condition: 'good', dims: { w: 58, d: 18, h: 30 }, brand: null,
    description: 'Six drawers, all slide smoothly. It was my grandmother\'s and I would love it to go to someone who will use it. Asking a little so it goes to someone serious.',
    tags: ['dresser', 'mid-century', 'bedroom', 'storage'], pickup: 'two_people', weightClass: 'heavy', priceUsd: 30, estValueUsd: 140,
    photo: PHOTO.dresserLowboy, neighborhood: 'Elmwood', address: '2811 Piedmont Ave', mode: 'owner_picks', availableToday: false, minutesAgo: 5 * 60, nudge: [-0.002, -0.001],
  },
  {
    id: 'l_armchair', ownerId: 'u_hannah', title: 'Gray reading armchair', category: 'seating', subcategory: 'Armchair',
    color: 'Gray', material: 'Woven fabric', condition: 'good', dims: { w: 31, d: 33, h: 34 }, brand: null,
    description: 'Very comfortable, no pets, no smoking. The blanket stays with me. Fits in a hatchback with the seats down.',
    tags: ['armchair', 'reading chair', 'living room'], pickup: 'one_person', weightClass: 'medium', priceUsd: 0, estValueUsd: 80,
    photo: PHOTO.armchairGray, neighborhood: 'Claremont', address: '14 Hillcrest Ct', mode: 'first_come', availableToday: true, minutesAgo: 7 * 60, nudge: [0.001, -0.001],
  },
  {
    id: 'l_bike', ownerId: 'u_omar', title: 'White road bike, 54 cm', category: 'bikes', subcategory: 'Road bike',
    color: 'White', material: 'Steel frame', condition: 'worn', dims: { w: 68, d: 17, h: 39 }, brand: null,
    description: 'Rides well, new tubes last spring. Brake pads are due and the bar tape is tired. Good campus bike for someone who can do a little tuning.',
    tags: ['bike', 'road bike', 'commuter', 'campus'], pickup: 'one_person', weightClass: 'medium', priceUsd: 45, estValueUsd: 120,
    photo: PHOTO.bikeWhite, neighborhood: 'Southside', address: '2401 Channing Way', mode: 'first_come', availableToday: true, minutesAgo: 9 * 60, nudge: [-0.001, 0.002],
  },
  {
    id: 'l_dining', ownerId: 'u_tom', title: 'Dining table and chairs', category: 'tables', subcategory: 'Dining set',
    color: 'Warm brown', material: 'Solid wood', condition: 'good', dims: { w: 60, d: 36, h: 30 }, brand: null,
    description: 'Seats four comfortably, six if you like each other. Legs unbolt so it lies flat in a wagon. Fed a lot of people over twelve years.',
    tags: ['dining table', 'chairs', 'wood', 'kitchen'], pickup: 'needs_disassembly', weightClass: 'very_heavy', priceUsd: 60, estValueUsd: 260,
    photo: PHOTO.diningTable, neighborhood: 'Westbrae', address: '1338 Gilman St', mode: 'owner_picks', availableToday: false, minutesAgo: 22 * 60, nudge: [0.001, 0.002],
  },
  {
    id: 'l_coffee', ownerId: 'u_daniel', title: 'Rustic coffee table', category: 'tables', subcategory: 'Coffee table',
    color: 'Weathered brown', material: 'Reclaimed wood', condition: 'worn', dims: { w: 42, d: 22, h: 17 }, brand: null,
    description: 'Plenty of character, which is a kind word for water rings. Solid as a rock. Books and vase not included.',
    tags: ['coffee table', 'rustic', 'living room'], pickup: 'one_person', weightClass: 'medium', priceUsd: 0, estValueUsd: 45,
    photo: PHOTO.coffeeTable, neighborhood: 'Temescal', address: '482 45th St', mode: 'first_come', availableToday: true, minutesAgo: 26 * 60, nudge: [0.002, -0.002],
  },
  {
    id: 'l_mirror', ownerId: 'u_hannah', title: 'Oval mirror, wood frame', category: 'decor', subcategory: 'Mirror',
    color: 'Brown', material: 'Wood and glass', condition: 'like_new', dims: { w: 20, d: 2, h: 30 }, brand: null,
    description: 'Hung in our hallway for a year. No chips. I will wrap it in a towel for the ride home.',
    tags: ['mirror', 'entryway', 'decor'], pickup: 'one_person', weightClass: 'light', priceUsd: 0, estValueUsd: 40,
    photo: PHOTO.mirrorOval, neighborhood: 'Claremont', address: '14 Hillcrest Ct', mode: 'first_come', availableToday: false, minutesAgo: 30 * 60, nudge: [0.001, -0.001],
  },
  {
    id: 'l_shelf', ownerId: 'u_grace', title: 'White bookshelf', category: 'storage', subcategory: 'Bookshelf',
    color: 'White', material: 'Painted wood', condition: 'good', dims: { w: 32, d: 11, h: 71 }, brand: null,
    description: 'Five shelves, holds a real load of textbooks without sagging. Two small paint chips near the base.',
    tags: ['bookshelf', 'bookcase', 'storage', 'white'], pickup: 'two_people', weightClass: 'heavy', priceUsd: 0, estValueUsd: 55,
    photo: PHOTO.bookshelfWhite, neighborhood: 'Albany', address: '915 Solano Ave', mode: 'first_come', availableToday: true, minutesAgo: 33 * 60, nudge: [-0.001, 0.001],
  },
  {
    id: 'l_blue', ownerId: 'u_lucia', title: 'Blue mid-century couch', category: 'seating', subcategory: 'Sofa',
    color: 'Deep blue', material: 'Upholstery on wood legs', condition: 'like_new', dims: { w: 78, d: 33, h: 31 }, brand: null,
    description: 'Barely a year old. We are moving abroad and cannot take it. Cushions are firm, fabric is clean.',
    tags: ['sofa', 'couch', 'mid-century', 'blue'], pickup: 'two_people', weightClass: 'heavy', priceUsd: 40, estValueUsd: 380,
    photo: PHOTO.sofaBlue, neighborhood: 'Elmwood', address: '2811 Piedmont Ave', mode: 'owner_picks', availableToday: false, minutesAgo: 41 * 60, nudge: [0.002, 0.001],
  },
  {
    id: 'l_nightstand', ownerId: 'u_tom', title: 'Small wooden dresser', category: 'storage', subcategory: 'Nightstand',
    color: 'Honey', material: 'Pine', condition: 'worn', dims: { w: 28, d: 16, h: 27 }, brand: null,
    description: 'Three drawers. The finish is scratched on top, easy to cover with a runner or refinish over a weekend.',
    tags: ['nightstand', 'dresser', 'bedroom', 'pine'], pickup: 'one_person', weightClass: 'medium', priceUsd: 0, estValueUsd: 30,
    photo: PHOTO.dresserVase, neighborhood: 'Lorin', address: '3120 Ellis St', mode: 'first_come', availableToday: true, minutesAgo: 49 * 60, nudge: [0.001, 0.001],
  },
  {
    id: 'l_white', ownerId: 'u_kenji', title: 'White armchair, black frame', category: 'seating', subcategory: 'Armchair',
    color: 'White', material: 'Padded fabric, wood frame', condition: 'good', dims: { w: 27, d: 29, h: 30 }, brand: null,
    description: 'Clean lines and a comfortable sit. One faint mark on the left arm that I never got around to cleaning.',
    tags: ['armchair', 'accent chair', 'modern'], pickup: 'one_person', weightClass: 'medium', priceUsd: 20, estValueUsd: 110,
    photo: PHOTO.armchairWhite, neighborhood: 'North Berkeley', address: '1509 Walnut St', mode: 'first_come', availableToday: false, minutesAgo: 60 * 60, nudge: [-0.001, -0.002],
  },
];

export function buildSeed(now: number) {
  const listings: Listing[] = seeds.map(({ photo, minutesAgo, nudge, status, ...rest }) => {
    const center = NEIGHBORHOODS[rest.neighborhood] ?? { lat: 37.8676, lng: -122.2595 };
    return {
      ...rest,
      photos: [unsplash(photo)],
      approx: { lat: center.lat + nudge[0], lng: center.lng + nudge[1] },
      status: status ?? 'available',
      createdAt: now - minutesAgo * MIN,
    };
  });

  const claims: Claim[] = [
    { id: 'c_s1', listingId: 'l_sectional', userId: 'u_hannah', note: 'Our book club has been sitting on the floor. I have a truck Saturday.', status: 'waiting', createdAt: now - 40 * MIN },
    { id: 'c_s2', listingId: 'l_sectional', userId: 'u_kenji', note: 'Four of us just moved into an empty apartment.', status: 'waiting', createdAt: now - 31 * MIN },
    { id: 'c_s3', listingId: 'l_sectional', userId: 'u_grace', note: 'Could pick up any evening this week.', status: 'waiting', createdAt: now - 12 * MIN },
    { id: 'c_d1', listingId: 'l_desk', userId: 'u_priya', note: 'Need a desk for my new room.', status: 'waiting', createdAt: now - 2 * HOUR },
    { id: 'c_lamp', listingId: 'l_lamp', userId: ME, note: '', status: 'confirmed', createdAt: now - 80 * MIN },
  ];

  const tomorrowFive = new Date(now + 24 * HOUR);
  tomorrowFive.setHours(17, 0, 0, 0);

  const conversations: Conversation[] = [
    { id: 'cv_lamp', listingId: 'l_lamp', buyerId: ME, sellerId: 'u_omar', pickupAt: tomorrowFive.getTime(), porch: false, meetSpot: 'Front desk, Unit 3 lobby' },
  ];

  const messages: Message[] = [
    { id: 'm_1', conversationId: 'cv_lamp', senderId: 'system', body: 'Omar confirmed your claim. Pickup address: 2650 Durant Ave, front desk.', createdAt: now - 78 * MIN },
    { id: 'm_2', conversationId: 'cv_lamp', senderId: ME, body: 'Thanks! Could I come by tomorrow around 5?', createdAt: now - 75 * MIN },
    { id: 'm_3', conversationId: 'cv_lamp', senderId: 'u_omar', body: 'Works for me. I will leave it with the front desk under your name in case I am in lab.', createdAt: now - 70 * MIN },
  ];

  const impact: ImpactEvent[] = [
    { id: 'i_1', userId: ME, listingId: null, kind: 'rehomed', title: 'Mini fridge', lbs: 35, co2Kg: 44, savedUsd: 60, at: now - 21 * 24 * HOUR },
    { id: 'i_2', userId: ME, listingId: null, kind: 'rehomed', title: 'Twin bed frame', lbs: 35, co2Kg: 21, savedUsd: 45, at: now - 16 * 24 * HOUR },
    { id: 'i_3', userId: ME, listingId: null, kind: 'donated', title: 'Box of kitchenware', lbs: 12, co2Kg: 4, savedUsd: 20, at: now - 9 * 24 * HOUR },
  ];

  const wanted: WantedPost[] = [
    { id: 'w_1', userId: DEMO_NEIGHBOR, text: 'A couch for our first apartment. Any color, we are not picky.', category: 'seating', createdAt: now - 3 * HOUR },
    { id: 'w_2', userId: 'u_priya', text: 'Need a desk for a dorm room, under 40 inches wide.', category: 'tables', createdAt: now - 8 * HOUR },
    { id: 'w_3', userId: 'u_grace', text: 'Microwave for a shared kitchen. Ours died mid-burrito.', category: 'appliances', createdAt: now - 20 * HOUR },
  ];

  return { listings, claims, conversations, messages, impact, wanted };
}

/** Pounds kept out of landfill near the user this month, before this session's handoffs. */
export const NEIGHBORHOOD_BASE_LBS = 1284;
