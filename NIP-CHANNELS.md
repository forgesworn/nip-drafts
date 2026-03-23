NIP-CHANNELS
============

Multi-Party Encrypted Channels
------------------------------

`draft` `optional`

Three event kinds for context-scoped encrypted communication between specific participants on Nostr. Fills the gap between NIP-17 (1-to-1 direct messages) and NIP-29 (relay-managed groups) with structured, encrypted channels scoped to a shared context.

> **Standalone usability:** This NIP works independently on any Nostr application. Within the [TROTT protocol](https://github.com/forgesworn/nip-drafts) (v0.9), these kinds are defined in TROTT-08: Messaging. TROTT extends them with task archive events (`kind:30566`), user messaging preferences (`kind:30567`), and operator-scoped message routing — but adoption of TROTT is not required.

## Motivation

NIP-17 provides 1-to-1 private direct messages. NIP-29 provides relay-managed groups. Neither handles a common pattern: encrypted communication between 2-4 specific participants, scoped to a shared context (a transaction, project, order, or event), with structured message types and automatic expiry.

Use cases:

- **Marketplace:** Buyer and seller coordinate delivery details for an order.
- **Freelance:** Client and contractor discuss project requirements.
- **Events:** Organizer and vendor coordinate setup logistics.
- **Local services:** Requester and provider share access codes, arrival updates.

## Kinds

| kind  | description      |
| ----- | ---------------- |
| 30564 | Scoped Message   |
| 30565 | Message Status   |
| 20502 | Typing Indicator |

---

## Scoped Message (`kind:30564`)

Context-scoped encrypted message between named participants. Content is NIP-44 encrypted pairwise to the recipient (see [Multi-Party Channels](#multi-party-channels) for channels with more than two participants). Append-only — each message is a separate event.

```json
{
    "kind": 30564,
    "pubkey": "<sender-hex-pubkey>",
    "created_at": 1698766000,
    "tags": [
        ["d", "order_abc123:msg:001"],
        ["context_id", "order_abc123"],
        ["p", "<recipient-1-pubkey>"],
        ["p", "<recipient-2-pubkey>"],
        ["message_type", "text"],
        ["expiration", "1701358000"]
    ],
    "content": "<NIP-44 encrypted pairwise to recipient: I'm at the back entrance, look for the red door.>",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `d` (REQUIRED): Unique message identifier. Recommended format: `<context_id>:msg:<sequence>`.
* `context_id` (REQUIRED): Identifier scoping this message to a shared context (order, project, task, event).
* `p` (REQUIRED, one or more): Pubkeys of recipients. For two-party channels, content is NIP-44 encrypted pairwise to the single recipient. For multi-party channels, use separate message streams per party-pair (see [Multi-Party Channels](#multi-party-channels)).
* `message_type` (REQUIRED): One of the defined message types (see below).
* `reply_to` (OPTIONAL): Event ID of a previous message in this channel (for threading).
* `expiration` (RECOMMENDED): NIP-40 expiration timestamp. Implementations SHOULD set `expiration` to context completion plus 30 days to support GDPR right-to-erasure compliance.

### Message Types

| Type         | Description                                                                      |
| ------------ | -------------------------------------------------------------------------------- |
| `text`       | Free-text message                                                                |
| `location`   | Shared location (encrypted content includes lat/lon)                             |
| `photo`      | Photo reference (encrypted content includes URL)                                 |
| `system`     | System-generated notification (e.g. "Order dispatched", "Context cancelled")     |
| `structured` | Predefined template with machine-parseable content (see below)                   |

### Structured Message Templates

When `message_type` is `structured`, a `template` tag identifies the pattern:

| Template               | Description                    | Example Content                                  |
| ---------------------- | ------------------------------ | ------------------------------------------------ |
| `eta_update`           | Shares updated arrival estimate | `{"eta_minutes": 5}`                            |
| `running_late`         | Notifies of delay              | `{"delay_minutes": 10, "reason": "traffic"}`     |
| `access_code`          | Shares entry code              | `{"code": "1234", "type": "gate"}`               |
| `arrival_notification` | Has arrived at location        | `{"location": "front door"}`                     |
| `status_update`        | General status notification    | `{"status": "Order being prepared"}`             |

Clients that do not recognise a template SHOULD fall back to rendering the content as plain text. Applications MAY define additional templates.

### Multi-Party Channels

When more than two participants are involved (e.g. buyer, courier, and recipient in a delivery), use **separate message streams per party-pair** rather than a single shared channel:

| Stream              | Participants        | Typical Content                           |
| ------------------- | ------------------- | ----------------------------------------- |
| Buyer ↔ Courier    | Customer, courier   | ETA updates, access codes                 |
| Courier ↔ Recipient | Courier, recipient | "I'm at the door", "Leave at reception"   |

Each stream uses the same `context_id` but different `p` tags. Messages are encrypted only to their `p`-tagged recipients — a buyer-to-courier message is NOT visible to the recipient unless all parties are `p`-tagged.

### Lifecycle

- Messages SHOULD only be sent during an active context (after mutual agreement, before completion).
- Messages SHOULD include an `expiration` tag for automatic cleanup.
- Pre-context enquiries SHOULD use NIP-17 direct messages instead.

---

## Message Status (`kind:30565`)

Read receipts and delivery confirmation. Addressable — the latest status for a given context replaces previous status events.

```json
{
    "kind": 30565,
    "pubkey": "<reader-hex-pubkey>",
    "created_at": 1698766100,
    "tags": [
        ["d", "order_abc123:status:<reader-pubkey>:<counterparty-pubkey>"],
        ["context_id", "order_abc123"],
        ["last_read", "<event-id-of-last-read-message>"],
        ["p", "<other-participant-pubkey>"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `d` (REQUIRED): Unique status identifier. Format: `<context_id>:status:<reader-pubkey>:<counterparty-pubkey>`. The counterparty pubkey discriminates between pairwise streams in the same context — without it, a participant in multiple streams would overwrite their read position when reading messages from a different stream.
* `context_id` (REQUIRED): Shared context identifier.
* `last_read` (REQUIRED): Event ID of the most recently read message.
* `p` (REQUIRED): Other participant(s) who should see this receipt.

---

## Typing Indicator (`kind:20502`)

Ephemeral real-time typing signal. Relays MUST NOT persist these events.

```json
{
    "kind": 20502,
    "tags": [
        ["context_id", "order_abc123"],
        ["p", "<recipient-pubkey>"],
        ["expiration", "1698766035"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `context_id` (REQUIRED): Shared context identifier.
* `p` (REQUIRED): Recipient(s) of the typing signal.
* `expiration` (REQUIRED): Short NIP-40 expiration (5-10 seconds). Safety net — if sender stops typing, the indicator expires automatically.

---

## Protocol Flow

1. **Context established:** Participants agree on a shared context (order, project, booking).
2. **Channel opens:** Participants begin sending `kind:30564` messages with the shared `context_id`.
3. **Read receipts:** Recipients publish `kind:30565` events as they read messages.
4. **Typing indicators:** Participants send ephemeral `kind:20502` events whilst composing.
5. **Context completes:** Messages remain available for a retention period (via `expiration` tags), then auto-expire.

## Use Cases Beyond Task Coordination

### Marketplace Buyer-Seller Chat
Scoped, encrypted channel tied to a specific listing. Auto-expires after the transaction closes. No persistent chat history to leak.

### Event Coordination
Group channel for event participants, scoped to the event. Typing indicators (kind:20502) show real-time activity. Channel expires when the event ends.

### Temporary Support Channels
Customer opens a support channel scoped to their ticket. Messages are encrypted between customer and support agent. Channel auto-closes when the ticket resolves.

### Collaborative Document Review
Reviewers discuss a document in a scoped channel. Messages reference specific sections. Channel expires after the review deadline.

## Security Considerations

* **End-to-end encryption.** All message content is NIP-44 encrypted pairwise to the `p`-tagged recipient. Relays see message metadata (sender, context, timestamps) but cannot read content. Multi-party channels use separate message streams per party-pair — each stream is a standard pairwise NIP-44 channel.
* **Scoped channels.** Messages are bound to a `context_id`. There is no cross-context message leakage.
* **Automatic expiry.** NIP-40 `expiration` tags ensure messages do not persist indefinitely. Implementations SHOULD set expiration to context completion + 30 days.
* **No retroactive access.** Adding a new participant to `p` tags on future messages does not grant access to historical messages.
* **Ephemeral indicators.** Typing indicators are ephemeral events — relays MUST NOT persist them.

## Relationship to Existing NIPs

Fills the gap between [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) (Private Direct Messages) and [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md) (Relay-based Groups). NIP-17 is maximally private 1-to-1 messaging; NIP-29 is relay-managed group chat; NIP-CHANNELS is context-scoped coordination messaging with automatic lifecycle cleanup. For sensitive data (PII, access codes), consider wrapping messages in [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) (Gift Wrap).

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads
* [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md): Gift wrap (RECOMMENDED for hiding sender metadata from relays)

## Relationship to TROTT-08 Messaging

NIP-CHANNELS is a standalone NIP. Within the TROTT protocol, context-scoped messaging is extended with additional capabilities:

- **TROTT-08: Messaging** — Adds `kind:30566` (Task Archive) for preserving message history after context completion, and `kind:30567` (User Preferences) for per-user messaging configuration (notification preferences, auto-expiry settings).
- **P5 (Evidence Recording)** — Message content can be referenced by evidence records (`kind:30578`) for audit purposes, linking chat messages to timestamped facts.

These extensions are optional. NIP-CHANNELS works without any TROTT adoption.

## Reference Implementation

The `@trott/sdk` (TypeScript SDK) provides builders and parsers for all three kinds defined in this NIP. For standalone use without TROTT, implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A NIP-44 encryption library for encrypting message content pairwise to each recipient.
2. A Nostr client that supports addressable and ephemeral event publishing.
3. Context management logic to scope messages to a `context_id` and enforce participant access.
