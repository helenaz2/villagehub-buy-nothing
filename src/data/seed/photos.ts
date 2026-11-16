/**
 * Demo photos ship inside the app (assets/seed), so the seeded feed and the
 * sample scans show real pictures instantly, with no signal and no network
 * fetch. A listing stores them as `seed:<key>` strings, the same shape as any
 * other photo URI, and `photoSource` turns that back into a bundled image.
 *
 * Sources and licenses are in docs/PHOTO_CREDITS.md.
 */
const FILES = {
  sofaGray: require('../../../assets/seed/sofa-gray.jpg'),
  sofaTanSectional: require('../../../assets/seed/sofa-tan-sectional.jpg'),
  sofaBlue: require('../../../assets/seed/sofa-blue.jpg'),
  officeChairMesh: require('../../../assets/seed/office-chair-mesh.jpg'),
  rollingChair: require('../../../assets/seed/rolling-chair.jpg'),
  bookshelfBirch: require('../../../assets/seed/bookshelf-birch.jpg'),
  bookshelfWhite: require('../../../assets/seed/bookshelf-white.jpg'),
  microwave: require('../../../assets/seed/microwave.jpg'),
  brokenChair: require('../../../assets/seed/broken-chair.jpg'),
  mattress: require('../../../assets/seed/mattress.jpg'),
  desk: require('../../../assets/seed/desk.jpg'),
  floorLamp: require('../../../assets/seed/floor-lamp.jpg'),
  dresserLowboy: require('../../../assets/seed/dresser-lowboy.jpg'),
  dresserSmall: require('../../../assets/seed/dresser-small.jpg'),
  armchairGray: require('../../../assets/seed/armchair-gray.jpg'),
  armchairPink: require('../../../assets/seed/armchair-pink.jpg'),
  diningTable: require('../../../assets/seed/dining-table.jpg'),
  coffeeTable: require('../../../assets/seed/coffee-table.jpg'),
  mirror: require('../../../assets/seed/mirror.jpg'),
  bikeWhite: require('../../../assets/seed/bike-white.jpg'),
} satisfies Record<string, number>;

export type PhotoKey = keyof typeof FILES;

/** The `seed:<key>` URI a listing stores for a bundled photo. */
export const PHOTO = Object.fromEntries(Object.keys(FILES).map((k) => [k, `seed:${k}`])) as Record<PhotoKey, string>;

/**
 * Older builds stored Unsplash download links. Map those ids to the bundled
 * copies so listings saved on a phone before this change still show a photo.
 */
const LEGACY: Record<string, PhotoKey> = {
  '5lLLAxNpAys': 'sofaGray',
  umAXneH4GhA: 'sofaTanSectional',
  zuM5yMAr8rU: 'sofaBlue',
  '144LTaRYmo8': 'officeChairMesh',
  Pvse_0mSm6Y: 'rollingChair',
  fhOQfT1eVEA: 'bookshelfBirch',
  VfHoMBagDPc: 'bookshelfWhite',
  '1eWGq_l_DuU': 'microwave',
  Ei1DoMO5QDU: 'brokenChair',
  NCareSEj4JE: 'mattress',
  VRoK8MxTlHY: 'desk',
  '3LTht2nxd34': 'floorLamp',
  K712zHuGmW4: 'dresserLowboy',
  Oe9fxq7ylWw: 'dresserSmall',
  Onyw32UMHKg: 'armchairGray',
  '1JJJIHh7-Mk': 'armchairPink',
  'NFbwes_e-jI': 'diningTable',
  '6OCmgz7n4fM': 'coffeeTable',
  ioQfNwEasdw: 'mirror',
  igKjieyjcko: 'bikeWhite',
};

function bundledKey(uri: string): PhotoKey | null {
  if (uri.startsWith('seed:')) {
    const key = uri.slice(5);
    return key in FILES ? (key as PhotoKey) : null;
  }
  const legacy = /unsplash\.com\/photos\/([^/]+)\/download/.exec(uri);
  return legacy ? (LEGACY[legacy[1]!] ?? null) : null;
}

/** The image source for any listing photo: a bundled demo photo, or a file or web URI. */
export function photoSource(uri: string): number | { uri: string } {
  const key = bundledKey(uri);
  return key ? FILES[key] : { uri };
}

/** True for photos that ship with the app rather than coming from the camera or the web. */
export const isBundledPhoto = (uri: string) => bundledKey(uri) != null;
