LIP-DISCOVERY
=============

Decentralised Discovery for L402 Services
------------------------------------------

`draft`

| Field   | Value                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Author  | TheCryptoDonkey (npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2) |
| Status  | Draft                                                                    |
| Created | 2026-03-27                                                               |

## Abstract

L402 handles payment beautifully. What it doesn't handle is discovery. There is no standard way for a client to find L402-enabled endpoints without already knowing the URL.

This proposal defines a decentralised discovery mechanism using Nostr (NIP-01 addressable events). Service operators publish a signed event describing their endpoint, pricing, and payment method. Clients subscribe and discover services before making a single HTTP request. Nostr handles discovery; HTTP handles payment and consumption.

## Motivation

When a client gets an HTTP 402 back, L402 tells it exactly what to do: pay this invoice, attach the token, retry. That flow works.

The problem is upstream of the 402. How does the client find the endpoint in the first place? Today, L402 service operators list their APIs on personal websites, GitHub READMEs, or Discord channels. There is no machine-readable, decentralised directory.

This matters more now because:

1. **Multiple payment protocols exist.** L402, x402, Cashu, X-Cashu. A client needs to know which protocol an endpoint uses *before* calling it, not after it parses a 402 response body. Issue [l402-protocol/l402#4](https://github.com/l402-protocol/l402/issues/4) proposes a `Payment-Protocol` header to solve this at runtime. Discovery solves it earlier: the client already knows the payment method before the first HTTP request.

2. **AI agents are the primary consumer.** Agents need to discover, compare, and select paid APIs programmatically. They cannot browse a website or ask in a Discord. They need structured, filterable, real-time data.

3. **Central registries are a single point of failure.** Any centralised directory can go down, censor listings, or charge rent. The discovery layer should be as decentralised as the payment layer.

## Why Nostr?

Nostr is a decentralised relay network with a simple event model (JSON objects signed with secp256k1 keys). It is already widely deployed with thousands of relays. The relevant properties:

- **Addressable events** (kind 30000-39999): replaceable by the same author + identifier, so service announcements stay current without accumulating stale entries.
- **Tag-based filtering**: relays support filtering by tag values, so clients can query "show me all L402 services tagged `ai`" without downloading everything.
- **Real-time subscriptions**: clients open a persistent connection and receive new announcements as they are published. No polling.
- **No registration**: operators sign events with their own keypair. No accounts, no API keys, no approval process.

If you have never touched Nostr, you can publish and subscribe to events with any WebSocket client. The learning curve is minimal.

## Specification

### Event Kind

Service announcements use **kind 31402** (addressable event). The number maps naturally to HTTP 402.

The combination of `pubkey` + `d` tag uniquely identifies a listing. Publishing again with the same values replaces the previous announcement.

### Required Tags

| Tag    | Description                                         |
| ------ | --------------------------------------------------- |
| `d`    | Unique service identifier (e.g. `my-l402-api`)      |
| `name` | Human-readable service name                          |
| `url`  | HTTP endpoint URL (repeatable for multi-transport)   |
| `pmi`  | Payment Method Identifier (see below)                |

### Payment Method Identifier (`pmi`)

This is the tag that addresses the protocol-distinguishing problem from issue #4. Each `pmi` tag declares a payment rail the service accepts:

```
["pmi", "l402", "lightning"]     # L402 with Lightning
["pmi", "x402", "base", "usdc", "0xAbC..."]  # x402 stablecoin
["pmi", "cashu"]                 # Cashu ecash
["pmi", "xcashu"]                # X-Cashu (NUT-24)
```

Clients filter by `pmi` to find only services whose payment method they support:

```json
["REQ", "sub1", { "kinds": [31402], "#pmi": ["l402"] }]
```

This returns only L402 services. No parsing 402 response bodies. No guessing.

### Optional Tags

| Tag          | Description                                                |
| ------------ | ---------------------------------------------------------- |
| `price`      | Per-capability pricing: `["price", "chat", "100", "sats"]` |
| `summary`    | Service description                                        |
| `t`          | Topic tags for discovery filtering (`ai`, `data`, `compute`) |
| `s`          | Upstream API URL (for proxy deduplication)                  |
| `expiration` | NIP-40 TTL                                                 |

### Content (Optional)

The event content MAY contain a JSON object with detailed capability descriptions, including endpoint paths and JSON Schema definitions for request/response bodies. This enables AI agents to generate type-safe API calls without fetching external documentation.

### Example: L402 AI Inference Service

```json
{
  "kind": 31402,
  "pubkey": "<operator-hex-pubkey>",
  "created_at": 1711234567,
  "tags": [
    ["d", "llm-inference-v1"],
    ["name", "LLM Inference API"],
    ["url", "https://inference.example.com/v1"],
    ["pmi", "l402", "lightning"],
    ["price", "chat_completion", "100", "sats"],
    ["price", "embedding", "10", "sats"],
    ["t", "ai"],
    ["t", "inference"]
  ],
  "content": "{\"capabilities\":[{\"name\":\"chat_completion\",\"description\":\"OpenAI-compatible chat completions.\",\"endpoint\":\"/chat/completions\"}]}"
}
```

## Protocol Flow

```
1. Operator publishes kind 31402 to Nostr relays (once, updated as needed)
2. Client subscribes: REQ {kinds:[31402], #pmi:["l402"], #t:["ai"]}
3. Relay returns matching announcements
4. Client picks a service, reads URL + pricing from tags
5. Client sends HTTP request to service URL
6. Service returns HTTP 402 + L402 challenge
7. Client pays Lightning invoice, retries with macaroon
8. Service returns HTTP 200 + response
```

Steps 1-4 are Nostr. Steps 5-8 are standard L402. The two protocols do not overlap.

## Relationship to `Payment-Protocol` Header

The `Payment-Protocol` header proposed in issue #4 and Nostr discovery are complementary:

| Concern | Header | Nostr Discovery |
|---------|--------|-----------------|
| When | After the client hits the endpoint | Before the first HTTP request |
| What it tells you | Which 402 flavour this response uses | Which services exist, what they cost, which rails they accept |
| Who benefits | Clients that already know the URL | Clients searching for services |
| Overhead | Zero (one HTTP header) | Requires a Nostr relay connection |

Both are probably needed. The header handles the runtime case (client has a URL, needs to know the protocol). Nostr handles the discovery case (client needs to find URLs in the first place).

## Reference Implementations

All open source and deployed today:

| Package | Purpose |
| ------- | ------- |
| [402-announce](https://github.com/forgesworn/402-announce) | Build and publish kind 31402 events |
| [402-mcp](https://github.com/forgesworn/402-mcp) | MCP server: AI agents discover, pay, and consume L402 APIs |
| [402-indexer](https://github.com/forgesworn/402-indexer) | Nostr-native crawler for L402/x402 service discovery |
| [402.pub](https://402.pub) | Live directory streaming kind 31402 from relays |
| [toll-booth-announce](https://github.com/forgesworn/toll-booth-announce) | Bridge: toll-booth middleware config to kind 31402 |
| [aperture-announce](https://github.com/forgesworn/aperture-announce) | Aperture (Go) config to kind 31402 |

## Backwards Compatibility

This proposal adds a discovery layer. It does not modify the L402 payment flow, token format, or HTTP semantics. L402 services that do not publish kind 31402 events continue to work exactly as before. Discovery is opt-in.

## Copyright

This document is placed in the public domain.
