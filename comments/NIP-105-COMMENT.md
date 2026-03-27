# Comment for PR #780 (NIP-105)

We've been building on kind 31402 independently and have 8 implementations in production:

- [402.pub](https://402.pub) - live directory streaming kind 31402 from relays
- [402-announce](https://github.com/forgesworn/402-announce) - publish kind 31402 events
- [402-mcp](https://github.com/forgesworn/402-mcp) - MCP server for AI agents to discover, pay, and consume 402 APIs
- [402-indexer](https://github.com/forgesworn/402-indexer) - Nostr-native crawler
- [aperture-announce](https://github.com/forgesworn/aperture-announce) - Aperture YAML to kind 31402 (Go)
- [toll-booth-announce](https://github.com/forgesworn/toll-booth-announce) - toll-booth config bridge
- [toll-booth-dvm](https://github.com/forgesworn/toll-booth-dvm) - L402 APIs as NIP-90 DVMs
- [satgate](https://github.com/TheCryptoDonkey/satgate) - L402 gateway

Our spec uses a different tag schema: `name`, `url`, `pmi` (payment method identifier), `price`, and `t` in tags for relay-side filtering, with payment-agnostic `pmi` rails (l402, x402, cashu, xcashu) instead of Lightning-only. We also support multiple capabilities per event.

We will be submitting a PR for our NIP soon, but are happy to chat / collaborate if you are interested.
