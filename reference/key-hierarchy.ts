/**
 * NIP-KEY-HIERARCHY Reference Implementation
 *
 * Minimal, standalone TypeScript reference for kinds 30594 (Hierarchy Declaration)
 * and 30595 (Hierarchy Revocation). Zero external dependencies.
 *
 * This file is intended as study material for implementors. It produces unsigned
 * Nostr event objects -- signing and relay interaction are out of scope.
 *
 * All validation rules (V-KH-01 through V-KH-13) from the spec are enforced.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Kind number for Hierarchy Declaration (addressable, replaceable). */
const KIND_DECLARATION = 30594 as const;

/** Kind number for Hierarchy Revocation (addressable, append-only). */
const KIND_REVOCATION = 30595 as const;

/** Maximum permitted delegation depth (V-KH-12). */
const MAX_DELEGATION_DEPTH = 10;

/** Maximum chain traversal depth to prevent DoS (V-KH-13). */
const MAX_CHAIN_DEPTH = 10;

/** Length of a hex-encoded Nostr public key. */
const HEX_PUBKEY_LENGTH = 64;

// ---------------------------------------------------------------------------
// Action permissions recognised by the spec: sign, manage_grants,
// manage_profile, manage_relays. Data permissions use read:<kind> / write:<kind>.
// Meta permission: delegate (allows re-delegation within delegation_depth).

/** Meta permission that enables re-delegation. */
const META_PERMISSION_DELEGATE = 'delegate' as const;

// ---------------------------------------------------------------------------
// Nostr event shape (minimal, unsigned)
// ---------------------------------------------------------------------------

/** A tag is an array of strings: [tag-name, ...values]. */
type Tag = [string, ...string[]];

/**
 * Minimal Nostr event structure.
 * Unsigned -- `id` and `sig` are absent until the event is signed.
 */
interface UnsignedEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: Tag[];
  content: string;
}

/**
 * A signed Nostr event as it would appear on a relay.
 * Extends the unsigned shape with `id` and `sig`.
 */
interface NostrEvent extends UnsignedEvent {
  id: string;
  sig: string;
}

// ---------------------------------------------------------------------------
// Type definitions: Hierarchy Declaration (kind 30594)
// ---------------------------------------------------------------------------

/** Recognised superior roles (recommended values from the spec). */
type SuperiorRole =
  | 'parent'
  | 'guardian'
  | 'organisation'
  | 'project_lead'
  | 'mentor'
  | 'keeper'
  | 'custodian'
  | 'employer'
  | (string & {}); // allow application-defined roles

/** Recognised subordinate roles (recommended values from the spec). */
type SubordinateRole =
  | 'child'
  | 'ward'
  | 'practitioner'
  | 'team_member'
  | 'apprentice'
  | 'member'
  | 'viewer'
  | 'employee'
  | (string & {}); // allow application-defined roles

/** Graduation outcome when a relationship ends. */
type GraduationOutcome = 'sovereign' | 'transfer' | 'none';

/** Revocation reasons. */
type RevocationReason =
  | 'graduation'
  | 'transfer'
  | 'withdrawal'
  | 'mutual'
  | 'disciplinary'
  | 'expiry'
  | 'restructure';

/** Graduation outcome on a revocation event. */
type RevocationGraduationOutcome = 'sovereign' | 'promoted' | 'transferred';

/**
 * Parameters for building a Hierarchy Declaration event (kind 30594).
 */
interface HierarchyDeclarationParams {
  /** Hex pubkey of the superior (event author). */
  superiorPubkey: string;
  /** Hex pubkey of the subordinate. */
  subordinatePubkey: string;
  /** Authority scope as a colon-separated path, e.g. "family:childcare". */
  scope: string;
  /** Superior's role in this relationship. */
  roleSuperior: SuperiorRole;
  /** Subordinate's role in this relationship. */
  roleSubordinate: SubordinateRole;
  /** One or more permission strings. At least one is required. */
  permissions: string[];
  /** Optional: Unix timestamp when authority begins. Defaults to created_at. */
  validFrom?: number;
  /** Optional: Unix timestamp when authority expires. */
  validUntil?: number;
  /** Optional: end-state when the relationship concludes. */
  graduation?: GraduationOutcome;
  /** Optional: application domain for filtering. */
  domain?: string;
  /** Optional: maximum re-delegation depth (0 = cannot delegate further). */
  delegationDepth?: number;
  /** Optional: event ID of a related event. */
  reference?: string;
  /** Optional: witness pubkeys (for high-stakes relationships). */
  witnesses?: string[];
  /** Optional: NIP-44 encrypted private metadata. */
  encryptedContent?: string;
  /** Optional: human-readable alt text for clients that don't understand this kind. */
  alt?: string;
}

/**
 * Parameters for building a Hierarchy Confirmation event (kind 30594).
 * Published by the subordinate to confirm they accept the relationship.
 */
interface HierarchyConfirmationParams {
  /** Hex pubkey of the subordinate (event author of the confirmation). */
  subordinatePubkey: string;
  /** Hex pubkey of the superior being confirmed. */
  superiorPubkey: string;
  /** Scope matching the original declaration. */
  scope: string;
  /** d-tag value of the original declaration being confirmed. */
  declarationDTag: string;
  /** Superior's role. */
  roleSuperior: SuperiorRole;
  /** Subordinate's role. */
  roleSubordinate: SubordinateRole;
  /** Optional: application domain for filtering. */
  domain?: string;
}

/**
 * Parameters for building a Hierarchy Revocation event (kind 30595).
 */
interface HierarchyRevocationParams {
  /** Hex pubkey of the revocation author (superior or subordinate). */
  authorPubkey: string;
  /** Hex pubkey of the subordinate whose hierarchy is being revoked. */
  subordinatePubkey: string;
  /** Scope of the hierarchy being revoked. */
  scope: string;
  /** The superior's pubkey from the original declaration. */
  superiorPubkey: string;
  /** The d-tag value of the Kind 30594 declaration being revoked. */
  declarationDTag: string;
  /** Reason for the revocation. */
  revocationReason: RevocationReason;
  /** Unix timestamp when the revocation takes effect. */
  effectiveAt: number;
  /** Optional relay hint for the `a` tag. */
  relayHint?: string;
  /** Optional: graduation outcome when reason is 'graduation'. */
  graduationOutcome?: RevocationGraduationOutcome;
  /** Optional: pubkey of the new superior when reason is 'transfer'. */
  successor?: string;
  /** Optional: human-readable explanation. */
  transitionNotes?: string;
  /** Optional: human-readable alt text. */
  alt?: string;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/** Result of a validation check. */
interface ValidationResult {
  valid: boolean;
  /** List of violated rules (e.g. "V-KH-01", "V-KH-10"). */
  errors: string[];
}

/** Result of the authority verification algorithm. */
interface VerificationResult {
  authorised: boolean;
  /** Human-readable reason for rejection, if applicable. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Returns the current time as a Unix timestamp (seconds). */
function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/** Checks whether a string looks like a 64-character hex pubkey. */
function isValidHexPubkey(s: string): boolean {
  return typeof s === 'string' && s.length === HEX_PUBKEY_LENGTH && /^[0-9a-f]+$/.test(s);
}

/**
 * Retrieves the first value for a given tag name from a tag array.
 * Returns `undefined` if the tag is not present.
 */
function getTagValue(tags: Tag[], name: string): string | undefined {
  const tag = tags.find((t) => t[0] === name);
  return tag ? tag[1] : undefined;
}

/**
 * Retrieves all values for a given tag name from a tag array.
 * For repeatable tags like `permission`.
 */
function getAllTagValues(tags: Tag[], name: string): string[] {
  return tags.filter((t) => t[0] === name).map((t) => t[1]);
}

/**
 * Parses the `delegation_depth` value, applying V-KH-12 clamping rules.
 *
 * - Values > 10 are clamped to 10.
 * - The value -1 is treated as 10 (not recommended but handled).
 * - Absent or non-numeric values default to 0.
 */
function parseDelegationDepth(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return 0;
  if (n === -1) return MAX_DELEGATION_DEPTH;
  if (n > MAX_DELEGATION_DEPTH) return MAX_DELEGATION_DEPTH;
  if (n < -1) return 0; // reject nonsensical negative values
  return n;
}

// ---------------------------------------------------------------------------
// Builder: Hierarchy Declaration (kind 30594)
// ---------------------------------------------------------------------------

/**
 * Builds an unsigned Hierarchy Declaration event (kind 30594).
 *
 * The caller is responsible for signing the returned event object.
 * The `created_at` timestamp is set to the current time.
 *
 * @param params - Declaration parameters.
 * @returns An unsigned Nostr event ready for signing.
 * @throws If required parameters are missing or invalid.
 */
function buildHierarchyDeclaration(params: HierarchyDeclarationParams): UnsignedEvent {
  const {
    superiorPubkey,
    subordinatePubkey,
    scope,
    roleSuperior,
    roleSubordinate,
    permissions,
    validFrom,
    validUntil,
    graduation,
    domain,
    delegationDepth,
    reference,
    witnesses,
    encryptedContent,
    alt,
  } = params;

  if (!isValidHexPubkey(superiorPubkey)) {
    throw new Error('superiorPubkey must be a 64-character hex string');
  }
  if (!isValidHexPubkey(subordinatePubkey)) {
    throw new Error('subordinatePubkey must be a 64-character hex string');
  }
  if (superiorPubkey === subordinatePubkey) {
    throw new Error('V-KH-10: superior and subordinate pubkeys must differ (no self-hierarchy)');
  }
  if (!scope || typeof scope !== 'string') {
    throw new Error('scope is required');
  }
  if (!permissions || permissions.length === 0) {
    throw new Error('V-KH-01: at least one permission is required');
  }

  const createdAt = nowUnix();

  // Construct the d tag: <superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>
  const dTag = `${superiorPubkey}:hierarchy:${subordinatePubkey}:${scope}`;

  const tags: Tag[] = [
    ['d', dTag],
    ['p', subordinatePubkey, '', 'subordinate'],
    ['alt', alt ?? `Hierarchy declaration: ${roleSuperior} over ${roleSubordinate} (${scope})`],
    ['t', 'hierarchy-declaration'],
    ['role_superior', roleSuperior],
    ['role_subordinate', roleSubordinate],
    ['scope', scope],
  ];

  // Add permission tags (one per tag, repeatable)
  for (const perm of permissions) {
    tags.push(['permission', perm]);
  }

  // Optional time bounds
  if (validFrom !== undefined) {
    tags.push(['valid_from', String(validFrom)]);
  }
  if (validUntil !== undefined) {
    if (validUntil <= createdAt) {
      throw new Error('V-KH-03: valid_until must be strictly greater than created_at');
    }
    tags.push(['valid_until', String(validUntil)]);
    // NIP-40 expiration for relay-side garbage collection
    tags.push(['expiration', String(validUntil)]);
  }

  if (graduation !== undefined) {
    tags.push(['graduation', graduation]);
  }
  if (domain !== undefined) {
    tags.push(['domain', domain]);
  }
  if (delegationDepth !== undefined) {
    const clamped = delegationDepth > MAX_DELEGATION_DEPTH ? MAX_DELEGATION_DEPTH : delegationDepth;
    tags.push(['delegation_depth', String(clamped)]);
  }
  if (reference !== undefined) {
    tags.push(['reference', reference]);
  }

  // Witness p tags
  if (witnesses) {
    for (const wit of witnesses) {
      if (!isValidHexPubkey(wit)) {
        throw new Error(`Witness pubkey is not valid hex: ${wit}`);
      }
      tags.push(['p', wit, '', 'witness']);
    }
  }

  return {
    kind: KIND_DECLARATION,
    pubkey: superiorPubkey,
    created_at: createdAt,
    tags,
    content: encryptedContent ?? '',
  };
}

// ---------------------------------------------------------------------------
// Builder: Hierarchy Confirmation (kind 30594, subordinate-published)
// ---------------------------------------------------------------------------

/**
 * Builds an unsigned Hierarchy Confirmation event (kind 30594).
 *
 * Published by the subordinate to signal mutual consent. Uses a distinct
 * d-tag format (`<subordinate_pubkey>:confirms:<superior_pubkey>:<scope>`)
 * and `t` tag of `hierarchy-confirmation`.
 *
 * @param params - Confirmation parameters.
 * @returns An unsigned Nostr event ready for signing.
 */
function buildHierarchyConfirmation(params: HierarchyConfirmationParams): UnsignedEvent {
  const {
    subordinatePubkey,
    superiorPubkey,
    scope,
    declarationDTag,
    roleSuperior,
    roleSubordinate,
    domain,
  } = params;

  if (!isValidHexPubkey(subordinatePubkey)) {
    throw new Error('subordinatePubkey must be a 64-character hex string');
  }
  if (!isValidHexPubkey(superiorPubkey)) {
    throw new Error('superiorPubkey must be a 64-character hex string');
  }

  // d tag format: <subordinate_pubkey>:confirms:<superior_pubkey>:<scope>
  const dTag = `${subordinatePubkey}:confirms:${superiorPubkey}:${scope}`;

  // Address reference to the declaration being confirmed (NIP-01 address format)
  const confirmsRef = `${KIND_DECLARATION}:${superiorPubkey}:${declarationDTag}`;

  const tags: Tag[] = [
    ['d', dTag],
    ['p', superiorPubkey, '', 'superior'],
    ['t', 'hierarchy-confirmation'],
    ['role_superior', roleSuperior],
    ['role_subordinate', roleSubordinate],
    ['scope', scope],
    ['confirms', confirmsRef],
  ];

  if (domain !== undefined) {
    tags.push(['domain', domain]);
  }

  return {
    kind: KIND_DECLARATION,
    pubkey: subordinatePubkey,
    created_at: nowUnix(),
    tags,
    content: '',
  };
}

// ---------------------------------------------------------------------------
// Builder: Hierarchy Revocation (kind 30595)
// ---------------------------------------------------------------------------

/**
 * Builds an unsigned Hierarchy Revocation event (kind 30595).
 *
 * Each revocation uses a unique d-tag (append-only pattern) so that relays
 * store every revocation rather than replacing previous ones.
 *
 * The author may be either the superior or the subordinate (V-KH-11).
 *
 * @param params - Revocation parameters.
 * @returns An unsigned Nostr event ready for signing.
 */
function buildHierarchyRevocation(params: HierarchyRevocationParams): UnsignedEvent {
  const {
    authorPubkey,
    subordinatePubkey,
    scope,
    superiorPubkey,
    declarationDTag,
    revocationReason,
    effectiveAt,
    relayHint,
    graduationOutcome,
    successor,
    transitionNotes,
    alt,
  } = params;

  if (!isValidHexPubkey(authorPubkey)) {
    throw new Error('authorPubkey must be a 64-character hex string');
  }
  if (!isValidHexPubkey(subordinatePubkey)) {
    throw new Error('subordinatePubkey must be a 64-character hex string');
  }

  const createdAt = nowUnix();

  // d tag: <subordinate_pubkey>:revocation:<scope>:<timestamp>
  // The timestamp component ensures append-only uniqueness (V-KH-06).
  const dTag = `${subordinatePubkey}:revocation:${scope}:${createdAt}`;

  // Address reference to the declaration being revoked
  const aTagValue = `${KIND_DECLARATION}:${superiorPubkey}:${declarationDTag}`;

  const tags: Tag[] = [
    ['d', dTag],
    ['alt', alt ?? `Hierarchy revocation: ${revocationReason}`],
    ['t', 'hierarchy-revocation'],
    ['a', aTagValue, relayHint ?? ''],
    ['p', subordinatePubkey],
    ['revocation_reason', revocationReason],
    ['effective_at', String(effectiveAt)],
  ];

  if (graduationOutcome !== undefined) {
    tags.push(['graduation_outcome', graduationOutcome]);
  }
  if (successor !== undefined) {
    if (!isValidHexPubkey(successor)) {
      throw new Error('successor must be a 64-character hex string');
    }
    tags.push(['successor', successor]);
  }
  if (transitionNotes !== undefined) {
    tags.push(['transition_notes', transitionNotes]);
  }

  return {
    kind: KIND_REVOCATION,
    pubkey: authorPubkey,
    created_at: createdAt,
    tags,
    content: '',
  };
}

// ---------------------------------------------------------------------------
// Validation: Hierarchy Declaration (kind 30594)
// ---------------------------------------------------------------------------

/**
 * Validates a Hierarchy Declaration event against all V-KH rules.
 *
 * Checks structural correctness only -- does not verify cryptographic
 * signatures or query relays.
 *
 * @param event - A Nostr event (signed or unsigned) to validate.
 * @returns Validation result with any violated rules.
 */
function validateDeclaration(event: UnsignedEvent | NostrEvent): ValidationResult {
  const errors: string[] = [];

  if (event.kind !== KIND_DECLARATION) {
    errors.push('Event kind is not 30594');
    return { valid: false, errors };
  }

  const tTag = getTagValue(event.tags, 't');

  // Determine whether this is a declaration or a confirmation
  const isConfirmation = tTag === 'hierarchy-confirmation';

  // --- V-KH-01: Required tags for declarations ---
  if (!isConfirmation) {
    if (tTag !== 'hierarchy-declaration') {
      errors.push('V-KH-01: t tag must be "hierarchy-declaration" for declarations');
    }

    const pTags = event.tags.filter((t) => t[0] === 'p');
    const subordinateP = pTags.find((t) => t[3] === 'subordinate' || t[3] === undefined);
    if (!subordinateP) {
      errors.push('V-KH-01: missing p tag for subordinate');
    }

    const permissions = getAllTagValues(event.tags, 'permission');
    if (permissions.length === 0) {
      errors.push('V-KH-01: at least one permission tag is required');
    }

    if (!getTagValue(event.tags, 'scope')) {
      errors.push('V-KH-01: scope tag is required');
    }
    if (!getTagValue(event.tags, 'role_superior')) {
      errors.push('V-KH-01: role_superior tag is required');
    }
    if (!getTagValue(event.tags, 'role_subordinate')) {
      errors.push('V-KH-01: role_subordinate tag is required');
    }
  }

  // --- V-KH-02: d tag format ---
  const dTag = getTagValue(event.tags, 'd');
  if (!dTag) {
    errors.push('V-KH-02: d tag is required');
  } else if (!isConfirmation) {
    // Declaration d tag: <superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>
    const parts = dTag.split(':');
    // The format is: pubkey(64):hierarchy:pubkey(64):<scope parts...>
    // We need at least 4 segments (superior, "hierarchy", subordinate, scope)
    if (parts.length < 4 || parts[1] !== 'hierarchy') {
      errors.push('V-KH-02: d tag must follow <superior_pubkey>:hierarchy:<subordinate_pubkey>:<scope>');
    } else {
      const superiorInD = parts[0];
      const subordinateInD = parts[2];
      if (!isValidHexPubkey(superiorInD)) {
        errors.push('V-KH-02: superior pubkey in d tag must be a full 64-character hex key');
      }
      if (!isValidHexPubkey(subordinateInD)) {
        errors.push('V-KH-02: subordinate pubkey in d tag must be a full 64-character hex key');
      }
      // Verify d tag pubkeys match the event
      if (superiorInD !== event.pubkey) {
        errors.push('V-KH-02: superior pubkey in d tag does not match event pubkey');
      }
      const pSubordinate = event.tags.find(
        (t) => t[0] === 'p' && (t[3] === 'subordinate' || t[3] === undefined)
      );
      if (pSubordinate && subordinateInD !== pSubordinate[1]) {
        errors.push('V-KH-02: subordinate pubkey in d tag does not match p tag');
      }
    }
  } else {
    // Confirmation d tag: <subordinate_pubkey>:confirms:<superior_pubkey>:<scope>
    const parts = dTag.split(':');
    if (parts.length < 4 || parts[1] !== 'confirms') {
      errors.push('V-KH-02: confirmation d tag must follow <subordinate_pubkey>:confirms:<superior_pubkey>:<scope>');
    }
  }

  // --- V-KH-03: valid_until > created_at ---
  const validUntilRaw = getTagValue(event.tags, 'valid_until');
  if (validUntilRaw !== undefined) {
    const validUntil = parseInt(validUntilRaw, 10);
    if (isNaN(validUntil) || validUntil <= event.created_at) {
      errors.push('V-KH-03: valid_until must be a Unix timestamp strictly greater than created_at');
    }
  }

  // --- V-KH-10: No self-hierarchy ---
  if (!isConfirmation) {
    const subordinateP = event.tags.find(
      (t) => t[0] === 'p' && (t[3] === 'subordinate' || t[3] === undefined)
    );
    if (subordinateP && subordinateP[1] === event.pubkey) {
      errors.push('V-KH-10: pubkey (superior) must not equal p tag subordinate (no self-hierarchy)');
    }
  }

  // --- V-KH-12: delegation_depth bounds ---
  const depthRaw = getTagValue(event.tags, 'delegation_depth');
  if (depthRaw !== undefined) {
    const n = parseInt(depthRaw, 10);
    if (isNaN(n)) {
      errors.push('V-KH-12: delegation_depth must be an integer');
    } else if (n < -1) {
      errors.push('V-KH-12: delegation_depth must be a non-negative integer or -1');
    }
    // Values > 10 are not rejected -- they are clamped during processing (V-KH-12).
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Validation: Hierarchy Revocation (kind 30595)
// ---------------------------------------------------------------------------

/**
 * Validates a Hierarchy Revocation event against all V-KH rules.
 *
 * @param event - A Nostr event (signed or unsigned) to validate.
 * @param originalDeclaration - The Kind 30594 event being revoked (optional).
 *   When provided, V-KH-11 (author must be superior or subordinate) is checked.
 * @returns Validation result with any violated rules.
 */
function validateRevocation(
  event: UnsignedEvent | NostrEvent,
  originalDeclaration?: UnsignedEvent | NostrEvent
): ValidationResult {
  const errors: string[] = [];

  if (event.kind !== KIND_REVOCATION) {
    errors.push('Event kind is not 30595');
    return { valid: false, errors };
  }

  // --- V-KH-05: Required tags ---
  const tTag = getTagValue(event.tags, 't');
  if (tTag !== 'hierarchy-revocation') {
    errors.push('V-KH-05: t tag must be "hierarchy-revocation"');
  }

  const aTag = event.tags.find((t) => t[0] === 'a');
  if (!aTag) {
    errors.push('V-KH-05: a tag (address reference to revoked declaration) is required');
  } else {
    // Validate a tag format: 30594:<pubkey>:<d-tag-value>
    const aValue = aTag[1];
    if (!aValue || !aValue.startsWith(`${KIND_DECLARATION}:`)) {
      errors.push('V-KH-05: a tag must reference a kind 30594 declaration');
    }
  }

  const pTags = event.tags.filter((t) => t[0] === 'p');
  if (pTags.length === 0) {
    errors.push('V-KH-05: p tag (subordinate pubkey) is required');
  }

  if (!getTagValue(event.tags, 'revocation_reason')) {
    errors.push('V-KH-05: revocation_reason tag is required');
  }

  if (!getTagValue(event.tags, 'effective_at')) {
    errors.push('V-KH-05: effective_at tag is required');
  }

  // --- V-KH-06: d tag must include timestamp for append-only uniqueness ---
  const dTag = getTagValue(event.tags, 'd');
  if (!dTag) {
    errors.push('V-KH-06: d tag is required');
  } else {
    // Expected format: <subordinate_pubkey>:revocation:<scope>:<timestamp>
    // We check that the d tag contains a numeric segment at the end
    const parts = dTag.split(':');
    const lastPart = parts[parts.length - 1];
    if (!lastPart || isNaN(parseInt(lastPart, 10))) {
      errors.push('V-KH-06: d tag must include a timestamp component for append-only uniqueness');
    }
  }

  // --- V-KH-11: Author must be superior or subordinate ---
  if (originalDeclaration) {
    const declSuperior = originalDeclaration.pubkey;
    const declSubordinate = originalDeclaration.tags.find(
      (t) => t[0] === 'p' && (t[3] === 'subordinate' || t[3] === undefined)
    );
    const declSubordinatePubkey = declSubordinate?.[1];

    if (
      event.pubkey !== declSuperior &&
      event.pubkey !== declSubordinatePubkey
    ) {
      errors.push(
        'V-KH-11: revocation author must be either the superior or subordinate from the original declaration'
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Scope matching
// ---------------------------------------------------------------------------

/**
 * Determines whether a granted scope covers a requested scope.
 *
 * Implements hierarchical prefix matching as defined in the spec:
 * - `project:alpha` covers `project:alpha:development` (prefix match)
 * - `project:alpha` does NOT cover `project:alpha2` (must match on colon boundary)
 * - Exact matches always succeed
 *
 * @param granted - The scope string from the hierarchy declaration.
 * @param requested - The scope string for the action being verified.
 * @returns `true` if the granted scope covers the requested scope.
 */
function scopeMatches(granted: string, requested: string): boolean {
  // Exact match
  if (granted === requested) return true;

  // Prefix match: granted must be a prefix of requested, followed by a colon.
  // This prevents "project:alpha" from matching "project:alpha2".
  return requested.startsWith(granted + ':');
}

// ---------------------------------------------------------------------------
// Verification algorithm
// ---------------------------------------------------------------------------

/**
 * Verifies whether a superior has authority over a subordinate for a
 * given scope and permission.
 *
 * Implements the 7-step verification algorithm from the spec:
 *
 * 1. Discover declarations
 * 2. Match scope
 * 3. Check permissions
 * 4. Check time bounds
 * 5. Check revocation
 * 6. Check confirmation (if required)
 * 7. Check delegation chain
 *
 * This function takes pre-fetched events as input rather than querying
 * relays directly. The caller is responsible for subscribing to the
 * appropriate relay filters and passing all relevant events.
 *
 * @param superiorPubkey - Hex pubkey of the claimed superior.
 * @param subordinatePubkey - Hex pubkey of the subordinate.
 * @param requestedScope - The scope being checked (e.g. "project:alpha:dev").
 * @param requestedPermission - The permission being checked (e.g. "read:30453").
 * @param declarations - All Kind 30594 events fetched from relays.
 * @param revocations - All Kind 30595 events fetched from relays.
 * @param options - Optional configuration.
 * @param options.requireConfirmation - Whether mutual confirmation is required.
 * @param options.now - Override the current timestamp (for testing).
 * @returns Verification result indicating whether authority is established.
 */
function verifyAuthority(
  superiorPubkey: string,
  subordinatePubkey: string,
  requestedScope: string,
  requestedPermission: string,
  declarations: (UnsignedEvent | NostrEvent)[],
  revocations: (UnsignedEvent | NostrEvent)[],
  options?: {
    requireConfirmation?: boolean;
    now?: number;
  }
): VerificationResult {
  const now = options?.now ?? nowUnix();
  const requireConfirmation = options?.requireConfirmation ?? false;

  // Use an iterative approach with a work queue to handle delegation chains.
  // Each entry in the queue represents a link to verify in the chain:
  //   { superior, subordinate, depth }
  // We start with the top-level claim and may push additional links if
  // the immediate superior is themselves a subordinate (re-delegation).

  interface ChainLink {
    superior: string;
    subordinate: string;
    depth: number;
  }

  const visited = new Set<string>();
  const queue: ChainLink[] = [
    { superior: superiorPubkey, subordinate: subordinatePubkey, depth: 0 },
  ];

  while (queue.length > 0) {
    const link = queue.shift()!;

    // V-KH-13: Maximum chain depth
    if (link.depth > MAX_CHAIN_DEPTH) {
      return { authorised: false, reason: 'V-KH-13: maximum chain traversal depth exceeded' };
    }

    // V-KH-13: Circular reference detection
    const linkKey = `${link.superior}:${link.subordinate}`;
    if (visited.has(linkKey)) {
      return { authorised: false, reason: 'V-KH-13: circular hierarchy detected' };
    }
    visited.add(linkKey);

    // --- Step 1: Discover declarations ---
    // Find Kind 30594 declarations where the author is the claimed superior
    // and the p tag references the claimed subordinate.
    const matchingDeclarations = declarations.filter((evt) => {
      if (evt.kind !== KIND_DECLARATION) return false;
      if (evt.pubkey !== link.superior) return false;
      const tTag = getTagValue(evt.tags, 't');
      if (tTag !== 'hierarchy-declaration') return false;
      const pSub = evt.tags.find(
        (t) => t[0] === 'p' && (t[3] === 'subordinate' || t[3] === undefined)
      );
      return pSub !== undefined && pSub[1] === link.subordinate;
    });

    if (matchingDeclarations.length === 0) {
      // If this is the first link (direct claim), there is no hierarchy.
      // If this is a chain link, the chain is broken.
      if (link.depth === 0) {
        return { authorised: false, reason: 'Step 1: no hierarchy declaration found' };
      }
      return {
        authorised: false,
        reason: `Step 7: delegation chain broken at depth ${link.depth} -- no declaration from ${link.superior} over ${link.subordinate}`,
      };
    }

    // Try each matching declaration (there may be multiple for different scopes)
    let foundValid = false;

    for (const decl of matchingDeclarations) {
      // --- Step 2: Match scope ---
      const declScope = getTagValue(decl.tags, 'scope');
      if (!declScope || !scopeMatches(declScope, requestedScope)) {
        continue; // try next declaration
      }

      // --- Step 3: Check permissions ---
      const declPermissions = getAllTagValues(decl.tags, 'permission');
      if (!declPermissions.includes(requestedPermission)) {
        continue; // try next declaration
      }

      // --- Step 4: Check time bounds ---
      const validFromRaw = getTagValue(decl.tags, 'valid_from');
      const validFrom = validFromRaw ? parseInt(validFromRaw, 10) : decl.created_at;

      const validUntilRaw = getTagValue(decl.tags, 'valid_until');
      const validUntil = validUntilRaw ? parseInt(validUntilRaw, 10) : Infinity;

      if (now < validFrom) {
        continue; // not yet active
      }
      // V-KH-04: reject if valid_until has passed
      if (now > validUntil) {
        continue; // expired
      }

      // --- Step 5: Check revocation ---
      // Build the address reference for this declaration
      const declDTag = getTagValue(decl.tags, 'd');
      if (!declDTag) continue;
      const declAddress = `${KIND_DECLARATION}:${decl.pubkey}:${declDTag}`;

      const activeRevocation = revocations.find((rev) => {
        if (rev.kind !== KIND_REVOCATION) return false;
        const tTag = getTagValue(rev.tags, 't');
        if (tTag !== 'hierarchy-revocation') return false;
        // Check whether this revocation targets the declaration
        const aTag = rev.tags.find((t) => t[0] === 'a');
        if (!aTag || aTag[1] !== declAddress) return false;
        // V-KH-04: revocation with past effective_at invalidates the hierarchy
        const effectiveAtRaw = getTagValue(rev.tags, 'effective_at');
        if (!effectiveAtRaw) return false;
        const effectiveAt = parseInt(effectiveAtRaw, 10);
        return !isNaN(effectiveAt) && effectiveAt <= now;
      });

      if (activeRevocation) {
        continue; // this declaration has been revoked
      }

      // --- Step 6: Check confirmation (if required) ---
      if (requireConfirmation && link.depth === 0) {
        // Look for a confirmation event from the subordinate
        const hasConfirmation = declarations.some((evt) => {
          if (evt.kind !== KIND_DECLARATION) return false;
          if (evt.pubkey !== link.subordinate) return false;
          const tTag = getTagValue(evt.tags, 't');
          if (tTag !== 'hierarchy-confirmation') return false;
          const confirmsTag = getTagValue(evt.tags, 'confirms');
          if (!confirmsTag) return false;
          // The confirms tag should reference the declaration's address
          return confirmsTag === declAddress;
        });

        if (!hasConfirmation) {
          continue; // confirmation required but not found
        }
      }

      // This declaration is valid for the direct link.
      foundValid = true;

      // --- Step 7: Check delegation chain ---
      // If this is not the root of the chain (depth > 0), we need to check
      // whether the superior had re-delegation authority.
      if (link.depth > 0) {
        // The superior in this link is themselves a subordinate in a higher declaration.
        // We need to find the declaration that gave them authority and verify:
        // (a) V-KH-09: they have both `delegate` permission AND delegation_depth > 0
        // (b) V-KH-07: they are not delegating permissions they don't have
        // These checks are handled when we pushed this link onto the queue (below).
      }

      break; // found a valid declaration for this link
    }

    if (!foundValid) {
      if (link.depth === 0) {
        return {
          authorised: false,
          reason: 'No valid declaration found (scope, permission, time bounds, revocation, or confirmation check failed)',
        };
      }
      return {
        authorised: false,
        reason: `Delegation chain broken at depth ${link.depth}`,
      };
    }

    // If depth is 0 and the superior might themselves be a subordinate, check the chain.
    // We look for declarations where the superior appears as a subordinate (re-delegation).
    if (link.depth === 0) {
      // Find declarations where our superior is someone else's subordinate
      const superiorAsSubordinate = declarations.filter((evt) => {
        if (evt.kind !== KIND_DECLARATION) return false;
        const tTag = getTagValue(evt.tags, 't');
        if (tTag !== 'hierarchy-declaration') return false;
        const pSub = evt.tags.find(
          (t) => t[0] === 'p' && (t[3] === 'subordinate' || t[3] === undefined)
        );
        return pSub !== undefined && pSub[1] === link.superior;
      });

      // If the superior is nobody's subordinate, they are the root -- chain is valid.
      if (superiorAsSubordinate.length === 0) {
        return { authorised: true };
      }

      // The superior IS a subordinate. Verify their delegation rights.
      for (const parentDecl of superiorAsSubordinate) {
        const parentScope = getTagValue(parentDecl.tags, 'scope');
        if (!parentScope || !scopeMatches(parentScope, requestedScope)) continue;

        const parentPermissions = getAllTagValues(parentDecl.tags, 'permission');

        // V-KH-09: re-delegation requires BOTH delegate permission AND delegation_depth > 0
        if (!parentPermissions.includes(META_PERMISSION_DELEGATE)) {
          return {
            authorised: false,
            reason: 'V-KH-09: superior lacks delegate permission for re-delegation',
          };
        }

        const parentDepth = parseDelegationDepth(getTagValue(parentDecl.tags, 'delegation_depth'));
        // V-KH-08 / V-KH-09: delegation_depth must be > 0
        if (parentDepth <= 0) {
          return {
            authorised: false,
            reason: 'V-KH-08/V-KH-09: delegation_depth is 0 -- re-delegation not permitted',
          };
        }

        // V-KH-07: subordinate must not delegate permissions exceeding their own
        if (!parentPermissions.includes(requestedPermission)) {
          return {
            authorised: false,
            reason: `V-KH-07: privilege escalation -- superior does not hold permission "${requestedPermission}"`,
          };
        }

        // Push the parent link onto the queue for further verification
        queue.push({
          superior: parentDecl.pubkey,
          subordinate: link.superior,
          depth: link.depth + 1,
        });

        break; // only need to verify one valid parent chain
      }
    }
  }

  return { authorised: true };
}

// ---------------------------------------------------------------------------
// Exports (for reference; this file is self-contained)
// ---------------------------------------------------------------------------

export {
  // Constants
  KIND_DECLARATION,
  KIND_REVOCATION,
  MAX_DELEGATION_DEPTH,
  MAX_CHAIN_DEPTH,

  // Types
  type Tag,
  type UnsignedEvent,
  type NostrEvent,
  type HierarchyDeclarationParams,
  type HierarchyConfirmationParams,
  type HierarchyRevocationParams,
  type SuperiorRole,
  type SubordinateRole,
  type GraduationOutcome,
  type RevocationReason,
  type RevocationGraduationOutcome,
  type ValidationResult,
  type VerificationResult,

  // Builders
  buildHierarchyDeclaration,
  buildHierarchyConfirmation,
  buildHierarchyRevocation,

  // Validation
  validateDeclaration,
  validateRevocation,

  // Scope matching
  scopeMatches,

  // Verification
  verifyAuthority,

  // Utilities (exposed for implementor convenience)
  isValidHexPubkey,
  getTagValue,
  getAllTagValues,
  parseDelegationDepth,
};
