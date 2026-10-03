import type { FoundationTerm } from "./types";

/**
 * "The Networking Foundations" — the vocabulary that is NOT a protocol.
 *
 * The brief is emphatic that these must not be presented as six more
 * protocols. They are grouped by the job they do, and each one names the
 * protocols it actually belongs to, so the relationship is visible rather
 * than asserted.
 */
export const foundations: FoundationTerm[] = [
  {
    group: "address",
    term: "IP",
    scope: "Network layer",
    definition:
      "An address that identifies a machine on a network — and lets a packet be routed towards it across many networks.",
    detail:
      "IP is an address and a delivery service, not a conversation. IPv4 uses 32-bit addresses (e.g. 142.250.190.78) and IPv6 uses 128-bit addresses. Every router along a path reads the destination address and forwards the packet towards it, one hop at a time. Crucially, the address says nothing about which program on that machine should get the data — that is the port's job.",
    related: ["tcp", "udp"],
  },
  {
    group: "address",
    term: "Port",
    scope: "Transport layer",
    definition:
      "A 16-bit number that identifies a specific program on a machine, so one IP address can host many conversations.",
    detail:
      "Ports range from 0 to 65535. Well-known ports (0–1023) carry conventions: 80 for HTTP, 443 for HTTPS, 53 for DNS, 22 for SSH. The rest are available for clients to pick from, usually at random for the duration of a connection. IP reaches the machine; the port reaches the program. Together with the protocol, that is an endpoint.",
    related: ["tcp", "udp"],
  },
  {
    group: "address",
    term: "MAC",
    scope: "Data Link layer",
    definition:
      "A hardware address burned into a network interface, used to move a frame across a single physical link.",
    detail:
      "A 48-bit address, usually written as six hex pairs, with the first three bytes identifying the manufacturer. MAC addresses are only meaningful within one local network — they do not survive a router, which is why they cannot address anything across the internet. When a packet leaves your house for a server abroad, the MAC address on the frame changes at every hop while the IP address stays the same.",
    related: ["tcp", "udp"],
  },
  {
    group: "unit",
    term: "Frame",
    scope: "Data Link layer",
    definition:
      "The unit of data on a single link — an IP packet plus a link-layer header carrying source and destination MAC addresses.",
    detail:
      "A frame exists only for the duration of one hop. It is built, transmitted, checked and discarded at each device it passes through, and a new frame is constructed for the next hop. Ethernet frames have a practical payload limit of 1500 bytes, which is why IP packets are kept at or below that size.",
    related: ["tcp", "udp"],
  },
  {
    group: "unit",
    term: "Packet / Datagram",
    scope: "Network layer",
    definition:
      "The unit of data IP deals with — an addressable, independently routed chunk that may take any path.",
    detail:
      "Each packet is handled on its own. Two consecutive packets may traverse entirely different routers and arrive in either order, or not at all. 'Datagram' means exactly this: a self-contained message whose delivery is not guaranteed. The word carries no implication of size or content.",
    related: ["tcp", "udp"],
  },
  {
    group: "unit",
    term: "Segment",
    scope: "Transport layer (TCP)",
    definition:
      "The TCP unit: a piece of the byte stream, with a header carrying ports, sequence and acknowledgement numbers.",
    detail:
      "A segment is where reliability lives. Its sequence number lets the receiver reassemble a shuffled stream, its ACK number tells the sender what has landed, and its fields are what make retransmission and flow control possible. A segment is carried inside one IP packet.",
    related: ["tcp"],
  },
  {
    group: "unit",
    term: "Datagram (UDP)",
    scope: "Transport layer (UDP)",
    definition:
      "The UDP unit: one message with an 8-byte header, delivered whole or not at all.",
    detail:
      "UDP preserves message boundaries, so a single datagram is never split or joined. This is the property that makes UDP useful for DNS or telemetry, where a message that arrives half-formed is worse than one that does not arrive. Same word as the IP datagram, different layer — which is a genuine and common source of confusion.",
    related: ["udp"],
  },
  {
    group: "device",
    term: "Router",
    scope: "Network layer",
    definition:
      "A device that connects separate networks and forwards packets between them using IP addresses.",
    detail:
      "Routers are what make the internet possible: they join millions of independently administered networks into one addressable space. A router examines each packet's destination IP address, consults a routing table, and forwards it towards the next hop. It also decrements the TTL, which is how loops are broken, and typically performs NAT, which is how many devices share one public address.",
    related: ["tcp", "udp"],
  },
  {
    group: "device",
    term: "Switch",
    scope: "Data Link layer",
    definition:
      "A device that forwards frames within one local network using MAC addresses.",
    detail:
      "A switch learns which MAC address is reachable on which port by watching the traffic that arrives, then forwards each frame only out of the correct port. It never looks at the IP address. This is why a robot's internal Ethernet, or a factory floor network segment, can be fast and local without involving a router at all.",
  },
  {
    group: "device",
    term: "Client / Server",
    scope: "Application layer",
    definition:
      "A role, not a device: the client initiates a request, the server awaits requests and answers them.",
    detail:
      "The distinction is about who speaks first, not about power or size. Your laptop is a client to a web server, but a server to nothing in particular; and a program can be both — a web application server is a client of a database. Many protocols are strictly asymmetric (HTTP), while others are peer-to-peer with no such roles at all (CAN).",
    related: ["http", "https"],
  },
  {
    group: "device",
    term: "DNS",
    scope: "Application layer",
    definition:
      "The naming system that maps human-readable names onto IP addresses — a phone book, not a protocol for moving data.",
    detail:
      "You connect to an address, not to a name. DNS converts example.com into 93.184.216.34 before any connection can be made, usually over UDP on port 53 for a single round trip. It is a distributed hierarchy: root servers, top-level-domain servers, and authoritative servers for each domain, with caches at every level to keep lookups fast.",
    related: ["udp", "http", "https"],
  },
  {
    group: "role",
    term: "Protocol",
    scope: "Every layer",
    definition:
      "An agreed set of rules for how data is formatted, addressed and exchanged between two parties.",
    detail:
      "A protocol is an agreement, and nothing more: what a byte pattern means, who speaks first, what happens when something goes wrong. This is why protocols are documented in RFCs and standards — they are contracts that let two programs written years apart, by different people, interoperate. Every protocol on this site is one such contract, at a different layer and for a different job.",
  },
];

/**
 * The encapsulated stack. HTTP sits inside TCP which sits inside IP which sits
 * inside a link-layer frame — four independent agreements working together,
 * each solving one problem and trusting the layer below for the rest.
 */
export const layerStack = [
  {
    id: "application",
    label: "Application",
    question: "What does the user want?",
    carries: "HTTP · HTTPS",
    carriesNote: "Requests, responses, documents, API payloads",
    protocolIds: ["http", "https"] as const,
  },
  {
    id: "transport",
    label: "Transport",
    question: "How do two programs talk reliably?",
    carries: "TCP · UDP",
    carriesNote: "Ports, reliability, ordering, flow and congestion control",
    protocolIds: ["tcp", "udp"] as const,
  },
  {
    id: "network",
    label: "Network",
    question: "Which machine, and how do we get there?",
    carries: "IP",
    carriesNote: "Addresses and routing across many independent networks",
    protocolIds: [] as const,
  },
  {
    id: "data-link",
    label: "Data Link",
    question: "How does the signal cross this one hop?",
    carries: "Ethernet · Wi-Fi",
    carriesNote: "MAC addresses, framing, medium access",
    protocolIds: [] as const,
  },
  {
    id: "physical",
    label: "Physical",
    question: "How do we put bits on a wire?",
    carries: "Copper · Fibre · Radio",
    carriesNote: "Voltages, light, modulation, connectors",
    protocolIds: [] as const,
  },
];
