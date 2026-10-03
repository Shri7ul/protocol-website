"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * ComparisonMatrix — all six protocols across twelve dimensions.
 *
 * The table is wide by nature, so on anything below a large desktop it becomes
 * a horizontally scrollable grid with the dimension column pinned. Rows are
 * interactive: selecting one highlights it and shows the framing sentence that
 * explains why *that* dimension matters.
 */

interface Column {
  id: string;
  label: string;
  hex: string;
  layer: string;
}

interface Row {
  dimension: string;
  /** Why this row is worth looking at. */
  why: string;
  cells: string[];
  /** The cell that most repays attention, as a column index. */
  highlight?: number;
}

const COLUMNS: Column[] = [
  { id: "tcp", label: "TCP", hex: "#4f93f5", layer: "Transport" },
  { id: "udp", label: "UDP", hex: "#a97bf0", layer: "Transport" },
  { id: "http", label: "HTTP", hex: "#e9a13f", layer: "Application" },
  { id: "https", label: "HTTPS", hex: "#4cc98a", layer: "Application" },
  { id: "i2c", label: "I²C", hex: "#4fc4dd", layer: "Embedded" },
  { id: "can", label: "CAN", hex: "#e8674a", layer: "Embedded" },
];

const ROWS: Row[] = [
  {
    dimension: "Layer",
    why: "Four of these sit in the TCP/IP stack; two do not. The column positions tell you which world you are in.",
    cells: [
      "Transport",
      "Transport",
      "Application",
      "Application + TLS",
      "Embedded bus",
      "Embedded bus",
    ],
  },
  {
    dimension: "Connection",
    why: "Whether state must be established before data can flow. This single choice cascades into almost everything below it.",
    cells: [
      "Connection-oriented, 3-way handshake",
      "Connectionless",
      "Per-request over a transport connection",
      "Per-request over TLS over transport",
      "Controller owns the bus; no negotiation",
      "Frames are independent; no session",
    ],
  },
  {
    dimension: "Reliability",
    why: "What happens when a unit of data is lost. Note that CAN is reliable in a completely different sense — it prevents corruption reaching the application rather than repairing loss.",
    cells: [
      "Acknowledged, retransmitted until delivered",
      "None — loss is silent",
      "Inherits the transport's reliability",
      "Inherits; plus integrity via AEAD",
      "ACK per byte; a missing ACK aborts the transfer",
      "CRC + collective ACK; a corrupt frame is discarded and retransmitted automatically",
    ],
    highlight: 5,
  },
  {
    dimension: "Ordering",
    why: "Whether the receiver is guaranteed to see data in the order it was sent — and what it costs when that guarantee is broken.",
    cells: [
      "Guaranteed by sequence numbers; one loss stalls the stream",
      "None — arrival order",
      "Ordered, because the transport is",
      "Ordered, because the transport is",
      "Inherent — a single shared clock",
      "Arbitration orders transmission, not delivery to an application",
    ],
  },
  {
    dimension: "Addressing",
    why: "How the protocol decides who the data is for. This is where the two worlds diverge most sharply.",
    cells: [
      "4-tuple: src/dst IP + src/dst port",
      "Port pair only — the rest is in the IP header",
      "A URL: scheme, host, path, query",
      "The same URL, plus a certificate binding a name to a key",
      "7-bit device address, per transaction",
      "Message identifier — broadcast, and no destination address at all",
    ],
    highlight: 5,
  },
  {
    dimension: "Data unit",
    why: "The name matters because it tells you who owns framing and who owns reassembly.",
    cells: [
      "Segment",
      "Datagram",
      "Message (request / response)",
      "TLS record containing an HTTP message",
      "Transaction",
      "Frame",
    ],
  },
  {
    dimension: "Typical payload",
    why: "A rough sense of the sizes involved. CAN's 8 bytes next to a TCP segment's 1460 is the clearest illustration of how different the constraints are.",
    cells: [
      "up to 1460 bytes (MSS) per segment",
      "up to ~1472 bytes without fragmentation",
      "Kilobytes to megabytes, across many segments",
      "Same, plus 5–21 bytes of TLS overhead per record",
      "1–n bytes of register data",
      "0–8 bytes classical; up to 64 in CAN FD",
    ],
    highlight: 5,
  },
  {
    dimension: "Handshake",
    why: "What must happen before useful data can be sent. This is the cost you pay per connection, per request, or per frame.",
    cells: [
      "SYN → SYN-ACK → ACK, 1 RTT",
      "None",
      "None of its own; depends on the transport",
      "TLS 1.3 handshake: 1 RTT, or 0 on resumption",
      "START condition plus an address byte",
      "SOF, then bitwise arbitration",
    ],
  },
  {
    dimension: "Error detection",
    why: "Every protocol here detects errors; the difference is in how much they detect, and whether detection is done in hardware.",
    cells: [
      "16-bit one's-complement checksum",
      "16-bit checksum, optional in IPv4, mandatory in IPv6",
      "None beyond the transport and TLS",
      "AEAD authentication tag per record — detects tampering, not just corruption",
      "Per-byte ACK/NACK only",
      "15-bit CRC, bit monitoring, bit stuffing, form check, ACK — all in hardware",
    ],
    highlight: 5,
  },
  {
    dimension: "Typical usage",
    why: "The clearest signal of intent. If your problem looks like one of these, the choice is usually already made for you.",
    cells: [
      "Web, file transfer, email, SSH — anything where every byte matters",
      "DNS, DHCP, NTP, voice and video, live games, telemetry",
      "Documents, REST APIs, streaming manifests, anything resource-shaped",
      "Everything the public web does today",
      "Sensors, EEPROMs, real-time clocks, small displays — many slow devices",
      "Automotive, robotics, industrial machinery — many controllers over distance",
    ],
  },
  {
    dimension: "Topology",
    why: "The physical shape of the connection, which constrains what the protocol can promise.",
    cells: [
      "Point to point, many connections per host",
      "Point to point, or one-to-many with multicast",
      "Client to server, often via intermediaries",
      "Same, with the tunnel transparent to HTTP",
      "Multi-drop: two wires, up to 112 addressed targets",
      "Linear broadcast bus, terminated at both ends",
    ],
    highlight: 4,
  },
  {
    dimension: "Physical signalling",
    why: "What actually happens on the copper. Note how the embedded buses take responsibility for the electrical layer, while the networking protocols delegate it entirely.",
    cells: [
      "Delegated to IP and below",
      "Delegated to IP and below",
      "Delegated to the transport",
      "TLS sits above the transport; the link layer is unchanged",
      "Single-ended, open-drain, pull-up resistors",
      "Differential on CAN_H / CAN_L, 120 Ω terminated",
    ],
    highlight: 5,
  },
];

export function ComparisonMatrix() {
  const [activeRow, setActiveRow] = useState<number | null>(1);
  const reduce = useReducedMotion();

  return (
    <div>
      {/* ------------------------- the table ------------------------- */}
      <div className="atlas-scroll -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
          <caption className="sr-only">
            Comparison of TCP, UDP, HTTP, HTTPS, I²C and CAN across twelve
            dimensions.
          </caption>

          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-void pb-3 pr-4 text-left"
                style={{ minWidth: 132 }}
              >
                <span className="atlas-label">Dimension</span>
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="pb-3 pl-2 pr-3 align-bottom"
                  style={{ minWidth: 148 }}
                >
                  <span className="flex flex-col gap-1.5">
                    <span
                      className="font-mono text-[13px] font-medium tracking-wide"
                      style={{ color: col.hex }}
                    >
                      {col.label}
                    </span>
                    <span className="atlas-label">{col.layer}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ROWS.map((row, r) => {
              const isActive = activeRow === r;
              return (
                <tr
                  key={row.dimension}
                  onMouseEnter={() => setActiveRow(r)}
                  onFocus={() => setActiveRow(r)}
                  className="group/row"
                >
                  {/* Dimension label — pinned so it survives horizontal scroll,
                      and a real button so the row is keyboard-reachable. */}
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-void py-0 pr-4 text-left align-top"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveRow(isActive ? null : r)}
                      aria-expanded={isActive}
                      className={cn(
                        "w-full border-t border-line py-3 text-left transition-colors",
                        isActive ? "text-ink" : "text-ink-soft hover:text-ink",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-1 w-1 shrink-0 rounded-full transition-colors"
                          style={{
                            backgroundColor: isActive
                              ? "var(--color-ink)"
                              : "var(--color-line-strong)",
                          }}
                        />
                        <span className="text-[12.5px] font-medium leading-snug">
                          {row.dimension}
                        </span>
                      </span>
                    </button>
                  </th>

                  {row.cells.map((cell, c) => {
                    const col = COLUMNS[c]!;
                    const emphasised = row.highlight === c;
                    return (
                      <td
                        key={col.id}
                        className="border-t border-line py-3 pl-2 pr-3 align-top"
                        style={{
                          backgroundColor: isActive ? `${col.hex}07` : "transparent",
                          transition: "background-color 220ms",
                        }}
                      >
                        <span
                          className={cn(
                            "block text-[12px] leading-relaxed",
                            isActive ? "text-ink-soft" : "text-ink-mute",
                          )}
                        >
                          {emphasised ? (
                            <span
                              className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                              style={{ backgroundColor: col.hex }}
                              aria-hidden="true"
                            />
                          ) : null}
                          {cell}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ------------------- the row explanation ------------------- */}
      <div className="mt-5 min-h-[68px]">
        {activeRow !== null ? (
          <motion.div
            key={activeRow}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-wrap items-start gap-x-5 gap-y-2 rounded-lg border border-line bg-surface/50 px-4 py-3.5"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
              {ROWS[activeRow]?.dimension}
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-soft">
              {ROWS[activeRow]?.why}
            </p>
          </motion.div>
        ) : (
          <p className="atlas-label py-4">
            Select a row to see why that dimension matters
          </p>
        )}
      </div>
    </div>
  );
}
