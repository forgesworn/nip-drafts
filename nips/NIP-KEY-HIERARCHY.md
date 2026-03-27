NIP-KEY-HIERARCHY
==================

Hierarchical Key Relationships
---------------------------------

`draft` `optional`

Two addressable event kinds for declaring, verifying, and managing hierarchical authority relationships between Nostr keypairs. A superior publishes a relationship declaration scoped by role, permissions, and time bounds. A revocation event provides a clean, auditable break when the relationship ends.

> **Design principle:** Hierarchy declarations are social and cryptographic facts published to relays. They communicate authority relationships — enforcement is the responsibility of consuming applications. A declaration says "this key has authority over that key with this scope"; the application decides what that means in practice.

> **Standalone usability:** This NIP works independently on any Nostr application. Families, organisations, projects, and any group structure can use it to declare who has authority over whom. No specific platform, framework, or external protocol is required.

## Motivation

Multiple Nostr applications independently need to declare "key A has authority over key B with scope C":

- A **parent** controls a child's account, delegates read access to a co-parent, and eventually graduates the child to full sovereignty
- An **organisation** assigns practitioners to projects with specific roles and permission scopes
- A **training provider** establishes mentor-apprentice relationships with time-bounded authority
- A **project lead** grants team members scoped authority that can be revoked when they leave
- A **custodian** manages accounts for people who cannot manage their own keys (accessibility, institutional care)

Every application that needs this pattern currently invents its own event kinds with incompatible tag conventions. Fathom uses kinds 30462-30465 for family relationships. Other projects use ad hoc `p` tag conventions or NIP-26 delegation (which is marked unrecommended and solves a different problem — signing authority, not account relationships).

NIP-KEY-HIERARCHY fills this gap with two minimal, composable primitives that work for any hierarchical relationship.

## Relationship to Existing NIPs and Patterns

### Why not NIP-51 (Lists)?

NIP-51 kind 30000 sets hold lists of pubkeys with optional relay hints and petnames. A reviewer might suggest: "just create a 'subordinates' list." NIP-51 lists lack three things this NIP requires:

1. **Scoped permissions.** A list says "these pubkeys belong to this set." It cannot express "this pubkey has `read:30453` permission within scope `family:childcare` until timestamp X." The permission model here is per-relationship, not per-set.
2. **Bilateral confirmation.** NIP-51 lists are unilateral (the list author decides membership). This NIP supports optional mutual confirmation where the subordinate acknowledges the relationship.
3. **Structured revocation.** Removing a pubkey from a NIP-51 list is silent. This NIP requires auditable revocation with reasons, effective dates, and graduation outcomes. Revocation is a first-class lifecycle event, not a list edit.

### Why not NIP-32 (Labelling)?

NIP-32 kind 1985 labels can attach arbitrary metadata to any event or pubkey. A reviewer might suggest: "label pubkey B as 'child' of pubkey A." NIP-32 labels are fire-and-forget observations, not addressable, revocable authority grants:

1. **No addressable replacement.** Kind 1985 is a regular event, not addressable. You cannot update a label by republishing with the same `d` tag. Authority relationships change (role adjustments, scope narrowing, renewals) and must be updatable in place.
2. **No time bounds.** Labels have no `valid_from` / `valid_until` semantics. Authority relationships are often time-bounded (a six-month apprenticeship, a project assignment).
3. **No permission model.** A label says "A is parent of B." It cannot express what A is authorised to do on behalf of B.

### Why not NIP-26 (Delegated Event Signing)?

NIP-26 (marked unrecommended) authorises one pubkey to sign events *as if* they were another pubkey. This NIP declares *authority relationships* between keys without granting signing power. A parent controlling a child's account is not signing as the child; they are exercising authority over the child's data and permissions. The two are complementary: a hierarchy declaration might accompany a NIP-26 delegation, or it might exist without one.

### Relationship to sub-key management proposals (NIP-102, NIP-0b, NIP-41)

Several proposals have attempted to solve key hierarchy through cryptographic sub-key derivation:

- **NIP-102** (Subkey Attestation, PR #1450, open) uses HD keys to derive sub-identities from a parent key. Reviewers called it "absurd complexity" (fiatjaf) and identified HD key security flaws (Semisol, paulmillr).
- **NIP-0b** (On-Behalf-Of, PR #1482, open) defines kind 10100 for managing active/inactive/revoked sub-keys. Reviewers raised complexity burden and temporal attack concerns (vitorpamplona).
- **NIP-41** (Identity Management, PR #1032, closed) proposed master keypairs backing subkeys with revocation. Reviewers found it "confusing" (fiatjaf) and unlikely to see adoption (staab).

All three focus on **cryptographic key derivation and device-level signing**. This NIP solves a different problem: **social authority relationships between already-existing keypairs**. A parent controlling a child's account, an organisation assigning roles to members, a mentor overseeing an apprentice. These are not signing delegation problems. The keys already exist independently; the NIP declares who has authority over whom and with what scope.

### Composition with other protocols

This NIP is a standalone primitive. It composes naturally with other protocols that handle adjacent concerns:

- **Data access grants** (if a NIP for scoped data access exists): the hierarchy declares "who has authority"; a data access grant declares "who can read what." Revoking data access does not dissolve the authority relationship, and vice versa.
- **Verifiable credentials** (if a NIP for credential gating exists): an organisation might require both a credential (professional qualification) *and* a role assignment (positional authority) before granting access.
- **Key derivation libraries** (e.g. nsec-tree): a derivation library generates sub-identity keypairs deterministically from a master secret. This NIP announces relationships between those keypairs on relays. The library derives the keys; this NIP declares their relationships.

## Kinds

| kind  | description              |
| ----- | ------------------------ |
| 30594 | Hierarchy Declaration    |
| 30595 | Hierarchy Revocation     |

Kind 30594 is an addressable event (NIP-01). The `d` tag ensures uniqueness per superior-subordinate pair within a scope. Re-publishing with the same `d` tag updates the relationship (used for role changes, scope adjustments, and renewals).

Kind 30595 is an addressable event using the **append-only pattern** — each revocation gets a unique `d` tag value so the relay stores every revocation rather than replacing previous ones. Revocations represent immutable facts and MUST NOT be overwritten.

---

## Hierarchy Declaration (`kind:30594`)

Published by a superior to declare authority over a subordinate within a defined scope. The declaration is addressable — the superior can update roles, permissions, and time bounds by republishing with the same `d` tag.

```json
{
    "kind": 30594,
    "pubkey": "<superior-hex-pubkey>",
    "created_at": 1707500000,
    "tags": [
        ["d", "<superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>"],
        ["p", "<subordinate-hex-pubkey>", "", "subordinate"],
        ["alt", "Hierarchy declaration: parent over child (family)"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "parent"],
        ["role_subordinate", "child"],
        ["scope", "family:childcare"],
        ["permission", "sign"],
        ["permission", "read:30453"],
        ["permission", "write:30453"],
        ["permission", "manage_grants"],
        ["valid_from", "1707500000"],
        ["valid_until", "1770000000"],
        ["expiration", "1770000000"],
        ["graduation", "sovereign"],
        ["domain", "family"]
    ],
    "content": "<NIP-44 encrypted to subordinate: optional private metadata>",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Tag Reference

| Tag                | Required    | Description |
|--------------------|-------------|-------------|
| `d`                | Yes         | `<superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>`. Unique per superior per subordinate per scope. The pubkeys MUST be the full 64-character hex-encoded public keys (not truncated). The `<scope>` segment is application-defined (e.g. a domain name, a project identifier, or a department name). Examples in this document use truncated pubkeys for readability; implementations MUST use full-length pubkeys. |
| `p`                | Yes         | Subordinate's Nostr pubkey. The fourth element SHOULD be `"subordinate"` as a role marker. Additional `p` tags MAY reference witnesses (see [Witnessed Declarations](#witnessed-declarations)). |
| `t`                | Yes         | Protocol family marker. MUST be `"hierarchy-declaration"`. |
| `role_superior`    | Yes         | The superior's role in this relationship. Application-defined values. Recommended: `parent`, `guardian`, `organisation`, `project_lead`, `mentor`, `keeper`, `custodian`, `employer`. |
| `role_subordinate` | Yes         | The subordinate's role. Application-defined values. Recommended: `child`, `ward`, `practitioner`, `team_member`, `apprentice`, `member`, `viewer`, `employee`. |
| `scope`            | Yes         | Authority scope as a colon-separated path. Examples: `family:childcare`, `project:alpha:development`, `org:training:welding`. Enables hierarchical scope matching: a grant for `project:alpha` implicitly covers `project:alpha:development`. Scope matching is strictly prefix-based -- `project:alpha` matches `project:alpha:development` but not `project:alpha2`. Applications designing scope strings SHOULD avoid ambiguous prefixes and SHOULD use distinct top-level segments for unrelated authority domains. |
| `permission`       | Yes         | One permission per tag. Repeatable. See [Permission Model](#permission-model). |
| `valid_from`       | Optional    | Unix timestamp when authority begins. Defaults to `created_at`. |
| `valid_until`      | Optional    | Unix timestamp when authority expires. Omit for indefinite relationships. When present, grantors SHOULD also include a NIP-40 `expiration` tag matching `valid_until` for relay-side garbage collection. |
| `graduation`       | Optional    | End state when the relationship expires or is intentionally concluded. One of `sovereign` (subordinate becomes fully independent), `transfer` (authority transfers to another superior), `none` (relationship simply ends). |
| `domain`           | Recommended | Application domain. Useful for filtering. Examples: `family`, `education`, `healthcare`, `project`, `organisation`. |
| `delegation_depth` | Optional    | Maximum depth of re-delegation. `0` means the subordinate cannot delegate further (default). Positive integers specify the maximum number of levels below the subordinate. Implementations MUST NOT accept values greater than 10 to prevent denial-of-service via deep chain traversal. The value `-1` is NOT RECOMMENDED as it creates unbounded chains; implementations that encounter `-1` SHOULD treat it as `10`. |
| `reference`        | Optional    | Event ID of a related event (e.g. a project announcement, an organisation profile, a custody agreement). |

### Permission Model

Permissions are declared as individual `permission` tags. Each tag contains a single permission string. Permissions fall into three categories:

**Action permissions** — what the superior can do on behalf of the subordinate:

| Permission       | Description |
|------------------|-------------|
| `sign`           | Sign events on the subordinate's behalf (implies NIP-26-level authority) |
| `manage_grants`  | Issue, modify, and revoke data access grants for the subordinate's data |
| `manage_profile` | Update the subordinate's kind 0 profile |
| `manage_relays`  | Update the subordinate's relay list (kind 10002) |

**Data permissions** — scoped to specific event kinds:

| Permission format | Description |
|-------------------|-------------|
| `read:<kind>`     | Read the subordinate's events of the specified kind |
| `write:<kind>`    | Publish events of the specified kind on the subordinate's behalf |

**Meta permissions** — control over the hierarchy itself:

| Permission       | Description |
|------------------|-------------|
| `delegate`       | Subordinate may re-delegate a subset of their permissions to a third party (constrained by `delegation_depth`) |

Applications SHOULD enforce the principle of least privilege — declare only the permissions actually needed. A mentor who reviews work needs `read:30453` (learning records), not `sign` (full signing authority).

### Mutual Confirmation

A hierarchy declaration published by the superior is unilateral -- it asserts authority. For relationships where the subordinate's consent matters (e.g. mentor-apprentice, employer-employee), the subordinate MAY publish a **confirmation event**: a Kind 30594 event with a `confirms` tag referencing the superior's declaration. The confirmation `d` tag uses the format `<subordinate_pubkey>:confirms:<superior_pubkey>:<scope>` -- note the `confirms` segment instead of `hierarchy`, which prevents collisions with regular declarations and ensures the confirmation is always distinguishable from a hierarchy assertion.

```json
{
    "kind": 30594,
    "pubkey": "<subordinate-hex-pubkey>",
    "tags": [
        ["d", "<subordinate_pubkey>:confirms:<superior_pubkey>:org:training:welding"],
        ["p", "<superior-hex-pubkey>", "", "superior"],
        ["t", "hierarchy-confirmation"],
        ["role_superior", "mentor"],
        ["role_subordinate", "apprentice"],
        ["scope", "org:training:welding"],
        ["confirms", "30594:<superior-hex-pubkey>:<d-tag-value>"],
        ["domain", "education"]
    ],
    "content": ""
}
```

The `confirms` tag uses an NIP-01 address reference (`30594:<pubkey>:<d-tag>`) rather than an event ID, because Kind 30594 is an addressable event whose event ID changes on updates. This ensures the confirmation remains valid when the superior republishes the declaration with minor changes.

The `t` tag MUST be `"hierarchy-confirmation"` (not `"hierarchy-declaration"`) so that clients can distinguish confirmations from declarations in relay queries.

Applications MAY require mutual confirmation before treating a hierarchy as active. This is OPTIONAL -- guardian relationships over minors, for example, do not require the child's confirmation.

### Witnessed Declarations

For high-stakes relationships (custody, institutional care, legal guardianship), additional `p` tags MAY reference witnesses whose signatures lend credibility:

```json
["p", "<witness-hex-pubkey>", "", "witness"]
```

Witnesses do not gain any permissions. Their inclusion signals that the relationship was established with third-party awareness. Applications MAY require witness `p` tags for specific relationship types.

---

## Hierarchy Revocation (`kind:30595`)

Published by a superior to explicitly revoke a previously declared hierarchy. Each revocation is an immutable record with a unique `d` tag value (append-only). Revocations cannot be undone; if a relationship is later re-established, a new Kind 30594 declaration MUST be published.

```json
{
    "kind": 30595,
    "pubkey": "<superior-hex-pubkey>",
    "created_at": 1710000000,
    "tags": [
        ["d", "<subordinate_pubkey>:revocation:<scope>:<timestamp>"],
        ["alt", "Hierarchy revocation: parent-child relationship ended (graduation)"],
        ["t", "hierarchy-revocation"],
        ["a", "30594:<superior-hex-pubkey>:<d-tag-value>", "<relay-hint>"],
        ["p", "<subordinate-hex-pubkey>"],
        ["revocation_reason", "graduation"],
        ["effective_at", "1774396800"],
        ["graduation_outcome", "sovereign"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Tag Reference

| Tag                  | Required    | Description |
|----------------------|-------------|-------------|
| `d`                  | Yes         | `<subordinate_pubkey>:revocation:<scope>:<timestamp>`. Unique per revocation (append-only). The timestamp ensures multiple revocations for the same subordinate and scope are preserved. |
| `t`                  | Yes         | Protocol family marker. MUST be `"hierarchy-revocation"`. |
| `a`                  | Yes         | Address reference to the Kind 30594 declaration being revoked. Format: `["a", "30594:<superior-pubkey>:<d-tag-value>", "<relay-hint>"]`. Uses `a` tags (not `e` tags) because Kind 30594 is an addressable event whose event ID changes on updates. |
| `p`                  | Yes         | Pubkey of the subordinate whose hierarchy is being revoked. |
| `revocation_reason`  | Yes         | Reason for revocation. One of `graduation` (subordinate reached sovereignty), `transfer` (authority transferred to another superior), `withdrawal` (superior withdraws authority), `mutual` (both parties agreed to end), `disciplinary` (conduct-related), `expiry` (natural time-bound expiry, explicitly recorded), `restructure` (organisational change). |
| `effective_at`     | Yes         | Unix timestamp when the revocation takes effect (e.g. `1742169600` for 2026-03-15T00:00:00Z). MAY be in the future for planned transitions. Note: this uses the same Unix timestamp format as `valid_from` and `valid_until` in Kind 30594 declarations, ensuring consistent temporal comparisons across the protocol. |
| `graduation_outcome` | Optional    | When `revocation_reason` is `graduation`. One of `sovereign` (subordinate is now fully independent), `promoted` (subordinate moves to a higher role in the same structure), `transferred` (subordinate moves to a different structure). |
| `successor`          | Optional    | Pubkey of the new superior, when `revocation_reason` is `transfer`. Applications SHOULD verify that a corresponding Kind 30594 declaration exists from the successor. |
| `transition_notes`   | Optional    | Human-readable explanation of the transition circumstances. |

### Subordinate-Initiated Revocation

The subordinate MAY also publish a Kind 30595 revocation to signal they no longer accept the authority relationship. When the subordinate publishes a revocation, the event's `pubkey` field will be the subordinate's key (not the superior's). Applications MUST verify that any Kind 30595 event is authored by either the superior (the original declaration's `pubkey`) or the subordinate (the `p` tag target in the original declaration); revocations from unrelated third parties MUST be ignored.

This is a social signal -- it does not cryptographically prevent the superior from continuing to publish Kind 30594 events. Applications SHOULD honour subordinate-initiated revocations when the relationship type permits it (e.g. mentor-apprentice) and MAY ignore them when the relationship type does not (e.g. legal guardianship of a minor).

---

## Protocol Flow

```
  Superior                Relay              Subordinate          Application
      |                     |                     |                    |
      |-- kind:30594 ------>|                     |                    |
      |  (hierarchy:        |                     |                    |
      |   parent > child,   |                     |                    |
      |   scope: family,    |                     |                    |
      |   permissions:      |                     |                    |
      |   sign, read, write)|                     |                    |
      |                     |                     |                    |
      |                     |<-- kind:30594 ------|                    |
      |                     |  (confirmation:     |                    |
      |                     |   child confirms    |                    |
      |                     |   parent authority)  |                    |
      |                     |                     |                    |
      |                     |                     |-- Request -------->|
      |                     |                     |  (action requiring |
      |                     |                     |   hierarchy check) |
      |                     |                     |                    |
      |   Application checks:                     |                    |
      |   kind:30594 exists for this pair ✓        |                    |
      |   scope matches requested action ✓         |                    |
      |   valid_until not expired ✓                |                    |
      |   no kind:30595 revocation ✓               |                    |
      |   → Authorised       |                     |                    |
      |                     |                     |                    |
      |                     |                (later: graduation)       |
      |                     |                     |                    |
      |-- kind:30595 ------>|                     |                    |
      |  (revocation:       |                     |                    |
      |   graduation,       |                     |                    |
      |   sovereign)        |                     |                    |
      |                     |                     |                    |
      |   Application checks:                     |                    |
      |   revocation exists ✗                      |                    |
      |   → No longer authorised                   |                    |
```

### Verification Algorithm

Applications verifying whether a superior has authority over a subordinate SHOULD follow this algorithm:

1. **Discover declarations** — subscribe to `kind:30594` events where the `p` tag matches the subordinate's pubkey, or where the author matches the superior's pubkey.
2. **Match scope** — for each declaration, verify that the `scope` tag covers the requested action. Hierarchical scope matching: `project:alpha` covers `project:alpha:development`.
3. **Check permissions** — verify that the declaration includes the required `permission` tag for the action.
4. **Check time bounds** — verify that the current time is between `valid_from` (or `created_at`) and `valid_until` (if present).
5. **Check revocation** — subscribe to `kind:30595` events where the `#a` filter matches the declaration's address (`30594:<superior-pubkey>:<d-tag-value>`). If any revocation exists with an `effective_at` in the past, the hierarchy is invalid.
6. **Check confirmation** (if required) — for relationship types that require mutual consent, verify that the subordinate has published a confirming Kind 30594 event with a `confirms` tag.
7. **Check delegation chain** — if the superior is themselves a subordinate in a higher hierarchy, verify that their `delegation_depth` permits re-delegation at this level.

### REQ Filters

```json
// All hierarchy declarations where a pubkey is the subordinate
{"kinds": [30594], "#p": ["<subordinate-pubkey>"]}

// All hierarchy declarations by a specific superior
{"kinds": [30594], "authors": ["<superior-pubkey>"]}

// All revocations for a specific subordinate
{"kinds": [30595], "#p": ["<subordinate-pubkey>"]}

// Revocations for a specific declaration (by address)
{"kinds": [30595], "#a": ["30594:<superior-pubkey>:<d-tag-value>"]}
```

> **Note:** Filters using multi-letter tag names (e.g. `#role_superior`, `#scope`) are not supported by relay-side `REQ` filtering. Clients MUST apply these filters locally after fetching events via the single-letter tag filters shown above.

---

## Validation Rules

All validation rules for NIP-KEY-HIERARCHY events. Implementations MUST enforce these rules when processing hierarchy events.

| Rule      | Requirement |
|-----------|-------------|
| V-KH-01   | Kind 30594 MUST include `p` (subordinate pubkey), at least one `permission` tag, a `scope` tag, `role_superior`, and `role_subordinate`. |
| V-KH-02   | Kind 30594 `d` tag MUST follow the format `<superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>` using full 64-character hex pubkeys. |
| V-KH-03   | If `valid_until` is present, it MUST be a Unix timestamp strictly greater than `created_at`. |
| V-KH-04   | Clients MUST reject declarations where `valid_until` has passed or where a valid Kind 30595 revocation exists with a past `effective_at`. |
| V-KH-05   | Kind 30595 MUST include `a` (address reference to the revoked declaration), `p` (subordinate pubkey), `revocation_reason`, and `effective_at`. |
| V-KH-06   | Kind 30595 `d` tag MUST include a timestamp component to ensure append-only uniqueness. |
| V-KH-07   | A subordinate MUST NOT declare permissions exceeding those granted to them by their own superior (no privilege escalation). |
| V-KH-08   | When `delegation_depth` is `0` (or absent), the subordinate MUST NOT publish Kind 30594 declarations delegating authority further. |
| V-KH-09   | Re-delegation requires BOTH the `delegate` permission tag AND a `delegation_depth` value greater than `0`. If either is missing, the subordinate MUST NOT re-delegate. |
| V-KH-10   | Kind 30594 `pubkey` (superior) MUST NOT equal the `p` tag subordinate pubkey (no self-hierarchy). |
| V-KH-11   | Kind 30595 `pubkey` (revocation author) MUST be either the superior from the referenced declaration or the subordinate named in it. Revocations from unrelated third parties MUST be rejected. |
| V-KH-12   | `delegation_depth` values MUST be non-negative integers or `-1`. Values greater than `10` MUST be treated as `10`. Implementations encountering `-1` SHOULD treat it as `10`. |
| V-KH-13   | Chain traversal during verification MUST terminate after a maximum depth (RECOMMENDED: 10 levels) and MUST maintain a visited-set to detect circular references. |

---

## Examples

### Family — Parent Controlling Child Account

A parent declares authority over a child's account with full signing and data management permissions. The child is not expected to confirm (they may be too young to hold their own keys).

```json
{
    "kind": 30594,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1707500000,
    "tags": [
        ["d", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:hierarchy:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200:family:childcare"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200", "", "subordinate"],
        ["alt", "Hierarchy declaration: parent over child (family)"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "parent"],
        ["role_subordinate", "child"],
        ["scope", "family:childcare"],
        ["permission", "sign"],
        ["permission", "manage_grants"],
        ["permission", "manage_profile"],
        ["permission", "manage_relays"],
        ["permission", "read:30453"],
        ["permission", "write:30453"],
        ["graduation", "sovereign"],
        ["domain", "family"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Family — Co-Parent with Read-Only Access

The primary parent delegates read access to a co-parent. No signing authority — the co-parent can view the child's data but not act on their behalf.

```json
{
    "kind": 30594,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1707500000,
    "tags": [
        ["d", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:hierarchy:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c300:family:co-parent"],
        ["p", "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c300", "", "subordinate"],
        ["alt", "Hierarchy declaration: co-parent read access (family)"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "parent"],
        ["role_subordinate", "co-parent"],
        ["scope", "family:childcare"],
        ["permission", "read:30453"],
        ["permission", "read:30450"],
        ["permission", "read:30451"],
        ["domain", "family"]
    ],
    "content": "<NIP-44 encrypted to co-parent: child metadata, granted_at timestamp>",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Family — Child Graduates to Sovereignty

When the child is old enough, the parent publishes a graduation revocation. The child becomes fully independent.

```json
{
    "kind": 30595,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1770000000,
    "tags": [
        ["d", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200:revocation:family:childcare:1770000000"],
        ["alt", "Hierarchy revocation: child graduated to sovereignty"],
        ["t", "hierarchy-revocation"],
        ["a", "30594:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:hierarchy:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200:family:childcare", "wss://relay.example.com"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200"],
        ["revocation_reason", "graduation"],
        ["effective_at", "1882915200"],
        ["graduation_outcome", "sovereign"],
        ["transition_notes", "Child has reached age 16 and now holds their own keys"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Organisation — Project Lead Assigns Developer

A project lead grants a developer scoped authority within a project. The developer confirms the relationship. Authority is time-bounded to the project duration.

**Project lead's declaration:**

```json
{
    "kind": 30594,
    "pubkey": "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    "created_at": 1707500000,
    "tags": [
        ["d", "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5:hierarchy:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6:project:alpha:development"],
        ["p", "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6", "", "subordinate"],
        ["alt", "Hierarchy declaration: project lead assigns developer to Project Alpha"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "project_lead"],
        ["role_subordinate", "developer"],
        ["scope", "project:alpha:development"],
        ["permission", "read:30023"],
        ["permission", "write:30023"],
        ["permission", "delegate"],
        ["valid_until", "1738800000"],
        ["expiration", "1738800000"],
        ["delegation_depth", "0"],
        ["domain", "project"],
        ["reference", "<project-alpha-announcement-event-id>"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

**Developer's confirmation:**

```json
{
    "kind": 30594,
    "pubkey": "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
    "created_at": 1707500100,
    "tags": [
        ["d", "e5f6a1b2:confirms:d4e5f6a1:project:alpha:development"],
        ["p", "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5", "", "superior"],
        ["t", "hierarchy-confirmation"],
        ["role_superior", "project_lead"],
        ["role_subordinate", "developer"],
        ["scope", "project:alpha:development"],
        ["confirms", "30594:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5:d4e5f6a1:hierarchy:e5f6a1b2:project:alpha:development"],
        ["domain", "project"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Education — Mentor-Apprentice with Time Bounds

A training provider assigns a mentor to an apprentice for a six-month programme. The mentor can read the apprentice's training records and portfolio entries but cannot sign on their behalf.

```json
{
    "kind": 30594,
    "pubkey": "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
    "created_at": 1707500000,
    "tags": [
        ["d", "f6a1b2c3:hierarchy:a1b2c3d4:org:training:welding"],
        ["p", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", "", "subordinate"],
        ["alt", "Hierarchy declaration: mentor over apprentice (welding training)"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "mentor"],
        ["role_subordinate", "apprentice"],
        ["scope", "org:training:welding"],
        ["permission", "read:30453"],
        ["permission", "read:30578"],
        ["permission", "write:30578"],
        ["valid_from", "1707500000"],
        ["valid_until", "1723420800"],
        ["expiration", "1723420800"],
        ["graduation", "sovereign"],
        ["domain", "education"],
        ["reference", "<training-programme-event-id>"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Multi-Level Hierarchy — Organisation Structure

An organisation publishes a chain: Organisation > Department Head > Team Lead > Developer. Each level has a `delegation_depth` that constrains how far authority can be re-delegated.

**Organisation to Department Head:**

```json
{
    "kind": 30594,
    "pubkey": "<org-hex-pubkey>",
    "tags": [
        ["d", "<org_pubkey>:hierarchy:<dept_head_pubkey>:org:engineering"],
        ["p", "<dept-head-hex-pubkey>", "", "subordinate"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "organisation"],
        ["role_subordinate", "department_head"],
        ["scope", "org:engineering"],
        ["permission", "manage_grants"],
        ["permission", "delegate"],
        ["delegation_depth", "2"],
        ["domain", "organisation"]
    ],
    "content": ""
}
```

**Department Head to Team Lead (re-delegation, depth reduced to 1):**

```json
{
    "kind": 30594,
    "pubkey": "<dept-head-hex-pubkey>",
    "tags": [
        ["d", "<dept_head_pubkey>:hierarchy:<team_lead_pubkey>:org:engineering:frontend"],
        ["p", "<team-lead-hex-pubkey>", "", "subordinate"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "department_head"],
        ["role_subordinate", "team_lead"],
        ["scope", "org:engineering:frontend"],
        ["permission", "manage_grants"],
        ["permission", "delegate"],
        ["delegation_depth", "1"],
        ["domain", "organisation"]
    ],
    "content": ""
}
```

Applications traversing the chain verify that each delegation is within the permitted depth and scope of its parent declaration.

---

## Privacy Considerations

### Encrypted Hierarchy Declarations

Some hierarchy relationships are sensitive — the existence of a guardian-ward relationship, a corporate reporting structure, or a custodial arrangement may itself be private information. Implementations MAY deliver Kind 30594 events via NIP-59 gift wrap when the existence of the relationship needs to remain hidden from relay operators.

When using NIP-59 gift wrap, the `p` tag on the outer gift-wrap event routes delivery to the subordinate, but the inner rumour (containing the actual Kind 30594 event) is only readable by the intended recipient. This hides the relationship from relay operators while preserving discoverability for the parties involved.

### `d` Tag Pubkey Exposure

The `d` tag format `<superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>` embeds both pubkeys in cleartext. Even when the `content` field is NIP-44 encrypted and relationship details are moved to encrypted content, the `d` tag remains visible to relay operators and reveals that a hierarchical relationship exists between the two keys. This is an inherent trade-off: the `d` tag must be unencrypted for addressable event semantics (NIP-01 requires relays to index `d` tags for replaceable event deduplication).

**Mitigation for high-privacy relationships:** Use NIP-59 gift wrap (described above) to hide the entire event from relay operators. When NIP-59 is used, the `d` tag is inside the encrypted rumour and is not visible to relays. The trade-off is that gift-wrapped declarations are not discoverable via relay-side `REQ` filters -- only the intended recipient can read them.

### Metadata Minimisation

Implementations SHOULD consider what information is exposed in unencrypted tags versus the encrypted `content` field:

- **Tags that need to be public** for relay-side filtering: `d`, `p`, `t`, `kind`
- **Tags that MAY be private** (moved to encrypted content): `role_superior`, `role_subordinate`, specific `permission` values, `reference`

Applications that prioritise privacy over discoverability MAY encrypt all relationship details in the `content` field, leaving only the minimum tags needed for relay filtering (`d`, `p`, `t`). Note that even with this minimisation, the `d` and `p` tags still reveal the relationship's existence (see `d` Tag Pubkey Exposure above).

---

## Security Considerations

* **Unilateral declarations.** Any pubkey can publish a Kind 30594 event claiming authority over another pubkey. Applications MUST NOT treat unconfirmed declarations as authoritative unless the relationship type inherently does not require consent (e.g. guardian over a minor whose key was generated by the guardian). For peer relationships (employer-employee, mentor-apprentice), applications SHOULD require mutual confirmation.
* **Revocation propagation.** Revocation events may not propagate to all relays immediately. Applications verifying hierarchies SHOULD query multiple relays and SHOULD treat any valid revocation found on any relay as authoritative.
* **Revocation and the `sign` permission.** The `sign` permission grants the ability to publish events as the subordinate. Events signed before a revocation propagates are cryptographically indistinguishable from events signed while the hierarchy was active. Applications consuming events from a subordinate's pubkey SHOULD check whether any `sign`-granting hierarchy was revoked around the time the event was published. There is no protocol-level solution to this -- it is an inherent limitation of asynchronous revocation on a gossip network. High-stakes applications (e.g. financial authorisation) SHOULD require short `valid_until` windows and frequent re-declaration rather than long-lived `sign` permissions.
* **Scope escalation.** A subordinate with `delegate` permission and `delegation_depth > 0` can declare hierarchies over third parties. Applications MUST verify that re-delegated permissions are a subset of the delegator's own permissions and that the scope is equal to or narrower than the delegator's scope. The `delegate` permission and `delegation_depth` tag are both required for re-delegation -- a subordinate with `delegation_depth > 0` but without the `delegate` permission tag MUST NOT be allowed to re-delegate, and vice versa.
* **Stale declarations.** Applications SHOULD check `created_at` and `valid_until` timestamps. A declaration with a valid `valid_until` but a very old `created_at` may indicate a stale relationship that was never formally revoked.
* **Key compromise.** If a superior's key is compromised, an attacker could publish hierarchy declarations over arbitrary subordinates. The mutual confirmation mechanism mitigates this for relationship types that require consent. For unilateral relationships (guardian-child), key compromise is a fundamental risk that exists independent of this NIP.
* **Circular hierarchies.** Applications MUST detect and reject circular authority chains (A declares authority over B, B declares authority over A). A simple visited-set check during chain traversal prevents infinite loops. Implementations MUST impose a maximum traversal depth (RECOMMENDED: 10 levels) to prevent denial-of-service via deeply nested or circular chains.
* **Self-hierarchy.** Applications MUST reject Kind 30594 events where the `pubkey` (superior) equals the `p` tag subordinate pubkey. A key declaring authority over itself has no meaningful semantics and could confuse chain traversal logic.
* **Revocation immutability.** Kind 30595 events use the append-only pattern. Clients MUST treat revocations as permanent. If a relationship is reinstated after revocation, a new Kind 30594 declaration MUST be published rather than deleting the revocation.
* **Subordinate-initiated revocation authority.** Both the superior and subordinate MAY publish Kind 30595 revocations. The `pubkey` field of the revocation event identifies who initiated it. Applications MUST verify that the revocation author is either the superior (the original declaration's `pubkey`) or the subordinate (the `p` tag target). Revocations from unrelated third parties MUST be ignored. For relationship types that do not permit subordinate withdrawal (e.g. legal guardianship of a minor), applications MAY ignore subordinate-initiated revocations.
* **`manage_relays` is a high-risk permission.** The `manage_relays` permission allows the superior to change the subordinate's relay list (kind 10002). A malicious or compromised superior could isolate the subordinate from the network by pointing their relay list to unresponsive or adversarial relays. Applications SHOULD treat `manage_relays` as a high-privilege permission comparable to `sign` and SHOULD require explicit user acknowledgement before granting it.
* **Privacy of relationship details.** Hierarchy declarations may reveal sensitive information (guardianship arrangements, employment relationships, institutional care). Publishers SHOULD use NIP-59 gift wrap for sensitive relationships and SHOULD minimise information in unencrypted tags. See the Privacy Considerations section for details on `d` tag pubkey exposure.

---

## Composition Patterns

This NIP is a standalone primitive that declares authority relationships. It composes with other protocols that handle adjacent concerns. The following patterns illustrate how hierarchy declarations can integrate with other Nostr events.

### With data access grants

A hierarchy declaration establishes *who has authority*. A separate data access grant (any addressable event that scopes read/write permissions to specific event kinds) establishes *what data they can access*. The two compose naturally:

1. Parent publishes Kind 30594 declaring authority over child.
2. Parent publishes a data access grant giving co-parent read access to child's learning records.
3. Application verifies: the co-parent's data access is justified by the parent's hierarchy declaration.

This separation means that revoking data access does not dissolve the authority relationship, and revoking the authority relationship (Kind 30595) does not automatically revoke data access grants. Applications SHOULD revoke related data access grants when a hierarchy is revoked.

### With credential gating

A credential requirement can specify that only pubkeys holding a specific hierarchy role may participate:

- "Only pubkeys declared as `mentor` by this training provider may assess apprentices"
- "Only pubkeys declared as `project_lead` by this organisation may approve pull requests"

Applications verify the hierarchy chain before checking credentials, establishing both positional authority and professional qualification.

### With approval workflows

An approval gate can reference a Kind 30594 declaration as the basis for reviewer authority:

- "This approval gate requires sign-off from a pubkey declared as `department_head` for scope `org:engineering`"

The hierarchy declaration provides the authority; the approval workflow provides the process.

---

## Multi-Letter Tag Filtering

This NIP uses several multi-letter tags (`role_superior`, `role_subordinate`, `scope`, `permission`, `graduation`, `delegation_depth`, `revocation_reason`, `effective_at`, `graduation_outcome`, `successor`, `transition_notes`). Standard Nostr relays index only single-letter tags for `#` filter queries. Multi-letter tags are stored in events and readable by clients, but cannot be used in relay-side `REQ` filters. Clients SHOULD filter by `kind` and use single-letter tags (`d`, `p`, `a`) for relay queries, then apply multi-letter tag filters client-side.

## Test Vectors

### Kind 30594 — Hierarchy Declaration (Parent-Child)

```json
{
    "kind": 30594,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1707500000,
    "tags": [
        ["d", "a1b2c3d4:hierarchy:b2c3d4e5:family:childcare"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200", "", "subordinate"],
        ["alt", "Hierarchy declaration: parent over child (family)"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "parent"],
        ["role_subordinate", "child"],
        ["scope", "family:childcare"],
        ["permission", "sign"],
        ["permission", "manage_grants"],
        ["permission", "manage_profile"],
        ["permission", "read:30453"],
        ["permission", "write:30453"],
        ["graduation", "sovereign"],
        ["domain", "family"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Kind 30594 — Hierarchy Declaration (Mentor-Apprentice)

```json
{
    "kind": 30594,
    "pubkey": "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
    "created_at": 1707500000,
    "tags": [
        ["d", "f6a1b2c3:hierarchy:a1b2c3d4:org:training:welding"],
        ["p", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", "", "subordinate"],
        ["alt", "Hierarchy declaration: mentor over apprentice (welding training)"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "mentor"],
        ["role_subordinate", "apprentice"],
        ["scope", "org:training:welding"],
        ["permission", "read:30453"],
        ["permission", "read:30578"],
        ["permission", "write:30578"],
        ["valid_from", "1707500000"],
        ["valid_until", "1723420800"],
        ["expiration", "1723420800"],
        ["graduation", "sovereign"],
        ["domain", "education"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Kind 30595 — Hierarchy Revocation (Graduation)

```json
{
    "kind": 30595,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1770000000,
    "tags": [
        ["d", "b2c3d4e5:revocation:family:childcare:1770000000"],
        ["alt", "Hierarchy revocation: child graduated to sovereignty"],
        ["t", "hierarchy-revocation"],
        ["a", "30594:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:a1b2c3d4:hierarchy:b2c3d4e5:family:childcare", "wss://relay.example.com"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200"],
        ["revocation_reason", "graduation"],
        ["effective_at", "1882915200"],
        ["graduation_outcome", "sovereign"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

### Kind 30595 — Hierarchy Revocation (Transfer)

```json
{
    "kind": 30595,
    "pubkey": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": 1710000000,
    "tags": [
        ["d", "b2c3d4e5:revocation:family:childcare:1710000000"],
        ["alt", "Hierarchy revocation: custody transferred to co-parent"],
        ["t", "hierarchy-revocation"],
        ["a", "30594:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2:a1b2c3d4:hierarchy:b2c3d4e5:family:childcare", "wss://relay.example.com"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200"],
        ["revocation_reason", "transfer"],
        ["effective_at", "1742169600"],
        ["successor", "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c300"],
        ["transition_notes", "Custody transferred to co-parent by mutual agreement"]
    ],
    "content": "",
    "id": "<32-byte-hex>",
    "sig": "<64-byte-hex>"
}
```

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps (time-bounded relationships)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads (private relationship metadata)
* [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md): Gift wrap (optional private declaration delivery)

## Reference Implementation

No reference implementation exists yet. Implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing and subscription filtering by `#p` and `#a` tags.
2. Hierarchy verification logic that checks scope matching, permission presence, time bounds, and revocation status.
3. Scope matching that supports hierarchical paths (e.g. `project:alpha` covers `project:alpha:development`).
4. Chain traversal that walks delegation chains while checking `delegation_depth` constraints and detecting circular references.
