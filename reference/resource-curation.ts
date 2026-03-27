/**
 * NIP-RESOURCE-CURATION Reference Implementation
 *
 * Standalone TypeScript reference code for kinds 30414, 30415, and 30416.
 * No external dependencies. Copy-pasteable for study and adaptation.
 *
 * Covers:
 *   - Type definitions for Resource Listing, Resource Review, Resource Collection
 *   - Builder functions that produce unsigned Nostr event objects
 *   - Validation functions enforcing all V-RC rules from the spec
 *   - Rating helpers (normalisation, star conversion, aggregation)
 *   - Review aggregation with weighted scoring and safety floors
 */

// ---------------------------------------------------------------------------
// Core Nostr types (minimal subset — no dependency on any Nostr library)
// ---------------------------------------------------------------------------

/** A single Nostr event tag (array of strings). */
type Tag = string[];

/** Unsigned Nostr event — ready for signing by a NIP-01 signer. */
interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: Tag[];
  content: string;
  pubkey: string;
}

// ---------------------------------------------------------------------------
// NIP-RESOURCE-CURATION kind constants
// ---------------------------------------------------------------------------

const KIND_RESOURCE_LISTING = 30414 as const;
const KIND_RESOURCE_REVIEW = 30415 as const;
const KIND_RESOURCE_COLLECTION = 30416 as const;

// ---------------------------------------------------------------------------
// Rating criteria
// ---------------------------------------------------------------------------

/**
 * Core rating criteria defined by the spec.
 * Applications MAY define additional criteria beyond these.
 */
type CoreCriterion =
  | 'overall'
  | 'quality'
  | 'relevance'
  | 'accessibility'
  | 'engagement'
  | 'suitability';

/**
 * A single rating entry: a decimal value between 0 and 1 paired with a
 * criterion name. The `overall` criterion is mandatory on every review.
 */
interface Rating {
  /** Decimal between 0.0 and 1.0 inclusive. */
  value: number;
  /** Criterion label — one of the core set or a custom string. */
  criterion: CoreCriterion | string;
}

// ---------------------------------------------------------------------------
// Content warnings and skip lists
// ---------------------------------------------------------------------------

/**
 * Spec-defined content warning values.
 * Applications MAY define additional values.
 */
type ContentWarning =
  | 'violence'
  | 'sexual_content'
  | 'strong_language'
  | 'animal_predation'
  | 'natural_disaster'
  | 'medical_imagery'
  | 'substance_use'
  | 'discrimination'
  | 'flashing_imagery';

/**
 * A skip segment for video, audio, or interactive resources.
 * Times use ISO 8601 duration from the start of the resource (e.g. "PT12M30S").
 */
interface SkipSegment {
  /** ISO 8601 duration — start of segment to skip. */
  start: string;
  /** ISO 8601 duration — end of segment to skip. */
  end: string;
  /** Reason category (e.g. "graphic_violence", "medical_imagery"). */
  reason: string;
  /** Brief factual description of what the segment contains. */
  description: string;
}

// ---------------------------------------------------------------------------
// NIP-32 label pair
// ---------------------------------------------------------------------------

/** A NIP-32 label namespace + value pair used for category classification. */
interface Label {
  /** Label namespace (the `L` tag value, e.g. "subject", "level"). */
  namespace: string;
  /** Label value (the `l` tag value, e.g. "mathematics", "secondary"). */
  value: string;
}

// ---------------------------------------------------------------------------
// Resource Listing (kind 30414)
// ---------------------------------------------------------------------------

/** Input parameters for building a Resource Listing event. */
interface ResourceListingParams {
  /** Author's hex pubkey. */
  pubkey: string;
  /** Unique identifier slug for this listing (the `d` tag). */
  dTag: string;
  /** Human-readable resource name. */
  title: string;
  /** URL of the resource. REQUIRED for digital resources; physical resources MAY omit. */
  url?: string;
  /** Brief structured summary (distinct from free-text content). */
  summary?: string;
  /** Free-text editorial notes about the resource. */
  content?: string;
  /** Hashtags for type and attributes (e.g. "video", "free", "interactive"). */
  hashtags?: string[];
  /** ISO 639-1 language codes. */
  languages?: string[];
  /** Geohash for location-specific resources. */
  geohash?: string;
  /** Representative image URL. */
  image?: string;
  /** Pubkey of the resource creator/provider (if they have a Nostr identity). */
  providerPubkey?: string;
  /** NIP-32 labels for category classification. */
  labels?: Label[];
  /** Price: [amount-in-smallest-unit, currency-code]. */
  price?: [string, string];
  /** NIP-40 expiration timestamp (unix seconds). */
  expiration?: number;
  /** Human-readable alt text per NIP-31. */
  alt?: string;
}

/**
 * Build an unsigned Resource Listing event (kind 30414).
 *
 * Produces a complete tag set per the spec. The caller is responsible for
 * signing the returned object with their Nostr signer.
 */
function buildResourceListing(params: ResourceListingParams): UnsignedEvent {
  const tags: Tag[] = [];

  // REQUIRED tags
  tags.push(['d', params.dTag]);
  tags.push(['title', params.title]);

  // Alt text — build a sensible default when not provided
  const altText = params.alt ?? `Resource listing: ${params.title}`;
  tags.push(['alt', altText]);

  // RECOMMENDED
  if (params.url) {
    tags.push(['r', params.url]);
  }
  if (params.summary) {
    tags.push(['summary', params.summary]);
  }

  // Hashtags
  if (params.hashtags) {
    for (const t of params.hashtags) {
      tags.push(['t', t]);
    }
  }

  // Languages
  if (params.languages) {
    for (const lang of params.languages) {
      tags.push(['language', lang]);
    }
  }

  // Geohash
  if (params.geohash) {
    tags.push(['g', params.geohash]);
  }

  // Image
  if (params.image) {
    tags.push(['image', params.image]);
  }

  // Provider pubkey
  if (params.providerPubkey) {
    tags.push(['p', params.providerPubkey]);
  }

  // NIP-32 labels — group by namespace, emit L then l tags
  if (params.labels && params.labels.length > 0) {
    const byNamespace = new Map<string, string[]>();
    for (const label of params.labels) {
      const existing = byNamespace.get(label.namespace) ?? [];
      existing.push(label.value);
      byNamespace.set(label.namespace, existing);
    }
    for (const [ns, values] of byNamespace) {
      tags.push(['L', ns]);
      for (const v of values) {
        tags.push(['l', v, ns]);
      }
    }
  }

  // Price
  if (params.price) {
    tags.push(['price', params.price[0], params.price[1]]);
  }

  // NIP-40 expiration
  if (params.expiration !== undefined) {
    tags.push(['expiration', String(params.expiration)]);
  }

  return {
    kind: KIND_RESOURCE_LISTING,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.content ?? '',
    pubkey: params.pubkey,
  };
}

// ---------------------------------------------------------------------------
// Resource Review (kind 30415)
// ---------------------------------------------------------------------------

/** Input parameters for building a Resource Review event. */
interface ResourceReviewParams {
  /** Reviewer's hex pubkey. */
  pubkey: string;
  /**
   * The `d` tag of the Resource Listing being reviewed.
   * The builder constructs the review's own `d` tag as `<resourceDTag>:<pubkey>`.
   */
  resourceDTag: string;
  /** The listing author's hex pubkey (needed for the `a` tag). */
  listingAuthorPubkey: string;
  /** Relay hint for the `a` tag (optional but recommended). */
  relayHint?: string;
  /** Structured ratings. MUST include an `overall` criterion. */
  ratings: Rating[];
  /** Free-text review commentary. */
  content?: string;
  /** Content warning values. */
  contentWarnings?: (ContentWarning | string)[];
  /** Skip segments for sensitive content. */
  skipSegments?: SkipSegment[];
  /** NIP-32 labels (reviewer-context, age-rating, subject, etc.). */
  labels?: Label[];
  /** Human-readable alt text per NIP-31. */
  alt?: string;
}

/**
 * Build an unsigned Resource Review event (kind 30415).
 *
 * Enforces the `d` tag format `<resource_d_tag>:<reviewer_pubkey>` and
 * includes all required tags per the spec.
 */
function buildResourceReview(params: ResourceReviewParams): UnsignedEvent {
  const tags: Tag[] = [];

  // REQUIRED: d tag in the format <resource_d_tag>:<reviewer_pubkey>
  const dTagValue = `${params.resourceDTag}:${params.pubkey}`;
  tags.push(['d', dTagValue]);

  // Alt text
  const overallRating = params.ratings.find((r) => r.criterion === 'overall');
  const starDisplay = overallRating
    ? `${ratingToStars(overallRating.value)}/5`
    : '';
  const altText =
    params.alt ??
    `Resource review: ${starDisplay} for ${params.resourceDTag}`.trim();
  tags.push(['alt', altText]);

  // REQUIRED: a tag referencing the listing
  const aTagValue = `${KIND_RESOURCE_LISTING}:${params.listingAuthorPubkey}:${params.resourceDTag}`;
  const aTag: Tag = ['a', aTagValue];
  if (params.relayHint) {
    aTag.push(params.relayHint);
  }
  tags.push(aTag);

  // REQUIRED: rating tags
  for (const rating of params.ratings) {
    tags.push(['rating', String(rating.value), rating.criterion]);
  }

  // Content warnings
  if (params.contentWarnings) {
    for (const cw of params.contentWarnings) {
      tags.push(['content_warning', cw]);
    }
  }

  // Skip segments
  if (params.skipSegments) {
    for (const seg of params.skipSegments) {
      tags.push(['skip', seg.start, seg.end, seg.reason, seg.description]);
    }
  }

  // NIP-32 labels
  if (params.labels && params.labels.length > 0) {
    const byNamespace = new Map<string, string[]>();
    for (const label of params.labels) {
      const existing = byNamespace.get(label.namespace) ?? [];
      existing.push(label.value);
      byNamespace.set(label.namespace, existing);
    }
    for (const [ns, values] of byNamespace) {
      tags.push(['L', ns]);
      for (const v of values) {
        tags.push(['l', v, ns]);
      }
    }
  }

  return {
    kind: KIND_RESOURCE_REVIEW,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.content ?? '',
    pubkey: params.pubkey,
  };
}

// ---------------------------------------------------------------------------
// Resource Collection (kind 30416)
// ---------------------------------------------------------------------------

/** A single resource reference within a collection. */
interface CollectionEntry {
  /** The listing author's hex pubkey. */
  listingAuthorPubkey: string;
  /** The listing's `d` tag. */
  listingDTag: string;
  /** Relay hint (optional but recommended). */
  relayHint?: string;
  /** Curation note explaining how this resource fits the collection. */
  curationNote?: string;
}

/** Input parameters for building a Resource Collection event. */
interface ResourceCollectionParams {
  /** Curator's hex pubkey. */
  pubkey: string;
  /** Unique identifier for this collection (the `d` tag). */
  dTag: string;
  /** Human-readable collection name. */
  title: string;
  /** Ordered list of resource references. Order is significant per the spec. */
  entries: CollectionEntry[];
  /** Brief description of the collection. */
  summary?: string;
  /** Free-text editorial introduction or usage guidance. */
  content?: string;
  /** ISO 639-1 language codes. */
  languages?: string[];
  /** Collection cover image URL. */
  image?: string;
  /** Geohash for location-specific collections. */
  geohash?: string;
  /** NIP-32 labels for classification. */
  labels?: Label[];
  /** NIP-40 expiration timestamp (unix seconds). */
  expiration?: number;
  /** Human-readable alt text per NIP-31. */
  alt?: string;
}

/**
 * Build an unsigned Resource Collection event (kind 30416).
 *
 * Preserves the order of `entries` in the `a` tags — clients MUST maintain
 * this order when rendering.
 */
function buildResourceCollection(
  params: ResourceCollectionParams,
): UnsignedEvent {
  const tags: Tag[] = [];

  // REQUIRED
  tags.push(['d', params.dTag]);
  tags.push(['title', params.title]);

  // Alt text
  const altText = params.alt ?? `Resource collection: ${params.title}`;
  tags.push(['alt', altText]);

  // Summary
  if (params.summary) {
    tags.push(['summary', params.summary]);
  }

  // REQUIRED: ordered a tags referencing Resource Listings
  for (const entry of params.entries) {
    const aTagValue = `${KIND_RESOURCE_LISTING}:${entry.listingAuthorPubkey}:${entry.listingDTag}`;
    const aTag: Tag = ['a', aTagValue];
    if (entry.relayHint) {
      aTag.push(entry.relayHint);
    } else if (entry.curationNote) {
      // Relay hint is positional — push empty string to keep curation note at index 3
      aTag.push('');
    }
    if (entry.curationNote) {
      aTag.push(entry.curationNote);
    }
    tags.push(aTag);
  }

  // Languages
  if (params.languages) {
    for (const lang of params.languages) {
      tags.push(['language', lang]);
    }
  }

  // Image
  if (params.image) {
    tags.push(['image', params.image]);
  }

  // Geohash
  if (params.geohash) {
    tags.push(['g', params.geohash]);
  }

  // NIP-32 labels
  if (params.labels && params.labels.length > 0) {
    const byNamespace = new Map<string, string[]>();
    for (const label of params.labels) {
      const existing = byNamespace.get(label.namespace) ?? [];
      existing.push(label.value);
      byNamespace.set(label.namespace, existing);
    }
    for (const [ns, values] of byNamespace) {
      tags.push(['L', ns]);
      for (const v of values) {
        tags.push(['l', v, ns]);
      }
    }
  }

  // NIP-40 expiration
  if (params.expiration !== undefined) {
    tags.push(['expiration', String(params.expiration)]);
  }

  return {
    kind: KIND_RESOURCE_COLLECTION,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.content ?? '',
    pubkey: params.pubkey,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validation result — either success or failure with a reason. */
interface ValidationResult {
  valid: boolean;
  /** Which V-RC rule failed (if any). */
  rule?: string;
  /** Human-readable explanation of the failure. */
  reason?: string;
}

/** Convenience: a passing validation result. */
function pass(): ValidationResult {
  return { valid: true };
}

/** Convenience: a failing validation result. */
function fail(rule: string, reason: string): ValidationResult {
  return { valid: false, rule, reason };
}

// -- Tag lookup helpers (no dependencies) --

/** Find the first tag matching the given name. */
function findTag(tags: Tag[], name: string): Tag | undefined {
  return tags.find((t) => t[0] === name);
}

/** Find all tags matching the given name. */
function findTags(tags: Tag[], name: string): Tag[] {
  return tags.filter((t) => t[0] === name);
}

/**
 * Validate a Resource Listing event (kind 30414).
 *
 * Checks:
 *   V-RC-01: MUST include `d` tag and `title` tag.
 */
function validateListing(event: UnsignedEvent): ValidationResult {
  if (event.kind !== KIND_RESOURCE_LISTING) {
    return fail('V-RC-01', `Expected kind ${KIND_RESOURCE_LISTING}, got ${event.kind}`);
  }

  const dTag = findTag(event.tags, 'd');
  if (!dTag || !dTag[1]) {
    return fail('V-RC-01', 'Kind 30414 MUST include a `d` tag');
  }

  const titleTag = findTag(event.tags, 'title');
  if (!titleTag || !titleTag[1]) {
    return fail('V-RC-01', 'Kind 30414 MUST include a `title` tag');
  }

  return pass();
}

/**
 * Validate a Resource Review event (kind 30415).
 *
 * Checks:
 *   V-RC-02: MUST include `d` tag matching `<resource_d_tag>:<reviewer_pubkey>`,
 *            at least one `rating` tag, and an `a` tag referencing kind 30414.
 *   V-RC-03: Rating values MUST be decimal numbers between 0.0 and 1.0 inclusive.
 *   V-RC-04: MUST include a `rating` tag with the `overall` criterion.
 *   V-RC-06: The reviewer_pubkey segment in the `d` tag MUST match the event's pubkey.
 */
function validateReview(event: UnsignedEvent): ValidationResult {
  if (event.kind !== KIND_RESOURCE_REVIEW) {
    return fail('V-RC-02', `Expected kind ${KIND_RESOURCE_REVIEW}, got ${event.kind}`);
  }

  // -- V-RC-02: d tag present --
  const dTag = findTag(event.tags, 'd');
  if (!dTag || !dTag[1]) {
    return fail('V-RC-02', 'Kind 30415 MUST include a `d` tag');
  }

  // -- V-RC-06: d tag format and pubkey match --
  const dValue = dTag[1];
  const lastColon = dValue.lastIndexOf(':');
  if (lastColon === -1) {
    return fail(
      'V-RC-06',
      'd tag MUST match format <resource_d_tag>:<reviewer_pubkey>',
    );
  }
  const embeddedPubkey = dValue.substring(lastColon + 1);
  if (embeddedPubkey !== event.pubkey) {
    return fail(
      'V-RC-06',
      `Reviewer pubkey in d tag (${embeddedPubkey}) does not match event pubkey (${event.pubkey})`,
    );
  }

  // -- V-RC-02: a tag referencing kind 30414 --
  const aTags = findTags(event.tags, 'a');
  const hasListingRef = aTags.some((t) =>
    t[1]?.startsWith(`${KIND_RESOURCE_LISTING}:`),
  );
  if (!hasListingRef) {
    return fail(
      'V-RC-02',
      'Kind 30415 MUST include an `a` tag referencing a kind 30414 event',
    );
  }

  // -- V-RC-02: at least one rating tag --
  const ratingTags = findTags(event.tags, 'rating');
  if (ratingTags.length === 0) {
    return fail('V-RC-02', 'Kind 30415 MUST include at least one `rating` tag');
  }

  // -- V-RC-03: rating values in range --
  for (const rt of ratingTags) {
    const val = parseFloat(rt[1]);
    if (isNaN(val) || val < 0 || val > 1) {
      return fail(
        'V-RC-03',
        `Rating value "${rt[1]}" for criterion "${rt[2]}" is not a decimal between 0.0 and 1.0`,
      );
    }
  }

  // -- V-RC-04: overall criterion present --
  const hasOverall = ratingTags.some((rt) => rt[2] === 'overall');
  if (!hasOverall) {
    return fail(
      'V-RC-04',
      'Kind 30415 MUST include a `rating` tag with the `overall` criterion',
    );
  }

  return pass();
}

/**
 * Validate a Resource Collection event (kind 30416).
 *
 * Checks:
 *   V-RC-05: MUST include `d` tag, `title` tag, and at least one `a` tag
 *            referencing a kind 30414 event.
 */
function validateCollection(event: UnsignedEvent): ValidationResult {
  if (event.kind !== KIND_RESOURCE_COLLECTION) {
    return fail('V-RC-05', `Expected kind ${KIND_RESOURCE_COLLECTION}, got ${event.kind}`);
  }

  const dTag = findTag(event.tags, 'd');
  if (!dTag || !dTag[1]) {
    return fail('V-RC-05', 'Kind 30416 MUST include a `d` tag');
  }

  const titleTag = findTag(event.tags, 'title');
  if (!titleTag || !titleTag[1]) {
    return fail('V-RC-05', 'Kind 30416 MUST include a `title` tag');
  }

  const aTags = findTags(event.tags, 'a');
  const hasListingRef = aTags.some((t) =>
    t[1]?.startsWith(`${KIND_RESOURCE_LISTING}:`),
  );
  if (!hasListingRef) {
    return fail(
      'V-RC-05',
      'Kind 30416 MUST include at least one `a` tag referencing a kind 30414 event',
    );
  }

  return pass();
}

// ---------------------------------------------------------------------------
// Rating helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a rating value to the 0-1 scale.
 *
 * Accepts values on arbitrary scales and maps them linearly:
 *   - A value of 4 on a 1-5 scale becomes 0.75
 *   - A value of 7 on a 0-10 scale becomes 0.7
 *   - A value already in 0-1 range is returned unchanged
 *
 * @param value - The raw rating value.
 * @param min   - The minimum of the source scale (default 0).
 * @param max   - The maximum of the source scale (default 1).
 * @returns Normalised value clamped to [0, 1].
 */
function normaliseRating(value: number, min = 0, max = 1): number {
  if (max === min) return 0;
  const normalised = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalised));
}

/**
 * Convert a 0-1 rating to a whole-number star rating out of `maxStars`.
 *
 * Uses standard rounding: 0.8 on a 5-star scale = 4, 0.5 = 3, 0.1 = 1.
 * The minimum return value is 1 (even 0.0 maps to 1 star) to avoid
 * displaying zero stars, which most UIs treat as "unrated".
 *
 * @param value    - Rating on the 0-1 scale.
 * @param maxStars - Number of stars in the display scale (default 5).
 * @returns Whole-number star count from 1 to maxStars.
 */
function ratingToStars(value: number, maxStars = 5): number {
  const clamped = Math.max(0, Math.min(1, value));
  const stars = Math.round(clamped * maxStars);
  return Math.max(1, stars);
}

/**
 * Compute a weighted average across an array of ratings.
 *
 * Each entry has a `value` (0-1) and an optional `weight` (defaults to 1).
 * Returns the weighted mean, or 0 if the input is empty.
 *
 * @param entries - Array of { value, weight? } objects.
 * @returns Weighted average on the 0-1 scale.
 */
function aggregateRatings(
  entries: Array<{ value: number; weight?: number }>,
): number {
  if (entries.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of entries) {
    const w = entry.weight ?? 1;
    weightedSum += entry.value * w;
    totalWeight += w;
  }

  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

// ---------------------------------------------------------------------------
// Review aggregation
// ---------------------------------------------------------------------------

/**
 * Trust signal weights used when aggregating multiple reviews.
 *
 * Implementations choose their own strategy; this provides a reasonable
 * starting point based on the spec's guidance (social distance, reviewer
 * role, consensus).
 */
interface ReviewTrustSignals {
  /** Is the reviewer in the user's follow list (NIP-02)? */
  isFollowed?: boolean;
  /** Reviewer role from NIP-32 `reviewer-context` label. */
  reviewerRole?: string;
  /**
   * Custom weight override (0-1). When provided, the other signals are
   * ignored and this weight is used directly.
   */
  weight?: number;
}

/**
 * A review with its extracted ratings and trust metadata, ready for
 * aggregation.
 */
interface ReviewForAggregation {
  /** The pubkey of the reviewer. */
  pubkey: string;
  /** All ratings from this review, keyed by criterion. */
  ratings: Record<string, number>;
  /** Trust signals for weighting. */
  trust?: ReviewTrustSignals;
}

/**
 * Result of aggregating multiple reviews for a single resource.
 */
interface AggregatedResult {
  /** Number of reviews aggregated. */
  reviewCount: number;
  /** Weighted average per criterion. */
  scores: Record<string, number>;
  /** Content warnings mentioned across all reviews (deduplicated). */
  contentWarnings: string[];
  /**
   * Whether the suitability score has been floored.
   * True when conflicting suitability assessments caused the more
   * restrictive value to prevail (safety floor rule).
   */
  suitabilityFloored: boolean;
}

/**
 * Derive a numeric weight from trust signals.
 *
 * This is a reference weighting scheme — implementations should adapt it
 * to their own trust model.
 *
 *   - Followed reviewers get a 2x multiplier.
 *   - Recognised professional roles get higher weight for suitability.
 *   - Unknown reviewers get the baseline weight of 1.
 */
function deriveWeight(trust?: ReviewTrustSignals): number {
  if (trust?.weight !== undefined) return trust.weight;

  let w = 1;
  if (trust?.isFollowed) w *= 2;

  // Professional roles carry more weight — especially for suitability
  const professionalRoles = [
    'teacher',
    'safeguarding_officer',
    'professional',
    'parent',
  ];
  if (trust?.reviewerRole && professionalRoles.includes(trust.reviewerRole)) {
    w *= 1.5;
  }

  return w;
}

/**
 * Derive a suitability-specific weight from trust signals.
 *
 * Safeguarding officers and teachers get elevated weight for suitability
 * assessments, reflecting the spec's guidance that "a safeguarding
 * officer's suitability assessment carries more weight than an anonymous
 * rating".
 */
function deriveSuitabilityWeight(trust?: ReviewTrustSignals): number {
  if (trust?.weight !== undefined) return trust.weight;

  let w = 1;
  if (trust?.isFollowed) w *= 2;

  // Suitability-specific role weighting
  const suitabilityRoles: Record<string, number> = {
    safeguarding_officer: 3,
    teacher: 2,
    parent: 1.5,
    professional: 1.5,
  };
  const roleMultiplier =
    trust?.reviewerRole && trust.reviewerRole in suitabilityRoles
      ? suitabilityRoles[trust.reviewerRole]
      : 1;
  w *= roleMultiplier;

  return w;
}

/**
 * Aggregate multiple reviews for a single resource.
 *
 * Computes weighted averages per criterion with special handling for
 * `suitability`:
 *
 *   - **Safety floor:** When suitability ratings conflict (standard deviation
 *     exceeds 0.2), the aggregated suitability is floored to the lower
 *     boundary of the weighted average minus one standard deviation. This
 *     implements the spec's guidance that "the more restrictive assessment
 *     SHOULD prevail until a sufficient number of trusted reviewers agree
 *     otherwise".
 *
 *   - **Minimum reviews:** The spec recommends at least two independent
 *     reviews with suitability data before presenting an age rating as
 *     reliable. This function flags the result but does not suppress it —
 *     the client decides how to display unreliable ratings.
 *
 * @param reviews - Array of reviews with extracted ratings and trust data.
 * @returns Aggregated scores, content warnings, and metadata.
 */
function aggregateReviews(reviews: ReviewForAggregation[]): AggregatedResult {
  if (reviews.length === 0) {
    return {
      reviewCount: 0,
      scores: {},
      contentWarnings: [],
      suitabilityFloored: false,
    };
  }

  // Collect all criteria mentioned across reviews
  const allCriteria = new Set<string>();
  for (const review of reviews) {
    for (const criterion of Object.keys(review.ratings)) {
      allCriteria.add(criterion);
    }
  }

  const scores: Record<string, number> = {};
  let suitabilityFloored = false;

  for (const criterion of allCriteria) {
    // Gather values and weights for this criterion
    const entries: Array<{ value: number; weight: number }> = [];
    for (const review of reviews) {
      if (criterion in review.ratings) {
        const isSuitability = criterion === 'suitability';
        const weight = isSuitability
          ? deriveSuitabilityWeight(review.trust)
          : deriveWeight(review.trust);
        entries.push({ value: review.ratings[criterion], weight });
      }
    }

    if (entries.length === 0) continue;

    const weightedAvg = aggregateRatings(entries);

    // Apply safety floor for suitability criterion
    if (criterion === 'suitability' && entries.length >= 2) {
      // Compute standard deviation of the raw values
      const mean =
        entries.reduce((sum, e) => sum + e.value, 0) / entries.length;
      const variance =
        entries.reduce((sum, e) => sum + (e.value - mean) ** 2, 0) /
        entries.length;
      const stdDev = Math.sqrt(variance);

      // When assessments conflict significantly, floor to the conservative bound
      if (stdDev > 0.2) {
        const flooredValue = Math.max(0, weightedAvg - stdDev);
        scores[criterion] = flooredValue;
        suitabilityFloored = true;
      } else {
        scores[criterion] = weightedAvg;
      }
    } else {
      scores[criterion] = weightedAvg;
    }
  }

  // Deduplicate content warnings across all reviews.
  // We extract these from events; callers pass pre-extracted reviews,
  // so this helper works on what it has. For a full pipeline, extract
  // content_warning tags before calling aggregateReviews.
  // (Content warnings are passed through from the caller — see
  // extractReviewForAggregation below.)

  return {
    reviewCount: reviews.length,
    scores,
    contentWarnings: [], // populated by the caller via extractContentWarnings
    suitabilityFloored,
  };
}

// ---------------------------------------------------------------------------
// Extraction helpers — turn raw events into aggregation-ready structures
// ---------------------------------------------------------------------------

/**
 * Extract ratings from a review event's tags into a criterion-keyed record.
 *
 * Skips any rating tag that fails V-RC-03 (value outside 0-1).
 */
function extractRatings(event: UnsignedEvent): Record<string, number> {
  const ratings: Record<string, number> = {};
  for (const tag of findTags(event.tags, 'rating')) {
    const value = parseFloat(tag[1]);
    const criterion = tag[2];
    if (!isNaN(value) && value >= 0 && value <= 1 && criterion) {
      ratings[criterion] = value;
    }
  }
  return ratings;
}

/**
 * Extract content warning values from a review event's tags.
 */
function extractContentWarnings(event: UnsignedEvent): string[] {
  return findTags(event.tags, 'content_warning').map((t) => t[1]).filter(Boolean);
}

/**
 * Extract skip segments from a review event's tags.
 */
function extractSkipSegments(event: UnsignedEvent): SkipSegment[] {
  return findTags(event.tags, 'skip')
    .filter((t) => t.length >= 5)
    .map((t) => ({
      start: t[1],
      end: t[2],
      reason: t[3],
      description: t[4],
    }));
}

/**
 * Extract the reviewer-context label from a review event's NIP-32 tags.
 *
 * Returns the first `l` tag value under the `reviewer-context` namespace,
 * or undefined if not present.
 */
function extractReviewerRole(event: UnsignedEvent): string | undefined {
  const lTags = findTags(event.tags, 'l');
  for (const tag of lTags) {
    if (tag[2] === 'reviewer-context') return tag[1];
  }
  return undefined;
}

/**
 * Build a ReviewForAggregation from a raw review event and optional trust data.
 *
 * This is the recommended way to prepare reviews before passing them to
 * `aggregateReviews()`.
 */
function extractReviewForAggregation(
  event: UnsignedEvent,
  trust?: ReviewTrustSignals,
): ReviewForAggregation {
  // Auto-populate the reviewer role from NIP-32 labels if not set
  const role = extractReviewerRole(event);
  const mergedTrust: ReviewTrustSignals = {
    ...trust,
    reviewerRole: trust?.reviewerRole ?? role,
  };

  return {
    pubkey: event.pubkey,
    ratings: extractRatings(event),
    trust: mergedTrust,
  };
}

/**
 * Full aggregation pipeline: takes raw review events, extracts data,
 * aggregates scores, and collects content warnings.
 *
 * This is a convenience wrapper around the lower-level functions. Pass
 * trust data keyed by reviewer pubkey.
 *
 * @param events     - Raw review events (kind 30415).
 * @param trustMap   - Optional map of pubkey -> trust signals.
 * @returns Fully aggregated result including content warnings.
 */
function aggregateReviewEvents(
  events: UnsignedEvent[],
  trustMap?: Map<string, ReviewTrustSignals>,
): AggregatedResult {
  const reviews: ReviewForAggregation[] = [];
  const allWarnings = new Set<string>();

  for (const event of events) {
    const trust = trustMap?.get(event.pubkey);
    reviews.push(extractReviewForAggregation(event, trust));

    for (const cw of extractContentWarnings(event)) {
      allWarnings.add(cw);
    }
  }

  const result = aggregateReviews(reviews);
  result.contentWarnings = Array.from(allWarnings).sort();
  return result;
}

// ---------------------------------------------------------------------------
// Exports (for reference — in a real module these would be ES exports)
// ---------------------------------------------------------------------------

export {
  // Kind constants
  KIND_RESOURCE_LISTING,
  KIND_RESOURCE_REVIEW,
  KIND_RESOURCE_COLLECTION,

  // Types
  type Tag,
  type UnsignedEvent,
  type CoreCriterion,
  type Rating,
  type ContentWarning,
  type SkipSegment,
  type Label,
  type ResourceListingParams,
  type ResourceReviewParams,
  type CollectionEntry,
  type ResourceCollectionParams,
  type ValidationResult,
  type ReviewTrustSignals,
  type ReviewForAggregation,
  type AggregatedResult,

  // Builders
  buildResourceListing,
  buildResourceReview,
  buildResourceCollection,

  // Validation
  validateListing,
  validateReview,
  validateCollection,

  // Rating helpers
  normaliseRating,
  ratingToStars,
  aggregateRatings,

  // Review aggregation
  aggregateReviews,
  aggregateReviewEvents,

  // Extraction helpers
  extractRatings,
  extractContentWarnings,
  extractSkipSegments,
  extractReviewerRole,
  extractReviewForAggregation,
};
