# PR Description

**Title:** NIP-XX: Paid API Service Announcements (kind 31402)

**Body:**

## Summary

Defines kind `31402` for announcing paid HTTP API services on Nostr. Decentralized discovery of APIs gated by any payment mechanism (L402, x402, Cashu). Nostr handles discovery; HTTP handles payment.

- 8 production implementations ([402.pub](https://402.pub) is a live directory)
- 1 kind, payment-agnostic, tags-first design for relay filterability
- Clean separation: Nostr for discovery, HTTP 402 for payment

## Relationship to NIP-105 (PR #780)

NIP-105 also proposes kind 31402. We commented on that PR before opening this one. The core intent is the same; the design differs:

- **Tags vs content**: This NIP puts `name`, `url`, `pmi`, `price`, and `t` in tags for relay-side filtering. NIP-105 puts metadata in content (not filterable).
- **Payment agnosticism**: NIP-105 prescribes Lightning invoices. This NIP supports any payment rail via the `pmi` tag.
- **Multi-capability**: NIP-105 is one endpoint per event. This NIP supports multiple capabilities with individual pricing.

We welcome collaboration on a merged spec.

## Why not NIP-90 DVMs?

NIP-90 DVMs are Nostr-native: jobs and results flow through relays as events. Kind 31402 is HTTP-native: Nostr handles discovery only, consumption happens over standard REST. They complement each other: [toll-booth-dvm](https://github.com/forgesworn/toll-booth-dvm) already bridges the two, exposing any L402-gated API as a NIP-90 DVM.

## Why not NIP-99?

NIP-99 classifieds serve human shoppers. Kind 31402 serves machines (AI agents, API clients). The data models are incompatible: NIP-99 uses a single `price` per listing; kind 31402 uses per-capability pricing tuples. NIP-99 has no concept of endpoint URLs or payment method identifiers. A client subscribing to NIP-99 to find APIs would receive furniture listings in the same feed.

## Reference Implementations

All by the same author; independent implementations encouraged.

| Implementation | Description |
|---|---|
| [402.pub](https://402.pub) | Live service directory |
| [402-announce](https://github.com/forgesworn/402-announce) | Publish kind 31402 events |
| [402-mcp](https://github.com/forgesworn/402-mcp) | MCP server for AI agents |
| [402-indexer](https://github.com/forgesworn/402-indexer) | Nostr-native crawler |
| [aperture-announce](https://github.com/forgesworn/aperture-announce) | Aperture YAML to kind 31402 (Go) |
| [toll-booth-announce](https://github.com/forgesworn/toll-booth-announce) | Toll-booth config bridge |
| [toll-booth-dvm](https://github.com/forgesworn/toll-booth-dvm) | L402 APIs as NIP-90 DVMs |
| [satgate](https://github.com/TheCryptoDonkey/satgate) | L402 gateway |
