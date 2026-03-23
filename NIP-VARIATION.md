NIP-VARIATION
=============

Scope & Price Change Management
----------------------------------

`draft` `optional`

Three addressable event kinds for managing changes to agreed work on Nostr — a variation request proposes a change, a variation quote prices the change, and a variation approval formalises the decision.

> **Design principle:** Variation events coordinate change management — they record that a change was requested, priced, and approved or rejected. They do not modify the original agreement directly; the consuming application updates its internal state based on the approved variation.

> **Standalone usability:** This NIP works independently on any Nostr application. Within the [TROTT protocol](https://github.com/forgesworn/nip-drafts) (v0.9), it is pattern P6 in TROTT-00: Core Patterns. TROTT composes variation management with payment commitment (amended stakes), task lifecycle states, and domain-specific scope change rules — but adoption of TROTT is not required.

## Motivation

Nostr has events for creating agreements (NIP-99 listings, NIP-15 marketplace orders, NIP-ESCROW payment terms) but no standard mechanism for **changing the terms of an existing agreement**. In practice, scope changes are inevitable:

- **Contract modifications** — adding, removing, or substituting deliverables mid-project
- **Order changes** — modifying a marketplace order after acceptance
- **Schedule adjustments** — changing deadlines or milestones for ongoing work
- **Price renegotiation** — adjusting pricing based on changed circumstances

Without a standard, applications handle changes informally (DMs, new events that break the original reference chain) or not at all. NIP-VARIATION provides a structured three-event flow (request, quote, approval) that ensures both parties explicitly agree to every change with a clear audit trail.

## Kinds

| kind  | description         |
| ----- | ------------------- |
| 30579 | Variation Request   |
| 30580 | Variation Quote     |
| 30581 | Variation Approval  |

All three kinds are addressable events (NIP-01). The `d` tag format ensures each event occupies a unique slot, allowing updates via republication.

---

## Variation Request (`kind:30579`)

Published by either party to request a change to the agreed scope. Addressable — the proposer can update the request before a quote is received.

```json
{
    "kind": 30579,
    "pubkey": "<requester-hex-pubkey>",
    "created_at": 1698771000,
    "tags": [
        ["d", "order_marketplace_001:variation:001"],
        ["t", "variation-request"],
        ["variation_type", "addition"],
        ["p", "<provider-hex-pubkey>"],
        ["e", "<original-agreement-event-id>", "wss://relay.example.com"],
        ["amount", "15000"],
        ["currency", "SAT"],
        ["schedule_impact_days", "3"]
    ],
    "content": "Adding express shipping to the order. Original order was standard delivery. Need it by Friday instead of next Wednesday.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<context_id>:variation:<sequence>`. Addressable event identifier.
* `t` (REQUIRED): Protocol family marker. MUST be `"variation-request"`.
* `variation_type` (REQUIRED): Nature of the change. One of `"addition"`, `"omission"`, `"substitution"`, or `"schedule_change"`.
* `p` (RECOMMENDED): Other party's hex pubkey.
* `e` (RECOMMENDED): Event ID of the original scope or agreement event.
* `amount` (OPTIONAL): Estimated cost impact in smallest currency unit (pence for GBP, cents for USD, satoshis for SAT).
* `currency` (OPTIONAL): Currency code (e.g. `GBP`, `USD`, `EUR`, `SAT`).
* `schedule_impact_days` (OPTIONAL): Estimated schedule impact in days.
* `ref` (OPTIONAL): External reference (variation order number, change request ID).

**Content:** Plain text or NIP-44 encrypted JSON describing the requested change in detail.

---

## Variation Quote (`kind:30580`)

Published by the provider in response to a variation request, quoting the cost and schedule impact of the proposed change.

```json
{
    "kind": 30580,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698772000,
    "tags": [
        ["d", "order_marketplace_001:variation:001:quote"],
        ["t", "variation-quote"],
        ["e", "<variation-request-event-id>", "wss://relay.example.com"],
        ["amount", "18000"],
        ["currency", "SAT"],
        ["p", "<requester-hex-pubkey>"],
        ["schedule_impact_days", "0"],
        ["expiration", "1699376800"]
    ],
    "content": "Express shipping upgrade: 18,000 sats. No schedule impact — can dispatch today if approved by 14:00.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<variation_d_tag>:quote`. Addressable event identifier.
* `t` (REQUIRED): Protocol family marker. MUST be `"variation-quote"`.
* `e` (REQUIRED): Event ID of the Kind 30579 variation request.
* `amount` (REQUIRED): Quoted cost in smallest currency unit.
* `currency` (REQUIRED): Currency code.
* `p` (RECOMMENDED): Requester's hex pubkey.
* `schedule_impact_days` (RECOMMENDED): Confirmed schedule impact in days.
* `expiration` (RECOMMENDED): Unix timestamp — quote validity deadline. Clients SHOULD use NIP-40 `expiration` for relay-level enforcement.
* `trust_model` (OPTIONAL): Payment trust model for the variation (e.g. `escrow`, `direct`).
* `ref` (OPTIONAL): External reference.

**Content:** Plain text or NIP-44 encrypted JSON with the detailed cost breakdown and method statement for the variation.

---

## Variation Approval (`kind:30581`)

Published by the requester to approve or reject a variation quote.

```json
{
    "kind": 30581,
    "pubkey": "<requester-hex-pubkey>",
    "created_at": 1698773000,
    "tags": [
        ["d", "order_marketplace_001:variation:001:approval"],
        ["t", "variation-approval"],
        ["e", "<variation-quote-event-id>", "wss://relay.example.com"],
        ["decision", "approved"],
        ["p", "<provider-hex-pubkey>"]
    ],
    "content": "Approved. Please dispatch with express shipping today.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<variation_d_tag>:approval`. Addressable event identifier.
* `t` (REQUIRED): Protocol family marker. MUST be `"variation-approval"`.
* `e` (REQUIRED): Event ID of the Kind 30580 variation quote.
* `decision` (REQUIRED): The requester's decision. One of `"approved"` or `"rejected"`.
* `p` (RECOMMENDED): Provider's hex pubkey.
* `reason` (OPTIONAL): Rationale for rejection.
* `ref` (OPTIONAL): External reference (approved variation order number).

**Content:** Empty string or plain text with any conditions on the approval.

---

## Protocol Flow

```
  Requester                      Relay                     Provider
      |                            |                            |
      |-- kind:30579 Request ----->|                            |
      |  (variation_type: addition)|------- notification ------>|
      |                            |                            |
      |                            |<-- kind:30580 Quote -------|
      |<------ notification -------|    (amount: 18000 SAT)     |
      |                            |                            |
      |-- kind:30581 Approval ---->|                            |
      |  (decision: approved)      |------- notification ------>|
      |                            |                            |
      |                            |  Provider proceeds with    |
      |                            |  the variation work        |
      |                            |                            |
```

1. **Request:** Either party publishes `kind:30579` describing the desired change, its type (addition, omission, substitution, or schedule change), and optionally an estimated cost impact.
2. **Quote:** The provider evaluates the request and publishes `kind:30580` with the confirmed cost and schedule impact.
3. **Approval:** The requester reviews the quote and publishes `kind:30581` with their decision — approved or rejected.
4. **Execution:** If approved, the consuming application updates its internal state to reflect the new scope, price, and timeline. Additional payment events (NIP-ESCROW) MAY be published to account for the price change.

## Use Cases Beyond TROTT

### Marketplace Order Modifications

When a buyer wants to modify an accepted marketplace order (NIP-15) — adding items, changing shipping method, or substituting a product variant — the variation flow provides a structured negotiation. The buyer requests a change, the seller quotes the impact, and the buyer approves before any changes take effect.

### Freelance Scope Changes

Freelance projects frequently encounter scope creep. NIP-VARIATION provides a formal mechanism for managing mid-project changes. When a client wants additional work, the freelancer quotes the cost and timeline impact, and the client explicitly approves. This prevents disputes about what was agreed and what was extra.

### Subscription & Service Plan Changes

Subscription services on Nostr can use variations to manage plan changes — upgrading, downgrading, or adding features to an existing subscription. The `variation_type: substitution` models a plan swap, while `addition` models add-on features.

### Event & Booking Modifications

When plans change after a booking has been confirmed — different venue, additional catering, extended hours — the variation flow ensures both parties agree to the revised terms and pricing before changes are made.

## Security Considerations

* **Reference chain integrity.** Each event in the variation flow references the previous event via `e` tag, creating a verifiable chain. Clients MUST verify that the `e` tag references are valid and form a consistent chain (request -> quote -> approval).
* **Quote expiry.** Variation quotes with an `expiration` tag SHOULD be considered expired after the deadline. Requester MUST NOT approve expired quotes.
* **Decision finality.** Once a `kind:30581` approval or rejection is published, the decision SHOULD be treated as final. Applications SHOULD warn if an approval event is republished with a different decision.
* **Amount validation.** Clients SHOULD verify that the `amount` on the variation quote (`kind:30580`) is reasonable relative to the request's estimated amount. Large discrepancies SHOULD be flagged to the requester.
* **Content encryption.** When variation details are commercially sensitive (pricing strategy, proprietary specifications), the `content` field SHOULD be NIP-44 encrypted to the relevant parties.
* **Authorization.** Only the original parties to the agreement SHOULD be able to publish variation events. Clients SHOULD verify that variation event authors are participants in the original agreement.

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps (quote validity)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads (sensitive variation details)

## Reference Implementation

The `@trott/sdk` (TypeScript SDK) provides builders and parsers for all three kinds defined in this NIP. For standalone use without TROTT, implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing.
2. Reference chain tracking — linking variation requests to quotes to approvals via `e` tags.
3. State management to update the original agreement's effective scope and price when a variation is approved.
