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

- **NIP-26 (Delegated Event Signing):** NIP-26 authorises one pubkey to sign events *as if* they were another pubkey — identity delegation. NIP-KEY-HIERARCHY declares *authority relationships* between keys without granting signing power. A parent controlling a child's account is not signing as the child; they are exercising authority over the child's data and permissions. The two are complementary: a NIP-KEY-HIERARCHY declaration might accompany a NIP-26 delegation, or it might exist without one.
- **NIP-DATA-ACCESS (kind 30556):** NIP-DATA-ACCESS grants scoped access to encrypted data — read/write permissions on specific event kinds. NIP-KEY-HIERARCHY declares the authority relationship that *justifies* those grants. A parent might hold a Kind 30594 declaration over a child and separately issue a Kind 30556 data access grant to a co-parent. The hierarchy declares "who has authority"; the data access grant declares "who can read what."
- **NIP-CREDENTIALS (kinds 30527-30528):** NIP-CREDENTIALS gates participation on verifiable qualifications. NIP-KEY-HIERARCHY gates participation on position within an authority structure. An organisation might require a credential (NIP-CREDENTIALS) *and* a role assignment (NIP-KEY-HIERARCHY) before granting access.
- **nsec-tree:** nsec-tree is a key *derivation* library — it generates sub-identity keypairs deterministically from a master secret. NIP-KEY-HIERARCHY is a key *relationship* protocol — it declares relationships between already-existing keypairs on relays. The two compose naturally: nsec-tree derives the keys, NIP-KEY-HIERARCHY announces their relationships.

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
| `d`                | Yes         | `<superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>`. Unique per superior per subordinate per scope. The `<scope>` segment is application-defined (e.g. a domain name, a project identifier, or a department name). |
| `p`                | Yes         | Subordinate's Nostr pubkey. The fourth element SHOULD be `"subordinate"` as a role marker. Additional `p` tags MAY reference witnesses (see [Witnessed Declarations](#witnessed-declarations)). |
| `t`                | Yes         | Protocol family marker. MUST be `"hierarchy-declaration"`. |
| `role_superior`    | Yes         | The superior's role in this relationship. Application-defined values. Recommended: `parent`, `guardian`, `organisation`, `project_lead`, `mentor`, `keeper`, `custodian`, `employer`. |
| `role_subordinate` | Yes         | The subordinate's role. Application-defined values. Recommended: `child`, `ward`, `practitioner`, `team_member`, `apprentice`, `renegade`, `viewer`, `employee`. |
| `scope`            | Yes         | Authority scope as a colon-separated path. Examples: `family:childcare`, `project:alpha:development`, `org:training:welding`. Enables hierarchical scope matching (a grant for `project:alpha` implicitly covers `project:alpha:development`). |
| `permission`       | Yes         | One permission per tag. Repeatable. See [Permission Model](#permission-model). |
| `valid_from`       | Optional    | Unix timestamp when authority begins. Defaults to `created_at`. |
| `valid_until`      | Optional    | Unix timestamp when authority expires. Omit for indefinite relationships. When present, grantors SHOULD also include a NIP-40 `expiration` tag matching `valid_until` for relay-side garbage collection. |
| `graduation`       | Optional    | End state when the relationship expires or is intentionally concluded. One of `sovereign` (subordinate becomes fully independent), `transfer` (authority transfers to another superior), `none` (relationship simply ends). |
| `domain`           | Recommended | Application domain. Useful for filtering. Examples: `family`, `education`, `healthcare`, `project`, `organisation`. |
| `delegation_depth` | Optional    | Maximum depth of re-delegation. `0` means the subordinate cannot delegate further (default). `1` means the subordinate can declare hierarchy over one level below them. `-1` means unlimited depth. |
| `reference`        | Optional    | Event ID of a related event (e.g. a project announcement, an organisation profile, a custody agreement). |

### Permission Model

Permissions are declared as individual `permission` tags. Each tag contains a single permission string. Permissions fall into three categories:

**Action permissions** — what the superior can do on behalf of the subordinate:

| Permission       | Description |
|------------------|-------------|
| `sign`           | Sign events on the subordinate's behalf (implies NIP-26-level authority) |
| `manage_grants`  | Issue, modify, and revoke data access grants (NIP-DATA-ACCESS kind 30556) for the subordinate's data |
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

A hierarchy declaration published by the superior is unilateral — it asserts authority. For relationships where the subordinate's consent matters (e.g. mentor-apprentice, employer-employee), the subordinate MAY publish a **confirmation event**: a Kind 30594 event with the roles reversed in the `d` tag and a `confirms` tag referencing the superior's declaration.

```json
{
    "kind": 30594,
    "pubkey": "<subordinate-hex-pubkey>",
    "tags": [
        ["d", "<subordinate_pubkey>:hierarchy:<superior_pubkey>:confirmation"],
        ["p", "<superior-hex-pubkey>", "", "superior"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "mentor"],
        ["role_subordinate", "apprentice"],
        ["scope", "org:training:welding"],
        ["confirms", "<event-id-of-superior's-declaration>"],
        ["domain", "education"]
    ],
    "content": ""
}
```

Applications MAY require mutual confirmation before treating a hierarchy as active. This is OPTIONAL — guardian relationships over minors, for example, do not require the child's confirmation.

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
        ["e", "<hierarchy-declaration-event-id>", "<relay-hint>", "30594"],
        ["p", "<subordinate-hex-pubkey>"],
        ["revocation_reason", "graduation"],
        ["effective_date", "2026-03-15"],
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
| `e`                  | Yes         | Event reference to the Kind 30594 declaration being revoked. Format: `["e", "<event-id>", "<relay-hint>", "30594"]`. |
| `p`                  | Yes         | Pubkey of the subordinate whose hierarchy is being revoked. |
| `revocation_reason`  | Yes         | Reason for revocation. One of `graduation` (subordinate reached sovereignty), `transfer` (authority transferred to another superior), `withdrawal` (superior withdraws authority), `mutual` (both parties agreed to end), `disciplinary` (conduct-related), `expiry` (natural time-bound expiry, explicitly recorded), `restructure` (organisational change). |
| `effective_date`     | Yes         | ISO 8601 date when the revocation takes effect (e.g. `2026-03-15`). MAY be in the future for planned transitions. |
| `graduation_outcome` | Optional    | When `revocation_reason` is `graduation`. One of `sovereign` (subordinate is now fully independent), `promoted` (subordinate moves to a higher role in the same structure), `transferred` (subordinate moves to a different structure). |
| `successor`          | Optional    | Pubkey of the new superior, when `revocation_reason` is `transfer`. Applications SHOULD verify that a corresponding Kind 30594 declaration exists from the successor. |
| `transition_notes`   | Optional    | Human-readable explanation of the transition circumstances. |

### Subordinate-Initiated Revocation

The subordinate MAY also publish a Kind 30595 revocation to signal they no longer accept the authority relationship. This is a social signal — it does not cryptographically prevent the superior from continuing to publish Kind 30594 events. Applications SHOULD honour subordinate-initiated revocations when the relationship type permits it (e.g. mentor-apprentice) and MAY ignore them when the relationship type does not (e.g. legal guardianship of a minor).

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
5. **Check revocation** — subscribe to `kind:30595` events referencing the declaration's event ID. If any revocation exists with an `effective_date` in the past, the hierarchy is invalid.
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

// Revocations for a specific declaration
{"kinds": [30595], "#e": ["<declaration-event-id>"]}
```

> **Note:** Filters using multi-letter tag names (e.g. `#role_superior`, `#scope`) are not supported by relay-side `REQ` filtering. Clients MUST apply these filters locally after fetching events via the single-letter tag filters shown above.

---

## Validation Rules

All validation rules for NIP-KEY-HIERARCHY events. Implementations MUST enforce these rules when processing hierarchy events.

| Rule      | Requirement |
|-----------|-------------|
| V-KH-01   | Kind 30594 MUST include `p` (subordinate pubkey), at least one `permission` tag, a `scope` tag, `role_superior`, and `role_subordinate`. |
| V-KH-02   | Kind 30594 `d` tag MUST follow the format `<superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>`. |
| V-KH-03   | If `valid_until` is present, it MUST be a Unix timestamp strictly greater than `created_at`. |
| V-KH-04   | Clients MUST reject declarations where `valid_until` has passed or where a valid Kind 30595 revocation exists with a past `effective_date`. |
| V-KH-05   | Kind 30595 MUST include `e` (reference to the revoked declaration), `p` (subordinate pubkey), `revocation_reason`, and `effective_date`. |
| V-KH-06   | Kind 30595 `d` tag MUST include a timestamp component to ensure append-only uniqueness. |
| V-KH-07   | A subordinate MUST NOT declare permissions exceeding those granted to them by their own superior (no privilege escalation). |
| V-KH-08   | When `delegation_depth` is `0` (or absent), the subordinate MUST NOT publish Kind 30594 declarations delegating authority further. |

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
        ["d", "a1b2c3d4:hierarchy:c3d4e5f6:family:co-parent"],
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
        ["d", "b2c3d4e5:revocation:family:childcare:1770000000"],
        ["alt", "Hierarchy revocation: child graduated to sovereignty"],
        ["t", "hierarchy-revocation"],
        ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555", "wss://relay.example.com", "30594"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200"],
        ["revocation_reason", "graduation"],
        ["effective_date", "2029-09-01"],
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
        ["d", "d4e5f6a1:hierarchy:e5f6a1b2:project:alpha:development"],
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
        ["d", "e5f6a1b2:hierarchy:d4e5f6a1:confirmation"],
        ["p", "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5", "", "superior"],
        ["t", "hierarchy-declaration"],
        ["role_superior", "project_lead"],
        ["role_subordinate", "developer"],
        ["scope", "project:alpha:development"],
        ["confirms", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555"],
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

### Metadata Minimisation

Implementations SHOULD consider what information is exposed in unencrypted tags versus the encrypted `content` field:

- **Tags that need to be public** for relay-side filtering: `d`, `p`, `t`, `kind`
- **Tags that MAY be private** (moved to encrypted content): `role_superior`, `role_subordinate`, specific `permission` values, `reference`

Applications that prioritise privacy over discoverability MAY encrypt all relationship details in the `content` field, leaving only the minimum tags needed for relay filtering (`d`, `p`, `t`).

---

## Security Considerations

* **Unilateral declarations.** Any pubkey can publish a Kind 30594 event claiming authority over another pubkey. Applications MUST NOT treat unconfirmed declarations as authoritative unless the relationship type inherently does not require consent (e.g. guardian over a minor whose key was generated by the guardian). For peer relationships (employer-employee, mentor-apprentice), applications SHOULD require mutual confirmation.
* **Revocation propagation.** Revocation events may not propagate to all relays immediately. Applications verifying hierarchies SHOULD query multiple relays and SHOULD treat any valid revocation found on any relay as authoritative.
* **Scope escalation.** A subordinate with `delegate` permission and `delegation_depth > 0` can declare hierarchies over third parties. Applications MUST verify that re-delegated permissions are a subset of the delegator's own permissions and that the scope is equal to or narrower than the delegator's scope.
* **Stale declarations.** Applications SHOULD check `created_at` and `valid_until` timestamps. A declaration with a valid `valid_until` but a very old `created_at` may indicate a stale relationship that was never formally revoked.
* **Key compromise.** If a superior's key is compromised, an attacker could publish hierarchy declarations over arbitrary subordinates. The mutual confirmation mechanism mitigates this for relationship types that require consent. For unilateral relationships (guardian-child), key compromise is a fundamental risk that exists independent of this NIP.
* **Circular hierarchies.** Applications MUST detect and reject circular authority chains (A declares authority over B, B declares authority over A). A simple visited-set check during chain traversal prevents infinite loops.
* **Revocation immutability.** Kind 30595 events use the append-only pattern. Clients MUST treat revocations as permanent. If a relationship is reinstated after revocation, a new Kind 30594 declaration MUST be published rather than deleting the revocation.
* **Privacy of relationship details.** Hierarchy declarations may reveal sensitive information (guardianship arrangements, employment relationships, institutional care). Publishers SHOULD use NIP-59 gift wrap for sensitive relationships and SHOULD minimise information in unencrypted tags.

---

## Composition Patterns

### With NIP-DATA-ACCESS (kind 30556)

A Kind 30594 hierarchy declaration establishes *who has authority*. A Kind 30556 data access grant establishes *what data they can access*. The two compose naturally:

1. Parent publishes Kind 30594 declaring authority over child.
2. Parent publishes Kind 30556 granting co-parent read access to child's learning records.
3. Application verifies: the co-parent's data access is justified by the parent's hierarchy declaration.

This separation means that revoking data access (Kind 30556 with `["revoked", "true"]`) does not dissolve the authority relationship, and revoking the authority relationship (Kind 30595) does not automatically revoke data access grants. Applications SHOULD revoke related data access grants when a hierarchy is revoked.

### With NIP-CREDENTIALS (kinds 30527-30528)

A Kind 30527 credential requirement can specify that only pubkeys holding a specific hierarchy role may participate:

- "Only pubkeys declared as `mentor` by this training provider may assess apprentices"
- "Only pubkeys declared as `project_lead` by this organisation may approve pull requests"

Applications verify the hierarchy chain before checking credentials, establishing both positional authority and professional qualification.

### With NIP-APPROVAL (kinds 30570-30571)

An approval gate (Kind 30570) can reference a Kind 30594 declaration as the basis for reviewer authority:

- "This approval gate requires sign-off from a pubkey declared as `department_head` for scope `org:engineering`"

The hierarchy declaration provides the authority; the approval gate provides the workflow.

---

## Multi-Letter Tag Filtering

This NIP uses several multi-letter tags (`role_superior`, `role_subordinate`, `scope`, `permission`, `graduation`, `delegation_depth`, `revocation_reason`, `effective_date`, `graduation_outcome`, `successor`, `transition_notes`). Standard Nostr relays index only single-letter tags for `#` filter queries. Multi-letter tags are stored in events and readable by clients, but cannot be used in relay-side `REQ` filters. Clients SHOULD filter by `kind` and use single-letter tags (`d`, `p`, `e`) for relay queries, then apply multi-letter tag filters client-side.

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
        ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555", "wss://relay.example.com", "30594"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200"],
        ["revocation_reason", "graduation"],
        ["effective_date", "2029-09-01"],
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
        ["e", "dddd4444eeee5555ffff6666aaaa1111bbbb2222cccc3333dddd4444eeee5555", "wss://relay.example.com", "30594"],
        ["p", "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b200"],
        ["revocation_reason", "transfer"],
        ["effective_date", "2026-03-15"],
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

1. A Nostr client that supports addressable event publishing and subscription filtering by `#p` and `#e` tags.
2. Hierarchy verification logic that checks scope matching, permission presence, time bounds, and revocation status.
3. Scope matching that supports hierarchical paths (e.g. `project:alpha` covers `project:alpha:development`).
4. Chain traversal that walks delegation chains while checking `delegation_depth` constraints and detecting circular references.
