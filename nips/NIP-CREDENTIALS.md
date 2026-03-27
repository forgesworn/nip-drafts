NIP-CREDENTIALS
================

Credential Requirements and Revocation
-----------------------------------------

`draft` `optional`

Two addressable event kinds for declaring credential requirements and revoking credentials on Nostr. NIP-CREDENTIALS completes the credential lifecycle by composing with any kind 31000 event that carries a `credential_type` tag, adding the missing primitives for *requiring* credentials (gating) and *revoking* them.

> **Design principle:** Credential requirements are declarations, not enforcement. A requirement event communicates that a credential is expected for participation -- enforcement is the responsibility of the consuming application (marketplace, relay, community).

> **Standalone.** This NIP works independently on any Nostr application.

## Motivation

Nostr has NIP-58 for badges and kind 31000 for credential attestations, but neither provides a standard for **requiring** credentials before participation or **revoking** them after issuance. This creates a gap in the credential lifecycle:

- **No gating standard** -- an application that requires a professional licence, background check, or compliance certification has no machine-readable way to declare those requirements. Each application invents its own scheme.
- **No revocation standard** -- re-publishing a kind 31000 event with `["status", "revoked"]` is an ad hoc workaround, but there is no formal revocation event with a reason, effective date, or audit trail. Revocations are indistinguishable from expired credentials.

The credential lifecycle is universal across application domains:

| Phase | Existing standard | Gap |
| ----- | ----------------- | --- |
| **Issue / Attest** | Kind 31000 (`type: credential`) | -- |
| **Present / Discover** | Kind 31000 (`type: credential`) | -- |
| **Require / Gate** | *None* | **Kind 30527** |
| **Verify** | Application-level | -- |
| **Expire** | `expiration` tag on kind 31000 (NIP-40) | -- |
| **Renew** | Republish kind 31000 | -- |
| **Revoke** | *None (ad hoc workarounds)* | **Kind 30528** |

NIP-CREDENTIALS provides the two missing primitives to complete the lifecycle.

## Relationship to Existing NIPs

- **NIP-58 (Badges):** Badges are display-oriented awards designed for profile decoration. They carry no mandatory/optional semantics, no structured gating rules, and no revocation lifecycle. A badge says "you earned this"; a credential requirement says "you must hold this to participate, or you are ineligible."
- **NIP-32 (Labelling):** Labels are regular events (kind 1985) with no addressability per subject, no per-label revocation, and no structured requirement definitions. Credential requirements need addressable semantics to allow authorities to update requirements over time.
- **NIP-51 (Lists):** Lists could model sets of required credentials, but they lack typed claims, mandatory/optional semantics, and expiration. A list of pubkeys is not a credential policy.

## Kinds

| kind  | description              |
| ----- | ------------------------ |
| 30527 | Credential Requirement   |
| 30528 | Credential Revocation    |

> Kinds 30527-30528 -- previously 30402-30403, reassigned to avoid conflict with NIP-99 (Classified Listings).

Kind 30527 is an addressable event (NIP-01) -- the publisher can update requirements by republishing with the same `d` tag.

Kind 30528 is an addressable event using the **append-only pattern** -- each revocation gets a unique `d` tag value so the relay stores every revocation rather than replacing previous ones. Revocations represent immutable facts and MUST NOT be overwritten.

---

## Credential Requirement (`kind:30527`)

Published by a context owner (marketplace, relay operator, community moderator) to declare what credentials are required for participation. Requirements are addressable -- the publisher can update them as regulations change.

The `credential_type` tag value is application-defined. Applications choose credential types relevant to their domain. This NIP does not prescribe a fixed vocabulary.

### Core Tags

* `d` (REQUIRED): Addressable event identifier. Format is application-defined but SHOULD be descriptive (e.g. `<context>:requirement:<slug>`).
* `t` (REQUIRED): Protocol family marker. MUST be `"credential-requirement"`.
* `credential_type` (REQUIRED): Machine-readable credential type that must be held. Application-defined string value.
* `mandatory` (REQUIRED): Boolean string (`"true"` or `"false"`). Whether the credential is mandatory for participation or merely recommended.
* `credential_name` (RECOMMENDED): Human-readable name of the required credential (e.g. "Medical Licence", "SOC 2 Compliance", "DBS Enhanced Check").
* `description` (RECOMMENDED): Human-readable explanation of why this credential is required and what it covers.
* `jurisdiction` (OPTIONAL): ISO 3166-1 alpha-2 country code or ISO 3166-2 region code where this requirement applies (e.g. `GB`, `US-CA`, `DE`).
* `p` (OPTIONAL): Additional parties to notify of the requirement.
* `e` (OPTIONAL): Event ID of a related context event (e.g. a task announcement or service catalogue entry).
* `expiration` (OPTIONAL): Unix timestamp -- requirement expiry (NIP-40). Useful for time-limited regulatory requirements.

**Content:** Plain text or NIP-44 encrypted JSON providing detailed guidance on how to obtain the credential, links to the issuing authority, or application-specific instructions.

### Application-Level Extensions

Applications MAY extend Kind 30527 events with additional tags to suit their domain. These tags are not part of the core protocol but provide useful patterns for common needs:

* `domain` -- Service domain or category this requirement applies to. Enables domain-scoped filtering.
* `verification_policy` -- When verification must occur. Suggested values: `pre_engagement`, `pre_commencement`, `periodic`, `on_demand`.
* `credential_id_pattern` -- Regex pattern for validating credential identifiers (e.g. `^[0-9]{6}$` for a six-digit registration number).
* `renewal_period_days` -- Maximum age in days before a credential must be renewed.

Issuer trust levels are an application concern. Applications MAY define their own trust hierarchies based on their domain requirements (e.g. distinguishing between self-declared credentials, peer endorsements, and authority-issued credentials).

### Example Credential Types

The following are non-normative examples of `credential_type` values across different domains:

| Domain | Example `credential_type` | Description |
| ------ | ------------------------- | ----------- |
| Trades | `professional_licence` | Regulatory registration (e.g. Gas Safe, NICEIC) |
| Trades | `insurance` | Public liability or professional indemnity cover |
| Healthcare | `medical_licence` | Medical practitioner registration (e.g. GMC, state medical board) |
| Healthcare | `board_certification` | Speciality board certification |
| Software | `security_clearance` | Government or industry security clearance |
| Software | `compliance_certification` | Compliance framework certification (e.g. SOC 2, ISO 27001) |
| Education | `teaching_qualification` | Qualified teacher status or equivalent |
| Education | `safeguarding` | Safeguarding or background check certification (e.g. DBS, state background check) |
| General | `background_check` | Criminal record check or vetting certificate |
| General | `certification` | Industry or professional body certification |
| General | `training` | Completed training programme |
| General | `peer_endorsement` | Attestation from a peer or colleague |
| General | `self_declared` | Unverified self-declaration |

Applications are free to define credential types beyond this list.

### Multiple Requirements

A context owner MAY publish multiple Kind 30527 events with different `d` tags to declare multiple credential requirements. For example, a healthcare platform might require both a medical licence and malpractice insurance:

```json
// Requirement 1: Medical Licence
["d", "telehealth_platform:requirement:medical_licence"]
["credential_type", "medical_licence"]
["mandatory", "true"]

// Requirement 2: Insurance
["d", "telehealth_platform:requirement:malpractice_insurance"]
["credential_type", "insurance"]
["mandatory", "true"]
```

Applications SHOULD evaluate all requirements for a context and display the participant's compliance status against each one.

---

## Credential Revocation (`kind:30528`)

Published by an issuer, operator, or regulatory authority to explicitly revoke a previously valid credential. Each revocation is an immutable record with a unique `d` tag value (append-only). Revocations cannot be undone; if a credential is later reinstated, a new kind 31000 attestation MUST be published.

```json
{
    "kind": 30528,
    "pubkey": "<issuer-hex-pubkey>",
    "created_at": 1698800000,
    "tags": [
        ["d", "<subject-pubkey>:revocation:medical_licence:1698800000"],
        ["alt", "Credential revocation: Medical Licence (disciplinary)"],
        ["t", "credential-revocation"],
        ["e", "<credential-attestation-event-id>", "<relay-hint>", "31000"],
        ["p", "<credential-holder-pubkey>"],
        ["credential_type", "medical_licence"],
        ["credential_name", "Medical Licence"],
        ["credential_id", "GMC-7654321"],
        ["revocation_reason", "disciplinary"],
        ["effective_date", "2024-10-31"],
        ["revocation_details", "Registration suspended following fitness to practise tribunal"]
    ],
    "content": "",
    // other fields...
}
```

Tags:

* `d` (REQUIRED): Format `<subject_pubkey>:revocation:<credential_type_slug>:<timestamp>`. Unique per revocation (append-only). The timestamp component ensures multiple revocations for the same credential type are preserved.
* `t` (REQUIRED): Protocol family marker. MUST be `"credential-revocation"`.
* `e` (REQUIRED): Event reference to the kind 31000 credential attestation being revoked. Format: `["e", "<event-id>", "<relay-hint>", "31000"]`.
* `p` (REQUIRED): Pubkey of the credential holder whose credential is being revoked.
* `credential_type` (REQUIRED): Machine-readable type of the credential being revoked. MUST match the `credential_type` on the referenced kind 31000 event.
* `revocation_reason` (REQUIRED): Reason for revocation. One of `expired` (natural expiry, explicitly recorded), `disciplinary` (conduct-related suspension or removal), `superseded` (replaced by an updated credential), `voluntary` (holder voluntarily surrendered), `fraud` (credential obtained fraudulently), `regulatory` (regulatory or legal requirement), `error` (issued in error).
* `effective_date` (REQUIRED): ISO 8601 date when the revocation takes effect (e.g. `2024-10-31`). MAY be in the future for advance notice of revocation.
* `credential_name` (RECOMMENDED): Human-readable name of the revoked credential.
* `credential_id` (RECOMMENDED): External identifier of the revoked credential (licence number, certificate ID).
* `revocation_details` (OPTIONAL): Human-readable explanation providing additional context.
* `reinstatement_eligible` (OPTIONAL): Boolean string (`"true"` or `"false"`). Whether the holder may apply for reinstatement.
* `reinstatement_conditions` (OPTIONAL): Plain text description of conditions for reinstatement (e.g. "Complete retraining programme and pass reassessment").
* `ref` (OPTIONAL): External reference (case number, disciplinary hearing reference).

**Content:** Plain text or NIP-44 encrypted JSON with detailed revocation information. SHOULD be encrypted when the revocation involves sensitive personal details.

### Revocation Authority

Only the original issuer or a recognised authority SHOULD publish revocation events. Applications MUST verify that the `pubkey` on a Kind 30528 event is authorised to revoke the referenced credential. Verification strategies include:

1. **Issuer match** -- the revoker's pubkey matches the `pubkey` on the referenced kind 31000 attestation.
2. **Trusted authority list** -- the application maintains a list of pubkeys authorised to revoke credentials for a given `credential_type`.

Applications SHOULD reject revocations from unrecognised pubkeys.

---

## Protocol Flow

```
  Context Owner             Relay              Participant          Issuer
      |                       |                    |                   |
      |-- kind:30527 -------->|                    |                   |
      |  (requirement:        |                    |                   |
      |   medical_licence,    |                    |                   |
      |   mandatory)          |                    |                   |
      |                       |                    |                   |
      |                       |<-- kind:31000 -----|                   |
      |                       |  (attestation:     |                   |
      |                       |   medical_licence) |<-- kind:31000 ---|
      |                       |                    |  (issued by      |
      |                       |                    |   medical board) |
      |                       |                    |                   |
      |   Application checks: |                    |                   |
      |   credential type matches ✓                 |                   |
      |   credential not expired ✓                  |                   |
      |   no kind:30528 revocation ✓                |                   |
      |   → Participant eligible |                  |                   |
      |                       |                    |                   |
      |                       |                    |   (later...)      |
      |                       |<--------------------------------- kind:30528
      |                       |                    |  (revocation:     |
      |                       |                    |   disciplinary)   |
      |                       |                    |                   |
      |   Application checks: |                    |                   |
      |   revocation exists ✗  |                    |                   |
      |   → Participant ineligible                  |                   |
```

### Verification Algorithm

Applications verifying a participant's eligibility against credential requirements SHOULD follow this algorithm:

1. **Discover requirements** -- subscribe to `kind:30527` events for the relevant context.
2. **Discover credentials** -- subscribe to `kind:31000` events for the participant's pubkey, filtered by `credential_type`.
3. **Check expiry** -- verify that the credential's `expiration` tag (if present) is in the future, or that the credential has no expiry.
4. **Check revocation** -- subscribe to `kind:30528` events referencing the credential's event ID. If any revocation exists with an `effective_date` in the past, the credential is invalid.
5. **Evaluate mandatory status** -- if `mandatory = "true"` and the credential is missing, expired, or revoked, the participant is ineligible.

Applications MAY add additional verification steps (e.g. checking issuer trust, validating credential IDs against external registries) as appropriate for their domain.

The following diagram illustrates the verification decision tree:

```mermaid
flowchart TD
    classDef green fill:#1b3d2d,stroke:#16c79a,color:#f0f0f0
    classDef yellow fill:#2d2d1b,stroke:#f5a623,color:#f0f0f0
    classDef blue fill:#1b2d3d,stroke:#0f3460,color:#f0f0f0
    classDef red fill:#3d1b1b,stroke:#e94560,color:#f0f0f0

    START([Participant requests<br/>to participate]):::blue
    REQ[Discover kind:30527<br/>requirements for context]:::blue
    CRED[Discover kind:31000<br/>credentials for participant]:::blue

    START --> REQ --> CRED

    MANDATORY{Is credential<br/>mandatory?}:::yellow
    CRED --> MANDATORY

    MANDATORY -- "No" --> RECOMMEND([Display as<br/>recommended]):::green

    MANDATORY -- "Yes" --> HAS_CRED{Does participant hold<br/>matching credential?}:::yellow
    HAS_CRED -- "No" --> INELIGIBLE([Ineligible:<br/>credential missing]):::red

    HAS_CRED -- "Yes" --> EXPIRY{Credential<br/>expired?}:::yellow
    EXPIRY -- "Yes" --> INELIGIBLE3([Ineligible:<br/>credential expired]):::red

    EXPIRY -- "No" --> REVOKED{Any kind:30528<br/>revocation with past<br/>effective_date?}:::yellow
    REVOKED -- "Yes" --> INELIGIBLE4([Ineligible:<br/>credential revoked]):::red

    REVOKED -- "No" --> ELIGIBLE([Eligible]):::green
```

### REQ Filters

```json
// All credential requirements for a context owner
{"kinds": [30527], "authors": ["<context-owner-pubkey>"]}

// All credentials held by a participant
{"kinds": [31000], "#p": ["<participant-pubkey>"]}

// All revocations for a participant
{"kinds": [30528], "#p": ["<participant-pubkey>"]}

// Revocations for a specific credential attestation
{"kinds": [30528], "#e": ["<credential-attestation-event-id>"]}
```

> **Note:** Filters using multi-letter tag names (e.g. `#credential_type`, `#revocation_reason`) are not supported by relay-side `REQ` filtering. Clients MUST apply these filters locally after fetching events via the single-letter tag filters shown above.

## Use Cases

### Marketplace Access Control

Any Nostr marketplace can use Kind 30527 to declare entry requirements. A freelance platform might require professional indemnity insurance; a food delivery marketplace might require food hygiene certification. Participants present their kind 31000 attestations, and the marketplace verifies compliance before listing them.

### Community Gating

Nostr communities (NIP-72) can gate membership on credentials. A medical professionals' community might require medical board registration. A legal community might require bar admission. The community moderator publishes Kind 30527 requirements, and applicants present their kind 31000 attestations.

### Relay Access Policies

Relay operators can use Kind 30527 to declare that certain event kinds require credential verification. For example, a relay specialising in financial advice might require regulatory authorisation before accepting Kind 30023 long-form content on financial topics.

### Software Development

A code review platform might require SOC 2 compliance certification or a security clearance before granting access to sensitive repositories. An open-source project might require a contributor licence agreement (CLA) attestation before accepting pull requests.

### Education and Training

An online learning platform might require qualified teacher status before permitting instructors to publish course materials. A safeguarding-sensitive context (children's services, schools) might require an enhanced background check.

## Security Considerations

* **Revocation immutability.** Kind 30528 events use the append-only pattern -- each revocation MUST have a unique `d` tag. Clients MUST treat revocations as permanent. If a credential is reinstated, a new kind 31000 attestation MUST be issued rather than deleting the revocation.
* **Revocation authority verification.** Applications MUST verify that the publisher of a Kind 30528 event is authorised to revoke the referenced credential. Unverified revocations could be used to deny service to legitimate participants. See [Revocation Authority](#revocation-authority) for verification strategies.
* **Requirement spoofing.** Any pubkey can publish a Kind 30527 event. Applications MUST verify that the requirement publisher is a recognised context owner (marketplace operator, regulatory body, community moderator) before enforcing its requirements. Unauthenticated requirements could be used to exclude participants unfairly.
* **Credential freshness.** Applications SHOULD check both the `expiration` tag on kind 31000 and the `created_at` timestamp. A credential with a valid `expiration` date but a very old `created_at` may indicate a stale attestation that has not been re-verified.
* **Replay attacks.** A revoked credential holder might present the original kind 31000 attestation to an application that has not yet received the Kind 30528 revocation. Applications SHOULD subscribe to revocation events in real time and SHOULD NOT rely solely on point-in-time queries.
* **Privacy of revocation reasons.** Revocation reasons (especially `disciplinary` and `fraud`) may involve sensitive personal information. Publishers SHOULD use the encrypted `content` field for detailed revocation circumstances and keep the `revocation_reason` tag to the high-level category only.
* **Cross-relay consistency.** Revocation events may not propagate to all relays immediately. Applications verifying credentials SHOULD query multiple relays and SHOULD treat any valid revocation found on any relay as authoritative.

## Test Vectors

### Kind 30527 -- Healthcare: Medical Licence Requirement

```json
{
  "kind": 30527,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "telehealth_platform:requirement:medical_licence"],
    ["alt", "Credential requirement: Medical Licence (medical_licence, mandatory)"],
    ["t", "credential-requirement"],
    ["credential_type", "medical_licence"],
    ["credential_name", "Medical Licence"],
    ["mandatory", "true"],
    ["description", "All practitioners must hold a current medical licence issued by a recognised medical board"],
    ["jurisdiction", "US"]
  ],
  "content": "A valid medical licence is required before you can consult with patients on this platform. Check your state medical board for application details.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30527 -- Software: SOC 2 Compliance Requirement

```json
{
  "kind": 30527,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "secure_code_review:requirement:soc2"],
    ["alt", "Credential requirement: SOC 2 Compliance (compliance_certification, mandatory)"],
    ["t", "credential-requirement"],
    ["credential_type", "compliance_certification"],
    ["credential_name", "SOC 2 Type II Compliance"],
    ["mandatory", "true"],
    ["description", "Organisations must hold SOC 2 Type II certification before accessing sensitive codebases"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30527 -- Trades: Gas Safe Registration Requirement

```json
{
  "kind": 30527,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "gas_services:requirement:gas_safe"],
    ["alt", "Credential requirement: Gas Safe Registration (professional_licence, mandatory)"],
    ["t", "credential-requirement"],
    ["credential_type", "professional_licence"],
    ["credential_name", "Gas Safe Registration"],
    ["mandatory", "true"],
    ["description", "All gas work providers must hold a current Gas Safe registration"],
    ["jurisdiction", "GB"]
  ],
  "content": "Gas Safe registration is a legal requirement for anyone working on gas appliances in the United Kingdom. Apply at https://www.gassaferegister.co.uk/",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30527 -- Education: Safeguarding Requirement

```json
{
  "kind": 30527,
  "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": 1709740800,
  "tags": [
    ["d", "tutoring_platform:requirement:safeguarding"],
    ["alt", "Credential requirement: Enhanced Background Check (safeguarding, mandatory)"],
    ["t", "credential-requirement"],
    ["credential_type", "safeguarding"],
    ["credential_name", "Enhanced Background Check"],
    ["mandatory", "true"],
    ["description", "All tutors working with children must hold an enhanced background check"],
    ["jurisdiction", "GB"]
  ],
  "content": "An enhanced DBS check (or equivalent for your jurisdiction) is required before you can be matched with students under 18.",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30528 -- Credential Revocation (Disciplinary)

```json
{
  "kind": 30528,
  "pubkey": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "created_at": 1709740800,
  "tags": [
    ["d", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3:revocation:medical_licence:1709740800"],
    ["alt", "Credential revocation: Medical Licence (disciplinary)"],
    ["t", "credential-revocation"],
    ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555", "wss://relay.example.com", "31000"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["credential_type", "medical_licence"],
    ["credential_name", "Medical Licence"],
    ["credential_id", "GMC-7654321"],
    ["revocation_reason", "disciplinary"],
    ["effective_date", "2024-03-06"],
    ["revocation_details", "Registration suspended following fitness to practise tribunal"],
    ["reinstatement_eligible", "true"],
    ["reinstatement_conditions", "Complete approved retraining programme and pass reassessment within 12 months"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

### Kind 30528 -- Credential Revocation (Superseded)

```json
{
  "kind": 30528,
  "pubkey": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "created_at": 1709740800,
  "tags": [
    ["d", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3:revocation:compliance_certification:1709740800"],
    ["alt", "Credential revocation: SOC 2 Type II (superseded)"],
    ["t", "credential-revocation"],
    ["e", "eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666", "wss://relay.example.com", "31000"],
    ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"],
    ["credential_type", "compliance_certification"],
    ["credential_name", "SOC 2 Type II"],
    ["revocation_reason", "superseded"],
    ["effective_date", "2024-03-06"],
    ["revocation_details", "Replaced by updated certification following annual audit"]
  ],
  "content": "",
  "id": "<32-byte-hex>",
  "sig": "<64-byte-hex>"
}
```

## Relationship to Existing NIPs

### Kind 31000 Credential Attestations

NIP-CREDENTIALS **composes with** kind 31000 credential attestation events rather than replacing them. A kind 31000 event with a `credential_type` tag is the canonical event for recording a credential: who holds it, what it is, who issued it, and when it expires. NIP-CREDENTIALS adds the two missing lifecycle phases:

- **Kind 30527** (Credential Requirement) -- declares *what credentials are needed* in a given context
- **Kind 30528** (Credential Revocation) -- records *when a credential is no longer valid*

Together, the three kinds complete the credential lifecycle: require (30527) -> attest (31000) -> revoke (30528).

### NIP-58 (Badges)

NIP-58 provides a general-purpose badge system. Badges are well suited for achievements and recognitions but lack the structured fields needed for professional credential verification -- expiry dates, verification URLs, credential IDs, and revocation. NIP-CREDENTIALS is complementary: badges celebrate; credentials gate.

### NIP-TRUST (Portable Trust Networks)

NIP-TRUST defines trust delegation and network membership. Credential requirements (Kind 30527) can reference trusted issuers from NIP-TRUST networks -- for example, a requirement might accept credentials from any pubkey that is a member of a specific trust network.

### NIP-APPROVAL (Multi-Party Approval Gates)

NIP-APPROVAL provides workflow gating on human decisions. NIP-CREDENTIALS provides gating on verifiable qualifications. The two compose naturally: an approval gate (Kind 30570) might require that the approver holds a specific credential (verified via kind 31000 against a Kind 30527 requirement).

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps (time-limited requirements)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads (sensitive revocation details)

[NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) (kind 31000 Verifiable Attestations) is a recommended companion for credential issuance. NIP-CREDENTIALS works with any kind 31000 event that includes a `credential_type` tag.

## Reference Implementation

No public reference implementation exists yet. Implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing and subscription filtering by `#p` and `#e` tags.
2. Credential matching logic that compares kind 31000 attestations against Kind 30527 requirements by `credential_type`.
3. Revocation checking that subscribes to Kind 30528 events and invalidates credentials with effective revocation dates in the past.
4. Expiry monitoring that tracks the `expiration` tag on kind 31000 events and warns holders before credentials lapse.
