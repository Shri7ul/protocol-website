import { ACCENTS } from "../accents";
import type { ProtocolDefinition } from "../types";

export const udp: ProtocolDefinition = {
  id: "udp",
  name: "UDP",
  longName: "User Datagram Protocol",
  subtitle: "Minimal, message-preserving datagrams",
  layer: "Transport Layer",
  layerId: "transport",
  communication: "Connectionless",
  purpose: "Low-overhead, best-effort delivery",
  hook:
    "An 8-byte header and nothing else. No connection, no ordering, no recovery — and that is precisely the point.",
  intro:
    "UDP does one job: it takes a chunk of bytes from an application, adds four fields, and hands it to IP. It does not open a connection, does not number anything, does not wait for confirmation, and does not adjust its rate. What it does provide is the two things only a transport protocol can: ports, so multiple programs can share one machine, and a checksum, so corruption is usually caught. Everything else, the application decides for itself.",
  accent: ACCENTS.udp,

  problem: {
    headline: "Reliability has a cost, and not every application can pay it",
    detail:
      "TCP's guarantees are implemented with state, timers and feedback, and every one of them costs time. A retransmitted packet is by definition late — if the application has already moved on, that retransmission is worse than useless, because it consumes bandwidth that the current frame needs. Meanwhile TCP's ordering rule means one lost segment blocks every segment behind it, so a single drop can stall a video call for hundreds of milliseconds even though 99% of the frames arrived intact.",
    failures: [
      "A retransmit is a *late* packet, and late information is often worthless",
      "Head-of-line blocking: one loss stalls everything queued behind it",
      "A handshake costs a round trip before the first byte can be sent",
      "Per-connection state and timers add memory and latency overhead",
      "A 20-byte header is a real cost in small, high-frequency messages",
      "Some applications build better recovery than TCP can: they know what is urgent",
    ],
  },
  solution: {
    headline: "Do almost nothing, very efficiently",
    concepts: [
      {
        tag: "structure",
        title: "Message boundaries are preserved",
        glyph: "ordering",
        body:
          "UDP is datagram-oriented, not stream-oriented. One send produces exactly one datagram, which arrives whole or not at all. The application never has to invent its own framing to find where a message ends.",
      },
      {
        tag: "identity",
        title: "Ports still allow multiplexing",
        glyph: "multidrop",
        body:
          "Source and destination ports remain, so many programs can share one host's IP address and the receiving stack knows which socket to hand the datagram to. This is the part of transport-layer work UDP keeps.",
      },
      {
        tag: "detection",
        title: "An optional checksum catches corruption",
        glyph: "checksum",
        body:
          "A 16-bit checksum covers the header, payload and a pseudo-header of IP addresses. If it fails, the datagram is silently discarded — never repaired, never reported. A zero checksum in IPv4 means 'not computed'.",
      },
      {
        tag: "cost",
        title: "No handshake, no state",
        glyph: "stateless",
        body:
          "The first datagram can leave immediately, with no round trip of setup. A server can answer a one-datagram DNS query without keeping a connection open afterwards, which is what lets a single resolver handle enormous query volumes.",
      },
      {
        tag: "consequence",
        title: "Loss, duplication and reordering are visible",
        glyph: "loss",
        body:
          "Nothing repairs them, so the application sees them. For a real-time stream that is a feature: you would rather skip one frame than play it 300 ms late. For a file transfer it is fatal, which is why file transfer does not use raw UDP.",
      },
      {
        tag: "responsibility",
        title: "The application owns the policy",
        glyph: "flow",
        body:
          "No flow control and no congestion control are built in. A well-behaved application must add its own — otherwise it competes unfairly and can congest the network it depends on. This is the main reason hand-rolled UDP protocols go wrong.",
      },
    ],
  },

  mechanics: {
    headline: "How UDP sends a datagram",
    framing:
      "The entire protocol is four fields and a handoff to IP. Select a step to see where the work moved to — usually, to the application above it.",
    stack: [
      { label: "Application", sub: "DNS, RTP, QUIC, game netcode" },
      { label: "UDP", sub: "8-byte header, port demultiplexing", emphasis: true },
      { label: "IP", sub: "addressing and best-effort routing" },
      { label: "Network", sub: "Ethernet / Wi-Fi frames" },
      { label: "Server", sub: "the far end" },
    ],
    steps: [
      {
        id: "nosetup",
        title: "No connection establishment",
        summary: "There is no handshake at all. The first datagram is data.",
        body:
          "An application calls send with a destination address and port, and a datagram leaves. Compare this with TCP, where the first payload byte can only travel after a full round trip of SYN, SYN-ACK, ACK. For a DNS lookup that is the difference between one round trip and two.",
        facts: [
          { key: "Setup packets", value: "zero" },
          { key: "State kept", value: "none on the server, unless the application adds it" },
        ],
        sequence: {
          caption: "Nothing precedes the data",
          nodes: [{ label: "Client" }, { label: "Server" }],
          arrows: [
            {
              from: 0,
              to: 1,
              label: "query datagram",
              detail: "the very first packet",
              tone: "accent",
            },
            {
              from: 1,
              to: 0,
              label: "reply datagram",
              detail: "no ACK required",
              tone: "ok",
            },
          ],
        },
      },
      {
        id: "header",
        title: "Eight bytes of header",
        summary: "Two ports, a length and a checksum. That is the whole protocol.",
        body:
          "Four 16-bit fields. Two ports for demultiplexing, a length that includes the header itself, and a checksum. There is no sequence number, no acknowledgement field, no flags and no window — so there is nothing to mis-implement and almost nothing to compute per packet.",
        facts: [
          { key: "Header size", value: "8 bytes, fixed" },
          { key: "Versus TCP", value: "20–60 bytes, variable" },
        ],
      },
      {
        id: "send",
        title: "Hand off to IP immediately",
        summary: "One send, one datagram, straight to the network layer.",
        body:
          "UDP encapsulates the payload and passes the datagram to IP, which adds addressing and routing. Because each datagram is independent, there is no buffer to drain, no window to respect and no waiting for anything. This is what makes UDP's send path so short.",
        facts: [
          { key: "Datagram size", value: "bounded by the path MTU, commonly ~1472 bytes of payload" },
          { key: "Fragmentation", value: "possible, but risky — a lost fragment loses the whole datagram" },
        ],
      },
      {
        id: "receive",
        title: "Receive and demultiplex",
        summary: "The port picks the socket; the payload is handed over untouched.",
        body:
          "On arrival the stack verifies the checksum, reads the destination port, and gives the payload to the matching socket — whole, in one piece, with the message boundary intact. If the checksum fails, or the datagram never arrives, the application simply never hears about it.",
        facts: [
          { key: "On checksum failure", value: "discard silently" },
          { key: "Notification to app", value: "none — absence is the only signal" },
        ],
      },
      {
        id: "app",
        title: "The application adds what it needs",
        summary: "Sequencing, retransmission and pacing, if they are wanted.",
        body:
          "This is where UDP gets complicated in practice, and where the design decisions belong. Video calls add timestamps and discard anything older than the playout deadline. Games send only the newest state and let older updates be superseded. QUIC rebuilds TCP's reliability properly, in user space, per stream — so that a loss on one stream does not block another.",
        facts: [
          { key: "RTP", value: "sequence numbers + timestamps for media" },
          { key: "QUIC", value: "per-stream ordering, own congestion control" },
          { key: "DNS", value: "retry the whole query after a timeout" },
        ],
      },
    ],
  },

  frame: {
    unit: "Datagram",
    overhead: "8 bytes, always",
    note:
      "Fixed and minimal. The length field makes UDP self-describing, unlike TCP, because there is no other field that implies where the payload ends.",
    rows: [
      {
        label: "32 bits",
        fields: [
          {
            name: "Source Port",
            size: "16 bits",
            span: 1,
            role: "Identifies the sending socket.",
            detail:
              "Optional in the sense that it may be zero when no reply is expected — for example in a one-way logging or multicast stream. Otherwise it is the ephemeral port the reply should be addressed to.",
            example: "51324",
          },
          {
            name: "Destination Port",
            size: "16 bits",
            span: 1,
            role: "Identifies the receiving socket.",
            detail:
              "Well-known UDP services include 53 (DNS), 67/68 (DHCP), 123 (NTP), 443 (HTTP/3 over QUIC), and dynamic RTP ports negotiated out of band.",
            example: "53",
          },
        ],
      },
      {
        label: "32 bits",
        fields: [
          {
            name: "Length",
            size: "16 bits",
            span: 2,
            role: "Total datagram size in bytes, including the 8-byte header.",
            detail:
              "Minimum value is 8 — a perfectly legal, payload-free datagram. The maximum is 65 535, which is larger than most paths can carry without IP fragmentation; in practice senders stay under the path MTU.",
            example: "41",
          },
          {
            name: "Checksum",
            size: "16 bits",
            span: 2,
            tone: "warn",
            role: "Integrity check over the header, payload and an IP pseudo-header.",
            detail:
              "Mandatory in IPv6, optional in IPv4 where a value of zero means 'not computed'. It detects corruption only — it is not a signature, provides no replay protection, and says nothing about who sent the datagram. UDP payloads are therefore unprotected against spoofing, which is why amplification attacks abuse it.",
            example: "0xb91c",
          },
        ],
      },
      {
        label: "Variable",
        fields: [
          {
            name: "Data",
            size: "0 – 65 507 bytes",
            span: 4,
            role: "The application's message, handed over intact.",
            detail:
              "Delivered as one unit, never split or merged by UDP, and never joined with the next datagram. If the application needs a record boundary to mean something, UDP preserves it; TCP does not.",
            example: "DNS query: example.com A?",
          },
        ],
      },
    ],
  },

  realWorld: {
    title: "A DNS lookup — one round trip, no connection",
    scenario:
      "Your browser needs to turn a name into an address before it can connect to anything. That lookup is a single UDP exchange: one datagram out, one datagram back.",
    hops: [
      {
        label: "Application",
        sub: "the browser's resolver stub",
        facts: [
          { key: "Question", value: "example.com A?" },
          { key: "Encoded size", value: "~30 bytes" },
        ],
      },
      {
        label: "UDP",
        sub: "no handshake, no state",
        facts: [
          { key: "Source port", value: "51324 (ephemeral)" },
          { key: "Destination port", value: "53" },
        ],
      },
      {
        label: "IP",
        sub: "one datagram, best effort",
        facts: [
          { key: "Destination", value: "the configured recursive resolver" },
          { key: "If it is lost", value: "nothing tells you — retransmit or fall back to TCP" },
        ],
      },
      {
        label: "Resolver",
        sub: "answers from cache or upstream",
        facts: [
          { key: "Answer", value: "example.com → 93.184.216.34" },
          { key: "TTL", value: "86 400 s — how long it may be cached" },
        ],
      },
      {
        label: "Back to the browser",
        sub: "one datagram, message boundary intact",
        facts: [
          { key: "Cost", value: "1 RTT total, vs 2 for DNS over TCP" },
          { key: "Trade-off", value: "the reply must fit in one datagram, or DNS retries over TCP" },
        ],
      },
    ],
    moral:
      "UDP's value here is not speed for its own sake — it is the removal of a round trip and of any server-side state. A resolver answering millions of queries per second cannot afford to keep a connection open for each one. The cost is real too: a large reply, or a truncated one, forces a fallback to TCP, and a lost query means the client waits for a timeout it cannot distinguish from a slow server.",
  },

  comparison: {
    title: "UDP vs TCP",
    framing:
      "The same table as TCP's, read from the other side. Notice that every 'none' in the UDP column is somewhere an application, or a protocol like QUIC, has to take responsibility instead.",
    columns: [
      { label: "UDP", accentToken: "--color-udp", accentHex: "#a97bf0", emphasis: true },
      { label: "TCP", accentToken: "--color-tcp", accentHex: "#4f93f5" },
    ],
    rows: [
      {
        dimension: "Connection",
        cells: ["None — datagrams are independent", "Explicit handshake before data"],
      },
      {
        dimension: "Reliability",
        cells: ["Not tracked; loss is silent", "Acknowledged and retransmitted"],
      },
      {
        dimension: "Ordering",
        cells: ["Arrival order, not send order", "Restored from sequence numbers"],
      },
      {
        dimension: "Message boundaries",
        cells: ["Preserved — one send, one datagram", "Dissolved into a byte stream"],
      },
      {
        dimension: "Acknowledgements",
        cells: ["No native mechanism", "Cumulative, with optional SACK"],
      },
      {
        dimension: "Retransmission",
        cells: ["None — the application decides", "Timer-based and fast retransmit"],
      },
      {
        dimension: "Flow control",
        cells: ["None", "Receiver advertises a window"],
      },
      {
        dimension: "Congestion control",
        cells: ["None — the application must add its own", "Sender-side AIMD"],
      },
      {
        dimension: "Head-of-line blocking",
        cells: ["None — one loss affects only itself", "Yes, within a connection"],
      },
      {
        dimension: "Latency",
        cells: ["No setup; first datagram leaves at once", "1 RTT setup plus recovery delays"],
      },
      {
        dimension: "Header",
        cells: ["8 bytes, fixed", "20–60 bytes, variable"],
      },
      {
        dimension: "Typical use",
        cells: [
          "DNS, DHCP, NTP, RTP, live games, telemetry, multicast",
          "Web, file transfer, email, SSH",
        ],
      },
      {
        dimension: "When it is the wrong choice",
        cells: [
          "Bulk transfer, or anything where a missing byte breaks the result",
          "Real-time media, where a late packet has already been superseded",
        ],
      },
      {
        dimension: "Built on it",
        cells: ["QUIC — the transport behind HTTP/3", "HTTP/1.1 and HTTP/2"],
      },
    ],
  },

  recap: {
    headline: "UDP in 20 seconds",
    points: [
      "Transport layer, connectionless: an 8-byte header with two ports, a length and a checksum.",
      "Message boundaries are preserved — one send is exactly one datagram, delivered whole or not at all.",
      "No handshake means no round trip before data, and no per-connection state on the server.",
      "No ordering, retransmission, flow control or congestion control. Loss is silent, not reported.",
      "Its speed is really the absence of waiting; the trade is that the application inherits the problems.",
      "Ideal when late data is useless: DNS, DHCP, NTP, voice and video (RTP), live games, telemetry.",
      "QUIC rebuilds reliability and congestion control above UDP — in user space, so it can evolve without changing the operating system.",
    ],
  },

  related: ["tcp", "https", "http"],

  references: [
    {
      label: "RFC 768 — User Datagram Protocol",
      note: "Three pages. The entire base specification.",
    },
    {
      label: "RFC 9000 — QUIC: A UDP-Based Multiplexed and Secure Transport",
      note: "How reliability and congestion control are rebuilt above UDP.",
    },
    {
      label: "RFC 8085 — UDP Usage Guidelines",
      note: "When UDP is appropriate, and the congestion-responsibility rules for using it.",
    },
    {
      label: "RFC 3550 — RTP: A Transport Protocol for Real-Time Applications",
      note: "The timestamping and sequencing layer that real-time media adds on top of UDP.",
    },
  ],
};
