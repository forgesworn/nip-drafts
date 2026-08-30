# NIP-BOTHY — the Bothy shelter events

> Proposed from `forgesworn/bothy` (source of truth: `docs/2026-08-30-bothy-events-draft.md`, v0.6, 2026-08-31).
> Draft for joint review; the reference implementation is `forgesworn/bothy-node` (`crates/bothy-core/src/events/`, frozen vectors in `vectors/events/`).

=========

Bothy Node Events — claim, status, grant, pin, tombstone, report, command
-------------------------------------------------------------------------

`draft` `optional`

*Version 0.6, revised 2026-08-30 by Quill. **This file is a living draft,
revised in place** — unlike this repo's dated reviews and briefs it is not
frozen at the date in its filename; each revision edits the text above and
records what it changed, with its origin, under "Changes in v0.6" at the foot.
Provenance: drafted against `BOTHY.md` v0.5 (§3.4, §3.5, §3.8, §4,
§5.1a–§5.5, §7, §13, §14.1) and `docs/2026-08-30-phase-1-scope.md`
(D2, D4, D8, D10, §7);
revised against `docs/2026-08-30-bothy-node-build-brief.md` (§4.5, §4.7, O10),
what building it found (T4, T12–T16b) and the fourth design review
(`docs/2026-08-30-design-review-v0.5.md`, §B and §C). `nip-drafts` material
held in the `bothy` repo until the daemon's tables are generated from it; it
closes §10 Q1 and supplies the "later revision with the Bothy pairing flow"
that Link `SPEC.md` §2.4 defers to. MUST / MUST NOT / SHOULD / MAY are RFC
2119. Section references without a repo name are `BOTHY.md`.*

## Abstract

A **bothy** is a home storage node — a plug-in box or a spare phone — that
shelters encrypted blobs over Blossom for its keeper, that keeper's guests and
a commons. This NIP defines the seven events a bothy and its keeper exchange:
a **claim** binding a node to a keeper, a **status** publishing that node's
reachability and capacity, a **grant** admitting a guest or a peer, a **pin**
claiming hashes as one's own, a **tombstone** withdrawing them, a private
**replica report**, and a private **command** channel that replaces an admin
web page. Throughout, *the keeper signs bindings and the node signs facts*;
anything naming a person, a blob or a friend is either gift-wrapped (NIP-59)
or carried in-band with the request it authorises.

## Terms

* **keeper** — the person who owns one or more nodes, identified by a Nostr
  master key that may live in a hardware signer reached over NIP-46.
* **node** — one bothy: a phone or a box. It mints its own Nostr key on first
  run and a separate Ed25519 ForgeSworn Link transport key.
* **bothy key** — the node's Nostr keypair, *not* derived from the keeper's
  master (a stolen node must not hold the keeper's identity, §7). It is also
  the static key of the Link rendezvous ECDH (`RENDEZVOUS.md` §2), so **every
  node has one**. It lives in one file, `<data_dir>/bothy.key`, and `retire`
  wipes it.
* **key set** — the keeper's keys as listed in a claim: `master`, exactly one
  `stash` child, zero or more `persona`, and the `node` key the claim is about.
  A signature by a listed key is "the keeper's" for that role's purposes.
* **class** — the durability the *owner* asked for: `working`, `circle`,
  `vital`, `open`. Travels in the pin.
* **tier** — the priority the *sheltering* node gives bytes: keeper, kith,
  commons. Assigned locally, never transmitted (§7).
* **pin** — a signed claim of ownership over hashes, with a class, a copy
  ceiling and a lease. Portable: honoured without an account.
* **grant** (invite, or invite plus promise) — a keeper-signed capability naming
  a guest pubkey, a mandatory byte ceiling and an expiry; with a `promise` tag
  it is also a federation promise. Grants name **keepers, never nodes** (§5.2).
* **tombstone** — a keeper-signed withdrawal of hashes: remove, refuse
  re-mirror, gossip so peers can honour it.

## Kinds

| kind | name | type | signed by | public? |
| --- | --- | --- | --- | --- |
| 30640 | Node claim | addressable | keeper's `master` | yes |
| 10640 | Node status | replaceable | the `node` (bothy) key | yes |
| 30642 | Shelter grant | addressable | `stash` (or `master`) | **no** — never relayed unwrapped |
| 30643 | Tombstone set | addressable | `stash` (or `master`) | yes |
| 24242 | Pin | Blossom BUD-11 shape, `t=pin` | `stash` (or `master`) | **no** — in-band only |
| 24640 | Grant delivery | NIP-59 rumor | sealer = issuer | no |
| 24641 | Replica report | NIP-59 rumor | sealer = node | no |
| 24642 | Command | NIP-59 rumor | sealer = keeper key | no |
| 24643 | Command reply | NIP-59 rumor | sealer = node | no |

30640/30642/30643 sit in an addressable block unused by the other `nip-drafts`
NIPs (which stop at 30599 and 31402) and by any NIP known at the date above;
10640 avoids NIP-51's 10000–10030, NIP-17's 10050/10051, BUD-03's 10063 and
NIP-66's 10166. The rumor kinds sit in the ephemeral range beside `roost-kit`'s
20078/24078 and Blossom's 24242 deliberately: a rumor that escapes its wrapper
through a bug is then not stored by a conformant relay. Allocation must be
re-checked before upstreaming. A bothy also publishes an unmodified **kind
10063** (BUD-03) server list pointing at its bridge URL, so a vanilla Nostr
client still resolves blobs; that event is not defined here.

---

## Claim (`kind:30640`)

Binds one node to one keeper. **One claim per node**: a keeper's nodes are the
set of their claims (`BOTHY.md` §10 Q18), so adding a box never retires a phone.
Signed by the keeper's master, once per node, wherever the master lives —
Heartwood over NIP-46, a bunker, or the app's own signer (scope D8). The Bothy
app never holds the master.

### Tags

| tag | card. | value | rule |
| --- | --- | --- | --- |
| `d` | 1 | node's bothy pubkey | 64 lowercase hex |
| `p` | ≥ 2 | `[pubkey, relay_or_empty, role]` | roles: `node`, `master`, `stash`, `persona` |
| `role` | 1 | `phone` \| `box` | the node's hardware role, keeper-stated |
| `region` | 0–1 | free text ≤ 64 bytes | keeper-stated, a proxy for off-site (§10 Q3) |
| `status` | 1 | `active` \| `retired` | `retired` is terminal, see below |
| `name` | 0–1 | free text ≤ 32 bytes | optional label; **public**, so no address, no surname |
| `alt` | 0–1 | NIP-31 human summary | |

Exactly one `p` with role `node`, whose pubkey MUST equal `d`. Exactly one with
role `master`, whose pubkey MUST equal the event's `pubkey`. Exactly one with
role `stash` while `status` is `active`. Any number of `persona`. `content`
MUST be the empty string.

The `stash` entry is what lets a node, and a friend's app, tell that a pin,
grant or tombstone signed by the child key is the keeper's — the binding
`BOTHY.md` §10 Q14 asks where to write down. It is written here.

### Pairing: how a claim reaches its node

A node that has never been claimed is in nobody's key set, so there is no
signature it could check to tell the keeper's app from a stranger's. The
**pairing secret** stands in for the claim that does not exist yet (build brief
§4.7, O10). The node phone — or a `bothyd` console — shows a QR carrying the
node's `card`, its bothy pubkey and a 32-hex secret; the keeper's app verifies
the card against that pubkey (`SPEC.md` §2.3 rule 9, with the card's own node
id as expected), signs the `kind:30640` claim with the master over NIP-46, and
delivers it to the node over the Link session the card opened (`PUT
/bothy/claim`, below) and to the keeper's relays.

The secret's authority is deliberately narrow:

* it authenticates **claim delivery only** — it grants no tier, no storage and
  no other route;
* **single use**: it is burned once a claim it carried has been accepted, and
  presenting a spent secret is a conflict — a resubmission, told apart from a
  wrong guess on purpose;
* **10-minute TTL**, and **regenerated on every QR show**, so a photographed
  screen ages out;
* **compared in constant time**, before anything in the body is decoded, so a
  wrong or expired secret is answered identically whatever the claim contains;
* a claim the node refuses under V1 leaves the secret usable for a retry: it is
  spent by acceptance, not by attempt.

**First claim wins** (§13). Once a node holds an `active` claim, a later claim
naming a *different* master is refused before V1 runs, whatever secret
accompanies it: pairing authenticates the delivery of a claim, never a right to
displace one already accepted. And because retirement is terminal (below), a
retired node cannot be paired back into service under its old `d` — a
legitimate re-claim mints a new key and a new `d`.

### Retirement and key-set change

* **Rotate the key set**: republish the same `d`, `status` `active`, new `p`
  set, later `created_at`. Grants and pins signed by a departed key stop being
  the keeper's *from that moment*; blobs already admitted keep their tier until
  the keeper tombstones them.
* **Retire the node**: republish the same `d` with `status` `retired` and no
  `stash` or `persona` entries. Readers MUST then reject that node's status
  events, refuse mirror requests naming it, and drop it from the keeper's node
  set for placement and promise fulfilment — the *grants* are untouched,
  because they name the keeper, not the node (§5.2).
* **`retired` is terminal.** Having accepted a retired claim for a `d`, a
  reader MUST NOT accept a later `active` claim for it. `retire` wipes the
  bothy key (§13), so a legitimate re-claim mints a new key and a new `d`;
  terminality denies a thief the one event that would return a wiped node to
  service.
* NIP-09 deletion MUST NOT be relied on: a suppressed deletion is
  indistinguishable from none, whereas a suppressed *retirement* leaves the
  older claim in force — the safe direction. Publish retirement to every relay
  in the keeper's write set.

---

## Status (`kind:10640`)

Signed by the bothy key. The node's own statement of where it is and what it
will take. Replaceable: one current status per node. Republished when any
field changes, on every card rotation, and at least every 60 minutes; a reader
treats a status older than three intervals as **stale, not dead** — home boxes
lose power and phones sleep (`BOTHY.md` §5.3).

### Tags

| tag | card. | value | rule |
| --- | --- | --- | --- |
| `card` | 1 | base64 `FSL-CARD-1` | standard base64 **with** padding; ≤ 4096 bytes decoded |
| `card-exp` | 1 | unix seconds | MUST equal the card's `expires_at` |
| `node` | 1 | Link node id | lowercase base32, exactly 52 chars, no padding; MUST equal the card's `node_id` |
| `free` | 1 | u64 bytes | rounded **down** to a whole GiB |
| `pool` | 1 | u64 bytes | rounded down to a whole GiB |
| `max-blob` | 1 | u64 bytes | exact |
| `classes` | 1 | `["classes", …]` | 1–4 values from `working` `circle` `vital` `open`, no duplicates |
| `charge-control` | 1 | `internal` \| `external-plug` \| `none` \| `mains` | §14.5, §5.1b; keeper-stated. `mains` is a permanently powered box, which has no charge to control; `internal` and `external-plug` are the two phone routes; `none` is a phone with neither. The §14.1 acknowledgement gate — `none` acknowledged in the app before permanent-node duty — applies to **phones only** |
| `sheltered` | 1 | `["sheltered", bytes, count]` | **aggregates only**; bytes down to a GiB, count down to a multiple of 100 |
| `policy` | 1 | `introductions` \| `open` | shelter policy, §5.5 |
| `bridge` | 0–1 | `https://` URL | lane C, 1b |
| `lan` | 0–1 | mDNS name, ≤ 63 bytes | e.g. `bothy-vkvk.local` |
| `expiration` | 0–1 | NIP-40 | RECOMMENDED `card-exp + 3600` |
| `alt` | 0–1 | NIP-31 | |

`content` MUST be the empty string. A status MUST NOT carry per-keeper or
per-blob figures of any kind: those are the replica report, and publishing them
would publish the keeper's kith (`BOTHY.md` §4, §5.5).

The rounding is not decoration: exact free-byte counts are a stable
fingerprint linking a node across relays and key rotations, and a GiB floor
costs placement nothing at the pool sizes of §5.1b.

### Binding status to a claim

The card is opaque bytes (`SPEC.md` §2) and carries no Nostr identity, so the
chain that makes it trustworthy is:

> the **status pubkey** must be the `d` of an `active` claim signed by the
> keeper's master, and the card's **`node_id`** must equal the status `node`
> tag.

That chain, and nothing else, is the "owner endorsement" Link `SPEC.md` §2.4
leaves to the Bothy pairing flow: a signed statement that this node id is this
keeper's, made outside the card and never inside it. A verifier resolves it
before any `connect` and passes the node id to `Card::verify` as the expected
id, so card rule 9 fires on a mismatch. Pairing (§14.1) short-circuits the
relay round trip — the node phone's QR carries `card`, its bothy pubkey and a
pairing secret — but carries the same three facts, not a different trust
model.

A verifier returns the card's **`serial`** alongside its node id and expiry.
The store needs the serial for `SPEC.md` §2.3 rule 8 (a card's serial strictly
increases, and a reused one fails closed), and returning it from the pass that
already verified the card is what stops an implementation verifying twice. A
byte-identical re-announcement of the stored card is judged one serial below
the stored mark and accepted as the same card, so no `previous_serial` need be
kept. V2 rule 6 is best implemented as an *interface* — a card verifier the
storage core calls — so that core need not depend on the Link crates.

---

## Shelter grant (`kind:30642`)

An invite, or an invite carrying a federation promise. Signed by the `stash`
child key (a `master` signature is also accepted). **Never published to a
public relay**: a grant names a friend, a ceiling and an expiry, which is the
keeper's social graph in one event.

Delivered two ways, both required:

1. **To the guest**, gift-wrapped (rumor `kind:24640`, below) so they can show
   the ceiling and expiry in their app;
2. **To the issuer's own nodes**, over the command channel (`grant-put`), so
   the admission table is populated before the guest's first upload.

The `kind:24640` rumor carries the signed grant whole, and its `content` is
JSON in the same shape as `grant-put`'s args, so one parser serves both:

```json
{"v":1,"grant":{ … the signed kind:30642 event, verbatim … }}
```

The receiver runs V3 over the enclosed event and admits nothing on the
strength of the wrapper. An unknown `v` is refused, not guessed (V6-B rule 7).

A guest whose grant has not reached a node MAY present it in-band: the base64
of the signed grant event in an `X-Bothy-Grant` header beside the BUD-11
`Authorization` token. The node admits only if the grant verifies to the
keeper's current claim key set — never on the strength of possession.

### Tags

| tag | card. | value | rule |
| --- | --- | --- | --- |
| `d` | 1 | guest pubkey | 64 lowercase hex — one grant per (issuer, guest), replaced on change |
| `p` | 1 | guest pubkey | equals `d`; present so the wrapper can be addressed |
| `grant` | 1 | 32 lowercase hex | stable id across re-issues, for audit and tombstone reference |
| `ceiling` | 1 | u64 bytes | **mandatory** (§3.4); MAY be 0, which admits nothing |
| `expiration` | 1 | NIP-40 unix seconds | mandatory; ≤ 400 days ahead |
| `classes` | 0–1 | as status | which classes the guest may store; default `working` |
| `promise` | 0–1 | `["promise", bytes, class…]` | makes this also a federation promise (§5.2) |
| `introductions` | 0–1 | u32 | ken-of-kith allowance for this kith (§5.5) |
| `status` | 1 | `active` \| `revoked` | |

`content` MUST be the empty string. The issuer MUST keep the sum of outstanding
`ceiling` values across `active` grants at or below `pool − reserve` (§3.3),
where `reserve` is the storage core's fixed high water-mark — with the marks
fixed at 10 % and 20 % (§3.2) that is `pool − pool/5` — and where the grant
being *replaced*, if any, is **excluded** from the sum, so a revocation
(ceiling 0) always fits. A node MUST refuse a `grant-put` that would breach it,
with `refused`.

### Revoking a grant

Republish the same `d` with `status` `revoked` and `ceiling` `0`, **sign it**,
and deliver it both ways again — gift-wrapped to the guest, and to the keeper's
own nodes through `grant-put`. There is deliberately **no `grant-revoke`
shorthand**: a one-argument command would mutate a stored row whose kept event
is the last *signed* grant, which that row no longer describes, and a node must
never hold an unsigned fact about a keeper's grants. One more signature on the
phone is the right price.

The guest drops from kith to ken and their blobs drop to commons tier —
evictable, not deleted (§3.4). To delete rather than demote, the keeper also
publishes a tombstone over the hashes.

---

## Pin (`kind:24242`, `t=pin`)

The ownership primitive: present a pin and the blobs move into your tier and
your accounting; send it with a mirror request and it is the credential a
shelter checks (§3.5). It is deliberately a **kind-24242 event in the BUD-11
shape**, so an existing Blossom validator parses and signature-checks it with
no new code.

### Tags

| tag | card. | value | rule |
| --- | --- | --- | --- |
| `t` | 1 | `pin` | |
| `x` | ≥ 1 | sha256, 64 lowercase hex | ≤ 1000 per event; ≤ 500 RECOMMENDED (relay size limits) |
| `server` | 1 | `*` | see below |
| `class` | 1 | `working` \| `circle` \| `vital` \| `open` | |
| `ceiling` | 0–1 | u32 copy count | the §5.1a ceiling; default = the class target |
| `expiration` | 1 | NIP-40 unix seconds | the lease: ≥ 1 day, ≤ 366 days, 90 days RECOMMENDED |

`content` is the BUD-11 human-readable reason. It MUST NOT name a file: a
shelter's operator can read it.

Signed by the `stash` child key on the phone — Stash's manifest already knows
every hash the keeper owns, so "claim everything in my manifest" is a handful of
events, not hundreds of button presses (§3.5). A shelter recognises the signer
through the owner's claim key set.

**A shelter stores the signed pin event, not a digest of it.** A pin is
portable and honoured without an account, which is only true while the bytes
that carry the signature survive: an offer to another node carries the pin
itself (`PUT /bothy/shelter`, below) and it cannot be rebuilt from an index.
Where several signers have pinned one hash, the **most recent** pin governs its
class and ceiling.

Pins MUST NOT be published to public relays: a public pin set is a public list
of the hashes a pubkey owns. They travel in-band: over lane B in the body of
`PUT /bothy/shelter` (below), over lane C in an `X-Bothy-Pin` header (standard
base64) on the BUD-04 mirror request, or gift-wrapped to the shelter's bothy
key.

### The `open` class has no target

`working`, `circle` and `vital` each name a copy count R. `open` names none,
and a class with no target and no rule silently becomes *everywhere* in
arithmetic — a target of 0 satisfied by a pointer on every node. So the rule is
stated instead: an `open` blob is **pointer-only until a node that declares
`open` in its status `classes`, and has free space ≥ the blob's size, offers to
take it**. That is what "best effort, opportunistic, capacity boxes only"
(§5.1b) means as a decision a node can take alone. An `open` copy **never
counts towards R for any other class**, so an `open` pin can never repair a
`vital` shortfall, and a node MUST NOT evict a `working`, `circle` or `vital`
copy to make room for an `open` one.

### The `server` tag: exactly one, `*`

The joint core contract §4 requires **at least one `server`** whose set includes
the node addressed, and `stash-rs`'s `validate` enforces it. A portable pin has
no single node to name, so: **omitting `server` is wrong** — every conformant
BUD-11 validator, the shelter's included, rejects the event, and portability is
what a pin is for; **naming nodes is wrong** — a per-shelter pin is not
portable, and the list would enumerate the keeper's nodes to every shelter that
reads it.

So a pin carries exactly one `["server", "*"]`, read as *any shelter*. That is
safe because a pin is **not an authorisation token**: `pin` is not one of the
four BUD-11 verbs, so §4's last rule — *the operation MUST match the endpoint*
— rejects it everywhere. Servers MUST reject a `t=pin` event presented in an
`Authorization: Nostr` header and MUST NOT treat a verb token (`get`, `upload`,
`list`, `delete`) as a pin. §4's five-minute lifetime ceiling applies to verb
tokens only; a pin is a lease measured in months.

---

## Tombstone set (`kind:30643`)

Keeper-signed withdrawal of hashes: remove, refuse re-mirror, gossip. Public,
because peers must be able to honour a takedown they were not told about
directly, and because a hash is not a name. Keepers subscribe to each other's
tombstone sets (§3.8 rule 4).

| tag | card. | value | rule |
| --- | --- | --- | --- |
| `d` | 1 | 32 lowercase hex | set id; a keeper may keep several sets |
| `x` | ≥ 1 | sha256, 64 lowercase hex | ≤ 1000 per event |
| `reason` | 1 | code | `takedown` \| `deleted` \| `revoked-grant` \| `mistake` \| `legal` |
| `p` | 0–1 | pubkey | when the set is scoped to one grant holder |

`content` MUST be the empty string: free text here would leak the complaint, the
complainant or the material. `expiration` MUST NOT be set.

A reader honours the **union of the current versions of all of a keeper's
tombstone sets**. Removing an `x` and republishing lifts that tombstone — what
`mistake` is for — and an adversary suppressing the newer version leaves the
older, still-tombstoning one in force: lifting requires delivery, withdrawing
does not.

---

## Replica report (`kind:24641`, gift-wrapped)

Node → keeper, NIP-59, never public. This is the event that puts *"3 copies,
last verified 09:12"* next to a blood-test result (§5.3), and it is exactly the
event `BOTHY.md` §4 forbids in the status.

Rumor `content` is JSON:

```json
{"v":1,"node":"<node-id-base32>","at":1756512000,"page":0,"more":false,
 "blobs":[{"x":"<sha256>","class":"vital","copies":3,"verified":3,
           "last_verified":1756508400,"nodes":["<node-id-base32>","…"]}]}
```

`copies` is what this node believes exists, `verified` what it has itself
checked within the class's timeout, `last_verified` null when never verified.
`nodes` lists node ids, never keeper pubkeys — a report reaching the wrong
inbox would otherwise enumerate a friend group. At most 500 blobs per report,
`page`/`more` continuing; sent on material change, at most hourly unsolicited,
and on the `report` command.

A node's own copy counts towards `verified`. A copy on a **public host** counts
while an unauthenticated `HEAD /<sha256>` verifies it, and no longer — that is
how §5.1a's "counted only while verified" is met off the mesh. A node **never
mirrors *to* a public host**: it holds no keeper token for one, and §8's rule is
that the keeper's app uploads there. Until a node implements the `HEAD`
verifier, a public copy is honestly reported missing rather than assumed.

## Command channel (`kind:24642`) and reply (`kind:24643`)

There is **no admin page** (`BOTHY.md` §13). Management is NIP-59-wrapped,
NIP-44-encrypted commands from the keeper's app to the bothy npub, replies the
same way, over whichever lane is up.

Rumor `content` is JSON: `{"v":1,"cmd":"<verb>","args":{…},"nonce":"<16 hex>"}`.

| verb | args | required role | effect |
| --- | --- | --- | --- |
| `retire` | `{"wipe_index":bool}` | `master` | revokes the claim and **keeps the blob files** (§13). With `wipe_index` true the index (`state/`) is deleted; with it false the stored claim is marked `retired` in place and the index survives. The bothy key is wiped **either way**, after the reply has been sealed with it |
| `set-pool-size` | `{"bytes":u64}` | `master`, `stash` | pool ceiling; the reply says when it bites (`in_force`, below) |
| `set-marks` | `{"low_pct":u8,"high_pct":u8}` | `master`, `stash` | water-marks; `0 < low < high < 100` |
| `add-drive` | `{"drive_id":"…","erase":true}` | `master` | the app's *"Add this 4 TB drive? It will be erased."* tap **is** this command |
| `ken-filter` | `{"alg":"binary-fuse-16","b64":"…","generation":u32}` | `master`, `stash` | replaces the `tessera-kit` filter; never a list (§5.5) |
| `grant-put` | `{"event":{…30642…}}` | `master`, `stash` | installs or replaces a grant |
| `report` | `{"since":unix,"x":["…"]}` | `master`, `stash`, `persona` | requests a replica report |

`grant-put` is an addition to the five management verbs listed in the Phase 1
scope §7; without it a grant reaches the node only by the guest presenting it,
which is admission on possession. It is also how a grant is **revoked** — the
revoked `kind:30642`, signed, through the same verb — so the node never stores
a fact about a keeper's grants that no signature covers.

`set-pool-size`'s reply says when the new ceiling takes effect:
`{"bytes":u64,"in_force":"now"}` where the storage core accepts a live quota
(`shelter-kit` v0.2.2, contract item B13, which is what a current node does),
and `{"bytes":u64,"in_force":"next_start"}` where it does not. The
`next_start` value is kept for older cores; an app MUST read the field rather
than assume either.

The reply rumor (`24643`) is
`{"v":1,"re":"<command rumor id>","ok":true,"result":{…}}` or
`{"v":1,"re":"…","ok":false,"error":{"code":"…","message":"…"}}` with `code` in
`unauthorised` | `stale` | `replay` | `unknown-cmd` | `bad-args` | `refused` |
`unsupported` | `busy` | `internal`. `re` is the NIP-01 id computed over the
**unsigned rumor**, which both sides can compute; that echo is what lets an app
match a reply without a correlation id the relay could read.

**`refused` and `unsupported` are different answers**, and conflating them
would tell an app to stop asking when it should ask again after an update.
`refused` is *I will not*: a decision this node has taken, such as a
`grant-put` that would breach the ceiling sum of V3.10. `unsupported` is *not
in this release*: the verb is in the table above, it parsed, its arguments were
validated, and this build has nothing to carry it out with; the `message`
carries the reason and, where it is known, what it waits on. A node MUST NOT
answer `unknown-cmd` to a verb that is in the table — pretending not to know a
verb lies to an app that will send it again to a later release. In 1a the
`unsupported` verbs are `set-marks` (the core's water-marks are fixed at 10 %
and 20 % until it takes a knob, §3.2), `add-drive` (multi-drive pooling is
1b), `ken-filter` (the ken filter arrives with the commons in Phase 3) and
`report` (the replica report is a `kind:24641` built by the reconcile loop,
which this release does not run).

### Replay protection

A NIP-59 wrapper's `created_at` is randomised up to two days into the past, so
it proves nothing. All three checks are on the **rumor**:

1. `|rumor.created_at − now| ≤ 120 s`;
2. `rumor.created_at > last_accepted_at[sealer_pubkey]`, advanced **on
   acceptance of the event** — after V6-B rule 7 and before the verb is
   parsed; that recording *is* V6-B rule 8 — so one rumor is answered at most
   once whatever the
   verdict on its verb, and a corrected command re-sent within the same second
   is `replay` (strictly monotonic per keeper key);
3. the rumor id is not in a 24 h seen-set.

Failing 1 replies `stale`, 2 or 3 replies `replay`. A node MUST apply the same
three checks to `grant-put` and to any future write verb, and MUST NOT act on a
command whose sealer is not in the current claim key set with a role the table
above permits.

---

## The lane-B transport of these events

Node↔node, most of these events never touch a relay. The shell serves HTTP/1.1
over a ForgeSworn Link `Stream` — "Blossom over Link", scope §3 — with the
storage core's Blossom router mounted for the BUD verbs and the shell's own
`/bothy/*` routes beside it. The **Link session's node id**, resolved to a
keeper through V1 and V2, authenticates the peer, so no BUD-11 verb token is
needed node↔node.

| route | the event it carries | rules |
| --- | --- | --- |
| `PUT /bothy/claim` | the signed claim, with the pairing secret | pairing, above; then V1 |
| `PUT /bothy/shelter` | a mirror request carrying the signed pin (and a grant, if any) and an `fsl://` source | V4, then a **pull**: the receiver fetches the bytes, the sender never pushes |
| `GET /bothy/holdings` | what this node holds for one named keeper | scoped to that keeper, never a catalogue |
| `GET /bothy/replicas` | copy counts for named hashes | node ids only, never a keeper pubkey — as the replica report |
| `PUT /bothy/probe` | nothing: an echo for the Phase 0-L path harness | bounded body; admits nothing and stores nothing |

The request and response shapes are **not restated here**. They are the
`bothy-node` types in `crates/bothy-core/src/peer.rs` (`ShelterRequest`,
`ShelterResponse`, `ShelterRefusal`, `HoldingsQuery`, `HoldingsBlob`,
`HoldingsResponse`, `ReplicaCount`, `ReplicasResponse`) and the build brief
§4.5 they were cut from; one definition, in the language that has to compile.
What is normative here is which event each route carries and which list below
verifies it — and that a refusal names the numbered rule that failed
(`{"code":"rule","rule":"V4.7"}`), which is why those numbers are stable.

---

## Verification rules

Each list is applied in order; an implementation reports the first rule that
fails and never accepts partially, in the style of `SPEC.md` §2.3. **Rule
numbers are stable across revisions**: a revision appends rules rather than
renumbering them, because a refusal quotes its number on the wire. Where an
appended rule is a *shape* check — V1.13, V3.11 and V5.9, "well-formed per the
table" — it is evaluated with the other shape checks, before any comparison
against stored state, and reported under its own (last) number. That is the one
place where list position and evaluation order deliberately differ; everywhere
else, position is order.

**V1 — accept a claim (30640).** 1. kind, id and signature valid. 2. exactly
one `d`, 64 lowercase hex. 3. exactly one `p` with role `node`, equal to `d`.
4. exactly one `p` with role `master`, equal to `event.pubkey`. 5. exactly one
`role`, in `{phone, box}`. 6. exactly one `status`, in `{active, retired}`.
7. if `active`: exactly one `p` with role `stash`; if `retired`: no `stash` and
no `persona`. 8. no duplicate pubkey across `p` tags. 9. `content` empty.
10. `created_at` ≤ `now + 300`. 11. `created_at` > that of the stored claim for
this `d` (else keep the stored one). 12. the stored claim for this `d` is not
`retired` (terminal). 13. every remaining tag is well-formed per the table: at
most one `region` (≤ 64 bytes), at most one `name` (≤ 32 bytes), at most one
`alt`, and every `p` value 64 lowercase hex with a role from the four — a shape
rule, evaluated with rules 2–9 (see above).

**V2 — accept a status (10640) and use its card.** 1. kind, id and signature
valid. 2. a claim for `d = event.pubkey` is held, accepted under V1, and
`active`. 3. singleton tags present exactly once and well-formed per the table.
4. `node` is 52 characters over the lowercase RFC 4648 base32 alphabet **and
is the canonical spelling**: 52 base32 characters carry 260 bits, so sixteen
spellings decode to the same 32-byte id, and only the one whose four trailing
bits are zero is accepted — as Link `SPEC.md` §1 requires and a base32 decoder
that re-encodes and compares enforces. 5. `card` decodes
(standard base64; a decoder SHOULD also accept base64url and missing padding,
an encoder MUST NOT emit them) to ≤ 4096 bytes. 6. the card passes `SPEC.md`
§2.3 rules 1–9 with the expected node id set to the `node` tag. 7. `card-exp`
equals the card's `expires_at`. 8. `free ≤ pool`; both are whole GiB.
9. `classes` non-empty, ≤ 4, no duplicates. 10. `created_at` ≤ `now + 300` and
> that of the stored status for this pubkey. 11. `content` is the empty string.
Only after 11 may the reader feed the card to a `CardResolver` or derive
rendezvous material from it.

**V3 — accept a grant (30642).** 1. kind, id and signature valid. 2. the
signer is in the issuer's current claim key set with role `stash` or `master`.
3. `d` is 64 lowercase hex and equals the single `p`. 4. exactly one `ceiling`,
a u64. 5. exactly one `expiration`, `> now` and `≤ now + 400 days`. 6. exactly
one `grant`, 32 lowercase hex. 7. `status` present; if `revoked`, `ceiling` is
0. 8. `content` empty. 9. `created_at` > that of the stored grant for this
(issuer, `d`). 10. installing it keeps the issuer's outstanding ceiling sum ≤
`pool − reserve`, where `reserve` is the core's fixed high water-mark
(`pool − pool/5`, §3.2) and the grant this one **replaces is excluded from the
sum**, so a revocation always fits. 11. every remaining tag is well-formed per
the table: `classes` 1–4 of the four with no duplicates, `promise` a u64
followed by at least one class, `introductions` a u32 — a shape rule, evaluated
with rules 3–8 (see above).

**V4 — accept a pin (24242, `t=pin`).** 1. kind, id and signature valid.
2. exactly one `t`, value `pin`; **the event did not arrive in an
`Authorization` header**. 3. ≥ 1 `x`, each 64 lowercase hex, ≤ 1000, no
duplicates. 4. exactly one `server`, value `*`. 5. exactly one `class`, in the
four. 6. at most one `ceiling`, a u32 ≥ 1. 7. exactly one `expiration`, between
`created_at + 1 day` and `created_at + 366 days`, and `> now`. 8. **backstop:**
no duplicate singleton tag. Rules 2, 4, 5, 6 and 7 already say "exactly one" or
"at most one" for every singleton a pin carries today, so a duplicate is
reported by the earlier rule that names that tag — a duplicated `class` fails
rule 5, not rule 8. Rule 8 is what catches a singleton added to the table by a
later revision before its own rule is written. 9. `created_at` ≤ `now + 300`.
10. the signer resolves to a
claim key set with role `stash` or `master` — **or** the shelter's trust set
admits it under §5.5 (kith grant, ken filter hit, or a countersigned
introduction) — else the pin is well-formed but unadmitted, which is a 403, not
a parse error.

**V5 — accept a tombstone (30643).** 1. kind, id and signature valid. 2. the
signer is in the keeper's current claim key set **with role `stash` or
`master`** — as V3.2 and V4.10 require, because a key that may not grant or pin
may not withdraw either; a `persona` tombstone is refused. 3. `d` 32 lowercase
hex. 4. ≥ 1 `x`, each 64 lowercase hex, ≤ 1000. 5. exactly one `reason`, a
known code. 6. no `expiration`. 7. `content` empty. 8. `created_at` > that of
the stored set for this (keeper, `d`). 9. any `p` is a single 64-lowercase-hex
pubkey — a shape rule, evaluated with rules 3–7 (see above).

**V6-A — drop a wrapped event (24640–24643).** These rules fail *silently*:
until rule 4 has passed there is no authenticated address to answer, so a
failure is dropped and nothing is sent. 1. the wrapper is kind 1059 and
`p`-tagged to a key this node holds. 2. NIP-44 decryption of the wrapper yields
a kind-13 seal with a valid signature — **authenticate the sender from the
seal, never from the wrapper's throwaway key**. 3. the seal decrypts to a rumor
whose `pubkey` equals the seal's `pubkey`; a mismatch is a forgery attempt and
the whole wrapper is dropped. 4. the rumor's kind is the expected one for this
inbox.

**V6-B — answer a wrapped event.** From here the sealer is authenticated and
addressable, so each failure is a *reply*, not a drop. 5. the sealer is in the
current claim key set holding at least one of the roles this inbox admits — for
the command inbox, the union of the roles in the verb table (`unauthorised`).
6. for 24642: the three replay checks above (`stale`, `replay`). 7. `content`
parses as the JSON shape for that kind with `v = 1`; an unknown `v` is refused,
not guessed (`bad-args`). 8. **acceptance is recorded**: the sealer's watermark
advances and the rumor id joins the 24 h seen set, because the *event* has now
been accepted. 9. the verb is one in the table (`unknown-cmd`) and its arguments
are the table's (`bad-args`). 10. the sealer holds the role that **verb**
requires (`unauthorised`).

Rules 8–10 are appended, but their **order is semantic, not cosmetic**. Rule 5
cannot check a per-verb role, because at rule 5 the verb is still encrypted:
the per-verb check has to follow rule 7, which is why it is rule 10. And the
watermark has to advance between the last check on the event and the first on
the verb — before rule 9, after rule 7 — because whether a verb is authorised
or actionable must not decide whether the same rumor can be presented again.

---

## Privacy considerations

* **The public surface is two events and a server list** — a claim (this
  keeper has a node, here, of this shape, with these keys) and a status (it is
  reachable this way, has this much room, shelters this much in aggregate).
* **Aggregates only, by rule.** Per-keeper and per-blob replica figures would
  publish the keeper's kith, so they travel as private reports (§4, §5.1a);
  free, pool and sheltered are rounded so exact byte counts cannot fingerprint
  a node across relays or key changes.
* **What a relay learns.** A Nostr relay learns the claim and status graph —
  the point of publishing them — and, for private events, only that *someone*
  sent a kind-1059 wrapper to a pubkey: never the rumor kind, verb, hash or
  ceiling. A **Link** relay learns less again: a per-pair, per-hour rendezvous
  tag, addresses, timing, byte counts, and no Nostr key at all
  (`RENDEZVOUS.md` §2) — which is why the tag inputs appear in no event here.
* **Pins and grants are the social graph** — a pin set enumerates what a pubkey
  owns, a grant names a friend — so neither is ever published.
* **`name` and `region` are public and keeper-written.** The app SHOULD warn
  once: no street, no surname, no employer.

## Security considerations

* **Stolen node.** It holds ciphertext, hashes, sizes, its own key, the grant
  table, the ken filter's 16-bit fingerprints and access times — the honest
  list of §7. It holds no keeper signing key, so it can mint no claim, grant,
  pin or tombstone; it *can* keep publishing plausible statuses until the
  keeper retires the claim.
* **Revoked claim.** Retirement is a master signature and terminal per V1.12,
  so a wiped-and-restored node cannot return under its old `d`. Readers that
  never see the retirement keep trusting the node — the usual replaceable-event
  suppression problem — mitigated by publishing retirement widely and keeping
  status `expiration` short.
* **Replay.** Cards carry a strictly increasing `serial` and fail closed on
  reuse (`SPEC.md` §2.3 rule 8); claims, statuses, grants and tombstones are
  replaceable and monotonic in `created_at`; commands get the three-check rule
  above, because a wrapper's timestamp is randomised by design. A captured
  BUD-11 verb token replays only an idempotent upload of the same hash to the
  same node inside five minutes.
* **Key-set changes are not retroactive.** A pin or grant signed by a key that
  has since left the set was the keeper's when made. Nodes MUST reject *new*
  presentations but MUST NOT re-evaluate admitted blobs, which would turn a
  routine rotation into mass eviction.
* **Grant on possession is refused.** An in-band grant admits only if it
  verifies to the issuer's current claim; holding its bytes proves nothing.
* **A pin is not a token.** An implementation that routes `t=pin` into its
  authorisation path has granted a wildcard write. Test for it.
* **Ceiling arithmetic is a denial-of-service control**: V3.10 is what stops a
  keeper over-committing a small pool until their own tier starves (§3.4).

---

## Examples

Fake keys throughout: keeper master `aa…`, stash child `bb…`, node (bothy)
key `cc…`, guest `dd…`.

### Claim

```json
{
  "kind": 30640,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1756512000,
  "tags": [
    ["d", "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"],
    ["p", "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", "", "node"],
    ["p", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "", "master"],
    ["p", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "", "stash"],
    ["role", "phone"],
    ["region", "GB-SCT"],
    ["status", "active"],
    ["name", "spare phone"],
    ["alt", "Bothy node claim"]
  ],
  "content": "",
  "id": "0101010101010101010101010101010101010101010101010101010101010101",
  "sig": "<64-byte hex>"
}
```

Retirement is the same event with `["status","retired"]`, no `stash` tag, and a
later `created_at`.

### Status

```json
{
  "kind": 10640,
  "pubkey": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "created_at": 1756512300,
  "tags": [
    ["card", "RlNMMQGqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqgAAAABosj8AAAAAAGizkIAAAAAAAAABoQIBABp3c3M6Ly9saW5rMS5mb3JnZXN3b3JuLmRldgQAIQK7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u8zMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMw="],
    ["card-exp", "1756598400"],
    ["node", "vkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkva"],
    ["free", "21474836480"],
    ["pool", "68719476736"],
    ["max-blob", "52428800"],
    ["classes", "vital", "circle"],
    ["charge-control", "external-plug"],
    ["sheltered", "10737418240", "1200"],
    ["policy", "introductions"],
    ["lan", "bothy-vkvk.local"],
    ["expiration", "1756602000"],
    ["alt", "Bothy node status"]
  ],
  "content": "",
  "id": "0202020202020202020202020202020202020202020202020202020202020202",
  "sig": "<64-byte hex>"
}
```

The card above is a real 191-byte `FSL-CARD-1` layout — `FSL1`, version 1, a
32-byte node id, `issued_at`, `expires_at`, serial 417, two hints (`0x01` a
`wss://` relay, `0x04` a 33-byte compressed secp256k1 ephemeral, per D4) and a
64-byte signature trailer — with placeholder key and signature bytes.

### Shelter grant, with a promise

```json
{
  "kind": 30642,
  "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "created_at": 1756512400,
  "tags": [
    ["d", "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"],
    ["p", "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"],
    ["grant", "9f2c41d70b5ea8c31e6d4477aa02b915"],
    ["ceiling", "107374182400"],
    ["expiration", "1788048000"],
    ["classes", "working", "circle"],
    ["promise", "107374182400", "vital", "circle"],
    ["introductions", "3"],
    ["status", "active"]
  ],
  "content": "",
  "id": "0303030303030303030303030303030303030303030303030303030303030303",
  "sig": "<64-byte hex>"
}
```

### Pin

```json
{
  "kind": 24242,
  "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "created_at": 1756512500,
  "tags": [
    ["t", "pin"],
    ["x", "1111111111111111111111111111111111111111111111111111111111111111"],
    ["x", "2222222222222222222222222222222222222222222222222222222222222222"],
    ["x", "3333333333333333333333333333333333333333333333333333333333333333"],
    ["server", "*"],
    ["class", "vital"],
    ["ceiling", "3"],
    ["expiration", "1764288500"]
  ],
  "content": "Claiming my own blobs",
  "id": "0404040404040404040404040404040404040404040404040404040404040404",
  "sig": "<64-byte hex>"
}
```

### Tombstone set

```json
{
  "kind": 30643,
  "pubkey": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "created_at": 1756512600,
  "tags": [
    ["d", "5a1c9e3f77b04d2288ef6013c4a9d0e2"],
    ["x", "2222222222222222222222222222222222222222222222222222222222222222"],
    ["reason", "takedown"]
  ],
  "content": "",
  "id": "0505050505050505050505050505050505050505050505050505050505050505",
  "sig": "<64-byte hex>"
}
```

### Replica report (the rumor, before sealing and wrapping)

```json
{
  "kind": 24641,
  "pubkey": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "created_at": 1756512700,
  "tags": [["p", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]],
  "content": "{\"v\":1,\"node\":\"vkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkva\",\"at\":1756512700,\"page\":0,\"more\":false,\"blobs\":[{\"x\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"class\":\"vital\",\"copies\":3,\"verified\":3,\"last_verified\":1756508400,\"nodes\":[\"vkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkvkva\"]}]}"
}
```

This rumor is unsigned, sealed in a `kind:13` signed by `cc…`, and wrapped in a
`kind:1059` from a throwaway key `p`-tagged to `aa…` — the `roost-kit`
envelope, unchanged.

### Command and reply (rumors)

```json
{
  "kind": 24642,
  "pubkey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "created_at": 1756512800,
  "tags": [["p", "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"]],
  "content": "{\"v\":1,\"cmd\":\"set-pool-size\",\"args\":{\"bytes\":68719476736},\"nonce\":\"7c1f9a03b28d4e56\"}"
}
```

```json
{
  "kind": 24643,
  "pubkey": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "created_at": 1756512801,
  "tags": [["p", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]],
  "content": "{\"v\":1,\"re\":\"0606060606060606060606060606060606060606060606060606060606060606\",\"ok\":true,\"result\":{\"bytes\":68719476736,\"in_force\":\"now\"}}"
}
```

A verb this release cannot carry out is answered `unsupported`, with the reason
in `message` — never `unknown-cmd`, and never a success that is not one:

```json
{
  "kind": 24643,
  "pubkey": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "created_at": 1756512901,
  "tags": [["p", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]],
  "content": "{\"v\":1,\"re\":\"0707070707070707070707070707070707070707070707070707070707070707\",\"ok\":false,\"error\":{\"code\":\"unsupported\",\"message\":\"the core's water-marks are fixed at 10 % and 20 % of the pool; a keeper-adjustable mark is later core work\"}}"
}
```

---

## Open questions

1. **Kind allocation.** The numbers are chosen against the `nip-drafts`
   register and the NIPs known on 2026-08-30; they need a collision re-check
   and formal allocation before upstreaming.
2. **Multi-keeper nodes** (§10 Q6). Two claims for one bothy key would work
   under V1 only if V1.11's per-`d` monotonicity became per `(d, master)`. Not
   decided; a household is not Phase 1.
3. **Region vocabulary** (§10 Q3). Free text here; a closed vocabulary (ISO
   3166-2, as in the example) would let placement reason about off-site, but
   free text stays honest about being keeper-stated.
4. **Reciprocity in the status.** §5.5 wants a leave-it-as-you-found-it score
   the app can show; whether it is too gameable to publish is open.
5. **Pin transport.** *Resolved on review (Quill, 2026-08-30):* over lane B
   there is no header to fight over. The shell serves HTTP/1.1 over a Link
   `Stream` (scope §3, "Blossom over Link"): the core's router is mounted
   for the BUD verbs, and the shell mounts its own node↔node routes beside
   it — `PUT /bothy/shelter` carries the pin (and a grant, if any) in its
   body, the peer is authenticated by the Link session's node ID resolved
   through V1/V2, and the shell admits through the core's
   `begin_claimed_upload` with the pin's signer as the claim's signer and
   the trust set deciding the tier. No core change, no contract change. The
   `X-Bothy-Pin` / `X-Bothy-Grant` headers remain only for the *HTTP* path
   (bridge, stock clients) and are Phase 3 material with the commons. The
   routes are listed under *The lane-B transport of these events*, above.
6. **A whom-I-shelter-for filter in the status** (§5.5, off by default). If it
   ever exists it needs its own tag and its own paragraph on confirmability;
   nothing here reserves one.

## Dependencies

NIP-01, NIP-09 (noted, not relied on), NIP-31, NIP-40, NIP-44, NIP-46, NIP-59;
Blossom BUD-01/02/03/04/06/11/12; ForgeSworn Link `SPEC.md` §2 and
`docs/RENDEZVOUS.md` §1–§2; the joint core contract §4.

---

## Changes in v0.6

Each line names the change and where it came from: **T4**, **T12**, **T13**,
**T14**, **T15** and **T16b** are what building `bothy-node` against this draft
found (`docs/2026-08-30-bothy-node-build-brief.md`); **§B** and **§C** are the
findings and the decisions of the fourth design review,
`docs/2026-08-30-design-review-v0.5.md`; **O10** is that brief's open question
of the same number.

1. **Header.** v0.6, and the file says in its own provenance that it is a
   living draft revised in place, not a document frozen at its filename's
   date. *(this revision)*
2. **Terms.** The bothy key names its file, `<data_dir>/bothy.key`, and says
   `retire` wipes it. *(T14 (8))*
3. **Claim — a new "Pairing" subsection.** The pairing secret authenticates
   claim delivery only: single use, 10-minute TTL, regenerated on every QR
   show, compared in constant time, granting no tier and no storage; a claim
   refused under V1 leaves it usable; first claim wins, and retirement is
   terminal, so a retired node cannot be paired back under its old `d`.
   *(O10, T16b; §B.8)*
4. **Status — `charge-control` gains `mains`**, a fourth value for a
   permanently powered box, and the §14.1 acknowledgement gate is stated as
   **phones only**. *(T15; §C.1)*
5. **Status — a verifier returns the card's `serial`** with its node id and
   expiry, so the store need not verify twice and needs no `previous_serial`;
   V2 rule 6 is best implemented as an interface, so the storage core need not
   depend on the Link crates. *(T13; T4's crate-boundary note)*
6. **Grant — `kind:24640`'s content shape is printed**:
   `{"v":1,"grant":{…the signed 30642…}}`, mirroring `grant-put`'s args.
   *(T4 (5))*
7. **Grant — the ceiling sum is defined.** `reserve` is the core's fixed high
   water-mark (`pool − pool/5` at 10 %/20 %), and the grant being *replaced* is
   excluded from the sum, so a revocation always fits. *(T14 (7), T4 (8))*
8. **Grant — revocation is the revoked 30642 through `grant-put`.** The
   `grant-revoke` shorthand is **removed**, because it would leave the node
   holding a stored row whose kept event no longer describes it. *(§C.4,
   T14 (6))*
9. **Pin — a shelter stores the signed pin event**, not a digest: an offer
   carries the pin and it cannot be rebuilt from an index. Where several
   signers have pinned one hash, the most recent governs class and ceiling.
   *(T12 (1))*
10. **Pin — the `open` class has a placement rule**: no target, pointer-only
    until a node declaring `open` with free space ≥ the blob's size offers;
    an `open` copy never counts towards R for another class and never
    displaces one. *(§C.5, T12 (3), §B.12)*
11. **Replica report — how a public-host copy counts.** It counts while an
    unauthenticated `HEAD /<sha256>` verifies it and no longer; a node never
    mirrors *to* a public host; a node's own copy counts towards `verified`.
    *(T12 (2), §B.11)*
12. **Command table — `retire` states both cases.** `wipe_index` true deletes
    the index; false marks the stored claim retired in place; the bothy key is
    wiped either way, after the reply is sealed. *(T14 (5))*
13. **Command table — the `grant-revoke` row is gone**, and the paragraph
    below it now says `grant-put` is also how a grant is revoked. *(§C.4)*
14. **`set-pool-size` says when it bites.** The reply carries
    `"in_force":"now"` on a core that takes a live quota (`shelter-kit`
    v0.2.2, contract B13 — which is now the case), with `"next_start"` kept
    for older cores; an app must read the field. *(T14 (3))*
15. **A ninth reply code, `unsupported`**, with the distinction stated:
    `refused` is "I will not", `unsupported` is "not in this release", and
    `unknown-cmd` is never the answer to a verb in the table. The verbs that
    answer `unsupported` in 1a are `set-marks`, `add-drive`, `ken-filter` and
    `report`. *(§C.2, T14 (4))*
16. **Replay — where the watermark is recorded.** It advances after V6-B rule
    7 and before the verb is parsed, so one rumor is answered at most once
    whatever the verdict on its verb. *(T14 (2))*
17. **A new section, "The lane-B transport of these events"**: `PUT
    /bothy/claim`, `PUT /bothy/shelter`, `GET /bothy/holdings`, `GET
    /bothy/replicas` and `PUT /bothy/probe`, with which event each carries and
    which list verifies it — the shapes by reference to `bothy-node`'s
    `crates/bothy-core/src/peer.rs` and build brief §4.5, not restated.
    *(§B.4, brief §4.5/§4.7, open question 5)*
18. **Verification rules — a numbering rule.** Numbers are stable and
    revisions append; an appended *shape* rule (V1.13, V3.11, V5.9) is
    evaluated with the other shape checks but reported under its own number,
    the one place position and evaluation order differ. *(T4 (3))*
19. **V1 gains rule 13**, "well-formed per the table" — `region` ≤ 64 bytes,
    `name` ≤ 32 bytes, one `alt`, every `p` value hex with a known role.
    *(T4 (3))*
20. **V2 rule 4 requires the canonical base32 node id.** Fifty-two base32
    characters carry 260 bits, so sixteen spellings decode to one id; only the
    spelling with four zero trailing bits is accepted. *(T4 (6))*
21. **V2 gains rule 11, `content` MUST be empty**, which V1, V3 and V5 had and
    V2 did not; the "only after" sentence now points at rule 11. *(T4 (4))*
22. **V3 rule 10 states the exclusion and the reserve** (as item 7), and **V3
    gains rule 11**, "well-formed per the table". *(T4 (8), T14 (7), T4 (3))*
23. **V4 rule 8 is reworded as a backstop.** Every singleton a pin carries is
    already covered by an earlier "exactly one" rule, so a duplicate is
    reported there — a duplicated `class` is rule 5; rule 8 catches whatever a
    later revision adds. *(T4 (1))*
24. **V5 rule 2 is tightened to `stash` or `master`.** A `persona` key may not
    withdraw hashes it could not have granted or pinned. *(§C.3, T4 (7))*
25. **V5 gains rule 9**, "well-formed per the table", for the optional `p`.
    *(T4 (3))*
26. **V6 is split into V6-A (drops) and V6-B (replies)**, rules 1–4 and 5–7,
    with two appended rules whose order is semantic: rule 8 records acceptance
    (the watermark and the seen set) and rule 10 is the **per-verb** role
    check, which cannot run at rule 5 because the verb is still encrypted
    there. Rule 9 is the verb-and-arguments check between them. *(T4 (2),
    T14 (1), T14 (2))*
27. **Examples.** The command pair is now a `set-pool-size` with an
    `"in_force":"now"` reply, and a third block shows an `unsupported` reply.
    No other example changed, because no tag or kind it carries did.
    *(items 14, 15)*

**Two notes are deliberately not folded.** T4's crate-boundary consequence
that `nostr`'s `os-rng` feature is required to sign or open NIP-44/NIP-59 is a
fact about one implementation's build, not about the protocol; it belongs in
the build brief and its ledger. And three of T12's "also decided in code"
items — a holder keeps its bytes at target, nothing in §5.1a drops a keeper's
copy, and `verified` in 1a is a listing rather than a sample — are §5.1a
placement matters for `BOTHY.md` v0.6, not event shapes; the review's §D table
already routes them there. The fourth, that a node's own copy counts towards
`verified`, is folded here because the replica report is where `verified` is
defined.
