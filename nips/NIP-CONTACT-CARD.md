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

A card is a UTF-8 JSON object, encoded as unpadded base64url, carried after
`#` in a link or as the whole content of a QR code. Nothing before `#` is
needed and an HTTP server never sees the fragment. A card is at most 16 KiB.

```json
{
  "v": 1,
  "p": "<64 hex, x-only public key of the person or persona>",
  "rz": "<64 hex, x-only rendezvous public key, a child of the person's root>",
  "name": "<display name; sanitised on read, never trusted>",
  "issued": <unix seconds>,
  "expires": <unix seconds>,
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
  "bond": { "v": 1, "pubkey": "<64 hex>", "displayName": "<optional>", "nonce": "<32 hex>", "personas": [ { "pubkey": "<64 hex>", "label": "<optional>" } ] },
  "sig": "<128 hex, BIP-340 signature by p>"
}
```

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
  exchange. Optional.

## 2. Signature

There is no canonical JSON. The signature covers a digest built from the
parsed fields, in the way a signed join invite does, so a reader
recomputes it from what it has already validated:

```
box_i  = p_i || "/" || claim_i || "/" || card_i || "/" || carriers_i.join("+")
digest = sha256( utf8( "nostr-contact-card:v1"
                       + ":" + p + ":" + rz
                       + ":" + issued + ":" + expires
                       + ":" + eph
                       + ":" + relays.join(",")
                       + ":" + boxes.map(box).join(",")
                       + ":" + (attest ?? "")
                       + ":" + (bond ? sha256hex(handshakeBytes(bond)) : "")
                       + ":" + sha256hex(utf8(name)) ) )
sig    = BIP-340 sign(digest, secret key of p)
```

`handshakeBytes` is the canonical form of the bond object: UTF-8 JSON with
no whitespace, keys in exactly this order and absent keys omitted:
`v`, `pubkey`, `displayName`, `nonce`, `personas`; inside `personas`, each
entry's keys in the order `pubkey`, `label`. It is defined here so that a reader in any
language reproduces it from parsed fields. Fields that could carry a separator are hashed, not
joined. A reader MUST reject a card whose
`relays` contain a comma or whose box fields contain `/`.

## 3. Reading a card

In this order, and the first failure rejects the card:

1. size at most 16 KiB; base64url decodes; JSON parses; `v` is 1;
2. every hex field is the right length and lower case after normalisation;
3. `expires > now` and `expires - issued <= 30 days` and `issued <= now +
   300`;
4. the signature verifies under `p` over the digest in §2;
5. each box's `card` decodes and passes Link SPEC §2.3, rules 1 to 8. The
   node id inside is the one `p` endorsed by signing this card, so rule 9's
   expected id is that node id, and the reader pins it to the box's `p`.

A card that passes steps 1 to 5 makes a contact, starts a bond, yields
rendezvous material and names a box the reader may dial at once. Nothing
outside the card is fetched to get there.

6. **Refresh.** The Link card inside expires within a week and the contact
   card within 30 days. To keep dialling after that, the reader fetches a
   fresh Link card from the box: any event signed by the box's own key
   `p_box`, in whatever shape the box's own protocol publishes, whose Link
   card verifies under SPEC §2.3 with the pinned node id as the expected
   id. A fresh card with a different node id is refused until a new
   contact card from `p` endorses it. `claim` names the box's own binding
   event where the box publishes one; a reader that cannot fetch it loses
   nothing but the box's self-reported facts.

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

- A client that knows nothing of this draft receives a link it cannot open
  and an npub it can. A card SHOULD be shown beside its npub wherever it is
  displayed so that the fallback is a copy away.
- Everything referenced is specified elsewhere and unchanged: NIP-01 keys,
  BIP-340 signatures, forgesworn-link `FSL-CARD-1` and rendezvous
  derivation, the box's own claim and status events, the bond handshake
  and ceremony, and whatever attestation `attest` points at.
- No kind is allocated and no tag name is reserved.

## Vectors

`vectors/contact-card.json` in this repository carries ten cards using the same test keys as
forgesworn-link: one that passes with a box, a Link card
and a bond; one that passes with none of those; and one failing at each of
steps 1 to 5, including a tampered name, a tampered box and an expired Link
card inside; and two refresh cases, a fresh Link card under the pinned node
id that is accepted and one under a different node id that is refused. Signatures carry
random auxiliary data, so a verifier checks them and does not compare bytes.
