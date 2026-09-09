NIP-SUCCESSION
==============

Key succession for Nostr: a pre-committed migration key, a successor that consents, and contacts that follow
------------------------------------------------------------------------------------------------------------

`draft` `optional`

> **Status: second draft, 2026-09-09.** This draft allocates no kinds. It
> builds on the most developed upstream proposal, NIP-41 key migration
> ([nostr-protocol/nips#2137], kinds 360 and 361, pre-committed migration
> key, OpenTimestamps, migration relays), and adds four things: a migration
> key you never have to store, consent from the successor, an automatic path
> when the evidence is strong, and the out-of-band attestation its reviewers
> asked for. It also says how to stay compatible with the three simpler
> proposals in flight. The intent is to contribute the additions to #2137,
> not to open a fifth proposal.

[nostr-protocol/nips#2137]: https://github.com/nostr-protocol/nips/pull/2137

## Motivation

On Nostr a key is a person and a key cannot change. Lose it and you are a
new person; leak it and an attacker is you. Four proposals address this and
they disagree on shape:

| Proposal | Shape | What it gives | What it lacks |
|---|---|---|---|
| #2137, NIP-41 (hodlbod) | kind 360 pre-commits a migration key; kind 361, signed by that key, names a successor; OpenTimestamps and migration relays order them | the only design where an attacker with the current key cannot migrate you | the migration key must be stored somewhere safe; no consent from the successor; no out-of-band attestation; automatic follow is forbidden |
| #1452 (braydonf) | kind 50 revocation with `successor-key`; kind 30050 friend attestations; `migration_keys` in kind 0 | relay-side revocation; friends remember who you were | pre-commitment is only advisory |
| #1056 (vitorpamplona) | kind 18 revocation with `p` | simplest possible | manual and social only |
| NostrHub "Simpler Social Key Migration" (vitorpamplona) | kind 39 with `p`, NIP-22 comments to debate | simplest possible | manual and social only |

This draft takes #2137 as its base because pre-commitment is the property
that makes an automatic move safe, and adds what a client needs to actually
move contacts without a week of web-of-trust debate.

## 1. Pre-commitment, with nothing to store

A person publishes a kind 360 exactly as #2137 defines it, naming one
migration pubkey. A client that derives keys from a root (NIP-IDENTITY-TREES,
nsec-tree) MUST derive the migration key deterministically with purpose
string `migration` and index `0`, publish its pubkey in the kind 360, and
never hold the private half outside the signer. At migration time the same
root produces the same key. Nothing extra is written down, and a root on a
hardware signer means the migration key was never on a networked machine.

A client SHOULD publish the kind 360 at first run. A person who wants no
migration path publishes an empty kind 360, as #2137 describes.

## 2. Announcement, with the successor's consent

The migration key signs a kind 361 as #2137 defines it, naming the successor
and the precommit event, with two additional tags:

```json
{
  "kind": 361,
  "pubkey": "<migration-pubkey>",
  "created_at": <unix seconds>,
  "tags": [
    ["p", "<successor-pubkey>"],
    ["e", "<id of the kind 360>", "<relay hint>"],
    ["successor-sig", "<64-byte-hex-bip340-signature>"],
    ["linkage", "<optional nsec-tree linkage proof, JSON>"]
  ],
  "content": ""
}
```

`successor-sig` is a BIP-340 signature by the successor key over

```
msg = sha256( "nostr-succession/v1" || 0x00
              || identity_pubkey || migration_pubkey || successor_pubkey
              || u64be(created_at) )
```

with the three pubkeys as 32 raw bytes, `identity_pubkey` taken from the
referenced kind 360's author, and `created_at` the kind 361's own. A verifier
recomputes `msg` and checks the signature under the `p` pubkey. A kind 361
without a valid `successor-sig` is a migration with an unconsenting
successor and MUST be treated as #2137 treats it today: shown, never
followed automatically.

`linkage`, when present, is an nsec-tree proof that the identity key and the
successor share one root, in the JSON form nsec-tree's `prove('full')`
emits. A client that cannot verify it MUST ignore it.

The successor SHOULD be generated at migration time, as #2137 says. A client
that derives it from the root uses purpose string `successor` and the lowest
unused index.

## 3. Announcements for everyone else

Because the kind 361 is signed by a key nobody follows, the identity key
SHOULD, while it still can, also publish the simplest social announcement
the ecosystem will honour: a kind 39 (NostrHub) or kind 18 (#1056) with
`["p", "<successor-pubkey>"]`, whichever is merged, or both while neither
is. Before that it SHOULD publish a pinned kind 1 naming the successor by
npub, repoint its NIP-05 to the successor, and mark its profile name as
moved. Old clients then see exactly what people do by hand today.

Order matters where a relay implements #1452's revocation: the social
announcements go first, the revocation last.

## 4. Acceptance

The successor's kind 0 MUST carry

```json
"predecessor_keys": ["<identity-pubkey>"]
```

This is a declaration, not a live link; #2137's advice that implementations
should not try to keep the two identities live-linked stands. The successor
SHOULD republish the profile, relay list and contact list it wants to carry
forward. Anything signed by others is not re-signed.

## 5. Client rule

On a valid kind 361 with a valid `successor-sig`, a client MUST choose one of
two paths and MUST show which it took.

**Automatic**, if at least one of these holds:

1. the kind 360 was seen by this client at least 7 days before the kind
   361's `created_at`, or carries a valid OpenTimestamps attestation older
   than the kind 361 as #2137 Appendix A describes;
2. a `linkage` proof verifies and the client already trusted the identity key
   as a derived key of the same root;
3. the user holds an out-of-band bond with the person, a shared secret
   established in person, and a fresh bond ceremony with the successor
   succeeds;
4. a kith of the user has published a #1452 kind 30050 attestation naming the
   pair.

Automatic means: follows, mutes, NIP-51 lists and local contact books are
rewritten from the identity key to the successor; the old key is shown as
retired under the same name; nothing is silently deleted.

**Manual** otherwise: the client shows the migration with the evidence it
has and does nothing until the person decides.

This is a deliberate departure from #2137's "SHOULD NOT follow successor
keys without explicit user approval". The departure is narrow: automatic
only when a pre-commitment demonstrably predates the migration, when the
keys share a root, or when the person has verified out of band. A
`successor-sig` alone is never enough, because an attacker holding the
migration key can mint a successor and sign with it.

## 6. Attestation

Reviewers of #2137 asked how a follower records "I verified out of band that
this person changed keys". Two answers, both already specified elsewhere:

- a #1452 kind 30050 attestation, public or private;
- an out-of-band bond with the successor, a shared secret established in
  person, stored locally and never published.

A client that completes either SHOULD offer the automatic path to that user
on the strength of it.

## 7. Relays and boxes

#2137's migration relays and OpenTimestamps are adopted as specified once
they exist. Until then, path 1 above rests on the client's own first-seen
record, which is weaker and is said so in the indicator.

A relay a circle runs for itself, one that never prunes its members'
events, is a natural migration relay for that circle: a kind 360 seen there
has a first-seen time the circle can trust. This does not replace
network-wide migration relays and does not claim to.

## Security considerations

- **Leak of the identity key.** The attacker cannot sign a kind 361, cannot
  change the kind 360 that migration relays or the circle already hold, and
  cannot produce a `linkage` proof for a key outside the root. They can
  publish a kind 39 or 18 pointing at their own key; clients on this draft
  treat those as social announcements only and never auto-follow them.
- **Leak of the migration key.** The attacker can sign a kind 361 and forge
  successor consent for a key they hold. Path 1 makes that automatic for
  contacts, which is the same exposure #2137 accepts. Deriving the migration
  key from a root on a hardware signer is the mitigation; the key never
  exists on a networked machine.
- **Leak of the root.** Everything derived is lost. Recovery words and
  coercion-resistant recovery are the answer, not this draft.
- **Two kind 361s.** Only the first published counts, per #2137. A client
  that sees two treats both as manual.
- **Replay and cross-protocol.** `successor-sig` binds all three pubkeys and
  `created_at` under a domain prefix, so it verifies nowhere else.

## Compatibility

- Clients on #2137 see a valid kind 361 and behave as they do today.
- Clients on #1452, #1056 or the kind 39 draft see their own announcement.
- Clients on none of them see a pinned note and a NIP-05 that moved.
- This draft allocates no kinds and reserves two tag names, `successor-sig`
  and `linkage`, and one profile field, `predecessor_keys`.

## Relationship to community proposals

- NostrHub "Key Migration" (hodlbod) has moved to #2137 and is the base here.
- NostrHub "Simpler Social Key Migration" (vitorpamplona, kind 39) is the
  social announcement in §3.
- #1452's kind 30050 attestation is adopted in §6 unchanged.

## Vectors

`vectors/succession.json` in this repository carries a test-only root (the
same 32 bytes forgesworn-link uses for "nostr A"), its derived identity
(`social`, 0), migration (`migration`, 0) and successor (`successor`, 0)
keys under nsec-tree, a full linkage proof for the successor, a kind 360,
and seven kind 361 cases: one that passes on the automatic path, one that
fails on `successor-sig`, one that fails on a `created_at` mismatch, two
without linkage that land on manual and automatic by the age of the
pre-commitment, one hijack by a holder of the migration key (valid, and the
exposure #2137 accepts), and a competing second migration that loses to the
first. Signatures carry random auxiliary data, so a verifier checks them and
does not compare bytes. Each case states the expected outcome and the reason.
