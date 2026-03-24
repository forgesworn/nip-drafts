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

Nostr has the g tag for geohash indexing (NIP-52, NIP-99) but no standard for privacy-preserving location discovery, consent-based sharing, or real-time tracking. Every app that needs more than a static geohash tag reinvents the same thing.

NIP-LOCATION defines two ephemeral kinds:

kind 20500 (Presence Beacon): coarse geohash-indexed presence. Subscribe to a cell and its 8 neighbours. You see who is roughly nearby; they don't see you.

kind 20501 (Location Update): NIP-44 encrypted coordinates shared only with specific recipients after consent. Bearing, speed, altitude, accuracy; the works.

The progressive reveal model means precision increases only when trust does. Public discovery at city-block level, precise sharing at street level, all controlled by the publisher.

Useful for delivery tracking, field service dispatch, event coordination, fleet management, or any Nostr app that needs "who is near me?" without a centralised location server.

Build with this: a Nostr meetup app that shows who's nearby without exposing exact locations. A wildlife tracking network where researchers share sighting coordinates with collaborators. A food truck finder that shows live locations without a centralised app. A geocaching game where clue proximity is revealed progressively.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-LOCATION.md

Tags: #nostr #nip #protocol #location #privacy #geohash #nostrdev

---

## Day 2 (Tue): NIP-VA

NIP-58 Badges let you award someone a named badge. NIP-32 Labels let you tag things. But badges have no expiration, no revocation, no trust hierarchy, and no structured claims. There is no standard way to say "I, as a licensed authority, attest that this person holds qualification X, valid until date Y, revocable if Z."

NIP-VA defines one kind (31000) for all of it. One event structure; many types. Credentials, endorsements, vouches, provenance claims, fact-checks. The type tag determines semantics; the kind stays the same. New attestation types require zero protocol changes.

What makes it different from badges: addressable per publisher, type, and subject. Built-in revocation. Expiration via NIP-40. Structured content for cryptographic proofs. Self-attestation and third-party attestation in the same kind.

What makes it different from labels: NIP-32 labels are regular events. You cannot revoke a specific label without deleting the entire event. NIP-VA attestations are individually replaceable, revocable, and expirable.

Reference implementation with builders, parsers, validators, and 17 frozen test vectors: https://github.com/forgesworn/nostr-attestations

Build with this: a restaurant review system where ratings are signed and verifiable, not anonymous. A Nostr-native recommendation engine where endorsements carry real weight. A fact-checking layer where journalists sign claims about sources. A music credits system where session musicians get cryptographic proof of their contribution.

The spec: https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md

Tags: #nostr #nip #protocol #attestations #credentials #identity #nostrdev

---

## Day 3 (Wed): NIP-APPROVAL

NIP-72 defines moderator approval for community posts, and NIP-25 reactions express sentiment. But there is no general-purpose approval gate where designated reviewers must sign off before a workflow proceeds.

NIP-APPROVAL defines two kinds:

kind 30570 (Approval Gate): a proposer declares what needs sign-off, who the reviewers are, and when the deadline is.

kind 30571 (Approval Response): each named reviewer responds with approved, rejected, or revise. One response per reviewer per gate, addressable and updatable.

The key difference from reactions: the reviewer set is declared upfront. Only listed authorities can approve. Revision loops are built in; a reviewer requests changes, the proposer updates, the reviewer re-evaluates. Deadlines are enforced via NIP-40 expiration.

Build with this: an editorial workflow where a senior editor signs off before an article goes live. A Nostr relay that requires admin approval before accepting new writers. A group buy organiser where all participants must confirm before the order is placed. A recipe book where community moderators approve submissions before they appear in the collection.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-APPROVAL.md

Tags: #nostr #nip #protocol #governance #workflow #review #nostrdev

---

## Day 4 (Thu): NIP-MATCHING

NIP-15 and NIP-99 handle seller-initiated listings. NIP-90 DVMs handle reverse auctions for computational jobs. But for physical goods and real-world services, there is no standard "I need X done" request event that providers can bid on.

NIP-MATCHING defines two kinds for the reverse pattern:

kind 30576 (Matching Offer): providers publish structured bids referencing a request. Price, timeline, qualifications, all in tags. Offers are addressable; a provider can revise their bid by republishing.

kind 30577 (Matching Selection): the requester chooses a winner. Selection is a signed, public record of who was picked and why.

This is the reverse auction pattern. One request, many providers competing. Different from NIP-90 DVMs (those are for computational jobs with machine-verifiable outputs). NIP-MATCHING is for human services where the requester evaluates offers subjectively.

Useful for freelance marketplaces, procurement, RFPs, service dispatch, or any Nostr app where providers compete for work rather than buyers competing for goods.

Build with this: a community noticeboard where neighbours request help and locals offer to assist. A music venue booking system where bands bid for gig slots. An open-source bounty platform where developers compete on timeline and approach. A dog walking app where pet owners post walks and sitters make offers.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-MATCHING.md

Tags: #nostr #nip #protocol #marketplace #matching #freelance #nostrdev

---

## Day 5 (Fri): NIP-CONSENSUS

NIP-88 defines open polls, but polls have no threshold requirements, no voter eligibility constraints, and no binding outcome semantics. There is no standard way to ask "do 3 out of 5 board members agree?" and get a verifiable, enforceable answer.

NIP-CONSENSUS defines two kinds:

kind 30574 (Consensus Proposal): declares the question, the voter set (by pubkey), the threshold, and the deadline. All in one event.

kind 30575 (Consensus Vote): each voter responds with agree, disagree, or abstain. Relay-filterable by the proposal's a-tag, so clients fetch only votes for a specific proposal.

Why not NIP-25 reactions? Reactions are open; anyone can react. There is no voter set, no threshold, no abstention, no deadline, no structured decision values. A client using reactions for governance must independently maintain the voter set, implement threshold arithmetic, track abstentions, and enforce deadlines with no relay-side support.

With NIP-CONSENSUS: declare voters, declare threshold, collect votes, check quorum. Five events and you have a verifiable decision.

Useful for DAOs, cooperatives, editorial boards, grant committees, or any multi-party decision that needs an auditable outcome.

Build with this: DAO governance where proposals need 3/5 board approval within 48 hours. Cooperative decision-making for community land trusts. Editorial boards deciding which articles to publish. Budget approvals in decentralised organisations.

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

Build with this: art provenance tracking from studio to gallery to collector. A tool library where every borrow and return is signed with condition photos. A vintage marketplace where the ownership history is verifiable. A community fridge network where food donations are tracked from donor through volunteers to recipients.

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

Build with this: a conference where speakers prove their claimed expertise before being listed on the programme. A Nostr client that shows a verified checkmark when someone's professional claim is backed by an issuer. A community wiki where only editors with verified credentials can approve changes to sensitive topics.

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

Build with this: a citizen journalism tool where photos carry verifiable metadata about when and where they were taken. A home renovation log where before/after photos are timestamped and geolocated. A birdwatching app where sightings carry structured evidence. A community mapping project where contributors submit verified survey data.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-EVIDENCE.md

Tags: #nostr #nip #protocol #evidence #compliance #audit #nostrdev

---

# Batch 2 Announcements

Published 2026-03-24. 20 new NIPs plus updates to 2 from batch 1. Post the summary, then 6 themed posts.

Schedule: summary > payments (1) > trust & safety (2) > profiles & scheduling (3) > messaging, invoicing & L402 (4) > crafts, heritage & ecosystem (5) > composition guides & oracle (6)

---

## Batch 2 Summary

Published 20 more Nostr protocol extensions on NostrHub, plus updates to 2 from last week. The full portfolio is now 27 standalone NIPs covering payments, trust, scheduling, disputes, provenance, and more. 40 new event kinds total.

Payments: NIP-QUOTE (structured pricing), NIP-ESCROW (conditional payments with settlement outcomes), NIP-INVOICING (machine-readable invoices)

Trust: NIP-TRUST (portable trust networks with revocation), NIP-REPUTATION (structured ratings), NIP-DISPUTES (dispute resolution with mediator support)

Scheduling: NIP-BOOKING (calendar availability and slot booking), NIP-PROVIDER-PROFILES (service provider discovery)

Ecosystem: NIP-CRAFTS (technique documentation), NIP-PROVENANCE (supply chain tracking), NIP-SCARCITY (workforce shortage signals), NIP-MENTORSHIP (training progression)

Paid APIs: NIP-PAID-SERVICES (paid API discovery, 8 production implementations)

Three composition guides show how existing NIPs combine without new kinds: SLA monitoring, community governance, institutional referral routing.

All standalone. No framework lock-in. Every NIP works independently.

Authorship verified with NIP-VA (kind 31000) attestations.

https://github.com/forgesworn/nip-drafts

Tags: #nostr #nip #protocol #nostrdev

---

## Post 1: Payments (NIP-QUOTE + NIP-ESCROW)

NIP-QUOTE (kinds 30530, 30531): structured pricing for Nostr.

NIP-99 gives you classified listings with a price tag. NIP-QUOTE gives you the negotiation layer. A provider publishes a structured quote with line items, tax, validity window, and payment method options. Multiple providers can quote the same request. Once accepted, Payment Terms (kind 30531) lock in the deal: milestones, deposits, streaming rates, cancellation schedules.

NIP-ESCROW (kinds 30532, 30533, 30535): conditional payment coordination.

NIP-57 zaps are one-way. Cashu tokens are bearer instruments. Neither gives you "hold these funds until both sides are happy."

Lock (30532) commits funds with proof. Settlement (30533) covers all outcomes via a single `outcome` tag: released, forfeited, partial_forfeit, or expired. Payment Receipt (30535) proves money moved; also handles streaming payments via tick_number and cumulative tags for time-based billing.

Payment-rail-agnostic. Events record what happened; money moves on Lightning, Cashu, Strike, Stripe, or whatever rail the parties choose.

Build with this: a freelance platform with milestone-based payments and per-deliverable quotes. A peer-to-peer marketplace with buyer protection. A ridesharing app with per-minute streaming receipts.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-QUOTE.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-ESCROW.md

Tags: #nostr #nip #protocol #payments #escrow #lightning #cashu #nostrdev

---

## Post 2: Trust & Safety (NIP-TRUST + NIP-DISPUTES + NIP-REPUTATION)

NIP-TRUST (kinds 30515, 30517): portable trust networks.

NIP-02 tells you who someone follows. NIP-51 lets you organise pubkeys. Neither covers "I trusted this provider, now I don't, and here's why" or "I vouch for this person's plumbing work."

Trust Revocation (30515): explicit trust removal with reason-tiered visibility. Public reasons vs NIP-44 encrypted private reasons. Append-only audit trail. Provider Endorsement (30517): provider-to-provider vouching with category, context, and competency assessment. Solves the cold-start problem.

NIP-DISPUTES (kinds 7543, 30545): dispute resolution.

Dispute Claim (7543) is a regular event (immutable; you cannot silently edit a claim after filing). Dispute Resolution (30545) is the mediator's ruling with outcome, reasoning, and financial remedy. Both parties submit NIP-EVIDENCE records; the mediator reviews and publishes the resolution.

NIP-REPUTATION (kind 30520): structured ratings tied to real transactions. One rating per party per transaction, enforced by d-tag uniqueness. Each rating references a completion event as proof the rater actually participated. Weighted criteria with domain-specific weights. Review responses use NIP-22 Comments.

Build with this: a tradesperson recommendation network with real professional endorsements. A marketplace with verifiable ratings and built-in dispute resolution. A community where revoking trust is a transparent, auditable action.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-TRUST.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-DISPUTES.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-REPUTATION.md

Tags: #nostr #nip #protocol #trust #disputes #reputation #nostrdev

---

## Post 3: Profiles & Scheduling (NIP-PROVIDER-PROFILES + NIP-BOOKING + NIP-VARIATION)

NIP-PROVIDER-PROFILES (kinds 30510, 30511): service provider discovery.

Provider Profile (30510): an addressable event declaring capabilities, credentials, coverage areas, and service terms. Discoverable by geohash, capability, or category. Coordinator Bond (30511): declares a coordinator's financial commitment, fee structure, and SLA.

NIP-BOOKING (kinds 30582, 30583, 30584): calendar availability and slot booking.

Availability Calendar (30582): providers publish when they are free, with duration, capacity, pricing, and cancellation policies. Recurrence via RFC 5545 tags. Booking Slot (30583): requesters book a specific time. Booking Cancellation (30584): either party cancels with a reason. Confirmation uses NIP-APPROVAL; rescheduling uses NIP-VARIATION.

NIP-VARIATION (kind 30579): scope and price change management. When agreed work needs to change mid-project, a variation request captures what changed, why, and the cost impact. Variation quotes use NIP-QUOTE; variation approvals use NIP-APPROVAL. One new kind, composed with existing primitives.

Build with this: a tutoring platform with calendar-based booking. A local services directory where providers are discoverable by skill and location. A construction project tracker where scope changes carry formal cost impact documentation.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-PROVIDER-PROFILES.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-BOOKING.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-VARIATION.md

Tags: #nostr #nip #protocol #booking #scheduling #discovery #nostrdev

---

## Post 4: Messaging, Invoicing & Paid APIs (NIP-CHANNELS + NIP-DATA-ACCESS + NIP-INVOICING + NIP-PAID-SERVICES)

NIP-CHANNELS (kinds 20502, 30565): context-scoped messaging. NIP-17 gives you DMs. NIP-28 gives you public channels. NIP-CHANNELS adds task-scoped messaging: typing indicator (20502, ephemeral) and message status (30565, read receipts). Task messages use NIP-17 with a context_id tag.

NIP-DATA-ACCESS (kind 30556): scoped, revocable data access grants. "I grant you access to this data, for this purpose, until this date." Time-bounded, purpose-constrained, revocable.

NIP-INVOICING (kind 30588): structured, machine-readable invoices. Line items, tax calculation, payment terms references, due dates. Different from a Lightning invoice: this is a commercial document with an audit trail, not a payment request.

NIP-PAID-SERVICES (kind 31402): paid API discovery on Nostr. If you run an API behind a Lightning paywall, how do people find it? Kind 31402 announces your service: endpoint, pricing, supported methods, authentication. Eight implementations already use this kind in production.

Build with this: an AI inference marketplace discoverable and payable via Lightning. A task management app with private scoped chat. A medical system where patients grant doctors temporary record access. An accounting tool that generates tax-ready invoices from Nostr payment events.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-CHANNELS.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-DATA-ACCESS.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-INVOICING.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-PAID-SERVICES.md

Tags: #nostr #nip #protocol #messaging #invoicing #l402 #lightning #nostrdev

---

## Post 5: Crafts, Heritage & Ecosystem (NIP-CRAFTS + NIP-PROVENANCE + NIP-SCARCITY + NIP-MENTORSHIP)

Four NIPs for the physical world.

NIP-CRAFTS (kind 30401): living technique records for craft skills. Safety notes, materials, tools, difficulty rating, media. Wikipedia for hands-on skills, signed by practitioners and discoverable by trade, material, or difficulty.

NIP-PROVENANCE (kind 30404): product and supply chain provenance. Where something came from, who handled it, what certifications apply. Composes with NIP-CUSTODY for multi-leg tracking and NIP-VA for certification attestations.

NIP-SCARCITY (kind 30599): workforce shortage signals. When a region lacks qualified practitioners, anyone can publish a scarcity signal with severity, affected area, and required qualifications.

NIP-MENTORSHIP: no new kinds. Extends NIP-TRUST's Provider Endorsement (30517) with mentorship tags: competency area, proficiency level, training duration, assessment method. "I trained this person in lime plastering for 6 months and assessed them as competent" carries more weight than "I vouch for this person."

Build with this: a heritage conservation archive where traditional building techniques are documented by master craftspeople. A food provenance system where farm-to-fork is verifiable. A workforce intelligence dashboard showing where training investment is most needed.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-CRAFTS.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-PROVENANCE.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-SCARCITY.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-MENTORSHIP.md

Tags: #nostr #nip #protocol #crafts #provenance #heritage #mentorship #nostrdev

---

## Post 6: Composition Guides + NIP-ORACLE

Three composition guides that prove the NIP ecosystem composes without new kinds.

NIP-SLA: service level agreements using NIP-EVIDENCE for breach evidence, NIP-APPROVAL for agreement sign-off, and NIP-DISPUTES for escalation.

NIP-COMMUNITY-GOVERNANCE: community decision-making using NIP-51 lists for membership, NIP-CONSENSUS for voting, and NIP-EVIDENCE for proposal documentation.

NIP-REFERRAL-ROUTING: institutional referral handoffs using NIP-51 for referral networks and NIP-APPROVAL for acceptance. Healthcare, legal aid, social services.

NIP-ORACLE (incubating; kinds 30543, 30547, 30548, 30549): oracle-based dispute resolution. External data feeds for automated dispute adjudication. Incubating because cross-domain demand is still emerging.

https://github.com/forgesworn/nip-drafts/blob/main/NIP-SLA.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-COMMUNITY-GOVERNANCE.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-REFERRAL-ROUTING.md
https://github.com/forgesworn/nip-drafts/blob/main/NIP-ORACLE.md

Tags: #nostr #nip #protocol #sla #governance #oracle #nostrdev
