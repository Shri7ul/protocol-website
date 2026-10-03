import type { Accent, ProtocolId } from "./types";

/**
 * Protocol accent colours.
 *
 * These are the *only* colours on the site. Each one is owned by exactly one
 * protocol and is used to answer a single question: "which protocol is this?"
 * They appear on the orbit wires, slide headers, header-field diagrams and
 * comparison columns — never as general decoration.
 *
 * `hex` values are duplicated from globals.css because SVG `stroke`/`fill` and
 * Framer Motion value interpolation need real colour literals, not `var()`.
 */
export const ACCENTS: Record<ProtocolId, Accent> = {
  tcp: {
    token: "--color-tcp",
    hex: "#4f93f5",
    soft: "#4f93f51f",
  },
  udp: {
    token: "--color-udp",
    hex: "#a97bf0",
    soft: "#a97bf01f",
  },
  http: {
    token: "--color-http",
    hex: "#e9a13f",
    soft: "#e9a13f1f",
  },
  https: {
    token: "--color-https",
    hex: "#4cc98a",
    soft: "#4cc98a1f",
  },
  i2c: {
    token: "--color-i2c",
    hex: "#4fc4dd",
    soft: "#4fc4dd1f",
  },
  can: {
    token: "--color-can",
    hex: "#e8674a",
    soft: "#e8674a1f",
  },
};

/** Order in which protocols appear on the orbit and in the recap. */
export const PROTOCOL_ORDER: ProtocolId[] = [
  "tcp",
  "udp",
  "http",
  "https",
  "i2c",
  "can",
];

/**
 * Which layer each protocol belongs to, and which other protocols share it.
 * Used by the foundations diagram so the grouping is derived, not duplicated.
 */
export const LAYER_GROUPS: {
  id: string;
  label: string;
  protocols: ProtocolId[];
  describedAs: string;
}[] = [
  {
    id: "application",
    label: "Application",
    protocols: ["http", "https"],
    describedAs: "Programs talk in requests and responses",
  },
  {
    id: "transport",
    label: "Transport",
    protocols: ["tcp", "udp"],
    describedAs: "End-to-end delivery between two processes",
  },
  {
    id: "network",
    label: "Network",
    protocols: [],
    describedAs: "Routing between hosts across networks (IP)",
  },
  {
    id: "data-link",
    label: "Data Link",
    protocols: [],
    describedAs: "Frames across one physical hop (Ethernet, Wi-Fi)",
  },
];
