NIP-DEVICE-CREDENTIAL
=====================

One identity, many devices, each with its own key, and a lost phone that is a device event and not an identity event
----------------------------------------------------------------------------------------------------------------------

`draft` `optional`

> **Status: first draft, 2026-09-09.** This draft reuses KithMoot's kind
> 20460 device credential, which is shipped and vectored per room, and
> widens its scope from one room to the person. It allocates no kind of its
> own. The room-scoped form stays exactly as it is; the person-scoped form
> is the same event with a different `d` and an extra tag, so a verifier
> that knows one knows the other.

## Motivation

On Nostr a device is the key. Every phone, laptop and tab that acts for a
person holds the same secret, and losing one means losing all of them, or
trusting that whoever has the phone will not use it. KithMoot already
solved this inside a room: a participant signs a short-lived credential
naming a device key, the device signs everything else, and the credential
travels only inside the room's encryption. This draft wants the same for
the person, across rooms, DMs, files and the box a person or their circle
runs.

## 1. The event

```json
{
  "kind": 20460,
  "pubkey": "<identity pubkey>",
  "created_at": <unix seconds>,
  "tags": [
    ["d", "<scope>"],
    ["device", "<device pubkey, x-only hex>"],
    ["expiration", "<unix seconds>"],
    ["scope", "person"],
    ["label", "<what the person calls this device, sanitised on read>"]
  ],
  "content": ""
}
```

- `d` is the room id for a room credential, unchanged, and the identity
  pubkey itself for a person credential. A verifier that is checking a
  room credential compares `d` to the room; one checking a person
  credential compares `d` to the signer.
- `scope` is present only on the person form and is the string `person`.
  A room credential has no `scope` tag; a reader that finds one on a room
  credential refuses it.
- `device` and `expiration` are as KithMoot defines them. Expiry MUST be at
  most 30 days ahead for the person form; a client renews before it lapses
  and a device that fails to renew stops being able to act, which is the
  intended failure.
- `label` is the person's own name for the device, shown to them and to
  nobody else.

Kind 20460 is ephemeral by number, and that is deliberate: this event is
never published bare to any relay. It travels inside encryption, in
the encrypted roster of a room, in a sealed message to the box, or in the
device's own storage. A relay that sees one has seen a mistake.

## 2. What a device does with it

A device holding a person credential acts for the identity in these
places:

- **Rooms.** The device presents the person credential where KithMoot's
  roster expects a room credential, and the room verifies it with the two
  extra checks of §4 in place of the room-id check. A room that admits the
  person admits the device. A device cannot mint a room credential, because
  a room credential is signed by the participant key and the device does
  not hold it; that is the point.
- **DMs and dead drops.** Rendezvous material for a contact is an ECDH
  between the identity's static key and the contact's, which the device
  cannot compute without the identity secret. Two shapes are allowed and a
  client says which it uses: the root hands the device the per-contact
  shared secret (`static_x`) for each contact, at pairing and whenever a
  contact is added, inside NIP-44; or the device asks the root for it over
  NIP-46 when needed. The device never holds the identity secret in either
  shape. **Open:** NIP-46 has no method that returns a raw shared secret,
  and a client that wants the second shape has to add one.
- **The box.** A box admits uploads and reads for the keeper's tier from
  any device holding a current person credential for the keeper's key, and
  logs the device, not the person, as the signer of what it stored.
- **Signing public events.** Never. A public note is signed by the identity
  through its signer. A device credential is authority inside encryption
  and nowhere a relay can see.

## 3. Issue, renew, revoke

- **Issue.** The root, wherever it lives (a hardware signer, a NIP-55
  signer, a NIP-46 bunker), signs the credential for a new device after a pairing the person
  performed on the new device: the QR and code flow KithMoot already has,
  widened to the person. The pairing carries the credential and the shared
  material of §2 to the device inside NIP-44 and nothing else. The identity
  secret never moves.
- **Renew.** A device asks for a fresh credential before expiry through any
  channel that reaches the root. The root MAY renew silently for a device it
  has renewed before and MUST prompt the person the first time.
- **Revoke.** The root signs a tombstone: a kind 5 naming the credential's
  id, carried on the sheltered lane to every room, box and device the
  person has. A revoked device is refused everywhere the tombstone reaches
  and the person's identity does not change. A client MUST show the person
  their devices with labels and let them revoke any one of them, and MUST
  show a revocation as a device event, not an identity event.
- **Loss of the root.** Out of scope here. That is NIP-SUCCESSION, and a
  person credential lapses on its own inside 30 days.

## 4. Verification

A verifier holds `now` and the identity pubkey it expects, and checks in
order: kind is 20460; the signature verifies under `pubkey`; `d` equals
`pubkey` and `scope` is `person`, or `d` equals the room and `scope` is
absent; `device` is a 32-byte x-only key; `expiration` is a number greater
than `now` and, for the person form, at most 30 days after `created_at`;
and no tombstone for this credential's id has been seen. The first failure
rejects. KithMoot's `verifyDeviceCredential` is the room form of this and
the person form is the same function with the two extra checks.

## Security considerations

- **A credential is authority for its expiry.** A stolen device acts for
  the person until the tombstone reaches the places it acts, or the
  credential lapses. Thirty days is the ceiling, not the recommendation; a
  phone that leaves the house is better at seven.
- **The identity secret never moves.** Nothing in this draft copies it. A
  device that can sign public notes is not a device, it is the identity,
  and that is the thing this draft exists to stop.
- **Relays learn nothing.** The credential never appears on a relay, and
  the device key that does appear, on room events, is not linkable to the
  identity by anyone outside the room's encryption.
- **Tombstones travel inside encryption** and reach a room only when a
  member of it is online. A room that has not heard the tombstone still
  admits the device; the person's client shows which rooms have and have
  not, and the revoked device is refused by the box at once.

## Compatibility

- The room form is byte-identical to KithMoot's shipped credential and
  passes its existing vectors unchanged.
- A verifier that knows only the room form refuses the person form on the
  `d` check, which is the safe failure.
- No kind is allocated. Two tag names are reserved on kind 20460, `scope`
  and `label`.

## Vectors

`vectors/device-credential.json` in this repository carries a person
credential that passes, a room credential that passes the room check, each
presented to the other's verifier (refused), a room credential carrying a
`scope` tag (refused), an expired one, one beyond 30 days, and a tombstone
that revokes the passing one. Signatures carry random auxiliary data, so a
verifier checks them and does not compare bytes.
