# NIP Drafts

This repository contains **27 Nostr protocol extensions** for service coordination, trust, payments, dispute resolution, and paid API discovery. Each file is written in [nostr-protocol/nips](https://github.com/nostr-protocol/nips) format and defines patterns useful to any Nostr application.

> **These NIPs are designed to work independently. They do not require adoption of any specific platform or framework.**

## Status

All drafts are `draft` `optional` unless noted otherwise.

## NIPs

| NIP | Title | Classification | Status | Kinds | Key Dependencies |
| --- | ----- | -------------- | ------ | ----- | ---------------- |
| [NIP-LOCATION](NIP-LOCATION.md) | Privacy-Preserving Location Discovery | upstream | `draft` | 20500, 20501 | NIP-01, NIP-40, NIP-44 |
| [NIP-PROVIDER-PROFILES](NIP-PROVIDER-PROFILES.md) | Service Provider Profiles | upstream | `draft` | 30510, 30511 | NIP-01, NIP-40, NIP-58, NIP-99, NIP-EVIDENCE |
| [NIP-TRUST](NIP-TRUST.md) | Portable Trust Networks | upstream | `draft` | 30515, 30517 | NIP-01, NIP-02, NIP-09, NIP-17, NIP-40, NIP-44, NIP-51 |
| [NIP-CHANNELS](NIP-CHANNELS.md) | Message Status & Typing Indicators | upstream | `draft` | 20502, 30565 | NIP-01, NIP-17, NIP-40, NIP-44, NIP-59 |
| [NIP-DATA-ACCESS](NIP-DATA-ACCESS.md) | Scoped, Revocable Data Access Grants | ecosystem | `draft` | 30556 | NIP-01, NIP-44, NIP-59 |
| [NIP-CREDENTIALS](NIP-CREDENTIALS.md) | Credential Verification & Gating | upstream | `draft` | 30527, 30528 | NIP-01, NIP-40, NIP-44, NIP-REPUTATION |
| [NIP-REPUTATION](NIP-REPUTATION.md) | Structured Reputation & Reviews | upstream | `draft` | 30520 | NIP-01, NIP-02, NIP-22, NIP-32, NIP-58, NIP-EVIDENCE |
| [NIP-QUOTE](NIP-QUOTE.md) | Structured Pricing & Payment Terms | upstream | `draft` | 30530, 30531 | NIP-01, NIP-40, NIP-44 |
| [NIP-ESCROW](NIP-ESCROW.md) | Conditional Payment Coordination | upstream | `draft` | 30532, 30533, 30535 | NIP-01, NIP-40, NIP-44, NIP-59, NIP-QUOTE |
| [NIP-DISPUTES](NIP-DISPUTES.md) | Dispute Resolution Protocol | upstream | `draft` | 7543, 30545 | NIP-01, NIP-32, NIP-44, NIP-56, NIP-59, NIP-EVIDENCE |
| [NIP-ORACLE](NIP-ORACLE.md) | Oracle Dispute Resolution | incubating | `draft` `incubating` | 30543, 30547, 30548, 30549 | NIP-01, NIP-40, NIP-44, NIP-59 |
| [NIP-APPROVAL](NIP-APPROVAL.md) | Multi-Party Approval Gates | upstream | `draft` | 30570, 30571 | NIP-01, NIP-40, NIP-44 |
| [NIP-CUSTODY](NIP-CUSTODY.md) | Chain-of-Custody Tracking | upstream | `draft` | 30572 | NIP-01, NIP-44, NIP-EVIDENCE, NIP-LOCATION |
| [NIP-CONSENSUS](NIP-CONSENSUS.md) | Multi-Party Consensus | upstream | `draft` | 30574, 30575 | NIP-01, NIP-40, NIP-44 |
| [NIP-MATCHING](NIP-MATCHING.md) | Competitive Matching & Selection | upstream | `draft` | 30576, 30577 | NIP-01, NIP-15, NIP-40, NIP-44, NIP-99 |
| [NIP-EVIDENCE](NIP-EVIDENCE.md) | Timestamped Evidence Recording | upstream | `draft` | 30578 | NIP-01, NIP-40, NIP-44 |
| [NIP-VARIATION](NIP-VARIATION.md) | Scope & Price Change Management | upstream | `draft` | 30579 | NIP-01, NIP-40, NIP-44, NIP-QUOTE, NIP-APPROVAL |
| [NIP-BOOKING](NIP-BOOKING.md) | Calendar Availability & Booking | upstream | `draft` | 30582, 30583, 30584 | NIP-01, NIP-40, NIP-44, NIP-52, NIP-APPROVAL, NIP-VARIATION, RFC 5545 |
| [NIP-INVOICING](NIP-INVOICING.md) | Structured Invoicing | ecosystem | `draft` | 30588 | NIP-01, NIP-40, NIP-44, NIP-ESCROW, NIP-APPROVAL |
| [NIP-SLA](NIP-SLA.md) | Service Level Agreements (Composition Guide) | ecosystem | `draft` `composition-guide` | none | NIP-EVIDENCE, NIP-APPROVAL, NIP-DISPUTES |
| [NIP-PROVENANCE](NIP-PROVENANCE.md) | Product & Supply Chain Provenance | ecosystem | `draft` | 30404 | NIP-01, NIP-32, NIP-40, NIP-44, NIP-VA, NIP-CUSTODY, NIP-EVIDENCE |
| [NIP-CRAFTS](NIP-CRAFTS.md) | Craft Technique Documentation | ecosystem | `draft` | 30401 | NIP-01, NIP-32, NIP-40, NIP-44, NIP-PROVIDER-PROFILES |
| [NIP-MENTORSHIP](NIP-MENTORSHIP.md) | Mentorship Pipelines & Training Progression | ecosystem | `draft` | 30517 (ext) | NIP-01, NIP-40, NIP-44, NIP-TRUST, NIP-REPUTATION, NIP-EVIDENCE |
| [NIP-SCARCITY](NIP-SCARCITY.md) | Workforce & Resource Scarcity Signals | ecosystem | `draft` | 30599 | NIP-01, NIP-40, NIP-TRUST, NIP-REPUTATION, NIP-PROVENANCE |
| [NIP-REFERRAL-ROUTING](NIP-REFERRAL-ROUTING.md) | Institutional Referral Routing (Composition Guide) | ecosystem | `draft` `composition-guide` | none | NIP-51, NIP-APPROVAL, NIP-44, NIP-59 |
| [NIP-COMMUNITY-GOVERNANCE](NIP-COMMUNITY-GOVERNANCE.md) | Community Governance (Composition Guide) | ecosystem | `draft` `composition-guide` | none | NIP-51, NIP-CONSENSUS, NIP-EVIDENCE |
| [NIP-PAID-SERVICES](NIP-PAID-SERVICES.md) | Paid API Service Announcements | upstream | `draft` | 31402 | NIP-01, NIP-40 |

### Incubating

Incubating NIPs have promising patterns but insufficient cross-domain demand for standalone NIP status. They remain in this directory for visibility but are not recommended for implementation outside their originating domain.

NIP-ORACLE is currently incubating.

**Promotion criteria:** An incubating NIP is promoted to `draft` when 2+ unrelated domains demonstrate need for the pattern.

### Classification

- **upstream** -- Domain-agnostic, no lock-in. Ready for submission to [nostr-protocol/nips](https://github.com/nostr-protocol/nips).
- **ecosystem** -- Strong patterns with clear application but currently narrow in scope or ambitious in kind count. Path to upstream after production adoption in 2+ independent Nostr apps.
- **incubating** -- Promising patterns. Promotion requires 2+ unrelated domains to demonstrate need.

## Authorship Attestations

Each published NIP has a corresponding [NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) authorship attestation (kind 31000) on Nostr, signed by the author's key. To verify:

```json
{"kinds": [31000], "#type": ["authorship"], "authors": ["da19f1cd34beca44be74da4b306d9d1dd86b6343cef94ce22c49c6f59816e5bd"]}
```

This returns one attestation per NIP, each with an `a` tag referencing the kind 30817 event. Authorship is cryptographically verifiable without trusting any centralised registry.

NIP-VA's own authorship is self-attested: the same keypair publishes both the specification and the attestation. The trust anchor is the Nostr keypair, not the attestation format. Third-party attestations from independent reviewers can layer additional trust over time.

## Relationships

Each NIP is classified by its maturity and genericness. See the Classification column in the table above.

### Extended by TROTT

The [TROTT protocol](https://github.com/TheCryptoDonkey/trott) (TROTT-00 through TROTT-14) extends these NIPs with domain-specific configuration, operator integration, and cross-spec wiring. For example:

- **TROTT-03** extends NIP-CREDENTIALS with domain-specific credential requirements and reputation weighting.
- **TROTT-04 / TROTT-04b** extend NIP-QUOTE and NIP-ESCROW with payment commitment and settlement workflows.
- **TROTT-05** extends NIP-DISPUTES with safety check-ins and emergency signals.
- **TROTT-06** extends NIP-PROVIDER-PROFILES with compliance and operator participation.
- **TROTT-06b** extends NIP-DATA-ACCESS with compliance access control and audit-oriented operating guidance.
- **TROTT-08** extends NIP-CHANNELS with task archival and messaging preferences.
- **TROTT-10** extends NIP-TRUST with location sharing and operator-managed trust.
- **TROTT-11** extends NIP-BOOKING with domain-specific scheduling configuration and TROTT-01 lifecycle composition.
- **TROTT-12** extends NIP-INVOICING with lifecycle-triggered invoicing, approval gate composition, and tax retention guidance.
- **TROTT-14** extends NIP-SLA with escrow integration, dispute escalation, and domain-specific SLA defaults.

The [`@trott/sdk`](https://github.com/TheCryptoDonkey/trott-sdk) TypeScript library is a reference implementation, providing builders and parsers for all NIP kinds.

### To AtoB

NIPs that reference a "task" or "transaction" lifecycle are designed to work with the [AtoB state machine protocol](https://github.com/TheCryptoDonkey/atob) or any similar state machine. AtoB defines the state transitions (kinds 7500, 7501, 7502, 30078); these NIPs define what happens around those transitions: payments, reputation, disputes, messaging.

### To nostr-protocol/nips

When mature, each NIP may be proposed as a PR to [nostr-protocol/nips](https://github.com/nostr-protocol/nips). The drafts here use placeholder numbers (`NIP-XX`) and descriptive filenames.

### Related

- **[NIP-VA: Verifiable Attestations](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md)** (kind 31000) lives in [nostr-attestations](https://github.com/forgesworn/nostr-attestations), which also provides a TypeScript reference implementation with builders, parsers, validators, and frozen test vectors.

## Kind Allocation

These NIPs use the following kind ranges:

- **Regular (1xxx):** 1315, 1316 (NIP-SPATIAL-SIGNALS)
- **Regular (7xxx):** 7543 (NIP-DISPUTES)
- **Ephemeral (20xxx):** 20500-20502
- **Addressable (30xxx):** 30401, 30404, 30510-30511, 30515, 30517, 30520, 30527-30528, 30530-30533, 30535, 30543, 30545, 30547-30549, 30556, 30565, 30570-30572, 30574-30579, 30582-30584, 30588, 30599
- **Addressable (31xxx):** 31402 (NIP-PAID-SERVICES)

Kind numbers will need formal allocation when proposed to `nostr-protocol/nips`.

## Diagrams

The `images/` directory contains rendered PNG diagrams (dark theme, 2400px, 2x scale) and their Mermaid sources (`.mmd`). To re-render after editing a `.mmd` file:

```bash
npx -y @mermaid-js/mermaid-cli -i images/<name>.mmd -o images/<name>.png \
  -c images/mermaid-config.json -w 2400 -b transparent --scale 2
```

## Licence

[MIT](LICENCE)
