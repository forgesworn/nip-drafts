# NIP Drafts

Nostr protocol extensions for service coordination, trust, payments, and dispute resolution. Each file is written in [nostr-protocol/nips](https://github.com/nostr-protocol/nips) format and defines patterns useful to any Nostr application.

> **These NIPs are designed to work independently. They do not require adoption of any specific platform or framework.**

## Status

All drafts are `draft` `optional` unless noted otherwise.

## NIPs

| NIP | Title | Kinds | Status |
| --- | ----- | ----- | ------ |
| [NIP-LOCATION](NIP-LOCATION.md) | Privacy-Preserving Location Discovery | 20500, 20501 | Ready |
| [NIP-PROVIDER-PROFILES](NIP-PROVIDER-PROFILES.md) | Service Provider Profiles | 30510, 30511, 30525, 30526 | Needs consolidation |
| [NIP-TRUST](NIP-TRUST.md) | Portable Trust Networks | 30512, 30513, 30515, 30517, 30518, 30519 | Needs consolidation |
| [NIP-CHANNELS](NIP-CHANNELS.md) | Multi-Party Encrypted Channels | 20502, 30564, 30565 | Needs consolidation |
| [NIP-CREDENTIALS](NIP-CREDENTIALS.md) | Credential Verification & Gating | 30527, 30528 | Ready |
| [NIP-REPUTATION](NIP-REPUTATION.md) | Structured Reputation & Reviews | 30520, 30521, 31000, 30523, 30524 | Needs consolidation |
| [NIP-ESCROW](NIP-ESCROW.md) | Conditional Payment Coordination | 30530-30537 | Needs consolidation |
| [NIP-DISPUTES](NIP-DISPUTES.md) | Dispute Resolution Protocol | 7543, 7544, 30545, 30546, 7547 | Needs consolidation |
| [NIP-APPROVAL](NIP-APPROVAL.md) | Multi-Party Approval Gates | 30570, 30571 | Ready |
| [NIP-CUSTODY](NIP-CUSTODY.md) | Chain-of-Custody Tracking | 30572, 30573 | Ready |
| [NIP-CONSENSUS](NIP-CONSENSUS.md) | Multi-Party Consensus | 30574, 30575 | Ready |
| [NIP-MATCHING](NIP-MATCHING.md) | Competitive Matching & Selection | 30576, 30577 | Ready |
| [NIP-EVIDENCE](NIP-EVIDENCE.md) | Timestamped Evidence Recording | 30578 | Ready |
| [NIP-VARIATION](NIP-VARIATION.md) | Scope & Price Change Management | 30579, 30580, 30581 | Needs consolidation |
| [NIP-BOOKING](NIP-BOOKING.md) | Calendar Availability & Booking | 30582-30587 | Needs consolidation |

**Ready** NIPs have survived internal review and are published on [NostrHub](https://nostrhub.io). **Needs consolidation** NIPs require kind-count reduction and better reuse of existing NIPs before publishing.

## Related

- **[NIP-VA: Verifiable Attestations](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md)** (kind 31000) lives in [nostr-attestations](https://github.com/forgesworn/nostr-attestations), which also provides a TypeScript reference implementation with builders, parsers, validators, and frozen test vectors.

- The [TROTT protocol](https://github.com/forgesworn/nip-drafts) extends these NIPs with domain-specific configuration, operator integration, and cross-spec wiring for physical service coordination. Adoption of TROTT is not required to use any NIP in this repository.

## Kind Allocation

These NIPs use the following kind ranges:

- **Ephemeral (20xxx):** 20500-20502
- **Regular (7xxx):** 7543, 7544, 7547
- **Addressable (30xxx):** 30510-30599

Kind numbers are provisional and will need formal allocation when proposed to `nostr-protocol/nips`.

## Diagrams

The `images/` directory contains rendered PNG diagrams (dark theme, 2400px, 2x scale) and their Mermaid sources (`.mmd`). To re-render after editing a `.mmd` file:

```bash
npx -y @mermaid-js/mermaid-cli -i images/<name>.mmd -o images/<name>.png \
  -c images/mermaid-config.json -w 2400 -b transparent --scale 2
```

## Licence

[MIT](LICENCE)
