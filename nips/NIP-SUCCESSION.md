NIP-SUCCESSION
==============

Key succession: a pre-committed migration key, a successor that consents, and contacts that follow
-------------------------------------------------------------------------------------------------

`draft` `optional`

> **Status: third draft, 2026-09-09.** Self-contained. Two regular kinds,
> `1360` and `1361`, one profile field, one client rule, and known-answer
> vectors. Earlier drafts reused the kind numbers of an open upstream
> proposal; this one stands on its own and coordinates with nobody.

## Motivation

On Nostr a key is a person and a key cannot change. Lose it and you are a
new person; leak it and an attacker is you. Every proposal to fix this
agrees on the shape of the problem and disagrees on the shape of the
answer. What a client actually needs is:

1. a way for a person to say, in advance and in public, which key may
   later move their identity, so that an attacker who steals today's key
   cannot also invent the move;
2. a migration that the successor has agreed to, so that nobody can be
   "moved" onto a key they do not hold;
3. a rule for when a client may follow the move on its own, and when it
   must ask, that does not need a week of web-of-trust debate;
4. a migration key the person never has to store, because a key that has
   to be kept safe for years is a key that gets lost.

## Why not an existing mechanism?

- **A field in kind 0.** A profile is signed by the key being replaced. An
  attacker holding it can write any successor they like. The whole point is
  a commitment made before the key was lost.
- **A kind 1 note and a NIP-05 change.** That is what people do today. It
  is social, manual, and forgeable by whoever holds the key. This draft
  still recommends doing it (§3) for the clients that know nothing else.
- **The open upstream proposals.** Four exist with four shapes: a
  pre-commitment with OpenTimestamps and migration relays; a revocation
  with friend attestations; and two minimal "here is my new key"
  announcements. None carries the successor's consent, none defines an
  automatic path, and none gives the person a migration key they do not
  have to store. This draft takes pre-commitment as the property that makes
  an automatic move safe and adds the rest. It shares no kind numbers with
  any of them, so a client may implement both without ambiguity.

## 1. Pre-commitment, `kind 1360`

A person publishes exactly one pre-commitment from their identity key,
naming one migration public key. Regular kind: it is stored, never
replaced, and the first one published by a key is the only one that counts.

```json
{
  "kind": 1360,
  "pubkey": "<identity pubkey>",
  "created_at": 1793577600,
  "tags": [
    ["p", "<migration pubkey>"]
  ],
  "content": ""
}
```

| Tag | Required | Meaning |
|---|---|---|
| `p` | REQUIRED, at most one | the migration public key; an empty tag list means "this identity will never migrate" |

Rules:

- A client that derives keys from a root (NIP-IDENTITY-TREES) MUST derive
  the migration key deterministically with purpose string `migration` and
  index `0`, publish its pubkey here, and never hold the private half
  outside the signer. At migration time the same root produces the same
  key. Nothing extra is written down, and a root on a hardware signer means
  the migration key was never on a networked machine.
- The identity key MUST itself be a child of that root and MUST NOT be the
  root. A tree rooted in the identity's own secret derives the migration
  key from the very key a thief holds, and protects nothing. The vectors
  show the right shape: root, then `social/0` as the identity.
- A client MUST keep the first `kind 1360` it saw for an identity. If it
  later sees a different `kind 1360` from the same identity, whatever its
  `created_at`, the identity is **contested**: no migration for it is ever
  automatic, and the client says so. `created_at` is chosen by the signer
  and orders nothing; only first-seen and OpenTimestamps do.
- A client SHOULD publish the pre-commitment at first run. A person who
  wants no migration path publishes one with no `p` tag.
- The migration key MUST NOT be used for anything but signing one
  `kind 1361`.
- A client MUST record when it first saw a pre-commitment. That
  first-seen time is evidence in §4. Where a `kind 1040` OpenTimestamps
  attestation (NIP-03) of the pre-commitment exists, it is stronger
  evidence and a client SHOULD prefer it.

## 2. Migration, `kind 1361`

The migration key signs exactly one migration, naming the successor and
the pre-commitment, and carrying the successor's consent.

```json
{
  "kind": 1361,
  "pubkey": "<migration pubkey>",
  "created_at": 1796169600,
  "tags": [
    ["p", "<successor pubkey>"],
    ["e", "<id of the kind 1360>", "<relay hint>"],
    ["successor-sig", "<64-byte BIP-340 signature, hex>"],
    ["linkage", "<optional linkage proof, JSON>"]
  ],
  "content": ""
}
```

| Tag | Required | Meaning |
|---|---|---|
| `p` | REQUIRED | the successor public key |
| `e` | REQUIRED | the pre-commitment this migration executes |
| `successor-sig` | REQUIRED | the successor's consent, below |
| `linkage` | OPTIONAL | an NIP-IDENTITY-TREES full proof that the successor and the identity share one root |

`successor-sig` is a BIP-340 signature by the successor key over

```
msg = sha256( "nostr-succession/v1" || 0x00
              || identity_pubkey || migration_pubkey || successor_pubkey
              || u64be(created_at) )
```

with the three pubkeys as 32 raw bytes, `identity_pubkey` taken from the
referenced `kind 1360`'s author, and `created_at` the `kind 1361`'s own. A
verifier recomputes `msg` and checks the signature under the `p` pubkey.
The successor signs before the migration key does, over the `created_at`
the event will carry; a signer that rewrites `created_at` (some NIP-46
signers do) invalidates the consent, so a client MUST compare the returned
event's `created_at` to the one it asked for and re-sign the consent if
they differ.

A `kind 1361` is **valid** only if all of these hold, checked in order:

1. it is a validly signed `kind 1361` whose `created_at` is a non-negative
   integer below 2^53, and the `kind 1360` its `e` tag names is itself
   validly signed and carries exactly one `p` tag. Verifiers MUST verify
   both signatures themselves, never trust a "verified" mark a library
   attached earlier;
2. `p`, `e` and `successor-sig` each appear exactly once and `linkage` at
   most once. A duplicate of any of them is invalid, not "first wins";
3. it is signed by the key named in the `kind 1360`'s `p` tag, and that
   key is not the identity key itself. A `kind 1360` naming its own author
   as migration key is invalid;
4. the successor named in `p` is neither the identity key nor the
   migration key;
5. all pubkeys and `successor-sig` are lower-case hex of the exact length.
   Upper-case or padded forms are invalid, so one event has one wire form;
6. `successor-sig` verifies as above.

Validity says nothing about whether to follow. A second `kind 1361` from
the same migration key is just as valid as the first; its existence makes
every migration by that key manual, the first included (§4).

`linkage`, when present, is the JSON form of an NIP-IDENTITY-TREES full
proof whose child is the successor. A client that cannot verify it MUST
ignore it. The successor SHOULD be generated at migration time; a client
that derives it from the root uses purpose string `successor` and the
lowest unused index.

## 3. Announcements for everyone else

Because a `kind 1361` is signed by a key nobody follows, the identity key
SHOULD, while it still can, also do what people do by hand today: publish a
pinned note naming the successor by npub, repoint its NIP-05 to the
successor, and mark its profile name as moved. Clients on this draft treat
those as social announcements only; clients on nothing see exactly what
they see today.

The successor's kind 0 MUST carry

```json
"predecessor_keys": ["<identity pubkey>"]
```

This is a declaration, not a live link. The successor SHOULD republish the
profile, relay list and contact list it wants to carry forward. Anything
signed by others is not re-signed.

## 4. Client rule

On a valid `kind 1361`, a client MUST choose one of two paths and MUST show
which it took.

**Never automatic** if the client has seen a second, different
`kind 1360` from the identity, or a second `kind 1361` from the same
migration key. Either one contests the move and every path below is off.

Let `seen` be the earlier of the `kind 1361`'s `created_at` and the time
this client first saw it. The `kind 1361`'s own `created_at` is never
enough on its own, because a signer can date it into the future; the
client's own first sight caps it.

**Automatic**, if at least one of these holds:

1. the `kind 1360` was first seen by this client at least 7 days before
   `seen`, or the `kind 1360` carries a `kind 1040` OpenTimestamps
   attestation proving it existed at least 7 days before `seen`. The gap
   applies to attestations too: an attestation made an hour ago proves the
   `kind 1360` existed an hour ago, which an attacker holding the identity
   key can arrange just as easily as they can publish the `kind 1360`;
2. a `linkage` proof verifies, its purpose is `successor`, its child is
   the `p` pubkey, and its master is the root this client had bound to the
   identity at least 7 days before `seen`. The bound root is the master
   key on the identity's own first published linkage proof (kind 30078);
   the client keeps the first it ever bound and never replaces it, because
   an attacker holding the identity key can publish a binding to a root of
   their own;
3. the user holds an out-of-band bond with the person, a shared secret
   established in person, and a fresh bond ceremony succeeds with the key
   named in `p`. A bond with any other key proves nothing about this
   migration;
4. someone the user trusts has published an attestation naming the identity
   and the key named in `p`, in whatever form the client honours: a signed
   attestation from a named friend, a ring-signed attestation from the
   user's circle in which the attester is not named, or a ring-signed
   identity bridge tying the two keys when they share no root.

Automatic means: follows, mutes, NIP-51 lists and local contact books are
rewritten from the identity key to the successor; the old key is shown as
retired under the same name; nothing is silently deleted.

**Manual** otherwise: the client shows the migration with the evidence it
has and does nothing until the person decides.

A `successor-sig` alone is never enough, because an attacker holding the
migration key can mint a successor and sign with it. What makes the move
automatic is a commitment that demonstrably predates it, a shared root
bound before it, or a person who checked out of band.

Filters a client uses:

```json
{"kinds": [1360], "authors": ["<identity pubkey>"]}
{"kinds": [1361], "authors": ["<migration pubkey from the 1360>"]}
{"kinds": [1361], "#e": ["<id of the 1360>"]}
```

## 5. Where the events live

Nostr relays keep no order and no promise. A `kind 1360` that a relay can
drop or that an attacker can post late is worth less than one many parties
saw early. So:

- a client MUST publish a `kind 1360` to every relay it writes to and
  SHOULD ask a trusted contact to fetch and record it;
- a relay a circle runs for itself, one that never prunes its members'
  events, is a natural place for a circle's pre-commitments, and its
  first-seen time is one the circle can trust;
- where the ecosystem settles on shared migration relays with
  OpenTimestamps, this draft uses them as evidence under §4 rule 1 and
  adds nothing to them.

## Security considerations

- **Leak of the identity key.** The attacker cannot sign a `kind 1361`,
  cannot change a `kind 1360` others already hold, and cannot produce a
  `linkage` proof for a key outside the root. They can publish a note or a
  NIP-05 change pointing at their own key; clients on this draft treat
  those as social announcements only and never follow them automatically.
- **Leak of the migration key.** The attacker can sign a `kind 1361` and
  forge consent for a key they hold. Rule 1 in §4 makes that automatic for
  contacts, which is the exposure any pre-commitment scheme accepts.
  Deriving the migration key from a root on a hardware signer is the
  mitigation; the key never exists on a networked machine.
- **Leak of the root.** Everything derived is lost. Recovery words and
  coercion-resistant recovery are the answer, not this draft.
- **A late pre-commitment.** An attacker who steals a key before any
  `kind 1360` exists can publish their own and migrate. The only defence is
  to publish early, which is why §1 says first run.
- **Two migrations.** Only the first counts. A client that sees two treats
  both as manual.
- **A compromised migration key that has not been used.** There is no
  cancel. The person's remedy is to migrate first, to a fresh successor of
  their own, before the attacker does; a client that learns a migration
  key may be exposed SHOULD offer exactly that.
- **A lost root with a live identity.** The person cannot migrate and
  cannot replace the `kind 1360`, because the first one is forever. Choose
  the root, and its recovery, before publishing.
- **Replay and cross-protocol.** `successor-sig` binds all three pubkeys
  and `created_at` under a domain prefix, so it verifies nowhere else.

## Relationship to community proposals

Two entries on NostrHub cover the same ground. "Key Migration" claims kinds
360, 361 and 362 for a pre-commitment, a migration and Shamir shards with
OpenTimestamps and migration relays; "Simpler Social Key Migration" is a
single announcement kind with comments. This draft shares no kind numbers
with either. It differs from the first in carrying the successor's consent,
deriving the migration key instead of sharding it, and defining an
automatic path; it differs from the second in being a commitment rather
than an announcement. A client may honour all three.

## Compatibility

- Clients on nothing see a pinned note and a NIP-05 that moved.
- Clients on any of the upstream proposals see nothing of this draft's
  kinds and lose nothing; a client MAY implement both.
- This draft allocates two regular kinds, `1360` and `1361`, reserves two
  tag names on them, `successor-sig` and `linkage`, and one profile field,
  `predecessor_keys`.

## Vectors

`vectors/succession.json` in this repository carries a test-only root (the same 32 bytes
forgesworn-link uses for "nostr A"), its derived identity (`social`, 0),
migration (`migration`, 0) and successor (`successor`, 0) keys under
nsec-tree, a full linkage proof for the successor, a `kind 1360`, a second
contesting `kind 1360`, and fourteen `kind 1361` cases. Two are invalid
(a bad `successor-sig`, a consent made over a different `created_at`). The
rest are valid and split by path: automatic with linkage and an old
pre-commitment; manual and automatic without linkage by the age of the
pre-commitment; a hijack by a holder of the migration key, automatic against
an old pre-commitment (the exposure this draft accepts) and manual against a
fresh one; a second migration by the same key, and the first migration once
that second exists, both manual; an OpenTimestamps attestation thirty days
old (automatic) and an hour old (manual); a future-dated migration; a
linkage against a root bound an hour ago; and a contested identity. Each
case carries the client's first-seen times and states the expected outcome
and the reason. Signatures carry random auxiliary data, so a verifier checks
them and does not compare bytes. Two independent implementations must agree
on every case: a verifier written from this text alone, and the reference
library.
