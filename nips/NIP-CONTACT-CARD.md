NIP-CONTACT-CARD
================

One QR or link that makes a stranger a contact, names their box, and starts a bond
----------------------------------------------------------------------------------

`draft` `optional`

> **Status: first draft, 2026-09-09.** This draft allocates no kinds and
> defines no new signature scheme. It bundles things that already exist,
> each carried opaquely in the form its own specification freezes: a Nostr
> public key, a forgesworn-link `FSL-CARD-1`, a reference to the box's own
> binding events, a bond handshake, an attestation reference and a
> rendezvous ephemeral. The bundle is signed by the key it introduces. Vectors are
> listed as TODO at the end.

## Motivation

A first private contact arrives by introduction, by presence, or in
person. In every case one person hands another a small
thing and the other's client does the rest. Today that thing is an npub,
which gets you the public lane and nothing else. A contact card gets you:

1. the person, as a key and a name, shown as an npub;
2. their public relays, so the public lane works at once;
3. their box, a relay and store the person or their circle runs, so the
   first private relay a new client ever speaks to is a friend's;
4. rendezvous material, so Link tags (forgesworn-link `docs/RENDEZVOUS.md`)
   and dead-drop keys under the same input key material can be derived from
   the moment the card is read;
5. a bond offer, so an in-person bond ceremony can start there and then;
6. optionally, where to find an attestation the holder may check.

A card is a capability. Whoever holds it can reach the box named in it and
derive rendezvous keys with the person. It is handed over in person, inside
a sealed message, or by a bonded friend making an introduction. It is never
published.

## 1. Shape

A card is a signed Nostr event of kind 21641, encoded as unpadded base64url
of its JSON, carried after `#` in a link or as the whole content of a QR
code. Nothing before `#` is needed and an HTTP server never sees the
fragment. A card is never published to a relay. Its kind is in the
ephemeral range so that a relay which meets one by mistake does not store
it: a card carries a rendezvous key, a fresh ephemeral and a bond nonce,
and a leaked one should not sit on a relay for thirty days. A card is at
most 16 KiB.

The event's `pubkey` is the person's key `p`, its `created_at` is `issued`,
its NIP-40 `expiration` tag is `expires`, and its `content` is the card.
That is the whole reason it is an event: a NIP-07 extension or a NIP-46
bunker signs events and nothing else, and the profile keeps the identity
secret inside the signer, so the signature a signer already
makes has to be the card's signature.

```json
{
  "kind": 21641,
  "pubkey": "<64 hex, x-only public key of the person or persona: p>",
  "created_at": <unix seconds: issued>,
  "tags": [["expiration", "<unix seconds: expires>"]],
  "content": "<the JSON object below, as a string>",
  "id": "<64 hex, NIP-01 id>",
  "sig": "<128 hex, BIP-340 signature over the id, by p>"
}
```

The content, before it is a string:

```json
{
  "v": 1,
  "rz": "<64 hex, x-only rendezvous public key, a child of the person's root>",
  "name": "<display name; sanitised on read, never trusted>",
  "relays": ["wss://…", "wss://…"],
  "boxes": [
    {
      "p": "<64 hex, the box's own key>",
      "claim": "<64 hex, event id of the keeper-signed claim that binds this box to the person>",
      "card": "<base64url FSL-CARD-1, carried opaquely>",
      "carriers": ["tor", "i2p"]
    }
  ],
  "eph": "<64 hex, x-only ephemeral public key, fresh for this card>",
  "attest": "<optional naddr of an attestation about p>",
  "bond": { "v": 1, "pubkey": "<64 hex>", "displayName": "<optional>", "nonce": "<32 hex>", "personas": [ { "pubkey": "<64 hex>", "label": "<optional>" } ] }
}
```

The event carries exactly one tag, `expiration`, and no other: a tag is
inside the signature, and a second one could carry what a card may not.
`p`, `issued` and `expires` live on the event and nowhere in the content.

Field rules:

- `p` is the key this relationship will use. A persona derived from a root
  (NIP-IDENTITY-TREES) is the normal case; the card carries no linkage proof
  and a reader MUST NOT ask for one. A linkage, if ever shared, travels on
  a private channel after a bond, never on a card.
- `rz` is the key every rendezvous with this person is computed against:
  Link tags and dead-drop keys use `ECDH(reader, rz)`, never
  `ECDH(reader, p)`. It is derived from the person's root with purpose
  `rendezvous` and an index, so its private half can be handed to the
  person's devices and rotated by moving the index and issuing new cards,
  while the identity secret never leaves the signer. It MUST NOT be
  published anywhere but a card, and a reader MUST NOT try to link it to
  `p`.
- `name` is the person's own claim. A reader sanitises it as KithMoot does
  and shows it beside the npub, never instead of it.
- `expires - issued` MUST be at most 30 days. The person, their relays and
  their box keys outlive the card; the Link card and the ephemeral inside
  do not, and a client refreshes them from the box's own status event once
  the card has expired.
- `relays` are public-lane relays, at most 8, `wss://` only, no commas.
- `boxes` has at most 4 entries. `card` is opaque bytes exactly as Link
  SPEC §2 intends, and is at most 4096 bytes decoded. Because the whole
  contact card is signed by `p`, the box entry is the owner endorsement
  Link SPEC §2.4 leaves open: `p` says "this node id is my box". No other
  event is needed to trust the box for a first dial. The 16 KiB cap on the
  whole card wins: two full-size Link cards fit, four do not, and a client
  building a card drops boxes from the end until it fits. `carriers` names the
  anonymous carriers the box speaks (for example `tor`, `i2p`); a reader
  ignores names it does not know.
- `eph` is a fresh secp256k1 key for this card and MUST NOT be reused across
  cards. It plays the part of Link's hint `0x04` for pairs that do not yet
  hold each other's Link cards: with it, the reader derives one-sided
  rendezvous material at once, and both-sided once cards have crossed.
- `attest` is a pointer, never the credential. A reader fetches it later,
  from public relays, and shows what it says under the attestation's own
  rules.
- `bond` is a bond handshake object: `v` is 1, `pubkey` is the key the
  person bonds as (normally `p`), `nonce` is 16 fresh bytes as hex,
  `displayName` and `personas` (at most 16) are optional. It is carried
  verbatim so an in-person bond ceremony starts from the card with no second
  exchange. Optional. Its
  `v` is 1 or absent, `pubkey` 64 lower-case hex, `nonce` 32 lower-case
  hex, `displayName` and each persona `label` text as `name` is, each
  persona `pubkey` 64 lower-case hex, at most 16 personas. Anything else
  in it fails the card. The nonce is a bearer secret for the card's life:
  whoever holds the card can start the ceremony.
- `name`, and every other text a person will see (`displayName`, persona
  labels), is 1 to 100 code points with at least one visible character
  (a letter, number, symbol or punctuation mark), no control, surrogate,
  unassigned or private-use character (Unicode categories Cc, Cs, Cn,
  Co), no line or paragraph separator (Zl, Zp), no space other than
  U+0020 and none at either end, no run of five combining marks, and none
  of the invisible or direction-changing format characters (U+200B to
  U+200F, U+202A to U+202E, U+2060 to U+2064, U+2066 to U+2069, U+FEFF,
  U+00AD, U+061C, U+180E). The zero-width joiner U+200D is allowed only
  beside a pictographic character and the tag characters U+E0020 to
  U+E007F only after one, so an emoji family or a flag reads and a hidden
  joiner does not. A reader refuses a card that breaks this rather than
  cleaning it, because a cleaned name is not the one that was signed.
  Which characters are unassigned, and which are pictographic, depends on
  the Unicode version a reader carries: a reader follows Unicode 15.0 or
  later, and a code point its version has not assigned is refused. Two
  readers on different versions can disagree about a name using a
  character assigned between them; a writer that wants a card read
  everywhere keeps to characters assigned by 15.0.
- `relays`: each is `wss://`, parses as a URL whose host is a DNS name or
  an IP literal, carries no username, password or fragment, no comma and
  no unprintable character; a port, path and query are allowed. This is
  the same rule Link SPEC §2.2 gives a relay hint.
- `expires` is after `issued`; `issued` may be up to 300 seconds after
  the reader's clock.
- `card` in a box is unpadded base64url, nothing outside that alphabet;
  `carriers`, when present, holds 1 to 8 names of 1 to 32 characters from
  `A-Z a-z 0-9 . _ -`; `attest`, when present, is 1 to 512 characters
  with no colon, no space or separator and no unprintable or format
  character. An empty `name`, `attest` or `carriers` is refused rather
  than read as absent, so that a reader can never mistake nothing there
  for nothing said.

## 2. Signature

The signature is the event's, as NIP-01 defines it: `id` is the SHA-256 of
the serialised array `[0, pubkey, created_at, kind, tags, content]` and
`sig` is BIP-340 over `id` under `pubkey`. There is no canonical JSON to
agree on beyond what NIP-01 already fixes, and `content` is signed byte
for byte as carried: a reader verifies the event first and only then
parses the content by §1, so a field the draft does not name, or a key
in a different case, changes nothing about what was signed and never
reaches the application.

`handshakeBytes`, the canonical form of the bond object, is no longer
needed for the signature; it remains what the bond ceremony hashes when
it runs, and a reader that stores a bond stores it cleaned by §1.

## 3. Reading a card

In this order, and the first failure rejects the card:

1. the part after the last `#` is at most 16 KiB (the cap is the card's,
   not the link's); base64url decodes; the bytes are valid UTF-8 with no
   byte-order mark (a reader never repairs bytes to U+FFFD); JSON parses
   to an object whose `kind` is 21641; its `content` parses to an object
   whose `v` is 1;
2. the event's `pubkey`, `id` and `sig` are hex of the right length, lower
   case after normalisation; its `tags` are exactly one `expiration`; and
   every field of the content has the shape and
   bounds §1 gives it: `rz` and `eph`, names and labels, relays, boxes,
   carriers, `attest`, `bond`;
3. `issued` is the event's `created_at` and `expires` the `expiration`
   tag's value, an unsigned decimal integer; `expires > now` and
   `expires - issued <= 30 days` and `issued <= now + 300`;
4. `id` is the NIP-01 id of the six fields as carried and `sig` verifies
   over it under `pubkey`;
5. each box's `card` decodes and passes Link SPEC §2.3, rules 1 to 8,
   verified as that section now states them: the signature check is the
   strict, cofactorless one (canonical encodings, no small-order node id
   or nonce point, `S` below the group order, `[S]B = R + [k]A`), relay
   hints pass the URL rule above with no byte-order mark, onion hints are
   a 56-character base32 host and a non-zero port, an ephemeral hint
   starts `0x02` or `0x03`, and a serial that does not fit in 53 bits
   fails rule 3. The node id inside is the one `p` endorsed by signing
   this card, so rule 9's expected id is that node id, and the reader pins
   it to the box's `p`.

A reader's clock must be a finite number of seconds, and the highest
serial it holds for a node an integer; a reader given anything else
refuses the card rather than skipping the check that needed it.

A card that passes steps 1 to 5 makes a contact, starts a bond, yields
rendezvous material and names a box the reader may dial at once. Nothing
outside the card is fetched to get there.

What the reader returns is a card rebuilt from the fields §1 names: `p`,
`issued` and `expires` from the event, the rest from the content, plus the
event's `id` and `sig`. A key on the wire that §1 does not name,
`__proto__` included, whether on the event (where it is outside the
signature) or inside the content (where it is signed), MUST NOT reach the
application under a verified result.
Hex case is normalised and base64url padding tolerated, so one card has
several wire forms; anything that caches or deduplicates a card MUST key
on its fields, not its bytes.

6. **Refresh.** The Link card inside expires within a week and the contact
   card within 30 days. To keep dialling after that, the reader fetches a
   fresh Link card from the box: any event signed by the box's own key
   `p_box`, in whatever shape the box's own protocol publishes, whose Link
   card verifies under SPEC §2.3 with the pinned node id as the expected
   id. A fresh card with a different node id is refused until a new
   contact card from `p` endorses it. Rule 8 is what stops an old card of
   the same node replaying, and rule 8 needs the highest serial this
   reader accepted for that node id: a reader persists it per node id
   from the first read on, or accepts replays. `claim` names the box's
   own binding event where the box publishes one; a reader that cannot
   fetch it loses nothing but the box's self-reported facts.

A client MUST show whether a box is dialled on the card's endorsement or
on a refreshed Link card.

## 4. What the reader derives

- **Contact.** `p`, shown as an npub with `name` beside it, on the public
  lane through `relays`, as an nprofile would.
- **First private relay.** The box's Link card, once step 6 holds, is the
  first relay hint the client uses for this contact and, if it had none, the
  first it ever uses. No vendor endpoint is ever needed to reach it.
- **Rendezvous.** With the reader's own rendezvous key and the card's `rz`
  and `eph`, the reader derives Link tags (`docs/RENDEZVOUS.md` §2, one-sided
  case with the card's side carrying) and dead-drop keys under the same
  input key material. When the reader hands back its own card the
  pair moves to the both-sided case. The ikm is byte-identical across the
  two uses, so a pair that exchanged cards for one purpose has the other
  for free.
- **Bond.** The `bond` payload starts the in-person ceremony: an ECDH bond
  between the two keys and spoken words derived from it, confirmed aloud. A
  completed bond is a verified relationship; the card alone is an
  acquaintance.
- **Attestation.** `attest`, if present, is fetched later and displayed
  under its own rules. It never gates anything.

## 5. Exchange

Two people in the same place show each other a QR: two cards cross, both
sides reach the both-sided rendezvous case, and the bond ceremony runs. An
introduction carries a card inside the introducer's sealed
statement. A card sent as a sealed message is fine; a
card posted to a public relay, a profile or a website is a mistake the
client MUST refuse to make: it is a capability to reach a box and to derive
keys with a person.

## Security considerations

- **A card is a capability, and a small one.** Its holder can reach the
  named box and learns `p`, `rz` and `eph`. They cannot derive rendezvous
  material: the one-sided tag needs either the reader's own static secret
  or the ephemeral's private half, and a card carries neither. A lost card
  yields a box address and two public keys. It is not identity: the box
  still decides admission by its own rules and a bond still needs the
  ceremony.
- **Replay.** `issued`, `expires` and the fresh `eph` bound a card in time;
  the Link card inside carries its own serial and expiry. An old card yields
  an expired Link card and stale rendezvous material, and nothing else.
- **Forgery.** A card is signed by the key it introduces. A forged card
  introduces the forger's key, which is an ordinary stranger; the bond
  ceremony is where a person is confirmed, and the card cannot skip it.
- **The name.** Free text from a stranger, shown beside the key and never
  as authority, exactly as elsewhere in the profile.
- **A stolen device.** A device holds the private half of `rz`, never of
  `p`. Losing one leaks the rendezvous material for the current index; the
  person moves to the next index, issues new cards, and their identity is
  untouched.
- **Linkage.** Nothing on a card ties `p` to any other key. A reader that
  wants that asks a bonded friend privately.

## Compatibility

- **Why an event and not a bare digest.** An earlier form of this draft
  signed a 32-byte digest of the fields, which only a client holding the
  raw key could produce. A NIP-07 extension or a NIP-46 bunker signs
  events and nothing else, and the profile keeps the identity secret in
  the signer, so that form could not be made by the people the profile is
  for. It was found while wiring the reference clients on 2026-09-09 and
  replaced before publication; nothing was issued under the old form.
- A client that knows nothing of this draft receives a link it cannot open
  and an npub it can. A card SHOULD be shown beside its npub wherever it is
  displayed so that the fallback is a copy away.
- Everything referenced is specified elsewhere and unchanged: NIP-01 keys,
  BIP-340 signatures, forgesworn-link `FSL-CARD-1` and rendezvous
  derivation, the box's own claim and status events, the bond handshake
  and ceremony, and whatever attestation `attest` points at.
- Kind 21641 is the card event's, in the ephemeral range (NIP-01), and
  never appears on a relay; `expiration` is the NIP-40 tag with its
  ordinary meaning. No other tag name is reserved. An earlier revision
  used 30641, an addressable kind beside the box's own kinds; it moved on the
  box's co-author's point that a kind a relay never stores is the safer
  home for a bearer nonce, and 30641 goes back to the box's reservation.

## Vectors

`vectors/contact-card.json` in this repository carries thirty-three cards using the same test
keys as forgesworn-link: cards that pass with a box, a
Link card and a bond; with none of those; with unnamed keys on the event
and inside the signed content, which the reader must strip; with an
emoji sequence in the name; with upper-case bond hex, which the reader
normalises; and cards failing at each of steps 1 to 5, including the
wrong kind or content version, the earlier addressable shape (kind 30641
with a `d` tag), an extra tag, an expiration that is not a number, a tampered name, a tampered box, a tampered time, a foreign key
on the event, an expired Link card inside, a name with a format
character, too long, or holding a lone surrogate, a box card outside
base64url, an empty carrier list, an empty attest, a malformed bond, a
future issue date, an expiry before the issue date, a non-`wss://`
relay, a relay with credentials, and Link cards whose relay hint is not a
URL or starts with a byte-order mark. Six refresh cases: a fresh Link card under the
pinned node id that is accepted; one under a different node id, a stale
one, one under a small-order node id with a signature that ZIP-215 would
accept, one whose nonce point carries torsion so that only a cofactored
check accepts it, and a replay with a serial no higher than the one
already seen, all refused. `vectors/verify-contact-card.mjs` is a
reference reader for §2 and §3 written from this text and runs with `npm
test`; `vectors/generate-contact-card.mjs` regenerates the file.
Signatures carry random auxiliary data, so a verifier checks them and
does not compare bytes. Two implementations must agree on every case.
