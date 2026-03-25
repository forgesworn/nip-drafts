NIP-XX
======

Paid API Service Announcements
------------------------------

`draft` `optional`

This NIP defines `kind:31402`, an addressable event for announcing paid HTTP API services on Nostr. Service operators publish what their API does, how much it costs, and which payment methods it accepts. Clients (including AI agents) discover services via standard [NIP-01](01.md) filters. Nostr handles discovery; HTTP handles payment and consumption.

## Kind

| Kind  | Description                   |
| ----- | ----------------------------- |
| 31402 | Paid API Service Announcement |

## Event Structure

### Tags

- `d` (required) - Unique service identifier (e.g. `jokes-api`, `inference-v2`). MUST NOT be empty.
- `name` (required) - Human-readable service name.
- `url` (required, repeatable) - HTTP endpoint URL. Multiple `url` tags represent the same service on different transports (clearnet, Tor, Handshake). Clients SHOULD try URLs in tag order.
- `pmi` (required, repeatable) - Payment Method Identifier. Multi-element tag: first element is the rail identifier, additional elements carry rail-specific parameters. See [PMI Values](#pmi-values).
- `alt` (recommended) - Short plaintext description for clients that do not support `kind:31402`.
- `summary` (optional) - Service description.
- `price` (optional, repeatable) - Capability pricing: `["price", "<capability>", "<amount>", "<currency>"]`. Amount is a non-negative integer in the smallest unit of the currency (satoshis for `sats`, cents for `usd`).
- `s` (optional) - Upstream API URL that this service proxies. Enables discovery of all providers for the same API (e.g. all proxies for `https://api.openai.com/v1/chat/completions`).
- `t` (optional, repeatable) - Topic tag for discovery filtering.
- `picture` (optional) - Icon URL.
- `expiration` (optional) - [NIP-40](40.md) expiration timestamp.

### Content

The `content` field is a JSON string. If present, it MAY contain:

```jsonc
{
  "capabilities": [         // array of capability objects
    {
      "name": "chat",       // MUST match a price tag capability name if pricing is declared
      "description": "...", // human-readable
      "endpoint": "/chat",  // optional path or full URL
      "schema": { },        // optional JSON Schema for the request body
      "outputSchema": { }   // optional JSON Schema for the response body
    }
  ],
  "version": "1.0.0"       // optional service version
}
```

Tags are sufficient for discovery, filtering, and pricing. Content capabilities are an optimization for programmatic consumers (AI agents, MCP clients) that need request/response schemas. Implementations that only need discovery MAY ignore content entirely.

If no capabilities or version are declared, content SHOULD be `"{}"`.

## PMI Values

The `pmi` tag identifies which payment rails a service accepts.

| Rail       | Tag example                                               | Description                          |
| ---------- | --------------------------------------------------------- | ------------------------------------ |
| `l402`     | `["pmi", "l402", "lightning"]`                            | L402 via Lightning BOLT-11 invoice   |
| `x402`     | `["pmi", "x402", "base", "usdc", "0xAbC..."]`            | x402 stablecoin (network, token, address) |
| `cashu`    | `["pmi", "cashu"]`                                        | Cashu ecash                          |
| `xcashu`   | `["pmi", "xcashu"]`                                       | Cashu ecash via NUT-24 (X-Cashu header) |

Clients SHOULD ignore unrecognized `pmi` rails. Future payment rails MAY be added by convention.

## Example

### AI Inference Service

```jsonc
{
  "kind": 31402,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711234567,
  // other fields...
  "tags": [
    ["d", "llm-inference-v1"],
    ["name", "LLM Inference API"],
    ["alt", "Paid API: LLM Inference API via Lightning and Cashu"],
    ["url", "https://inference.example.com/v1"],
    ["url", "http://inferencexyz123.onion/v1"],
    ["summary", "GPT-4 class inference. Chat completions and embeddings."],
    ["pmi", "l402", "lightning"],
    ["pmi", "cashu"],
    ["price", "chat_completion", "100", "sats"],
    ["price", "embedding", "10", "sats"],
    ["t", "ai"],
    ["t", "inference"]
  ],
  "content": "{\"capabilities\":[{\"name\":\"chat_completion\",\"description\":\"Chat completion with streaming support.\",\"endpoint\":\"/chat/completions\"},{\"name\":\"embedding\",\"description\":\"Text embedding generation.\",\"endpoint\":\"/embeddings\"}],\"version\":\"2.1.0\"}"
}
```

## Discovery

Clients discover services using [NIP-01](01.md) `REQ` filters:

By topic:
```json
["REQ", "sub1", { "kinds": [31402], "#t": ["ai"] }]
```

By payment method:
```json
["REQ", "sub2", { "kinds": [31402], "#pmi": ["l402"] }]
```

By operator:
```json
["REQ", "sub3", { "kinds": [31402], "authors": ["<pubkey>"] }]
```

Note: `pmi` is a multi-letter tag. Relay support for `#pmi` filtering varies. Clients that cannot filter by `#pmi` at the relay SHOULD post-filter client-side.

## Protocol Flow

1. Service operator publishes a `kind:31402` event to one or more relays.
2. Client subscribes with filters matching its interests (topics, payment methods).
3. Client parses the event to extract endpoint URLs, pricing, and payment methods.
4. Client sends an HTTP request to the service URL.
5. Service responds with HTTP 402 and a payment challenge appropriate to the declared `pmi`.
6. Client completes payment and retries with proof.
7. Service validates proof and returns the response.

Nostr is used only for discovery. Payment and API consumption happen over HTTP using the HTTP 402 status code ([RFC 9110 section 15.5.3](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.3)) in a challenge-response pattern established by L402 and x402.

## Security Considerations

`kind:31402` events are unverified claims. Clients SHOULD prefer operators with established Nostr reputations and start with low-value requests to verify quality. Clients MUST validate URLs before making requests (reject `javascript:`, `data:`, `file:` schemes; apply connection timeouts; limit redirects).

## Reference Implementations

| Implementation | Language | Purpose |
| -------------- | -------- | ------- |
| [402-announce](https://github.com/forgesworn/402-announce) | TypeScript | Build and publish `kind:31402` events |
| [toll-booth-announce](https://github.com/forgesworn/toll-booth-announce) | TypeScript | Bridge: toll-booth config to `kind:31402` |
| [aperture-announce](https://github.com/forgesworn/aperture-announce) | Go | Aperture YAML to `kind:31402` |
| [402-pub](https://402.pub) | JavaScript | Live service directory (streams `kind:31402`) |
| [402-mcp](https://github.com/forgesworn/402-mcp) | TypeScript | MCP server: AI agents discover and consume 402 APIs |
| [402-indexer](https://github.com/forgesworn/402-indexer) | TypeScript | Nostr-native crawler for paid API discovery |
| [toll-booth-dvm](https://github.com/forgesworn/toll-booth-dvm) | TypeScript | Expose L402 APIs as [NIP-90](90.md) DVMs |
| [satgate](https://github.com/TheCryptoDonkey/satgate) | TypeScript | L402 gateway with Lightning and Cashu support |

All implementations are by the same author. Independent implementations are encouraged.
