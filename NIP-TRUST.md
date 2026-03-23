NIP-TRUST
==========

Portable Trust Networks
------------------------

`draft` `optional`

Six addressable event kinds for personal trust relationships, shareable recommendations, provider endorsements, collectives, and block lists on Nostr.

> **Standalone usability:** This NIP works independently on any Nostr application. Within the [TROTT protocol](https://github.com/forgesworn/nip-drafts) (v0.9), these kinds are defined in TROTT-10: Trusted Networks. TROTT extends them with trusted follower location sharing (`kind:20503`), operator-managed trust configuration, and domain-specific trust weighting — but adoption of TROTT is not required.

## Motivation

Trust relationships form organically through repeated interactions, yet no Nostr protocol standardises how these relationships are expressed, shared, or discovered across applications. NIP-02 contact lists are binary (follow/don't follow) with no category scoping, ratings, or reasons. Users who find a trusted plumber, cleaner, or freelancer have no portable way to maintain that trust relationship across clients, share it with friends, or discover new providers through existing trust networks.

This NIP elevates trust relationships to first-class protocol primitives:

- **Personal trust is portable** — follows the user's Nostr keypair across clients
- **Word-of-mouth discovery** — shareable recommendation lists via deep links or NIP-44 messages
- **Cold-start solved** — provider-to-provider endorsements create trust bridges for new providers
- **Provider collectives** — groups of providers coordinate under a shared identity
- **Social graph discovery** — existing data (NIP-02 contact lists, `kind:30512` trust lists, `kind:30517` endorsements) surfaces trust signals with no new infrastructure

## Kinds

| kind  | description             |
| ----- | ----------------------- |
| 30512 | Trusted Provider List   |
| 30513 | Shareable Recommendations |
| 30515 | Trust Revocation        |
| 30517 | Provider Endorsement    |
| 30518 | Provider Collective     |
| 30519 | Block List              |

---

## Kind 30512: Trusted Provider List

A user's personal list of preferred providers, with per-entry category and trust rating. Addressable event — publishing a new version replaces the previous list entirely.

```json
{
    "kind": 30512,
    "pubkey": "<user-hex-pubkey>",
    "created_at": 1698700000,
    "tags": [
        ["d", "<user-hex-pubkey>_trusted_providers"],
        ["p", "<provider-1-pubkey>", "plumbing", "5", "personal_experience"],
        ["p", "<provider-2-pubkey>", "cleaning", "4", "recommendation"],
        ["p", "<provider-3-pubkey>", "plumbing", "4", "personal_experience", "1742000000"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Each `p` tag carries positional metadata:

| Position | Description | Required |
| -------- | ----------- | -------- |
| 1 | Provider's hex pubkey | Yes |
| 2 | Category for which this provider is trusted | Yes |
| 3 | Personal trust rating (1–5) | Yes |
| 4 | Trust reason | No |
| 5 | Expiration (Unix timestamp) | No |

Tags:

* `d` (REQUIRED): Unique identifier. Recommended format: `<pubkey>_trusted_providers`.
* `p` (REQUIRED, one or more): Provider entries with category, rating, and optional reason/expiration.

### Trust Reasons

| Value | Description |
| ----- | ----------- |
| `personal_experience` | Trust earned through direct interaction (default if omitted) |
| `recommendation` | Imported from a `kind:30513` shareable recommendation |
| `social_proof` | Added because multiple contacts trust this provider |

### Time-Bound Trust

Position 5 carries an optional expiration timestamp. When the current time exceeds this value, the trust entry has lapsed. Clients MUST NOT treat expired entries as active trust. This supports trial periods — trust a new provider for a fixed window and decide later whether to make it permanent.

### Category-Scoped Entries

A provider MAY appear multiple times with different categories. Each entry is independent — ratings, reasons, and expirations MAY differ per category. A provider trusted at 5 for plumbing may be trusted at 3 for electrical work.

### REQ Filters

```json
[
    {"kinds": [30512], "authors": ["<user-pubkey>"], "limit": 1},
    {"kinds": [30512], "#p": ["<provider-pubkey>"]}
]
```

---

## Kind 30513: Shareable Recommendations

Word-of-mouth provider recommendations. A user publishes a curated list that others can discover and import into their own `kind:30512` trusted list.

Two visibility modes:

- **`public`** — visible to anyone, shareable via link. "Here are my 5 trusted cleaners."
- **`private`** — NIP-44 encrypted to specific recipients. "Here are my babysitters, sharing with my sister."

```json
{
    "kind": 30513,
    "tags": [
        ["d", "my-london-plumbers"],
        ["domain", "plumbing"],
        ["visibility", "public"],
        ["p", "<provider-1-pubkey>", "plumbing", "5"],
        ["p", "<provider-2-pubkey>", "plumbing", "4"],
        ["expiration", "1742000000"]
    ],
    "content": "Plumbers I've used and trust. All South London, all reasonable prices.",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Required tags:

* `d` (MUST): Unique list identifier (slug).
* `domain` (MUST): Target category for this recommendation list.
* `visibility` (MUST): `public` or `private`.
* `p` (MUST, at least one): Recommended providers with category and rating.

Optional tags:

* `expiration`: NIP-40 timestamp — auto-expire the recommendation list.
* `p` (recipient): For private mode, `["p", "<recipient-pubkey>", "recipient"]`.

### Import Flow

1. App displays the recommendation with provider profiles (fetched from `kind:30510`).
2. User selects which providers to import (explicit action REQUIRED — no automatic trust injection).
3. App adds selected providers to user's `kind:30512` with reason `recommendation`.

### REQ Filters

NIP-01 defines subscription filters for single-letter tag names only. Multi-letter tags (`domain`, `visibility`) are client-side metadata — not relay-indexed. Fetch all recommendations and post-filter client-side:

```json
{"kinds": [30513]}
```

---

## Kind 30515: Trust Revocation

Explicit trust removal with reason-tiered visibility. Provides an audit trail and notification. Addressable — each revocation uses a unique `d` value.

```json
{
    "kind": 30515,
    "created_at": 1708300800,
    "tags": [
        ["d", "<revoker-pubkey>:<revoked-pubkey>:plumbing:1708300800"],
        ["p", "<revoked-pubkey>"],
        ["domain", "plumbing"],
        ["reason_code", "quality_decline"],
        ["e", "<kind-30512-event-id>"]
    ],
    "content": "<NIP-44 encrypted to coordinator(s): 'Quality dropped significantly over last 3 jobs.'>",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Required tags:

* `d` (MUST): Unique revocation identifier.
* `p` (MUST): Revoked party's hex pubkey.
* `domain` (MUST): Category context.
* `reason_code` (MUST): One of the defined codes.

Optional tags:

* `e` (OPTIONAL): Reference to the `kind:30512` event the revocation applies to.

### Reason Codes

| Code | Visibility | Notification |
| ---- | ---------- | ------------ |
| `safety_concern` | Coordinators + safety contacts | NIP-17 to revoked party (code only, NOT free-text) |
| `no_show` | Coordinators | NIP-17 to revoked party (code only) |
| `quality_decline` | Coordinators | NIP-17 to revoked party (code only) |
| `personal_preference` | Revoked party only | NIP-17 with reason code |
| `moved_area` | Revoked party only | NIP-17 with reason code |
| `inactive` | Silent | No notification |

Content encryption: For safety/quality codes, content MUST be NIP-44 encrypted to relevant coordinators. The revoked party receives only the reason code via NIP-17, never the free-text — preventing retaliation while giving signal.

---

## Kind 30517: Provider Endorsement

Provider-to-provider vouching. Experienced providers endorse newer providers, solving the cold-start problem. Addressable — each endorser can publish at most one endorsement per endorsed provider per category.

```json
{
    "kind": 30517,
    "tags": [
        ["d", "<endorser-pubkey>:<endorsed-pubkey>:plumbing"],
        ["p", "<endorsed-pubkey>"],
        ["domain", "plumbing"],
        ["endorsement_type", "skill"],
        ["e", "<endorser-kind-30510-profile>"]
    ],
    "content": "Worked alongside Mo for 3 years. Solid work, reliable, always on time.",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Endorsement Types

| Type | Meaning |
| ---- | ------- |
| `skill` | "They're good at the job" — competence |
| `reliability` | "They show up and follow through" — dependable |
| `safety` | "I'd trust them in my home" — trustworthy in sensitive contexts |
| `general` | Broad endorsement, no specific category |

Required tags:

* `d` (MUST): Unique identifier. Recommended format: `<endorser-pubkey>:<endorsed-pubkey>:<category>`.
* `p` (MUST): Endorsed provider's hex pubkey.
* `domain` (MUST): Category context.
* `endorsement_type` (MUST): One of the defined types.

Optional tags:

* `e` (OPTIONAL): Reference to the endorser's `kind:30510` profile.
* `expiration` (OPTIONAL): NIP-40 timestamp — forces periodic re-endorsement.

### Weighting

Apps SHOULD weight endorsements by the endorser's track record:

- **Completed tasks** — an endorser with 500 completed tasks carries more weight than one with 5. Zero-history endorser = zero weight (primary Sybil defense).
- **Ratings** — higher-rated endorsers carry more weight.
- **Category relevance** — same-category endorsements carry full weight; cross-category MAY be weighted at 50%.

### Withdrawal

Retract by publishing a new `kind:30517` with the same `d` tag and empty content. Apps MUST treat empty content as retracted.

---

## Kind 30518: Provider Collective

A group of providers sharing clients and coordinating under a common identity. Solves the single-provider availability problem.

```json
{
    "kind": 30518,
    "tags": [
        ["d", "south-london-emergency-plumbers"],
        ["domain", "plumbing"],
        ["name", "South London Emergency Plumbers"],
        ["p", "<founder-pubkey>", "admin"],
        ["p", "<member-2-pubkey>", "admin"],
        ["p", "<member-3-pubkey>", "member"],
        ["p", "<member-4-pubkey>", "member"],
        ["coverage", "gcpuu"],
        ["coverage", "gcpuv"]
    ],
    "content": "24/7 emergency plumbing across South London. All background-checked and insured.",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Roles

| Role | Permissions |
| ---- | ----------- |
| `admin` | Add/remove members, manage collective profile, delegate admin |
| `member` | Accept tasks from collective's shared clients, publish availability under collective identity |

Required tags:

* `d` (MUST): Unique collective identifier (slug).
* `domain` (MUST, one or more): Service categories the collective covers.
* `name` (MUST): Human-readable collective name.
* `p` (MUST, at least one with `admin` role): Member entries with role.

Optional tags:

* `coverage` (OPTIONAL, one or more): Geohash cells where the collective operates.
* `expiration` (OPTIONAL): NIP-40 timestamp.

### Trusting a Collective

Users add a `collective` tag to their `kind:30512`:

```json
["collective", "<collective_d_tag>", "<category>", "<rating>", "<reason>", "<expiration>"]
```

Example:

```json
["collective", "south-london-emergency-plumbers", "plumbing", "5"]
```

Positions match the `p` tag format defined above:

| Position | Description | Required |
| -------- | ----------- | -------- |
| 1 | Collective's `d` tag identifier | Yes |
| 2 | Category for which this collective is trusted | Yes |
| 3 | Personal trust rating (1–5) | Yes |
| 4 | Trust reason | No |
| 5 | Expiration (Unix timestamp) | No |

Any member of the trusted collective can then serve the user.

### Individual Reputation Preserved

Members keep their own ratings and profiles. The collective is a coordination layer, not a replacement for individual identity.

---

## Kind 30519: Block List

A private, self-encrypted list of blocked counterparties. Blocked parties are never notified.

```json
{
    "kind": 30519,
    "tags": [
        ["d", "block-list"],
        ["encrypted", "nip44-self"]
    ],
    "content": "<NIP-44 self-encrypted JSON>",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

Required tags:

* `d` (MUST): `block-list` for cross-category, `block-list:<category>` for category-scoped.
* `encrypted` (MUST): `nip44-self`.

**Privacy:** Blocked pubkeys MUST NOT appear in tags. They are stored exclusively in the encrypted content to prevent metadata leakage.

### Encrypted Content

```json
{
    "blocked": [
        {
            "pubkey": "<hex-pubkey>",
            "blockedAt": 1708444800,
            "reason": "no_show",
            "note": "Three no-shows in a row"
        }
    ],
    "updatedAt": 1708531200
}
```

### Reason Codes

| Code | Description |
| ---- | ----------- |
| `safety` | Felt unsafe, aggressive behaviour |
| `no_show` | Repeated no-shows |
| `harassment` | Unwanted contact |
| `fraud` | Payment disputes, fraudulent claims |
| `other` | Free-text note explains |

### Behavioural Rules

1. Apps SHOULD filter incoming requests and offers against the block list before presenting them.
2. Blocking is silent — no notification is sent.
3. Cross-category blocks (`block-list`) block across all categories.
4. Category-scoped blocks (`block-list:<category>`) apply to that category only.
5. Cross-category blocks take precedence over category-scoped blocks.

---

## Social Graph Discovery

These event kinds enable a trust discovery algorithm using existing Nostr data:

| Tier | Source | Priority |
| ---- | ------ | -------- |
| 1 | Providers in user's `kind:30512` trusted list | Highest |
| 2 | Providers in user's NIP-02 follow list (`kind:3`) | High |
| 3 | Providers endorsed (`kind:30517`) by Tier 1 providers | Medium |
| 4 | Providers followed by user's follows (2-hop web of trust) | Low |
| 5 | Any available provider meeting minimum criteria | Default fallback |

Apps SHOULD present the trust tier alongside provider listings so users understand the source of trust.

---

## Sybil Resistance Properties

NIP-TRUST provides structural sybil resistance through several mechanisms:

### Endorsement Cost
Creating a provider endorsement (kind:30517) requires an existing keypair with reputation history. An attacker must either:
- Build genuine reputation over time (expensive)
- Compromise an existing trusted keypair (difficult)
- Create a new keypair with no endorsement weight (ineffective)

### Collective Membership
Provider collectives (kind:30518) require approval from existing members. A sybil attacker cannot join established collectives without social verification.

### Trust Decay
Trust lists (kind:30512) are actively maintained. Stale entries lose weight in discovery algorithms. An attacker who creates fake trust relationships must continuously maintain them.

### Graph Analysis
The trust graph is public (trust lists, endorsements, collectives are all on relays). Clients can detect suspicious patterns:
- Clusters of new keypairs endorsing each other
- Trust relationships with no corresponding transaction history
- Keypairs that only endorse and never transact

### What NIP-TRUST Does NOT Prevent
- A well-resourced attacker building genuine reputation over months
- Collusion between existing trusted parties
- Social engineering of collective membership

These are inherent limits of any decentralized trust system. NIP-TRUST raises the cost of sybil attacks without requiring a central authority.

---

## Use Cases Beyond Service Providers

### Content Moderation Networks
Relay operators maintain trusted curator lists (kind:30512). Content from endorsed keypairs gets priority. New accounts must earn endorsements before their content surfaces.

### Recommendation Circles
Friends share recommendation lists — "these are the npubs whose restaurant reviews I trust." Collectives (kind:30518) become curated recommendation groups.

### Professional Endorsements
LinkedIn-style endorsements on Nostr. A developer's endorsement (kind:30517) from a known open-source maintainer carries weight. The endorsement is portable — it follows the keypair, not a platform.

### Academic Peer Review
Researchers form collectives (kind:30518) for peer review groups. Trust lists (kind:30512) track which reviewers are trusted in which domains. Endorsements signal expertise areas.

---

## Security Considerations

* **No automatic trust injection.** Importing recommendations requires explicit user action. Apps MUST NOT silently add providers to trust lists.
* **Self-encrypted block lists.** Block data is NIP-44 self-encrypted; relays cannot read who is blocked.
* **Tiered revocation visibility.** Safety-related revocations are visible to coordinators for pattern detection; personal preference revocations are private.
* **Sybil resistance for endorsements.** Apps SHOULD weight endorsements by the endorser's track record (completed tasks, ratings). Zero-history endorsers carry zero weight.
* **Expiration support.** Trust entries and endorsements support NIP-40 expiration for time-bounded relationships.

## Test Vectors

### Kind 30512 — Trusted Provider List

```json
{
  "kind": 30512,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2_trusted_providers"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", "plumbing", "5", "personal_experience"],
    ["p", "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", "cleaning", "4", "recommendation"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30513 — Shareable Recommendations

```json
{
  "kind": 30513,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "my-london-plumbers"],
    ["domain", "plumbing"],
    ["visibility", "public"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", "plumbing", "5"],
    ["p", "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", "plumbing", "4"]
  ],
  "content": "Plumbers I've used and trust. All South London, all reasonable prices.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30515 — Trust Revocation

```json
{
  "kind": 30515,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3:plumbing:1709740800"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["domain", "plumbing"],
    ["reason_code", "quality_decline"],
    ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555"]
  ],
  "content": "<NIP-44 encrypted to coordinator(s): 'Quality dropped significantly over last 3 jobs.'>",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30517 — Provider Endorsement

```json
{
  "kind": 30517,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3:plumbing"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["domain", "plumbing"],
    ["endorsement_type", "skill"],
    ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555"]
  ],
  "content": "Worked alongside Mo for 3 years. Solid work, reliable, always on time.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30518 — Provider Collective

```json
{
  "kind": 30518,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "south-london-emergency-plumbers"],
    ["domain", "plumbing"],
    ["name", "South London Emergency Plumbers"],
    ["p", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", "admin"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", "member"],
    ["coverage", "gcpuu"],
    ["coverage", "gcpuv"]
  ],
  "content": "24/7 emergency plumbing across South London. All background-checked and insured.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30519 — Block List

```json
{
  "kind": 30519,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "block-list"],
    ["encrypted", "nip44-self"]
  ],
  "content": "<NIP-44 self-encrypted JSON>",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md): Contact lists (social graph discovery)
* [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md): Deletion events (right to erasure)
* [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md): Gift wrap (private notifications)
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads

## Relationship to TROTT-10 Trusted Networks

NIP-TRUST is a standalone NIP. Within the TROTT protocol, trust networks are extended with additional capabilities:

- **TROTT-10: Trusted Networks** — Adds `kind:20503` (Trusted Follower Location) for sharing approximate location with trusted followers outside a task context, and defines operator-managed trust configuration including safety floors and auto-revocation policies. TROTT-10 also defines `kind:30514` (Trusted Network Configuration) for self-encrypted follower lists and shared-key management, and `kind:30516` (Personal Provider Presence) for NIP-44 encrypted availability and service terms visible only to approved followers. These private bilateral trust kinds are intentionally excluded from this standalone NIP as they depend on TROTT-specific infrastructure.
- **P3 (Multi-party Consensus)** — Provider collectives (`kind:30518`) can use consensus proposals (`kind:30574`) for group governance decisions (accepting new members, setting shared policies).

These extensions are optional. NIP-TRUST works without any TROTT adoption.

## Reference Implementation

The `@trott/sdk` (TypeScript SDK) provides builders and parsers for all six kinds defined in this NIP. For standalone use without TROTT, implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing and NIP-02 contact list queries.
2. A NIP-44 encryption library for self-encrypting block lists and private presence data.
3. Social graph traversal logic implementing the 5-tier discovery algorithm described above.
