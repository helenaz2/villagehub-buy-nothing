import { MapPinned } from 'lucide-react-native';

import type { LatLng, Listing } from '@/data/types';

import { EmptyState } from './bits';

/** The map uses native map views, so the web build shows a note instead. */
export function ListingMap(_props: { listings: Listing[]; center: LatLng }) {
  return (
    <EmptyState
      icon={MapPinned}
      title="The map lives on the phone"
      body="Open Curbside in Expo Go or a device build to see listings on a map. The list view works everywhere."
    />
  );
}
