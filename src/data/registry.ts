import { ACCENTS, PROTOCOL_ORDER } from "./accents";
import { can } from "./protocols/can";
import { http } from "./protocols/http";
import { https } from "./protocols/https";
import { i2c } from "./protocols/i2c";
import { tcp } from "./protocols/tcp";
import { udp } from "./protocols/udp";
import type { ProtocolDefinition, ProtocolId } from "./types";

/**
 * The registry.
 *
 * Adding a seventh protocol is: write the data file, add one import, add one
 * entry here, add one line to `PROTOCOL_ORDER` and one accent token. No
 * component changes are required, because the whole presentation is generic.
 */
const REGISTRY: Record<ProtocolId, ProtocolDefinition> = {
  tcp,
  udp,
  http,
  https,
  i2c,
  can,
};

/** All protocols, in orbit order. */
export const protocols: ProtocolDefinition[] = PROTOCOL_ORDER.map(
  (id) => REGISTRY[id],
);

export function getProtocol(id: string): ProtocolDefinition | undefined {
  return REGISTRY[id as ProtocolId];
}

export function isProtocolId(value: string): value is ProtocolId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

export { ACCENTS, PROTOCOL_ORDER };
export type { ProtocolDefinition, ProtocolId };
