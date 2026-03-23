NIP-REPUTATION
===============

Structured Reputation & Reviews
---------------------------------

`draft` `optional`

Four addressable event kinds for completion-verified ratings, reputation summaries, activity evidence, and review responses on Nostr. Credential attestations use [NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) kind 31000 (Verifiable Attestation) with `type: credential`.

> **Standalone usability:** This NIP works independently on any Nostr application. Within the [TROTT protocol](https://github.com/forgesworn/nip-drafts) (v0.9), these kinds are defined in TROTT-03: Reputation. TROTT extends them with cross-domain reputation portability, levelled credentials, and domain-specific rating criteria — but adoption of TROTT is not required.

## Motivation

Nostr has NIP-32 for generic labels and NIP-58 for badges, but neither provides structured reviews tied to verified completions. A freelancer with 500 five-star jobs on one platform starts at zero on another. Current Nostr reputation approaches lack:

- **Completion verification** — no proof that the rater actually transacted with the rated party
- **Multi-criterion scoring** — no way to rate punctuality separately from quality
- **Stake weighting** — a review from a 10-sat transaction weighs the same as one from a 500,000-sat transaction
- **Portable credentials** — professional qualifications have no machine-readable format

This NIP defines a reputation system where ratings are cryptographically signed, tied to verifiable completion events, and portable across any Nostr client.

## Kinds

| kind  | description             |
| ----- | ----------------------- |
| 30520 | Rating                  |
| 30521 | Reputation Summary      |
| 30523 | Activity Evidence       |
| 30524 | Review Response         |

> **Credential Attestation** — previously kind 30522 in this NIP — now uses NIP-VA kind 31000 with `type: credential`. All application-specific tags (credential_type, issuer_type, etc.) are carried as application-specific tags on the NIP-VA event. See the [NIP-VA specification](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) and TROTT-03 §Credential Attestation for details.

---

## Kind 30520: Rating

Published by a participant after transaction completion to rate the counterparty. Each participant publishes exactly one rating per transaction, enforced by the `d` tag format. The `e` tag references a completion event, providing cryptographic proof the rater participated.

```json
{
    "kind": 30520,
    "pubkey": "<rater-hex-pubkey>",
    "created_at": 1698765500,
    "tags": [
        ["d", "tx_abc123:rating:requester"],
        ["p", "<rated-party-pubkey>"],
        ["e", "<completion-event-id>", "<relay-hint>"],
        ["domain", "freelance"],
        ["role", "provider"],
        ["rating", "overall", "4"],
        ["rating", "quality", "5"],
        ["rating", "communication", "4"],
        ["rating", "punctuality", "3"],
        ["stake_evidence", "50000", "SAT"],
        ["payment_method", "lightning"]
    ],
    "content": "Excellent work on the logo design. Delivered on time with minor revisions needed. Great communication throughout.",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<transaction_id>:rating:<rater_role>`. Ensures one rating per role per transaction via addressable event semantics. Valid roles: `requester`, `provider`, `beneficiary`.
* `p` (REQUIRED): Pubkey of the party being rated.
* `e` (REQUIRED): References a completion/confirmation event. Verifiable proof the rater participated. Implementations SHOULD verify: the event exists with a valid signature, the rater's pubkey appears as a participant, and the transaction reached a terminal state.
* `domain` (RECOMMENDED): Category this transaction belonged to. Enables category-specific filtering.
* `role` (RECOMMENDED): Whether the rated party was `provider`, `requester`, or `beneficiary`.
* `rating` (REQUIRED, at least one): Multi-value tag: `["rating", "<criterion>", "<value>"]`. The `overall` criterion MUST be present. Values are integers 1–5. Additional criteria are application-defined.
* `stake_evidence` (RECOMMENDED): `["stake_evidence", "<amount>", "<currency>"]`. How much was at stake. Higher stakes imply greater credibility.
* `payment_method` (OPTIONAL): Payment method used for the transaction (e.g. `lightning`, `ecash`, `cash`, `onchain`). Including `payment_method` provides context for the rating. A rating from a Lightning-settled transaction demonstrates different trust properties than one from a cash transaction — the former proves cryptographic payment completion, while the latter relies on the rater's attestation.
* `content` (OPTIONAL): Free-text review.

### Rating Scale

| Value | Meaning                            |
| ----- | ---------------------------------- |
| 1     | Unacceptable — serious issues      |
| 2     | Poor — below expectations          |
| 3     | Adequate — met basic expectations  |
| 4     | Good — above expectations          |
| 5     | Excellent — outstanding            |

### Three-Party Transactions

When three distinct participants are involved (e.g. buyer, courier, and recipient), the `beneficiary` role enables up to three ratings per transaction — one per role — each with a unique `d` tag.

### Timing

Ratings SHOULD be published within 30 days of transaction completion. Implementations SHOULD reject ratings published after this window.

### REQ Filters

NIP-01 defines subscription filters for single-letter tag names only. The `domain` tag is client-side metadata — filter by `#p` at the relay, then post-filter by `domain` tag client-side.

```json
[
    {"kinds": [30520], "#p": ["<provider-pubkey>"]},
    {"kinds": [30520], "#p": ["<provider-pubkey>"]}
]
```

---

## Kind 30521: Reputation Summary

Pre-aggregated reputation summary for a pubkey. Published by aggregators as a convenience cache — consumers SHOULD verify by independently computing from `kind:30520` events when stakes are high.

```json
{
    "kind": 30521,
    "pubkey": "<aggregator-hex-pubkey>",
    "created_at": 1698800000,
    "tags": [
        ["d", "<subject-pubkey>:reputation:freelance"],
        ["p", "<subject-pubkey>"],
        ["domain", "freelance"],
        ["role", "provider"],
        ["average_rating", "4.7"],
        ["total_ratings", "156"],
        ["total_transactions", "162"],
        ["completion_rate", "0.96"],
        ["rating_breakdown", "5:98,4:42,3:10,2:4,1:2"],
        ["member_since", "1672531200"],
        ["last_updated", "1698800000"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<subject_pubkey>:reputation:<domain>` (or `:reputation:all` for cross-category).
* `p` (REQUIRED): Subject's pubkey.
* `domain` (OPTIONAL): Category scope (omit for cross-category).
* `role` (OPTIONAL): `provider` or `requester`.
* `average_rating` (REQUIRED): Weighted decimal 1.0–5.0.
* `total_ratings` (REQUIRED): Count of ratings.
* `total_transactions` (OPTIONAL): Total completed transactions.
* `completion_rate` (OPTIONAL): Decimal 0.0–1.0.
* `rating_breakdown` (OPTIONAL): Format `5:<count>,4:<count>,3:<count>,2:<count>,1:<count>`.
* `member_since` (OPTIONAL): Unix timestamp.
* `last_updated` (OPTIONAL): Unix timestamp.

### Bayesian Averaging

Implementations SHOULD use Bayesian averaging to prevent small-sample manipulation:

`adjusted = (C * M + R * N) / (C + N)`

Where C = confidence threshold (e.g. 10 ratings), M = global mean, R = provider's raw average, N = provider's rating count.

---

## Credential Attestation (NIP-VA Kind 31000)

Credential attestations use [NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) kind 31000 (Verifiable Attestation) with `type: credential`. This NIP no longer defines its own credential kind — NIP-VA provides the shared primitive.

```json
{
    "kind": 31000,
    "pubkey": "<issuer-hex-pubkey>",
    "created_at": 1698700000,
    "tags": [
        ["d", "credential:<subject-pubkey>:professional_licence"],
        ["type", "credential"],
        ["p", "<subject-pubkey>"],
        ["credential_type", "professional_licence"],
        ["credential_name", "Gas Safe Registration"],
        ["credential_id", "123456"],
        ["issued", "1672531200"],
        ["expiration", "1704067200"],
        ["verification_url", "https://verify.example.com/123456"],
        ["issuer_type", "authority"],
        ["domain", "plumbing"],
        ["summary", "Gas Safe Registration verified"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags (NIP-VA required):

* `d` (REQUIRED): Format `credential:<subject_pubkey>:<credential_type_slug>`.
* `type` (REQUIRED): Must be `credential`.
* `p` (REQUIRED): Subject's pubkey.

Tags (application-specific):

* `credential_type` (REQUIRED): Machine-readable type. Recommended values: `professional_licence`, `background_check`, `insurance`, `certification`, `training`, `peer_endorsement`, `self_declared`.
* `credential_name` (REQUIRED): Human-readable name.
* `credential_id` (OPTIONAL): External identifier (licence number, etc.).
* `issued` (RECOMMENDED): Unix timestamp.
* `expiration` (RECOMMENDED): Unix timestamp per [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md). Enables automatic expiry detection.
* `verification_url` (OPTIONAL): URL for independent verification.
* `issuer_type` (RECOMMENDED): One of `authority`, `industry_body`, `peer`, `self_declared`.
* `domain` (OPTIONAL): Primary category relevance.
* `summary` (RECOMMENDED): Human-readable description for clients unfamiliar with the credential type.

### Revocation

Revoke by re-publishing with `["status", "revoked"]` and optional `["reason", "..."]` per NIP-VA. For regulated domains requiring audit trails, also publish a [NIP-CREDENTIALS](./NIP-CREDENTIALS.md) Kind 30528 (Credential Revocation) event.

---

## Kind 30523: Activity Evidence

Signed factual record of an activity — links a source event to a domain, evidence type, and outcome. Complements subjective ratings (`kind:30520`) and institutional credentials (`kind:31000`) with objective activity records.

```json
{
    "kind": 30523,
    "pubkey": "<publisher-hex-pubkey>",
    "created_at": 1698780000,
    "tags": [
        ["d", "<publisher-pubkey>:evidence:1698780000"],
        ["domain", "freelance"],
        ["e", "<source-event-id>"],
        ["p", "<subject-pubkey>"],
        ["evidence_type", "project_completion"],
        ["evidence_category", "quality"],
        ["evidence_category", "breadth"],
        ["date", "2024-10-31"],
        ["outcome", "delivered"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<publisher_pubkey>:evidence:<timestamp>`.
* `domain` (REQUIRED): Category context.
* `e` (REQUIRED): References the source event (completion, milestone, etc.).
* `p` (REQUIRED): Pubkey of the party this evidence is about.
* `evidence_type` (REQUIRED): Application-defined type (e.g. `project_completion`, `service_delivery`, `session_report`).
* `evidence_category` (REQUIRED, one or more): Categorisation tags (e.g. `quality`, `breadth`, `progress`, `compliance`).
* `date` (REQUIRED): ISO 8601 date.
* `outcome` (OPTIONAL): Application-defined outcome.

---

## Kind 30524: Review Response

Published by the rated party to respond to a Kind 30520 review. One response per review, enforced by the `d` tag. The response is permanently associated with the review and SHOULD be displayed alongside it.

```json
{
    "kind": 30524,
    "pubkey": "<responder-hex-pubkey>",
    "created_at": 1698773000,
    "tags": [
        ["d", "<task_id>:response:<responder_pubkey>"],
        ["e", "<rating-event-id>"],
        ["p", "<reviewer-pubkey>"],
        ["domain", "plumbing"],
        ["task_id", "<task_id>"]
    ],
    "content": "The soil pipe behind the wall was cracked — I showed the customer before starting and they agreed to the additional work.",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<task_id>:response:<responder_pubkey>`. Ensures one response per review.
* `e` (REQUIRED): References the Kind 30520 rating being responded to.
* `p` (REQUIRED): Pubkey of the original reviewer.
* `domain` (RECOMMENDED): Service domain (kebab-case).
* `task_id` (RECOMMENDED): Parent task reference.

---

## Trust Weighting

Implementations SHOULD weight ratings using available trust signals:

1. **Stake weight** — Ratings from higher-value transactions carry more weight.
2. **Social distance** — Ratings from pubkeys in the user's NIP-02 contact list (or 2-hop follows) carry more weight than ratings from strangers.
3. **Recency** — Recent ratings MAY be weighted more heavily than old ones.
4. **Credential backing** — Ratings from credentialed participants (verified via `kind:31000`) MAY carry additional weight.

The protocol deliberately does not prescribe a scoring algorithm — implementations choose their own weighting and aggregation strategies.

## Stake Weighting

Ratings carry different weight based on the economic stake of the underlying transaction. A 5-star rating from a 500,000-sat job is more meaningful than one from a 100-sat micro-task.

### Algorithm

```
weight(rating) = log2(1 + amount_sats) × recency_factor × completion_factor
```

Where:
- `amount_sats` — transaction amount converted to satoshis (from `amount` and `currency` tags)
- `recency_factor` — `1.0` for ratings < 30 days old, decaying by `0.95^months` thereafter
- `completion_factor` — `1.0` if rating references a verified completion event (kind:30533 release or equivalent), `0.5` otherwise

### Aggregation

A provider's aggregate score for criterion `c` is:

```
score(c) = Σ(rating_c × weight) / Σ(weight)
```

This weighted average naturally surfaces ratings backed by significant transactions while still counting smaller ones.

### Why Stake Weighting Matters

Without stake weighting, an attacker can inflate ratings cheaply by creating many low-value transactions and rating them highly. With stake weighting, inflating reputation requires proportional economic commitment.

## Use Cases Beyond Task Coordination

### Marketplace Seller Ratings

NIP-15 marketplace implementations can use NIP-REPUTATION to rate sellers after purchase. The `amount` tag ties the rating to the actual transaction value.

### Content Creator Reviews

Readers rate paid content (articles, courses, media). Stake weighting ensures reviews from higher-value purchases carry more weight.

### Mentor/Tutor Ratings

Students rate mentors after paid sessions. Multi-criterion scoring (knowledge, communication, punctuality) provides actionable feedback.

### Peer Code Review

Developers rate code reviewers. The `completion_event` references a merged PR or closed bounty, proving the review actually happened.

## Security Considerations

* **Completion verification.** The `e` tag on `kind:30520` references a completion event, preventing rating fabrication. Implementations SHOULD verify this link.
* **One rating per role per transaction.** Addressable event semantics (`d` tag) enforce uniqueness. Republishing replaces the previous rating.
* **Sybil resistance.** Stake evidence and social distance weighting reduce the impact of fake ratings. Zero-stake ratings from unknown pubkeys carry minimal weight.
* **Self-declared credentials.** `kind:31000` supports `issuer_type: self_declared` — implementations SHOULD display these distinctly from authority-issued credentials.
* **Privacy.** Activity evidence (`kind:30523`) content MAY be NIP-44 encrypted for sensitive categories (healthcare, education).

## Test Vectors

### Kind 30520 — Rating

```json
{
  "kind": 30520,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "tx_abc123:rating:requester"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555", "wss://relay.example.com"],
    ["domain", "freelance"],
    ["role", "provider"],
    ["rating", "overall", "4"],
    ["rating", "quality", "5"],
    ["rating", "communication", "4"],
    ["rating", "punctuality", "3"],
    ["stake_evidence", "50000", "SAT"],
    ["payment_method", "lightning"]
  ],
  "content": "Excellent work on the logo design. Delivered on time with minor revisions needed.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30521 — Reputation Summary

```json
{
  "kind": 30521,
  "pubkey": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "created_at": 1709740800,
  "tags": [
    ["d", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3:reputation:freelance"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["domain", "freelance"],
    ["role", "provider"],
    ["average_rating", "4.7"],
    ["total_ratings", "156"],
    ["total_transactions", "162"],
    ["completion_rate", "0.96"],
    ["rating_breakdown", "5:98,4:42,3:10,2:4,1:2"],
    ["member_since", "1672531200"],
    ["last_updated", "1709740800"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### NIP-VA Kind 31000 — Credential Attestation

```json
{
  "kind": 31000,
  "pubkey": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "created_at": 1709740800,
  "tags": [
    ["d", "credential:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3:professional_licence"],
    ["type", "credential"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["credential_type", "professional_licence"],
    ["credential_name", "Gas Safe Registration"],
    ["credential_id", "123456"],
    ["issued", "1672531200"],
    ["expiration", "1704067200"],
    ["verification_url", "https://verify.example.com/123456"],
    ["issuer_type", "authority"],
    ["domain", "plumbing"],
    ["summary", "Gas Safe Registration verified"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30523 — Activity Evidence

```json
{
  "kind": 30523,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:evidence:1709740800"],
    ["domain", "freelance"],
    ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["evidence_type", "project_completion"],
    ["evidence_category", "quality"],
    ["evidence_category", "breadth"],
    ["date", "2024-03-06"],
    ["outcome", "delivered"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30524 — Review Response

```json
{
  "kind": 30524,
  "pubkey": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
  "created_at": 1709740800,
  "tags": [
    ["d", "tx_abc123:response:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555"],
    ["p", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"],
    ["domain", "plumbing"],
    ["task_id", "tx_abc123"]
  ],
  "content": "The soil pipe behind the wall was cracked — I showed the customer before starting and they agreed to the additional work.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

## Relationship to Existing NIPs

Complements [NIP-58](https://github.com/nostr-protocol/nips/blob/master/58.md) (Badges) — NIP-58 provides static credentials ("You hold this certification"); NIP-REPUTATION provides dynamic transactional ratings ("How well you performed this job"). Together they create a two-layer trust signal: credentials plus transaction history. Uses [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md) (Contact Lists) for social-graph-weighted reputation scoring.

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md): Contact lists (social distance weighting)
* [NIP-32](https://github.com/nostr-protocol/nips/blob/master/32.md): Labelling (category classification)
* [NIP-58](https://github.com/nostr-protocol/nips/blob/master/58.md): Badges (credential compatibility)

## Relationship to TROTT-00 Patterns

NIP-REPUTATION is a standalone NIP. Within the TROTT protocol, reputation composes with other TROTT-00 patterns:

- **P5 (Evidence Recording)** — Activity evidence (`kind:30523`) and evidence records (`kind:30578`) complement subjective ratings with objective, timestamped facts. Applications can weight ratings higher when backed by P5 evidence.
- **P1 (Approval Gate)** — Credential attestations (`kind:31000`) can be gated behind an approval process (`kind:30570`), ensuring credentials are reviewed before publication.

These compositions are optional. NIP-REPUTATION works without any TROTT-00 patterns.

## Reference Implementation

The `@trott/sdk` (TypeScript SDK) provides builders and parsers for all five kinds defined in this NIP. For standalone use without TROTT, implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing and NIP-02 contact list queries.
2. A scoring engine that weights ratings by stake, social distance, and recency.
3. Verification logic that checks the `e` tag on `kind:30520` ratings references a valid completion event.
