# NIP Announcements

Notes for Nostr (kind 1). Post the summary tonight, then one per day.

Schedule: summary > location (Mon) > nip-va (Tue) > approval (Wed) > matching (Thu) > consensus (Fri) > custody (Sat) > credentials (Sun) > evidence (Mon)

## Tonight: Summary

Published 8 Nostr protocol extensions on NostrHub. Each defines 1-2 new event kinds for problems that don't have a standard solution yet.

- NIP-VA: one generic attestation kind for credentials, endorsements, provenance, and trust (kind 31000)
- NIP-LOCATION: privacy-preserving presence and location sharing (kinds 20500, 20501)
- NIP-CREDENTIALS: credential requirements and revocation lifecycle (kinds 30527, 30528)
- NIP-APPROVAL: multi-party approval gates with revision loops (kinds 30570, 30571)
- NIP-CUSTODY: chain-of-custody tracking with evidence linkage (kinds 30572, 30573)
- NIP-CONSENSUS: threshold-based voting with declared voter sets (kinds 30574, 30575)
- NIP-MATCHING: competitive offers and selection for reverse auctions (kinds 30576, 30577)
- NIP-EVIDENCE: structured, timestamped evidence records (kind 30578)

All standalone. No framework lock-in. Specs, JSON examples, relay query patterns, and diagrams in each.

Authorship verified with NIP-VA (kind 31000) attestations.

https://github.com/forgesworn/nip-drafts

Tags: #nostr #nip #protocol #nostrdev

---

## Day 1 (Mon): NIP-LOCATION

Every Nostr app that touches location reinvents the same thing: how do you share where you are without broadcasting your coordinates to the world?

NIP-LOCATION defines two ephemeral kinds:

kind 20500 (Presence Beacon): coarse geohash-indexed presence. Subscribe to a cell and its 8 neighbours. You see who is roughly nearby; they don't see you.

kind 20501 (Location Update): NIP-44 encrypted coordinates shared only with specific recipients after consent. Bearing, speed, altitude, accuracy; the works.

The progressive reveal model means precision increases only when trust does. Public discovery at city-block level, precise sharing at street level, all controlled by the publisher.

Useful for delivery tracking, field service dispatch, event coordination, fleet management, or any Nostr app that needs "who is near me?" without a centralised location server.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-LOCATION.md

Tags: #nostr #nip #protocol #location #privacy #geohash #nostrdev

---

## Day 2 (Tue): NIP-VA

Nostr has badges (NIP-58) for "you earned this." Labels (NIP-32) for tagging. But no standard way to say "I, as a licensed authority, attest that this person holds qualification X, valid until date Y, revocable if Z."

NIP-VA defines one kind (31000) for all of it. One event structure; many types. Credentials, endorsements, vouches, provenance claims, fact-checks. The type tag determines semantics; the kind stays the same. New attestation types require zero protocol changes.

What makes it different from badges: addressable per publisher, type, and subject. Built-in revocation. Expiration via NIP-40. Structured content for cryptographic proofs. Self-attestation and third-party attestation in the same kind.

What makes it different from labels: NIP-32 labels are regular events. You cannot revoke a specific label without deleting the entire event. NIP-VA attestations are individually replaceable, revocable, and expirable.

Reference implementation with builders, parsers, validators, and 17 frozen test vectors: https://github.com/forgesworn/nostr-attestations

The spec: https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md

Tags: #nostr #nip #protocol #attestations #credentials #identity #nostrdev

---

## Day 3 (Wed): NIP-APPROVAL

Nostr has reactions for "I like this" but nothing for "I, as the designated reviewer, officially approve this to proceed."

NIP-APPROVAL defines two kinds:

kind 30570 (Approval Gate): a proposer declares what needs sign-off, who the reviewers are, and when the deadline is.

kind 30571 (Approval Response): each named reviewer responds with approved, rejected, or revise. One response per reviewer per gate, addressable and updatable.

The key difference from reactions: the reviewer set is declared upfront. Only listed authorities can approve. Revision loops are built in; a reviewer requests changes, the proposer updates, the reviewer re-evaluates. Deadlines are enforced via NIP-40 expiration.

Use cases: pull request reviews on Nostr-native Git tools. Grant committee decisions. Editorial sign-off before publishing. Regulatory inspections. Any workflow where "someone specific must say yes" before the next step.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-APPROVAL.md

Tags: #nostr #nip #protocol #governance #workflow #review #nostrdev

---

## Day 4 (Thu): NIP-MATCHING

NIP-15 and NIP-99 are great for "here's what I'm selling." But what about "here's what I need; who wants to compete for it?"

NIP-MATCHING defines two kinds for the reverse pattern:

kind 30576 (Matching Offer): providers publish structured bids referencing a request. Price, timeline, qualifications, all in tags. Offers are addressable; a provider can revise their bid by republishing.

kind 30577 (Matching Selection): the requester chooses a winner. Selection is a signed, public record of who was picked and why.

This is the reverse auction pattern. One request, many providers competing. Different from NIP-90 DVMs (those are for computational jobs with machine-verifiable outputs). NIP-MATCHING is for human services where the requester evaluates offers subjectively.

Useful for freelance marketplaces, procurement, RFPs, service dispatch, or any Nostr app where providers compete for work rather than buyers competing for goods.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-MATCHING.md

Tags: #nostr #nip #protocol #marketplace #matching #freelance #nostrdev

---

## Day 5 (Fri): NIP-CONSENSUS

Nostr has no standard way to ask "do 3 out of 5 board members agree?" and get a verifiable answer.

NIP-CONSENSUS defines two kinds:

kind 30574 (Consensus Proposal): declares the question, the voter set (by pubkey), the threshold, and the deadline. All in one event.

kind 30575 (Consensus Vote): each voter responds with agree, disagree, or abstain. Relay-filterable by the proposal's a-tag, so clients fetch only votes for a specific proposal.

Why not NIP-25 reactions? Reactions are open; anyone can react. There is no voter set, no threshold, no abstention, no deadline, no structured decision values. A client using reactions for governance must independently maintain the voter set, implement threshold arithmetic, track abstentions, and enforce deadlines with no relay-side support.

With NIP-CONSENSUS: declare voters, declare threshold, collect votes, check quorum. Five events and you have a verifiable decision.

Useful for DAOs, cooperatives, editorial boards, grant committees, or any multi-party decision that needs an auditable outcome.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-CONSENSUS.md

Tags: #nostr #nip #protocol #governance #dao #voting #nostrdev

---

## Day 6 (Sat): NIP-CUSTODY

When a physical item changes hands, who proves it was in good condition at handoff?

NIP-CUSTODY defines two kinds:

kind 30572 (Custody Transfer): records who handed what to whom, where, and in what condition. Each transfer references the previous one via custody_handoff_ref, forming a verifiable chain.

kind 30573 (Custody Evidence): photos, documents, sensor readings linked to a specific transfer. Evidence is append-only; you can add but never delete.

A three-leg delivery (sender to courier to hub to recipient) produces three transfer events and six evidence records, all chain-linked. Any party can reconstruct the full audit trail by following the references.

Useful for delivery tracking, art provenance, equipment handoff, legal evidence chains, or any workflow where "who had this, when, and in what state" matters.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-CUSTODY.md

Tags: #nostr #nip #protocol #custody #provenance #delivery #nostrdev

---

## Day 7 (Sun): NIP-CREDENTIALS

NIP-VA (kind 31000) lets anyone attest anything about anyone. But how does a marketplace say "providers MUST hold a Gas Safe registration" and verify that they do?

NIP-CREDENTIALS defines two kinds that complete the credential lifecycle:

kind 30527 (Credential Requirement): a context owner declares what credentials are needed, with trust levels (authority, industry body, operator, peer, self-declared) and mandatory/optional semantics.

kind 30528 (Credential Revocation): an issuer revokes a credential with a reason and effective date. Append-only audit trail; revocations are permanent records.

The verification algorithm is six steps: discover requirements, discover credentials, check mandatory, check issuer trust level, check expiry, check revocation. All relay-queryable.

Different from NIP-58 badges: badges celebrate ("you earned this"). Credentials gate ("you need this to participate").

https://github.com/forgesworn/nip-drafts/blob/main/NIP-CREDENTIALS.md

Tags: #nostr #nip #protocol #credentials #identity #verification #nostrdev

---

## Day 8 (Mon): NIP-EVIDENCE

Every Nostr event is already timestamped. So why a dedicated evidence kind?

Because a kind 1 note with a SHA-256 hash in the text is human-readable but not machine-parseable. NIP-EVIDENCE (kind 30578) adds structured metadata that makes evidence filterable, verifiable, and composable.

One kind. Tags for: evidence type (photo, video, document, reading, observation), file hash, capture timestamp, geolocation, condition grade, and chain linkage to related events.

Not all evidence is file-based. Sensor readings, condition assessments, verbal confirmations, and witnessed observations have no associated file. NIP-94 requires a file URL; NIP-EVIDENCE does not.

NIP-03 (OpenTimestamps) proves an event existed at a time. NIP-EVIDENCE adds what was captured, where, when, and under what conditions. The two complement each other.

Useful for inspections, insurance claims, compliance audits, dispute resolution, or any workflow where "signed facts" need to be discoverable by type, location, or related event.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-EVIDENCE.md

Tags: #nostr #nip #protocol #evidence #compliance #audit #nostrdev
