/**
 * The content model for Protocol Atlas.
 *
 * Every protocol page is produced by ONE generic presentation shell reading one
 * of these objects. Nothing about a protocol's layout is hard-coded — adding a
 * seventh protocol means adding one data file and one line to the registry.
 *
 * The types are intentionally narrow. A slide can only be built out of a small
 * set of primitives (steps, sequence diagrams, key/value pairs, header fields,
 * comparison rows), which is what keeps six very different protocols looking
 * like chapters of the same book instead of six separate microsites.
 */

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

/** Stable slug. Also the URL segment and the accent-token suffix. */
export type ProtocolId = "tcp" | "udp" | "http" | "https" | "i2c" | "can";

/** The four-layer model, plus the two embedded-bus worlds that sit outside it. */
export type LayerId =
  | "application"
  | "transport"
  | "network"
  | "data-link"
  | "embedded";

export interface Accent {
  /** CSS custom property name holding the colour, e.g. `--color-tcp`. */
  token: string;
  /** Literal value. Used where a real colour is required (SVG, canvas). */
  hex: string;
  /** Same hue, low alpha. For fills and glow pools. */
  soft: string;
}

/* ------------------------------------------------------------------ *
 * Header / frame field diagram
 * ------------------------------------------------------------------ */

export interface HeaderField {
  name: string;
  /** Size as written in the spec, e.g. `16 bits`, `11 bits`, `variable`. */
  size: string;
  /** What the field is for. Shown in the inspector panel on hover/focus. */
  role: string;
  /** Deeper detail — edge cases, common values, why it exists. */
  detail?: string;
  /** Example value from a real packet. */
  example?: string;
  /**
   * Relative flex-grow weight when laying the field out. 1 ≈ narrow,
   * 4 ≈ wide. Purely presentational; the real byte counts are in `size`.
   */
  span?: number;
  /** Which protocol-accent to paint it with. Defaults to the protocol's own. */
  tone?: "accent" | "neutral" | "warn" | "ok" | "danger";
}

/** A group of fields drawn as one horizontal band (one 32-bit word, usually). */
export interface HeaderRow {
  label?: string;
  fields: HeaderField[];
}

export interface FrameStructure {
  /** What this unit of data is called at this layer. */
  unit: string;
  /** e.g. `20 bytes minimum, 60 bytes maximum`. */
  overhead: string;
  /** Framing note, e.g. "no delimiter — length is implied by the IP header". */
  note: string;
  rows: HeaderRow[];
}

/* ------------------------------------------------------------------ *
 * Sequence / flow diagrams
 * ------------------------------------------------------------------ */

/**
 * One arrow in a time-sequence diagram.
 * `from`/`to` index into the parent step's `node` list.
 */
export interface SequenceArrow {
  from: number;
  to: number;
  label: string;
  /** Sub-label rendered in the mono micro-type, e.g. `seq = 0`. */
  detail?: string;
  /** Direction of travel is implied by from/to; this only changes styling. */
  tone?: "accent" | "neutral" | "ok" | "danger" | "warn";
  /** Marks this arrow as the failure/retry case, drawn dashed. */
  dashed?: boolean;
}

export interface SequenceNode {
  label: string;
  /** Short descriptor under the label, e.g. `0..65535`. */
  sub?: string;
}

export interface Sequence {
  caption?: string;
  nodes: SequenceNode[];
  arrows: SequenceArrow[];
}

/* ------------------------------------------------------------------ *
 * Steps ("how it works")
 * ------------------------------------------------------------------ */

export interface Step {
  id: string;
  /** Short title, e.g. `Connection establishment`. */
  title: string;
  /** One-sentence summary shown in the collapsed list. */
  summary: string;
  /** 2–4 sentences shown when the step is expanded. */
  body: string;
  /** Optional concrete values, rendered as a mono key/value list. */
  facts?: { key: string; value: string }[];
  /** Optional animated diagram for this step. */
  sequence?: Sequence;
}

/* ------------------------------------------------------------------ *
 * Concepts ("why it exists")
 * ------------------------------------------------------------------ */

export interface Concept {
  title: string;
  body: string;
  /** Tiny mono tag, e.g. `mechanism`, `guarantee`, `cost`. */
  tag?: string;
  /** A compact visual glyph id rendered next to the card. */
  glyph?: GlyphId;
}

export type GlyphId =
  | "ordering"
  | "ack"
  | "retransmit"
  | "flow"
  | "congestion"
  | "checksum"
  | "handshake"
  | "stateless"
  | "loss"
  | "encrypt"
  | "identity"
  | "integrity"
  | "clock"
  | "arbitration"
  | "differential"
  | "priority"
  | "multidrop"
  | "pullup"
  | "cache"
  | "method"
  | "session";

/* ------------------------------------------------------------------ *
 * Comparisons
 * ------------------------------------------------------------------ */

export interface ComparisonColumn {
  /** Protocol id or an ad-hoc label for non-protocol columns. */
  label: string;
  accentToken?: string;
  accentHex?: string;
  /** Highlights the column as "the one this page is about". */
  emphasis?: boolean;
}

export interface ComparisonRow {
  dimension: string;
  /** One cell per column, in the same order. */
  cells: string[];
}

export interface Comparison {
  title: string;
  /** Why this comparison matters — one sentence of framing. */
  framing: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}

/* ------------------------------------------------------------------ *
 * Real-world example
 * ------------------------------------------------------------------ */

export interface ExampleHop {
  label: string;
  sub?: string;
  /** Key/value values displayed for this hop. */
  facts?: { key: string; value: string }[];
}

export interface RealWorldExample {
  title: string;
  scenario: string;
  hops: ExampleHop[];
  /** The point of the slide, in one or two sentences. */
  moral: string;
}

/* ------------------------------------------------------------------ *
 * The protocol
 * ------------------------------------------------------------------ */

export interface ProtocolDefinition {
  id: ProtocolId;
  /** Display name, e.g. `TCP`. */
  name: string;
  /** Expanded name, e.g. `Transmission Control Protocol`. */
  longName: string;
  /** One-line subtitle used on the orbit card. */
  subtitle: string;
  /** Layer / category label, e.g. `Transport Layer`. */
  layer: string;
  layerId: LayerId;
  /** `Connection-Oriented`, `Multi-Master`, ... */
  communication: string;
  /** `Reliable data delivery`, `Best-effort delivery`, ... */
  purpose: string;
  /** The card's single-sentence hook. */
  hook: string;
  /** Two-sentence intro for slide 01. */
  intro: string;
  accent: Accent;

  /** Slide 02 — the problem, and the mechanisms that answer it. */
  problem: {
    headline: string;
    detail: string;
    /** Bullet list of concrete failure modes. */
    failures: string[];
  };
  solution: {
    headline: string;
    concepts: Concept[];
  };

  /** Slide 03 — clickable mechanics. */
  mechanics: {
    headline: string;
    framing: string;
    /** The encapsulated stack this protocol sits in. */
    stack: { label: string; sub?: string; emphasis?: boolean }[];
    steps: Step[];
  };

  /** Slide 04 — the header/field diagram. */
  frame: FrameStructure;

  /** Slide 05. */
  realWorld: RealWorldExample;

  /** Slide 06. */
  comparison: Comparison;

  /** Slide 07. */
  recap: {
    headline: string;
    points: string[];
  };

  /** Jump-to-other-protocol suggestions on the recap slide. */
  related: ProtocolId[];
  /** Primary sources, so the claims are checkable. */
  references: { label: string; note: string }[];
}

/* ------------------------------------------------------------------ *
 * Foundations (the non-protocol glossary section)
 * ------------------------------------------------------------------ */

export interface FoundationTerm {
  term: string;
  /** One-line definition. */
  definition: string;
  /** Where it lives, e.g. `Network layer`. */
  scope: string;
  /** Longer explanation shown when expanded. */
  detail: string;
  /** Related protocol ids, for cross-linking. */
  related?: ProtocolId[];
  /** Which group it belongs to in the UI. */
  group: "address" | "unit" | "device" | "role";
}
