import { ACCENTS } from "../accents";
import type { ProtocolDefinition } from "../types";

export const tcp: ProtocolDefinition = {
  id: "tcp",
  name: "TCP",
  longName: "Transmission Control Protocol",
  subtitle: "Reliable, ordered byte stream",
  layer: "Transport Layer",
  layerId: "transport",
  communication: "Connection-Oriented",
  purpose: "Reliable data delivery",
  hook:
    "Turns an unreliable packet network into a byte stream that arrives complete, in order, exactly once.",
  intro:
    "TCP sits directly above IP and below your application. IP will deliver datagrams on a best-effort basis — some may vanish, some may arrive twice, some may arrive out of order. TCP is the layer that hides all of that. It presents the application with a single, continuous, ordered stream of bytes, and it does the retransmitting, reordering and rate-limiting needed to keep that promise.",
  accent: ACCENTS.tcp,

  problem: {
    headline: "An IP network makes no promises",
    detail:
      "Each IP datagram is routed independently. Routers may drop it when a queue fills, the network may duplicate it, and two datagrams sent a millisecond apart can take different paths and arrive in the opposite order. On top of that, any single link can only carry so much — a fast sender will overrun a slow receiver or a congested router unless something in the middle pushes back. An application that just wants to send a file has to solve all of this itself.",
    failures: [
      "A datagram can be dropped when a router queue overflows",
      "Two copies of the same datagram can arrive (duplication)",
      "Datagrams can arrive out of order, because each is routed independently",
      "A bit can flip in transit, and the payload arrives corrupted",
      "A fast sender can overrun a slow receiver's buffer",
      "A sender can push data into an already-congested network",
    ],
  },
  solution: {
    headline: "Six mechanisms, one byte stream",
    concepts: [
      {
        tag: "addressing",
        title: "Ports identify the process",
        glyph: "multidrop",
        body:
          "IP gets a packet to the right machine; a port gets it to the right program on that machine. A TCP connection is uniquely named by the 4-tuple (source IP, source port, destination IP, destination port), which is why one server can hold thousands of simultaneous connections on a single port.",
      },
      {
        tag: "guarantee",
        title: "Sequence numbers give order",
        glyph: "ordering",
        body:
          "Every byte is numbered. The receiver uses those numbers to place data back into the original order and to detect anything missing — even if datagrams arrive jumbled, or arrive twice.",
      },
      {
        tag: "guarantee",
        title: "Acknowledgements close the loop",
        glyph: "ack",
        body:
          "The receiver reports the next byte it expects. The ACK number is cumulative, so one ACK can confirm several segments at once and the sender knows exactly what has landed.",
      },
      {
        tag: "recovery",
        title: "Retransmission repairs loss",
        glyph: "retransmit",
        body:
          "If a segment is not acknowledged before the retransmission timer expires, it is sent again. Three duplicate ACKs trigger a faster resend without waiting for the timer at all.",
      },
      {
        tag: "protection",
        title: "Flow control protects the receiver",
        glyph: "flow",
        body:
          "The receive window advertises how much buffer space is free. A sender that fills it must stop. This prevents a fast sender from overwhelming a slow or busy application.",
      },
      {
        tag: "protection",
        title: "Congestion control protects the network",
        glyph: "congestion",
        body:
          "A separate, sender-side estimate of how much the *network* can take. TCP starts slow, grows exponentially, and cuts back sharply on loss — the algorithm behind the famous sawtooth.",
      },
      {
        tag: "detection",
        title: "A checksum catches corruption",
        glyph: "checksum",
        body:
          "A 16-bit one's-complement checksum covers the header, the payload, and a pseudo-header containing the IP addresses. A corrupted segment is discarded and simply never acknowledged, so it gets retransmitted.",
      },
      {
        tag: "setup",
        title: "A handshake agrees the parameters",
        glyph: "handshake",
        body:
          "Before any data flows, both sides agree on starting sequence numbers, confirm they are both present, and negotiate options such as window scaling and selective acknowledgements.",
      },
    ],
  },

  mechanics: {
    headline: "How TCP delivers data",
    framing:
      "Follow one upload. Each step below is a real phase of the protocol — select one to see what it does and why it is needed.",
    stack: [
      { label: "Application", sub: "your HTTP client" },
      { label: "TCP", sub: "segments, ports, reliability", emphasis: true },
      { label: "IP", sub: "datagrams, addresses, routing" },
      { label: "Network", sub: "Ethernet / Wi-Fi frames" },
      { label: "Server", sub: "the far end" },
    ],
    steps: [
      {
        id: "establish",
        title: "Connection establishment",
        summary: "A three-way handshake — SYN, SYN-ACK, ACK.",
        body:
          "The client picks a random initial sequence number (ISN) and sends a SYN. The server replies with its own SYN plus an ACK for the client's ISN. The client confirms with a final ACK. Only now is the connection open. The randomness matters: it makes it hard for an off-path attacker to guess sequence numbers and inject data.",
        facts: [
          { key: "Client ISN", value: "typically random, e.g. 1043" },
          { key: "Server ISN", value: "independently random, e.g. 7641" },
          { key: "Round trips", value: "1 RTT before the first byte of data" },
        ],
        sequence: {
          caption: "The three-way handshake",
          nodes: [{ label: "Client" }, { label: "Server" }],
          arrows: [
            { from: 0, to: 1, label: "SYN", detail: "seq = 1043", tone: "accent" },
            {
              from: 1,
              to: 0,
              label: "SYN-ACK",
              detail: "seq = 7641, ack = 1044",
              tone: "accent",
            },
            {
              from: 0,
              to: 1,
              label: "ACK",
              detail: "ack = 7642",
              tone: "accent",
            },
          ],
        },
      },
      {
        id: "segment",
        title: "Data segmentation",
        summary: "The byte stream is cut into segments that fit the path.",
        body:
          "TCP has no idea what your data means. It slices the stream into segments and gives each one a header. The maximum segment size (MSS) is derived from the path MTU so that each segment fits inside one IP datagram without fragmentation — typically 1460 bytes over Ethernet.",
        facts: [
          { key: "Typical MSS", value: "1460 bytes (1500 MTU − 20 IP − 20 TCP)" },
          { key: "Sub-MSS advice", value: "send less than MSS to leave room for options" },
        ],
      },
      {
        id: "sequence",
        title: "Sequence numbers",
        summary: "Every byte is numbered, not every segment.",
        body:
          "The sequence number in a segment is the number of the *first byte* it carries. If a segment carries 1460 bytes starting at 1043, the next segment starts at 2503. The receiver can therefore reassemble a shuffled stream and spot a gap precisely — it is not segment counting, it is byte counting.",
        facts: [
          { key: "Byte range", value: "32-bit, wraps at ~4 GB" },
          { key: "Why wrap is fine", value: "window scaling keeps the live window far smaller" },
        ],
      },
      {
        id: "ack",
        title: "Acknowledgement",
        summary: "The receiver reports the next byte it expects.",
        body:
          "The ACK number is cumulative: it means 'I have everything up to this byte, send me the next one.' A single ACK can therefore confirm several segments at once. When a packet disappears mid-stream, the receiver keeps repeating the same ACK — that repetition is how the sender learns about the gap.",
        sequence: {
          caption: "Cumulative acknowledgement",
          nodes: [{ label: "Sender" }, { label: "Receiver" }],
          arrows: [
            { from: 0, to: 1, label: "seq = 1, 1460 bytes", tone: "accent" },
            { from: 1, to: 0, label: "ACK 1461", detail: "next expected", tone: "ok" },
            { from: 0, to: 1, label: "seq = 1461, 1460 bytes", tone: "accent" },
            {
              from: 1,
              to: 0,
              label: "ACK 2921",
              detail: "one ACK, two segments",
              tone: "ok",
            },
          ],
        },
      },
      {
        id: "retransmit",
        title: "Retransmission",
        summary: "Missing data is resent — on a timer, or on duplicate ACKs.",
        body:
          "Every segment is covered by a retransmission timer (RTO). If no ACK arrives in time, it is resent. TCP also runs fast retransmit: three duplicate ACKs for the same number are strong evidence that exactly one segment was lost, so it is resent immediately rather than waiting out the timer. Selective acknowledgements let the receiver list the exact ranges it holds, avoiding pointless resends of data that already arrived.",
        facts: [
          { key: "RTO", value: "estimated from RTT, with jitter allowance" },
          { key: "Fast retransmit", value: "3 duplicate ACKs → resend without waiting" },
        ],
        sequence: {
          caption: "Fast retransmit",
          nodes: [{ label: "Sender" }, { label: "Receiver" }],
          arrows: [
            { from: 0, to: 1, label: "seq = 1", tone: "accent" },
            { from: 0, to: 1, label: "seq = 1461", tone: "danger", dashed: true },
            { from: 0, to: 1, label: "seq = 2921", tone: "accent" },
            { from: 1, to: 0, label: "ACK 1461", detail: "gap detected", tone: "warn" },
            { from: 1, to: 0, label: "ACK 1461", detail: "duplicate 1", tone: "warn" },
            { from: 1, to: 0, label: "ACK 1461", detail: "duplicate 2", tone: "warn" },
            { from: 1, to: 0, label: "ACK 1461", detail: "duplicate 3 → resend", tone: "warn" },
            { from: 0, to: 1, label: "seq = 1461", detail: "retransmitted", tone: "ok" },
          ],
        },
      },
      {
        id: "flow",
        title: "Flow and congestion control",
        summary: "Two independent brakes: the receiver's buffer, and the network.",
        body:
          "Flow control is receiver-driven: the advertised window says how many more bytes the receiver can accept right now, and it can shrink to zero. Congestion control is sender-driven and conservative: the congestion window (cwnd) starts small, grows exponentially during slow start until a threshold, then grows linearly, and halves on detected loss. The amount actually in flight is the minimum of the two windows, so TCP is always limited by whichever bottleneck is tighter.",
        facts: [
          { key: "In flight ≤", value: "min(receive window, congestion window)" },
          { key: "Slow start", value: "cwnd doubles every RTT" },
          { key: "Congestion avoidance", value: "+1 MSS per RTT (AIMD)" },
          { key: "On loss", value: "multiplicative decrease, then probe upward" },
        ],
        sequence: {
          caption: "The congestion window sawtooth",
          nodes: [{ label: "Sender" }, { label: "Network" }],
          arrows: [
            { from: 0, to: 1, label: "cwnd grows", detail: "exponential", tone: "accent" },
            { from: 0, to: 1, label: "cwnd grows", detail: "linear", tone: "accent" },
            { from: 1, to: 0, label: "packet loss", detail: "queue overflow", tone: "danger" },
            { from: 0, to: 1, label: "cwnd halved", tone: "warn" },
            { from: 0, to: 1, label: "cwnd grows again", detail: "probe for headroom", tone: "accent" },
          ],
        },
      },
      {
        id: "terminate",
        title: "Connection termination",
        summary: "A four-way teardown so both sides finish cleanly.",
        body:
          "Each direction closes independently, because one side may still have data to send after the other has finished. FIN, ACK, FIN, ACK. The side that sends the first FIN then waits through TIME_WAIT (twice the maximum segment lifetime) so that any stray duplicate segments expire and a delayed final ACK still finds something to acknowledge.",
        facts: [
          { key: "TIME_WAIT", value: "2 × MSL, commonly 60 s" },
          { key: "Abrupt close", value: "RST — sent on error or refusal" },
        ],
        sequence: {
          caption: "Four-way teardown",
          nodes: [{ label: "Client" }, { label: "Server" }],
          arrows: [
            { from: 0, to: 1, label: "FIN", tone: "accent" },
            { from: 1, to: 0, label: "ACK", tone: "ok" },
            { from: 1, to: 0, label: "FIN", tone: "accent" },
            { from: 0, to: 1, label: "ACK", detail: "client enters TIME_WAIT", tone: "ok" },
          ],
        },
      },
    ],
  },

  frame: {
    unit: "Segment",
    overhead: "20 bytes minimum, 60 bytes with maximum options",
    note:
      "A TCP segment is carried inside one IP datagram. There is no length field — the payload size is whatever the IP header says is left over.",
    rows: [
      {
        label: "32 bits",
        fields: [
          {
            name: "Source Port",
            size: "16 bits",
            span: 1,
            role: "Identifies the sending application.",
            detail:
              "Often ephemeral — chosen by the OS from a high-numbered range for the duration of the connection. Together with the destination port and both IP addresses it forms the connection's 4-tuple.",
            example: "52104",
          },
          {
            name: "Destination Port",
            size: "16 bits",
            span: 1,
            role: "Identifies the receiving application.",
            detail:
              "Well-known low ports are assigned conventions: 80 for HTTP, 443 for HTTPS, 22 for SSH, 25 for SMTP. The port alone does not specify the service — the client and server must agree.",
            example: "443",
          },
        ],
      },
      {
        label: "32 bits",
        fields: [
          {
            name: "Sequence Number",
            size: "32 bits",
            span: 3,
            role: "Byte number of the first payload byte in this segment.",
            detail:
              "Increments by the payload length, not by one per segment. Randomised at connection start to make sequence numbers hard to guess. Wraps around after 4 GB, which is safe because the live window is always far smaller.",
            example: "1 043 217",
          },
        ],
      },
      {
        label: "32 bits",
        fields: [
          {
            name: "Acknowledgment Number",
            size: "32 bits",
            span: 3,
            role: "The next byte the sender of this segment expects to receive.",
            detail:
              "Cumulative — everything below this number has been received. Only meaningful when the ACK flag is set. This is what makes single-packet loss recoverable without resending the whole stream.",
            example: "1 045 894",
          },
        ],
      },
      {
        label: "32 bits",
        fields: [
          {
            name: "Data Offset",
            size: "4 bits",
            span: 1,
            role: "Header length in 32-bit words.",
            detail:
              "Minimum 5 (a 20-byte header with no options). Tells the receiver where the header ends and the payload begins.",
            example: "5",
          },
          {
            name: "Reserved",
            size: "3 bits",
            span: 1,
            tone: "neutral",
            role: "Unused; must be zero.",
            detail: "Reserved for future use, and for the experimental flags some middleboxes abuse.",
          },
          {
            name: "Flags",
            size: "9 bits",
            span: 2,
            role: "Control bits: NS, CWR, ECE, URG, ACK, PSH, RST, SYN, FIN.",
            detail:
              "SYN opens a connection, FIN closes one direction, RST aborts, PSH asks the receiver to hand data up immediately, ACK marks the acknowledgment field as valid. CWR and ECE carry explicit congestion notification, and NS handles ECN nonce concealment.",
            example: "PSH, ACK",
          },
          {
            name: "Window Size",
            size: "16 bits",
            span: 2,
            role: "Flow control: bytes the receiver will accept beyond the ACK number.",
            detail:
              "The 16-bit field caps the raw window at 65 535 bytes, far too small for modern links. The window scale option (a shift count of 0–14) multiplies it, allowing windows into the gigabyte range.",
            example: "65 280",
          },
        ],
      },
      {
        label: "32 bits",
        fields: [
          {
            name: "Checksum",
            size: "16 bits",
            span: 2,
            role: "Integrity check over the header, payload and a pseudo-header.",
            detail:
              "The pseudo-header contains the source and destination IP addresses, the protocol number and the TCP length. Including it means a misdelivered segment is detectable, because the addresses no longer match.",
            example: "0x1a4f",
          },
          {
            name: "Urgent Pointer",
            size: "16 bits",
            span: 2,
            tone: "neutral",
            role: "Offset to urgent data; only meaningful with the URG flag.",
            detail:
              "Rarely used, and interpreted inconsistently in practice. Almost always zero on the modern web.",
            example: "0",
          },
        ],
      },
      {
        label: "Variable",
        fields: [
          {
            name: "Options & Padding",
            size: "0–40 bytes",
            span: 4,
            tone: "neutral",
            role: "Extensions negotiated during the handshake.",
            detail:
              "MSS, window scale, selective ACK permitted, SACK ranges, timestamps (used for round-trip estimation and to guard against wrapped sequence numbers), and TCP fast open. Padded to a multiple of four bytes so the payload starts word-aligned.",
            example: "MSS=1460, WScale=7, SACK_PERM",
          },
        ],
      },
      {
        label: "Variable",
        fields: [
          {
            name: "Data",
            size: "up to MSS",
            span: 4,
            role: "The application's bytes — for HTTP, the request or response text.",
            detail:
              "Length is implied: total IP length minus the IP header minus the TCP data offset. Not terminated by any delimiter, which is another reason TCP is described as a stream rather than a message service.",
            example: "GET / HTTP/1.1\\r\\n…",
          },
        ],
      },
    ],
  },

  realWorld: {
    title: "Loading a web page over TCP",
    scenario:
      "You type a URL into a browser. Before a single byte of HTML can arrive, TCP has to establish a connection to the server — and that handshake is a round trip that you pay for before the request even leaves.",
    hops: [
      {
        label: "Browser",
        sub: "your machine, an ephemeral port",
        facts: [
          { key: "Source IP", value: "192.168.1.24" },
          { key: "Source port", value: "52104 (ephemeral)" },
        ],
      },
      {
        label: "TCP handshake",
        sub: "three packets, one round trip",
        facts: [
          { key: "Packets", value: "SYN → SYN-ACK → ACK" },
          { key: "Cost", value: "1 RTT before the first request byte" },
        ],
      },
      {
        label: "IP",
        sub: "addressing and routing",
        facts: [
          { key: "Destination IP", value: "142.250.190.78" },
          { key: "TTL", value: "decremented by every router" },
        ],
      },
      {
        label: "Internet",
        sub: "many independent networks",
        facts: [
          { key: "Routing protocol", value: "BGP between autonomous systems" },
          { key: "Behaviour", value: "best effort — no guarantee of delivery" },
        ],
      },
      {
        label: "Web server",
        sub: "listening on a well-known port",
        facts: [
          { key: "Destination port", value: "443" },
          { key: "Protocol", value: "TCP" },
          { key: "Accepts", value: "thousands of connections on one port" },
        ],
      },
    ],
    moral:
      "The IP address reaches the machine, the port reaches the program, and the protocol number tells the receiving stack how to interpret the bytes. A connection is identified by the pair of address-and-port tuples at both ends — which is why one server on port 443 can serve every user on the internet at the same time.",
  },

  comparison: {
    title: "TCP vs UDP",
    framing:
      "These two are siblings, not rivals. They sit at the same layer and make opposite trade-offs: TCP spends latency and state to buy reliability, UDP spends nothing and promises nothing. Neither is better — the question is what the application can tolerate.",
    columns: [
      { label: "TCP", accentToken: "--color-tcp", accentHex: "#4f93f5", emphasis: true },
      { label: "UDP", accentToken: "--color-udp", accentHex: "#a97bf0" },
    ],
    rows: [
      {
        dimension: "Connection",
        cells: ["Explicit handshake before data", "None — send immediately"],
      },
      {
        dimension: "Reliability",
        cells: [
          "Acknowledged and retransmitted until delivered",
          "Not tracked; lost datagrams stay lost",
        ],
      },
      {
        dimension: "Ordering",
        cells: [
          "Reassembled in sequence numbers before delivery",
          "Each datagram delivered in arrival order",
        ],
      },
      {
        dimension: "Acknowledgements",
        cells: ["Yes, cumulative with optional SACK", "No native ACK mechanism"],
      },
      {
        dimension: "Retransmission",
        cells: ["Timer-based and fast retransmit", "None — up to the application"],
      },
      {
        dimension: "Flow control",
        cells: ["Receiver advertises a window", "None"],
      },
      {
        dimension: "Congestion control",
        cells: ["Yes, sender-side AIMD", "None — a sender may add congestion"],
      },
      {
        dimension: "Head-of-line blocking",
        cells: [
          "One lost segment stalls the stream, by design",
          "A lost datagram affects only itself",
        ],
      },
      {
        dimension: "Latency",
        cells: [
          "1 RTT setup, plus retransmit delays",
          "No setup; the first datagram can leave at once",
        ],
      },
      {
        dimension: "Header",
        cells: ["20–60 bytes", "8 bytes"],
      },
      {
        dimension: "Data unit",
        cells: ["Byte stream", "Message boundary preserved"],
      },
      {
        dimension: "Typical use",
        cells: [
          "File transfer, web, email, SSH — anything where every byte matters",
          "DNS, voice and video, live games, telemetry — anything where late data is useless",
        ],
      },
      {
        dimension: "Also used by",
        cells: [
          "HTTP/1.1 and HTTP/2",
          "QUIC, which is HTTP/3's transport",
        ],
      },
    ],
  },

  recap: {
    headline: "TCP in 20 seconds",
    points: [
      "Lives at the transport layer, directly above IP, and gives applications a reliable ordered byte stream.",
      "A connection is a 4-tuple: source IP, source port, destination IP, destination port.",
      "Opens with a three-way handshake — SYN, SYN-ACK, ACK — costing one round trip.",
      "Every byte is numbered; the receiver acknowledges the next byte it expects, cumulatively.",
      "Lost data is recovered by timer-based or fast retransmission, and always in order.",
      "Two brakes: the receive window protects the receiver, the congestion window protects the network.",
      "One lost segment stalls the stream for everything behind it — head-of-line blocking. That cost is exactly what QUIC, and UDP, avoid.",
    ],
  },

  related: ["udp", "http", "https"],

  references: [
    {
      label: "RFC 9293 — Transmission Control Protocol (TCP)",
      note: "The current base specification; obsoletes RFC 793.",
    },
    {
      label: "RFC 5681 — TCP Congestion Control",
      note: "Slow start, congestion avoidance, fast retransmit and fast recovery.",
    },
    {
      label: "RFC 7323 — TCP Extensions for High Performance",
      note: "Window scaling, timestamps and the protection against wrapped sequence numbers.",
    },
    {
      label: "RFC 2018 — TCP Selective Acknowledgment Options",
      note: "How a receiver reports exactly which byte ranges it holds.",
    },
  ],
};
