NIP-EVIDENCE
============

Timestamped Evidence Recording
--------------------------------

`draft` `optional`

One event kind for recording signed, timestamped facts on Nostr — any participant can publish an immutable evidence record with optional file attachments and cryptographic integrity verification. Evidence records capture both proof of delivery (work completed, services rendered) and proof of accomplishment (certifications earned, milestones achieved, portfolio artefacts created).

> **Design principle:** Evidence records are append-only facts. Each record is independently verifiable via its cryptographic signature and optional file hash. They do not enforce truth — they record claims with provable authorship and timing.

> **Standalone.** This NIP works independently on any Nostr application.

## Motivation

Nostr events are inherently signed and timestamped, but there is no standard kind dedicated to **recording facts for later verification**. Many workflows need an immutable audit trail:

- **Attestations** — a professional attests to a finding or measurement
- **Notarisation** — timestamped proof that a document existed at a certain time
- **Proof-of-existence** — recording that a file, measurement, or observation was made at a specific time and place
- **Compliance records** — inspection findings, safety observations, environmental readings
- **Progress documentation** — photographic evidence of work milestones
- **Accomplishment records** — certifications earned, courses completed, skills demonstrated, portfolio artefacts
- **Learning portfolios** — signed, timestamped artefacts documenting what was learned, created, or achieved

NIP-01 events provide signatures and timestamps, but applications need a dedicated kind with structured metadata (evidence type, file hashes, geolocation, capture time) to build interoperable evidence systems. NIP-EVIDENCE fills this gap with a minimal, append-only evidence primitive.

## Relationship to Existing NIPs

- **"Every Nostr event is already timestamped evidence."** True, but NIP-EVIDENCE adds structured metadata (evidence type, file hash, capture timestamp, geolocation, condition grade) that enables interoperable evidence systems. A kind 1 note with a SHA-256 hash in the text is human-readable but not machine-parseable. A kind 30578 evidence record with `evidence_type`, `file_hash`, `captured_at`, and `g` tags is filterable, verifiable, and composable with other NIPs.
- **NIP-03 (OpenTimestamps):** NIP-03 proves that an event existed at a given time. NIP-EVIDENCE adds structured metadata about what was captured, where, when, and under what conditions. NIP-03 could complement NIP-EVIDENCE (timestamp an evidence record for additional assurance) but does not replace it.
- **NIP-CUSTODY (kind 30572):** Custody evidence is recorded as kind 30578 events with custody-specific tags (`evidence_type: custody_inspection`, `custody_handoff_ref`, `condition_grade`, `asset_id`). The `e` tag references the custody transfer event, and `custody_handoff_ref` links evidence to a specific leg in a multi-leg chain. See the [NIP-CUSTODY](./NIP-CUSTODY.md) composing section for full details and examples.
- **NIP-94 (File Metadata):** NIP-94 covers file hashing and media metadata but not evidence context: capture conditions, geolocation at time of capture, evidence type classification, or chain linkage to related events.

### Relationship to NIP-94

NIP-94 (File Metadata) describes file properties (hash, dimensions, MIME type). NIP-EVIDENCE records the context in which evidence was captured: who observed what, when, where, under what conditions. A photo evidence record MAY reference a NIP-94 file metadata event for the image file itself. The two NIPs are complementary: NIP-94 answers "what is this file?", while NIP-EVIDENCE answers "why was this file captured, by whom, and what does it prove?"

## Kinds

| kind  | description      |
| ----- | ---------------- |
| 30578 | Evidence Record  |

Kind 30578 is an addressable event (NIP-01) but uses the **append-only pattern** — each record gets a unique `d` tag value (incorporating a sequence number) so the relay stores every record rather than replacing previous ones. Evidence records represent immutable facts that MUST NOT be overwritten.

---

## Evidence Record (`kind:30578`)

Published by any participant to record a signed, timestamped fact. Each record gets a unique `d` tag value.

```json
{
    "kind": 30578,
    "pubkey": "<author-hex-pubkey>",
    "created_at": 1698770000,
    "tags": [
        ["d", "property_inspection_42:evidence:finding_01"],
        ["alt", "Evidence record: inspection finding for property_inspection_42"],
        ["t", "evidence-record"],
        ["evidence_type", "inspection"],
        ["captured_at", "1698769800"],
        ["g", "gcpuuz"],
        ["file_hash", "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"],
        ["ref", "INSP-2026-0099", "inspection_report"],
        ["p", "<interested-party-hex-pubkey>"]
    ],
    "content": "Fire door on Level 3 corridor B fails self-closing test. Gap exceeds 3mm threshold. Remediation required before certificate issuance.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<context_id>:evidence:<sequence>`. Unique per record (append-only).
* `t` (REQUIRED): Protocol family marker. MUST be `"evidence-record"`.
* `evidence_type` (REQUIRED): Category of evidence. The value is application-defined. Core examples: `photo`, `document`, `video`. Applications MAY define domain-specific evidence types such as `inspection`, `measurement`, `observation`, `certification`, `accomplishment`, `portfolio`, `reading`.
* `captured_at` (RECOMMENDED): Unix timestamp when the evidence was captured. May differ from `created_at` if the record is published later.
* `g` (RECOMMENDED): Geohash of the location where the evidence was captured.
* `file_hash` (RECOMMENDED): `sha256:<hex>` hash of any attached file. Consumers MUST verify the hash before trusting the evidence content.
* `p` (RECOMMENDED): Other parties to notify.
* `e` (OPTIONAL): Event ID of a related event (e.g. the request that prompted the inspection).
* `ref` (OPTIONAL): External reference (inspection report number, certificate ID, document reference).
* `mime_type` (OPTIONAL): MIME type of the evidence file.
* `expiration` (OPTIONAL): Unix timestamp — evidence expiry (NIP-40). Useful for time-limited certificates.

**Content:** Plain text description of the evidence, or NIP-44 encrypted JSON with structured data and/or file URLs. For file-based evidence, content SHOULD include the file URL. Example encrypted content: `{"url": "https://cdn.example.com/evidence/photo.jpg", "thumbnail_url": "https://cdn.example.com/evidence/photo_thumb.jpg"}`.

---

## Protocol Flow

```
  Author                         Relay                     Interested Parties
      |                            |                            |
      |-- kind:30578 Evidence ---->|                            |
      |  (evidence_type: inspection|                            |
      |   file_hash: sha256:...)   |------- notification ------>|
      |                            |                            |
      |-- kind:30578 Evidence ---->|  (additional finding)      |
      |  (evidence_type: photo)    |------- notification ------>|
      |                            |                            |
      |-- kind:30578 Evidence ---->|  (another finding)         |
      |  (evidence_type: measurement)                           |
      |                            |------- notification ------>|
      |                            |                            |
      |  Immutable audit trail     |                            |
      |  recorded on relays        |                            |
```

1. **Recording:** Any participant publishes `kind:30578` events to record facts. Each record gets a unique `d` tag value (append-only).
2. **Verification:** Interested parties verify the author's signature, check `file_hash` integrity for any attached files, and cross-reference `captured_at` with `created_at` for timing consistency.
3. **Accumulation:** Additional evidence is published as new `kind:30578` events — never by overwriting existing records.
4. **Discovery:** Clients discover evidence via the `t` tag (`evidence-record`) and optionally filter by `evidence_type`, geohash (`g`), or related event (`e` tag).

## Append-Only Semantics

Evidence records are semantically append-only. Although Kind 30578 is an addressable event (and relays MAY accept replacements if the `d` tag were reused), each record MUST use a unique `d` tag value. Clients MUST treat each evidence record as immutable; once published, it represents a claimed fact at a specific point in time.

### REQ Filters

```json
// All evidence records by a specific author
{"kinds": [30578], "authors": ["<author_pubkey>"]}

// All evidence linked to a specific event (e.g. a task or custody transfer)
{"kinds": [30578], "#e": ["<related_event_id>"]}

// All evidence records with a specific protocol family tag
{"kinds": [30578], "#t": ["evidence-record"]}

// All evidence in a geographic area (geohash prefix)
{"kinds": [30578], "#g": ["gcpu"]}
```

> **Note:** Filters on multi-letter tags (e.g. `#evidence_type`, `#condition_grade`) are not supported by relay-side `REQ` filtering. Clients MUST apply these filters locally after fetching events via the single-letter tag filters shown above.

## Use Cases

### Proof-of-Existence for Documents

A notarisation service can publish `kind:30578` events with the `file_hash` of a document, creating a timestamped, signed proof that the document existed at a specific time. The Nostr event's `created_at` and the author's signature serve as the proof — no external timestamping authority is needed beyond the relay.

### Professional Attestations

Professionals (inspectors, surveyors, auditors, medical practitioners) can publish `kind:30578` events to record their findings. The `evidence_type` tag categorises the attestation, the `ref` tag links to formal report numbers, and the cryptographic signature proves authorship. This creates a portable attestation record tied to the professional's Nostr identity.

### Environmental & IoT Readings

IoT devices and environmental sensors can publish `kind:30578` events with `evidence_type: reading` to record measurements (temperature, humidity, air quality, noise levels). The `g` tag provides location context, and `captured_at` records the precise measurement time. This creates a decentralized, signed sensor data log.

### Progress Photography

Any project requiring photographic documentation (construction progress, restoration work, agricultural monitoring) can use evidence records to build a timestamped, geolocated photo timeline. The `file_hash` tag ensures photos have not been tampered with after publication.

### Accomplishment Records

Individuals, institutions, or AI systems can publish `kind:30578` events with `evidence_type: accomplishment` or `evidence_type: portfolio` to record achievements — certifications earned, courses completed, projects finished, skills demonstrated. The `file_hash` tag can reference a certificate image, project output, or portfolio artefact. When combined with NIP-58 badges, evidence records provide the underlying proof that a badge attestation is based on.

### Custody Evidence Composition (OPTIONAL)

This section describes OPTIONAL composition with NIP-CUSTODY. Applications not using NIP-CUSTODY can ignore these tags.

NIP-CUSTODY uses kind 30578 to record asset condition at each handoff point. Custody evidence events add `custody_handoff_ref` (linking to a specific transfer in the chain), `condition_grade`, and `asset_id` tags. This enables multi-leg audit trails without a dedicated evidence kind.

```json
{
    "kind": 30578,
    "pubkey": "<custodian-hex-pubkey>",
    "created_at": 1698767100,
    "tags": [
        ["d", "parcel_042:custody:handoff_01:evidence:01"],
        ["alt", "Custody evidence: inspection for parcel_042 (good condition)"],
        ["t", "evidence-record"],
        ["e", "<custody-transfer-30572-event-id>", "wss://relay.example.com"],
        ["evidence_type", "custody_inspection"],
        ["custody_handoff_ref", "<custody-transfer-30572-event-id>"],
        ["condition_grade", "good"],
        ["asset_id", "parcel_042"],
        ["file_hash", "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"],
        ["captured_at", "1698767050"],
        ["g", "gcpuuz"],
        ["mime_type", "image/jpeg"]
    ],
    "content": "<NIP-44 encrypted JSON: {\"url\":\"https://cdn.example.com/custody/photo.jpg\"}>",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

See [NIP-CUSTODY](./NIP-CUSTODY.md) for full custody transfer details and multi-leg chain diagrams.

## Security Considerations

* **Evidence integrity.** All evidence records SHOULD include a `file_hash` tag with the SHA-256 hash of any attached file. Consumers MUST verify the hash before trusting the evidence content. Mismatched hashes indicate tampering or corruption.
* **Timestamp verification.** Clients SHOULD cross-reference `created_at` timestamps with `captured_at` on evidence events. Large discrepancies MAY indicate fabricated or backdated evidence. For high-integrity use cases, clients MAY cross-reference with relay receipt timestamps.
* **Append-only enforcement.** Although relays cannot enforce append-only semantics for addressable events, clients MUST treat each unique `d` tag as an immutable record. Applications SHOULD warn users if a record with a previously-seen `d` tag appears with different content.
* **Content encryption.** When evidence contains sensitive information (medical findings, security vulnerabilities, personal details), the `content` field SHOULD be NIP-44 encrypted to relevant parties.
* **File availability.** Evidence records reference external files via URLs in the content. File availability is not guaranteed by the Nostr event. High-integrity applications SHOULD use content-addressed storage or mirror files across multiple hosts.
* **Non-repudiation.** The combination of Nostr event signature, `created_at` timestamp, and relay storage provides non-repudiation — the author cannot deny having published the record. Applications SHOULD archive evidence events on multiple relays for durability.

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps (time-limited certificates)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads (sensitive evidence content)

## Reference Implementation

No public reference implementation exists yet. Implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing.
2. File hash computation (SHA-256) for attached evidence files.
3. Evidence discovery logic — subscribing to `kind:30578` events and filtering by `t` tag, `evidence_type`, or related event references.
