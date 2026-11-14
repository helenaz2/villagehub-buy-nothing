import type { LatLng, User } from '../types';

export const ME = 'u_me';
/** The neighbor who plays the other side of the handoff in demo mode. */
export const DEMO_NEIGHBOR = 'u_maya';

export const seedUsers: User[] = [
  { id: ME, name: 'Riley Park', neighborhood: 'Southside', verified: 'edu', rating: 4.9, handoffs: 7, memberSince: '2026-08' },
  { id: DEMO_NEIGHBOR, name: 'Maya Okafor', neighborhood: 'Elmwood', verified: 'phone', rating: 5.0, handoffs: 12, memberSince: '2025-11' },
  { id: 'u_daniel', name: 'Daniel Reyes', neighborhood: 'Rockridge', verified: 'phone', rating: 4.8, handoffs: 23, memberSince: '2025-03' },
  { id: 'u_priya', name: 'Priya Raman', neighborhood: 'Southside', verified: 'edu', rating: 4.9, handoffs: 5, memberSince: '2026-09' },
  { id: 'u_tom', name: 'Tom Whitaker', neighborhood: 'Westbrae', verified: 'phone', rating: 4.7, handoffs: 31, memberSince: '2024-10' },
  { id: 'u_lucia', name: 'Lucía Herrera', neighborhood: 'Elmwood', verified: 'phone', rating: 5.0, handoffs: 9, memberSince: '2026-01' },
  { id: 'u_kenji', name: 'Kenji Sato', neighborhood: 'Northside', verified: 'edu', rating: 4.6, handoffs: 3, memberSince: '2026-08' },
  { id: 'u_hannah', name: 'Hannah Brandt', neighborhood: 'Claremont', verified: 'phone', rating: 4.9, handoffs: 17, memberSince: '2025-06' },
  { id: 'u_omar', name: 'Omar Haddad', neighborhood: 'Southside', verified: 'edu', rating: 4.8, handoffs: 4, memberSince: '2026-08' },
  { id: 'u_grace', name: 'Grace Liu', neighborhood: 'Albany', verified: null, rating: 4.5, handoffs: 2, memberSince: '2026-10' },
];

export const NEIGHBORHOODS: Record<string, LatLng> = {
  Southside: { lat: 37.8655, lng: -122.2585 },
  Elmwood: { lat: 37.8585, lng: -122.253 },
  Northside: { lat: 37.878, lng: -122.261 },
  'Downtown Berkeley': { lat: 37.87, lng: -122.269 },
  Westbrae: { lat: 37.884, lng: -122.288 },
  Rockridge: { lat: 37.844, lng: -122.252 },
  Temescal: { lat: 37.833, lng: -122.264 },
  Albany: { lat: 37.887, lng: -122.298 },
  Claremont: { lat: 37.856, lng: -122.244 },
  Lorin: { lat: 37.85, lng: -122.27 },
  'North Berkeley': { lat: 37.8795, lng: -122.2745 },
};
