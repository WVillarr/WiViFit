import { randomUUID } from 'expo-crypto';

/**
 * Client-generated ids for every row created offline (routines, sessions,
 * sets, outbox entries). `randomUUID()` needs no round-trip to a server, so a
 * row can be created in a gym basement with zero signal and still get an id
 * no other device will ever also assign — see user-schema.ts.
 */
export function newId(): string {
  return randomUUID();
}
