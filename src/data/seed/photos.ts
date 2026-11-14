/**
 * Seed photos are free Unsplash photos, loaded by photo id and cached on the
 * device after the first view. The URL scheme lives in one place so it is easy
 * to swap for bundled files or your own storage bucket.
 *
 * Unsplash License: free to use, no permission needed. Credits are in the README.
 */
export function unsplash(id: string, width = 1080): string {
  return `https://unsplash.com/photos/${id}/download?force=true&w=${width}`;
}

export const PHOTO = {
  sofaGray: '5lLLAxNpAys',
  sofaTanSectional: 'umAXneH4GhA',
  sofaBlue: 'zuM5yMAr8rU',
  officeChairMesh: '144LTaRYmo8',
  rollingChair: 'Pvse_0mSm6Y',
  bookshelfWood: 'fhOQfT1eVEA',
  bookshelfWhite: 'VfHoMBagDPc',
  microwave: '1eWGq_l_DuU',
  brokenChair: 'Ei1DoMO5QDU',
  mattress: 'NCareSEj4JE',
  desk: 'VRoK8MxTlHY',
  floorLamp: '3LTht2nxd34',
  dresserLowboy: 'K712zHuGmW4',
  dresserVase: 'Oe9fxq7ylWw',
  armchairGray: 'Onyw32UMHKg',
  armchairWhite: '1JJJIHh7-Mk',
  diningTable: 'NFbwes_e-jI',
  coffeeTable: '6OCmgz7n4fM',
  mirrorOval: 'ioQfNwEasdw',
  bikeWhite: 'igKjieyjcko',
} as const;

export const allSeedPhotoUrls = (): string[] => Object.values(PHOTO).map((id) => unsplash(id));
