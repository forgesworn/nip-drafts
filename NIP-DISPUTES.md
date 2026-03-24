NIP-DISPUTES
==============

Dispute Resolution Protocol
------------------------------

`draft` `optional`

Two event kinds for structured dispute resolution on Nostr; claim filing and mediator resolution.

## Motivation

NIP-56 provides content reporting (flagging notes for moderation), but Nostr has no protocol for resolving disputes between transacting parties. When a marketplace purchase goes wrong, a freelance job is abandoned, or a service is not delivered, there is no standardised way to:

- **File a structured complaint** with typed dispute categories, financial amounts, and mediator assignment
- **Resolve via mediation** with transparent, signed rulings

Evidence submission uses [NIP-EVIDENCE](NIP-EVIDENCE.md) (`kind:30578`), which provides structured, immutable evidence records with file hashes, evidence types, and geolocation. Abuse reporting and serial offender detection use [NIP-56](https://github.com/nostr-protocol/nips/blob/master/56.md) at the application layer.

This NIP defines the dispute claim and resolution lifecycle. It works with any Nostr-based transaction: marketplace (NIP-15), classified listings (NIP-99), service coordination, or any custom application.

## Relationship to Existing NIPs

### NIP-56 (Reporting)

NIP-56 handles content and user reporting for moderation. Dispute Claims (`kind:7543`) are structured complaints between transacting parties with typed dispute categories, financial amounts, and mediator assignment. The two serve different purposes: NIP-56 is unilateral reporting to relays; NIP-DISPUTES is bilateral dispute resolution between parties.

For serial offender pattern detection, use NIP-56 reports referencing resolved disputes. When an application detects patterns (e.g. 3+ at-fault rulings against the same pubkey within 30 days), it SHOULD publish NIP-56 reports with structured `report` tags. This keeps abuse reporting at the application layer where pattern detection logic belongs.

### NIP-EVIDENCE (kind 30578)

Dispute evidence SHOULD be submitted as [NIP-EVIDENCE](NIP-EVIDENCE.md) records (`kind:30578`). The `e` tag references the dispute claim event. Evidence types (photo, video, screenshot, receipt, etc.) map directly to NIP-EVIDENCE's `evidence_type` vocabulary. This composability means dispute evidence is discoverable alongside other evidence records and benefits from NIP-EVIDENCE's file hash verification, geolocation, and capture timestamp metadata.

See [Composing with NIP-EVIDENCE](#composing-with-nip-evidence) for concrete examples.

### NIP-94 / Blossom

For media attachments (photos, videos, documents), use NIP-94 file metadata or Blossom (BUD-01) uploads, referenced from NIP-EVIDENCE records via `file_hash` and URL tags. Media upload is a generic file management concern, not dispute-specific.

### NIP-ESCROW

Disputes compose with [NIP-ESCROW](NIP-ESCROW.md). A dispute resolution MAY trigger settlement (Lock to Settlement with `release_reason: dispute_resolved`). When a `kind:30545` resolution includes a refund ruling, the escrow system can use the resolution event as authorisation to release or forfeit funds.

### NIP-APPROVAL

For multi-party dispute panels (e.g. three-mediator arbitration), compose with [NIP-APPROVAL](NIP-APPROVAL.md) gates. Each panel member publishes an approval event; the dispute resolution is published once the required threshold is met.

## Kinds

| kind  | description         | type        |
| ----- | ------------------- | ----------- |
| 7543  | Dispute Claim       | regular     |
| 30545 | Dispute Resolution  | addressable |

Claims are regular events (NIP-01); once published, they cannot be replaced at the relay level (regular events have no addressable replacement semantics). NIP-09 deletion requests may be issued but relays MAY ignore them; the cryptographic signature on the original event remains independently verifiable. Resolutions are addressable events; mediators may correct rulings before settlement.

---

## Dispute Claim (`kind:7543`)

Filed by a complainant against an accused party. Immutable: as a regular event, the claim cannot be replaced or retracted at the relay level. It can only be resolved via a `kind:30545` resolution.

```json
{
    "kind": 7543,
    "pubkey": "<complainant-hex-pubkey>",
    "created_at": 1698770000,
    "tags": [
        ["p", "<accused-pubkey>"],
        ["e", "<transaction-event-id>"],
        ["dispute_type", "quality"],
        ["resolution_model", "mediator"],
        ["mediator", "<mediator-pubkey>"],
        ["domain", "freelance"],
        ["t", "domain:freelance"],
        ["amount_disputed", "25000"],
        ["currency", "SAT"]
    ],
    "content": "Deliverables did not match the agreed specification. Three of five requirements were not addressed."
}
```

Tags:

* `p` (REQUIRED): Accused party's pubkey.
* `e` (REQUIRED): References the transaction event.
* `dispute_type` (REQUIRED): One of:
    * `no_show` - party did not appear or deliver
    * `quality` - work or goods below agreed standard
    * `pricing` - overcharging, hidden fees
    * `damage` - property or goods damaged
    * `safety` - unsafe behaviour
    * `fraud` - deliberate deception
* `resolution_model` (REQUIRED): One of:
    * `mediator` - designated mediator reviews and rules
    * `mutual` - parties negotiate directly
    * `automated` - rule-based auto-resolution
* `mediator` (OPTIONAL): Nominated mediator's pubkey. How the mediator is selected (marketplace-assigned, mutually agreed, random from pool) is application-defined.
* `domain` (OPTIONAL): Service or transaction category (e.g. `freelance`, `delivery`, `marketplace`). This is a multi-letter tag; relays cannot filter on it. Clients MUST post-filter by `domain` after retrieval.
* `t` (RECOMMENDED when `domain` is present): `["t", "domain:<category>"]` (e.g. `["t", "domain:freelance"]`). Enables relay-side discovery by domain via `#t` filters. The `domain` tag remains the canonical source; the `t` tag is a relay-filterable mirror.
* `amount_disputed` (OPTIONAL): Financial amount in dispute, in smallest currency unit.
* `currency` (OPTIONAL): Currency code (e.g. `GBP`, `USD`, `EUR`, `SAT`).

### Filing Window

Disputes SHOULD be filed within the dispute window defined by the transaction terms (default: 24 hours after completion). "Completion" means the `created_at` timestamp of the completion-state event (e.g. a status update to `completed`, a delivery confirmation, or the final transaction event). If the application has no explicit completion event, the `created_at` of the transaction event referenced by the `e` tag is used. Implementations MAY reject claims filed after this window.

### REQ Filters

```jsonc
// Subscribe to all disputes involving a specific pubkey (as accused)
["REQ", "disputes", {"kinds": [7543], "#p": ["<accused-pubkey>"]}]

// Subscribe to all disputes filed by a specific pubkey
["REQ", "my-disputes", {"kinds": [7543], "authors": ["<complainant-pubkey>"]}]

// Subscribe to disputes for a specific transaction
["REQ", "tx-disputes", {"kinds": [7543], "#e": ["<transaction-event-id>"]}]
```

### Appeals

An appeal is a new `kind:7543` with:

- `["appeal", "true"]` tag
- `e` tag referencing the original `kind:30545` resolution event

Appeals MUST be filed within 48 hours of the original resolution, MUST be assigned a different mediator, and are final (no further appeals at protocol level).

```json
{
    "kind": 7543,
    "pubkey": "<complainant-hex-pubkey>",
    "created_at": 1698790000,
    "tags": [
        ["p", "<accused-pubkey>"],
        ["e", "<original-resolution-event-id>"],
        ["dispute_type", "quality"],
        ["resolution_model", "mediator"],
        ["mediator", "<different-mediator-pubkey>"],
        ["appeal", "true"]
    ],
    "content": "The original ruling did not consider the evidence submitted in items 2 and 3. Requesting review by a different mediator."
}
```

> **Privacy:** This event MUST be delivered via NIP-59 gift wrap. See [Privacy](#privacy).

---

## Dispute Resolution (`kind:30545`)

The mediator's ruling. Addressable: can be updated if the mediator corrects an error before settlement.

```json
{
    "kind": 30545,
    "pubkey": "<mediator-hex-pubkey>",
    "created_at": 1698775000,
    "tags": [
        ["d", "resolution_<dispute-claim-event-id>"],
        ["e", "<dispute-claim-event-id>"],
        ["ruling", "partial_refund"],
        ["resolution_model", "mediator"],
        ["at_fault", "<accused-pubkey>"],
        ["refund_amount", "15000"],
        ["refund_currency", "SAT"],
        ["complainant_stake_outcome", "released"],
        ["accused_stake_outcome", "partial_forfeit"],
        ["resolved_at", "1698775000"]
    ],
    "content": "After reviewing submitted evidence, the deliverables met 2 of 5 requirements. A 60% refund is awarded to the requester."
}
```

Tags:

* `d` (REQUIRED): Format `resolution_<dispute-claim-event-id>`. The `<dispute-claim-event-id>` is the SHA-256 event ID from the `e` tag referencing the claim. Using the event ID (a globally unique SHA-256 hash) guarantees uniqueness without requiring application-level identifiers.
* `e` (REQUIRED): References the Dispute Claim event (`kind:7543`).
* `ruling` (REQUIRED): One of:
    * `full_refund` - requester receives full refund
    * `partial_refund` - requester receives partial refund
    * `no_refund` - provider keeps payment
    * `provider_compensated` - provider awarded additional compensation
    * `mutual_release` - both parties agree to walk away
    * `voided` - transaction voided entirely
* `resolution_model` (REQUIRED): Model used (matches the claim's `resolution_model`).
* `at_fault` (OPTIONAL): Pubkey of the party found at fault.
* `refund_amount`, `refund_currency` (OPTIONAL): Refund details. Amount in smallest currency unit.
* `complainant_stake_outcome` (OPTIONAL): One of `released`, `partial_forfeit`, or `full_forfeit`.
* `accused_stake_outcome` (OPTIONAL): One of `released`, `partial_forfeit`, or `full_forfeit`.
* `resolved_at` (REQUIRED): Unix timestamp when the ruling was made.

`content`: Reasoning and explanation for the ruling. Signed by the mediator's key.

### Time Limits

| Resolution Model | Time Limit                          |
| ---------------- | ----------------------------------- |
| Mediator         | 24 hours from evidence deadline     |
| Mutual           | 7 days from dispute filing          |
| Default          | `mutual_release` if no ruling filed |

If no resolution is published within the time limit, implementations SHOULD treat the dispute as `mutual_release`.

### REQ Filters

```jsonc
// Subscribe to resolutions for a specific dispute
["REQ", "resolution", {"kinds": [30545], "#e": ["<dispute-claim-event-id>"]}]

// Subscribe to all resolutions by a specific mediator
["REQ", "mediator-rulings", {"kinds": [30545], "authors": ["<mediator-pubkey>"]}]
```

> **Privacy:** This event MUST be delivered via NIP-59 gift wrap. See [Privacy](#privacy).

---

## Composing with NIP-EVIDENCE

Dispute evidence SHOULD be submitted as [NIP-EVIDENCE](NIP-EVIDENCE.md) records (`kind:30578`). The `e` tag on the evidence record references the dispute claim event, linking evidence to the dispute.

### Submitting Dispute Evidence

A complainant submitting photographic evidence of a quality dispute:

```json
{
    "kind": 30578,
    "pubkey": "<complainant-hex-pubkey>",
    "created_at": 1698771000,
    "tags": [
        ["d", "<dispute-claim-event-id>:evidence:photo_01"],
        ["t", "evidence-record"],
        ["e", "<dispute-claim-event-id>"],
        ["evidence_type", "photo"],
        ["captured_at", "1698770500"],
        ["file_hash", "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"],
        ["g", "gcpuuz"],
        ["p", "<accused-pubkey>"],
        ["p", "<mediator-pubkey>"]
    ],
    "content": "Photo of delivered item showing visible damage to left panel. Compare with agreed specification in the original listing."
}
```

An accused party submitting a screenshot of the agreed terms:

```json
{
    "kind": 30578,
    "pubkey": "<accused-hex-pubkey>",
    "created_at": 1698772000,
    "tags": [
        ["d", "<dispute-claim-event-id>:evidence:screenshot_01"],
        ["t", "evidence-record"],
        ["e", "<dispute-claim-event-id>"],
        ["evidence_type", "screenshot"],
        ["captured_at", "1698772000"],
        ["file_hash", "sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
        ["p", "<complainant-pubkey>"],
        ["p", "<mediator-pubkey>"]
    ],
    "content": "Screenshot of original agreement showing the five deliverables. Items 1 and 2 were delivered as specified."
}
```

A receipt submission for a pricing dispute:

```json
{
    "kind": 30578,
    "pubkey": "<complainant-hex-pubkey>",
    "created_at": 1698771500,
    "tags": [
        ["d", "<dispute-claim-event-id>:evidence:receipt_01"],
        ["t", "evidence-record"],
        ["e", "<dispute-claim-event-id>"],
        ["evidence_type", "receipt"],
        ["captured_at", "1698771500"],
        ["file_hash", "sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"],
        ["p", "<accused-pubkey>"],
        ["p", "<mediator-pubkey>"]
    ],
    "content": "Payment receipt showing 25000 SAT charged. The agreed price was 18000 SAT per the original quote."
}
```

### Evidence `d` Tag Convention

For dispute evidence, the recommended `d` tag format is:

```
<dispute-claim-event-id>:evidence:<label>
```

This links evidence to the dispute while ensuring each record has a unique `d` tag (append-only semantics). The `<label>` is author-chosen (e.g. `photo_01`, `screenshot_01`, `receipt_01`).

### Discovering Dispute Evidence

Clients can discover all evidence for a dispute by filtering on the `e` tag:

```json
["REQ", "dispute-evidence", {"kinds": [30578], "#e": ["<dispute-claim-event-id>"]}]
```

### Evidence Submission Window

Evidence SHOULD be submitted within 48 hours of the dispute filing. Implementations MAY reject evidence submitted after this window.

### Evidence Privacy

When dispute evidence contains sensitive information, the NIP-EVIDENCE `content` field SHOULD be NIP-44 encrypted to the relevant parties. Evidence events MUST be delivered via NIP-59 gift wrap (one copy per recipient: complainant, accused, mediator). See [Privacy](#privacy).

---

## Protocol Flow

```mermaid
sequenceDiagram
    actor C as Complainant
    actor A as Accused
    participant M as Mediator

    C-->>A: kind:7543 Dispute Claim (gift-wrapped)
    Note left of C: Filed within dispute window

    rect rgb(240, 248, 255)
        Note over C,A: Evidence phase (48-hour window)
        C-->>M: kind:30578 Evidence (gift-wrapped)
        A-->>M: kind:30578 Evidence (gift-wrapped)
        Note over C,M: NIP-EVIDENCE records with e tag<br/>referencing the dispute claim
    end

    M-->>C: kind:30545 Resolution (gift-wrapped)
    M-->>A: kind:30545 Resolution (gift-wrapped)
    Note right of M: Ruling with reasoning

    alt At-fault ruling confirmed
        Note over C,A: Escrow released or forfeited per ruling (NIP-ESCROW)
    else Pattern detected (3+ at-fault)
        Note over C,A: Application publishes NIP-56 report
    end
```

> **Arrow legend:** `-->>` dashed = NIP-59 gift-wrapped (private)

1. **Filing:** Complainant publishes `kind:7543` within the dispute window.
2. **Evidence:** Both parties submit `kind:30578` evidence records (NIP-EVIDENCE) within the 48-hour window.
3. **Ruling:** Mediator publishes `kind:30545` resolution with reasoning.
4. **Settlement:** Escrow released or forfeited per ruling (see [NIP-ESCROW](NIP-ESCROW.md)).
5. **Abuse reporting:** If patterns are detected across multiple disputes, the application publishes NIP-56 reports.

### State Transitions

```mermaid
flowchart TD
    TC["Transaction Complete"] --> CF["Claim Filed\nkind:7543"]
    CF --> ES["Evidence Submission\nkind:30578 (NIP-EVIDENCE)\n(48-hour window)"]
    ES --> RU["Ruling\nkind:30545"]
    RU --> SE["Settled"]
    RU --> AP["Appeal\nkind:7543 (appeal variant)"]
    AP --> ES2["Evidence Submission\n(new mediator)"]
    ES2 --> RU2["Final Ruling\nkind:30545"]
    RU2 --> SE

    style CF fill:#fff3cd,stroke:#ffc107
    style ES fill:#fff3cd,stroke:#ffc107
    style RU fill:#d4edda,stroke:#28a745
    style SE fill:#d4edda,stroke:#28a745
    style AP fill:#cce5ff,stroke:#007bff
    style ES2 fill:#fff3cd,stroke:#ffc107
    style RU2 fill:#d4edda,stroke:#28a745
```

Legend: <span style="color:#ffc107">**yellow**</span> = in progress, <span style="color:#28a745">**green**</span> = terminal, <span style="color:#007bff">**blue**</span> = appeal path

### Enforcement Note

The state transitions above are **client-side guidance**, not relay-enforced constraints. Nothing in the Nostr protocol prevents out-of-order event publication (e.g. a resolution before the evidence window closes). Clients SHOULD validate state transitions and reject or flag events that arrive out of sequence. Relays have no mechanism to enforce ordering across event kinds.

## Use Cases Beyond Task Coordination

### Marketplace Purchase Disputes
Buyer and seller disagree on item condition. Dispute claim (`kind:7543`) references the original listing. Evidence records (`kind:30578`) include photos with file hashes. A designated mediator issues resolution (`kind:30545`).

### Freelance Contract Disputes
Client claims deliverable does not match brief. Structured dispute flow with evidence and optional mediation replaces unstructured DM arguments.

### Rental Damage Claims
Landlord claims damage after checkout. Tenant submits counter-evidence (pre-checkout photos as `kind:30578` records). Third-party mediator reviews both sides.

### Content Takedown Appeals
Creator disputes a content removal. The creator submits counter-evidence via NIP-EVIDENCE. Resolution documents the outcome for transparency.

## Security Considerations

* **Evidence integrity.** NIP-EVIDENCE records include `file_hash` tags with SHA-256 hashes for tamper detection. Implementations SHOULD verify hashes against submitted files and reject mismatches.
* **Encrypted evidence.** Evidence content SHOULD be NIP-44 encrypted to dispute participants only. Relays see event metadata (kind, tags, pubkeys) but cannot read evidence content.
* **Mediator accountability.** Resolutions are signed events; the mediator's pubkey is transparent and their ruling history is publicly auditable. Clients MAY display mediator statistics (rulings issued, appeal rate, average resolution time).
* **Appeal safeguards.** Appeals MUST be assigned a different mediator, preventing the same person from ruling twice on the same dispute.
* **Immutability guarantees.** Dispute claims (`kind:7543`) are regular events; relays cannot replace them once published. This ensures accusations are tamper-proof at the protocol level. Resolutions (`kind:30545`) remain addressable to allow mediator corrections before settlement.
* **Abuse report thresholds.** Serial offender detection belongs at the application layer. Applications SHOULD only publish NIP-56 reports after verified patterns (3+ at-fault rulings, not single complaints). Publishing unverified reports undermines the system.

## Privacy

Dispute events contain sensitive information: accusations, evidence, rulings, and fault determinations. These MUST NOT be visible to relay operators or passive observers. All dispute events MUST be delivered privately using [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) gift wrap.

### Gift-wrap requirements

| Kind | Event | Requirement | Recipients |
|------|-------|-------------|------------|
| 7543 | Dispute Claim | MUST gift-wrap | Complainant, accused, mediator (if known) |
| 30578 | Dispute Evidence (NIP-EVIDENCE) | MUST gift-wrap | Complainant, accused, mediator |
| 30545 | Dispute Resolution | MUST gift-wrap | Complainant, accused |

The inner event (the sealed rumour) retains its full tag structure; gift wrap provides the privacy layer, not tag restructuring. Recipients unwrap the NIP-59 envelope to access the original event.

Evidence (`kind:30578`) content MAY additionally be NIP-44 encrypted pairwise to each gift-wrap recipient. This provides defence in depth: even if the gift-wrap envelope is compromised, the content remains encrypted. Each gift-wrapped copy carries content encrypted to that specific recipient; NIP-44 is pairwise and a single ciphertext cannot be decrypted by multiple keys.

### Metadata minimisation

Implementations SHOULD include only the tags marked REQUIRED or RECOMMENDED in each event kind. Optional tags (`domain`, `amount_disputed`, `currency`) increase the metadata surface; omit them unless the application specifically needs them.

## Test Vectors

### Dispute Claim (kind 7543)

```json
{
    "kind": 7543,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1698770000,
    "tags": [
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
        ["e", "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"],
        ["dispute_type", "quality"],
        ["resolution_model", "mediator"],
        ["mediator", "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5"],
        ["domain", "freelance"],
        ["t", "domain:freelance"],
        ["amount_disputed", "25000"],
        ["currency", "SAT"]
    ],
    "content": "Deliverables did not match the agreed specification. Three of five requirements were not addressed."
}
```

Expected validation:
- `kind` is 7543 (regular event, immutable)
- `p` tag present (accused pubkey)
- `e` tag present (transaction reference)
- `dispute_type` is one of the six permitted values
- `resolution_model` is one of the three permitted values
- `mediator` tag present when `resolution_model` is `mediator`

### Dispute Resolution (kind 30545)

```json
{
    "kind": 30545,
    "pubkey": "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    "created_at": 1698775000,
    "tags": [
        ["d", "resolution_e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"],
        ["e", "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"],
        ["ruling", "partial_refund"],
        ["resolution_model", "mediator"],
        ["at_fault", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
        ["refund_amount", "15000"],
        ["refund_currency", "SAT"],
        ["complainant_stake_outcome", "released"],
        ["accused_stake_outcome", "partial_forfeit"],
        ["resolved_at", "1698775000"]
    ],
    "content": "After reviewing submitted evidence, the deliverables met 2 of 5 requirements. A 60% refund is awarded to the requester."
}
```

Expected validation:
- `kind` is 30545 (addressable event)
- `d` tag starts with `resolution_`
- `e` tag present (dispute claim reference)
- `ruling` is one of the six permitted values
- `resolution_model` matches the claim's model
- `resolved_at` is a valid Unix timestamp
- `pubkey` matches the mediator nominated in the claim

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, regular and addressable events
* [NIP-32](https://github.com/nostr-protocol/nips/blob/master/32.md): Labelling (abuse categorisation via NIP-56)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads
* [NIP-56](https://github.com/nostr-protocol/nips/blob/master/56.md): Reporting (serial offender detection)
* [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md): Gift wrap (private delivery of dispute events)
* [NIP-EVIDENCE](NIP-EVIDENCE.md): Timestamped evidence recording (dispute evidence submission)

## Reference Implementation

The [`@trott/sdk`](https://github.com/TheCryptoDonkey/trott-sdk) TypeScript library provides builders and parsers for the two kinds defined in this NIP, plus composition helpers for submitting dispute evidence as NIP-EVIDENCE records.

A minimal implementation requires:

1. A Nostr client that supports regular and addressable event publishing, NIP-44 encryption, and NIP-59 gift wrap.
2. A dispute management interface for filing claims and viewing resolutions.
3. Mediator tooling for reviewing evidence and publishing rulings.
4. NIP-EVIDENCE integration for submitting and discovering dispute evidence (`kind:30578`).
