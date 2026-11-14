import { router } from 'expo-router';
import MapView, { Circle, Marker } from 'react-native-maps';

import type { LatLng, Listing } from '@/data/types';
import { price } from '@/lib/format';
import { palette } from '@/theme';

type Props = { listings: Listing[]; center: LatLng };

/**
 * Listings on a map. Each pin sits on the blurred location, with a soft circle
 * around it, so nobody can read a home address off the map.
 */
export function ListingMap({ listings, center }: Props) {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.07, longitudeDelta: 0.07 }}
      showsPointsOfInterests={false}
      toolbarEnabled={false}>
      {listings.map((l) => (
        <Circle
          key={`c_${l.id}`}
          center={{ latitude: l.approx.lat, longitude: l.approx.lng }}
          radius={180}
          strokeWidth={0}
          fillColor="rgba(30, 59, 47, 0.14)"
        />
      ))}
      {listings.map((l) => (
        <Marker
          key={l.id}
          coordinate={{ latitude: l.approx.lat, longitude: l.approx.lng }}
          title={l.title}
          description={`${price(l.priceUsd)}, ${l.neighborhood}. Tap for details.`}
          pinColor={l.priceUsd > 0 ? palette.forest : palette.terracotta}
          onCalloutPress={() => router.push(`/listing/${l.id}`)}
        />
      ))}
    </MapView>
  );
}
