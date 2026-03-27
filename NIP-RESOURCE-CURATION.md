NIP-RESOURCE-CURATION
=====================

Structured Resource Listings, Reviews & Collections
------------------------------------------------------

`draft` `optional`

Four addressable event kinds for resource curation on Nostr: listings describe resources, reviews evaluate them, collections organise them, and suitability ratings classify their appropriateness for different audiences. Resource reviews compose with NIP-REPUTATION for reviewer credibility; reviewer credentials compose with [NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md).

> **Design principle:** A resource listing is a signed declaration that a resource exists and has certain properties. Reviews, collections, and suitability ratings are separate events that reference listings, enabling multiple independent perspectives on the same resource without requiring the listing author's cooperation or approval.

> **Standalone usability:** This NIP works independently on any Nostr application. Resource listings, reviews, collections, and suitability ratings each function without requiring any other NIP. Composition with NIP-REPUTATION, NIP-VA, and NIP-51 adds credibility signals and organisational features but is not required.

## Motivation

Many applications need decentralised resource directories, yet Nostr has no standard for structured resource metadata beyond simple lists (NIP-51) and classifieds (NIP-99):

- **Learning platforms** - curricula, worksheets, educational videos, interactive apps, and physical venues need structured metadata (age range, subject, media type, cost) for discovery and filtering
- **Skills and training** - curated directories of training providers, tool catalogues, material sources, and certification bodies
- **Community directories** - local service directories, mutual aid resource lists, community asset maps
- **Health and wellbeing** - curated directories of practitioners, therapeutic resources, support groups, and self-help materials
- **Marketplace curation** - product recommendation lists, buyer's guides, comparison reviews
- **Content libraries** - podcast directories, reading lists, video collections with structured metadata and audience suitability

These domains share a common pattern: someone describes a resource with structured metadata, others review it, curators organise resources into collections, and community members rate content suitability for different audiences. NIP-51 lists lack structured metadata. NIP-99 classifieds are designed for selling items, not describing external resources. NIP-RESOURCE-CURATION fills this gap.

## Relationship to Existing NIPs

- **[NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md) (Lists):** NIP-51 provides unstructured sets of references. NIP-RESOURCE-CURATION provides structured metadata per resource (category, age range, cost, media type) and separates listing from curation. A Collection (kind 30413) MAY reference NIP-51 lists for organisational compatibility; a NIP-51 list MAY contain `a` tag references to Resource Listings.
- **[NIP-99](https://github.com/nostr-protocol/nips/blob/master/99.md) (Classifieds):** NIP-99 is for items offered for sale by the listing author. NIP-RESOURCE-CURATION describes external resources that the listing author does not necessarily own or sell. A learning platform curator listing a free YouTube video is not selling anything.
- **[NIP-REPUTATION](./NIP-REPUTATION.md) (kind 30520):** NIP-REPUTATION rates people after transactions. NIP-RESOURCE-CURATION reviews rate resources, not people. However, a reviewer's NIP-REPUTATION score provides a credibility signal for their resource reviews. Clients MAY weight resource reviews by the reviewer's reputation.
- **[NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) (kind 31000):** Reviewer credentials (e.g. "qualified teacher", "certified nutritionist") can be expressed as NIP-VA attestations. Resource Review events MAY reference credential attestations to support reviewer authority claims.
- **[NIP-32](https://github.com/nostr-protocol/nips/blob/master/32.md) (Labelling):** Resource Listings use `L` and `l` tags for category classification, enabling relay-side filtering by domain.
- **[NIP-PAID-SERVICES](./NIP-PAID-SERVICES.md) (kind 31402):** NIP-PAID-SERVICES announces paid APIs. NIP-RESOURCE-CURATION describes resources of any type (free or paid, digital or physical). A paid API announced via NIP-PAID-SERVICES could also be listed as a resource, but the two NIPs serve different purposes.
- **[NIP-EVIDENCE](./NIP-EVIDENCE.md) (kind 30578):** Evidence records MAY back resource reviews (e.g. screenshots of a broken link, photos of a venue's accessibility features).

## Kinds

| kind  | description          |
| ----- | -------------------- |
| 30410 | Resource Listing     |
| 30411 | Resource Review      |
| 30412 | Suitability Rating   |
| 30413 | Resource Collection  |

All kinds are addressable events (NIP-01). Resource Listings and Resource Collections are replaceable (the author MAY update them). Resource Reviews and Suitability Ratings use the append-only pattern with unique `d` tag values per resource per author.

---

## Resource Listing (`kind:30410`)

Published by anyone to describe a resource. A resource is anything that can be referenced by URL or identified by structured metadata: a website, video, book, app, physical venue, document, course, tool, or service.

```json
{
    "kind": 30410,
    "pubkey": "<author-hex-pubkey>",
    "created_at": 1709740800,
    "tags": [
        ["d", "khan_academy_algebra"],
        ["alt", "Resource listing: Khan Academy - Algebra Basics"],
        ["t", "resource-listing"],
        ["title", "Khan Academy - Algebra Basics"],
        ["url", "https://www.khanacademy.org/math/algebra-basics"],
        ["description", "Free interactive algebra course covering equations, inequalities, and graphing. Self-paced with practice exercises and progress tracking."],
        ["media_type", "interactive"],
        ["cost", "free"],
        ["age_range", "11", "16"],
        ["language", "en"],
        ["L", "subject"],
        ["l", "mathematics", "subject"],
        ["l", "algebra", "subject"],
        ["L", "level"],
        ["l", "secondary", "level"]
    ],
    "content": "Khan Academy's algebra course is well-suited for secondary school students who need to build or reinforce foundational algebra skills. The interactive exercises provide immediate feedback, and the mastery-based progression ensures gaps are addressed before moving on. Works well as both a primary resource and a supplement to classroom teaching.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Unique identifier for this resource listing. Implementations SHOULD use a human-readable slug derived from the resource name.
* `t` (REQUIRED): Protocol family marker. MUST be `"resource-listing"`.
* `title` (REQUIRED): Human-readable name of the resource.
* `url` (RECOMMENDED): URL of the resource. REQUIRED for digital resources. Physical resources (venues, tools, books) MAY omit this tag.
* `description` (RECOMMENDED): Brief machine-parseable description of the resource (distinct from the free-text `content` field).
* `media_type` (RECOMMENDED): Type of resource. Core values: `video`, `article`, `interactive`, `app`, `worksheet`, `book`, `course`, `podcast`, `venue`, `tool`, `service`, `document`. Applications MAY define additional values.
* `cost` (RECOMMENDED): Pricing indicator. Values: `free`, `freemium`, `paid`, `subscription`. For paid resources, implementations MAY add a `price` tag with `["price", "<amount>", "<currency>"]`.
* `age_range` (OPTIONAL): `["age_range", "<min>", "<max>"]`. Suggested age range in years. Omit for resources with no age-specific targeting.
* `language` (OPTIONAL): ISO 639-1 language code (e.g. `en`, `fr`, `es`). Multiple `language` tags for multilingual resources.
* `duration` (OPTIONAL): Estimated engagement time in ISO 8601 duration format (e.g. `PT30M` for 30 minutes, `P5D` for 5 days).
* `g` (OPTIONAL): Geohash for location-specific resources (venues, local services).
* `image` (OPTIONAL): URL of a representative image or thumbnail.
* `p` (OPTIONAL): Pubkey of the resource creator or provider, if they have a Nostr identity.
* `L` and `l` (RECOMMENDED): NIP-32 label tags for category classification. Enables relay-side filtering.
* `price` (OPTIONAL): `["price", "<amount>", "<currency>"]`. Specific price when `cost` is `paid` or `subscription`. Amount in smallest currency unit (pence, cents, satoshis).
* `expiration` (OPTIONAL): NIP-40 expiry for time-limited resources (seasonal courses, temporary venues).

**Content:** Free-text editorial notes, context, or recommendations about the resource. This is the curator's perspective, not a structured review (use kind 30411 for that).

### Physical Venue Example

```json
{
    "kind": 30410,
    "pubkey": "<author-hex-pubkey>",
    "created_at": 1709740800,
    "tags": [
        ["d", "science_museum_london"],
        ["alt", "Resource listing: Science Museum, London"],
        ["t", "resource-listing"],
        ["title", "Science Museum, London"],
        ["url", "https://www.sciencemuseum.org.uk"],
        ["description", "Free entry science museum with interactive galleries, IMAX cinema, and regular workshops for children and adults."],
        ["media_type", "venue"],
        ["cost", "free"],
        ["age_range", "5", "99"],
        ["language", "en"],
        ["g", "gcpvj0"],
        ["L", "subject"],
        ["l", "science", "subject"],
        ["l", "technology", "subject"],
        ["L", "level"],
        ["l", "primary", "level"],
        ["l", "secondary", "level"],
        ["l", "adult", "level"]
    ],
    "content": "Excellent for family visits. The Wonderlab gallery (paid, around 10 GBP) is particularly good for primary-age children. The main galleries are free and cover everything from space exploration to computing history. Busy during school holidays; weekday mornings are quieter."
}
```

### REQ Filters

```json
// All resource listings tagged with a specific subject
{"kinds": [30410], "#l": ["mathematics"]}

// All resource listings by a specific curator
{"kinds": [30410], "authors": ["<curator_pubkey>"]}

// All resource listings in a geographic area
{"kinds": [30410], "#g": ["gcpv"]}

// All free resource listings (client-side post-filter on cost tag)
{"kinds": [30410], "#t": ["resource-listing"]}
```

> **Note:** Filters on multi-letter tags (e.g. `#media_type`, `#cost`, `#age_range`) are not supported by relay-side `REQ` filtering. Clients MUST apply these filters locally after fetching events via single-letter tag filters.

---

## Resource Review (`kind:30411`)

Published by anyone to review a specific resource. Reviews provide structured multi-criteria ratings and free-text commentary. Each reviewer publishes one review per resource, enforced by the `d` tag format.

```json
{
    "kind": 30411,
    "pubkey": "<reviewer-hex-pubkey>",
    "created_at": 1709744400,
    "tags": [
        ["d", "khan_academy_algebra:review:<reviewer-hex-pubkey>"],
        ["alt", "Resource review: 4/5 for Khan Academy - Algebra Basics"],
        ["t", "resource-review"],
        ["a", "30410:<listing-author-pubkey>:khan_academy_algebra", "wss://relay.example.com"],
        ["rating", "overall", "4"],
        ["rating", "quality", "5"],
        ["rating", "relevance", "4"],
        ["rating", "accessibility", "3"],
        ["rating", "engagement", "4"],
        ["reviewer_context", "teacher"],
        ["L", "subject"],
        ["l", "mathematics", "subject"]
    ],
    "content": "Strong content that covers the fundamentals well. The exercises are well-designed and the hints system helps struggling students without giving away answers. Accessibility could be better: no offline mode, screen reader support is patchy, and the interface assumes a wide screen. I use this as a homework supplement for my Year 9 class and it works well for that purpose.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<resource_d_tag>:review:<reviewer_pubkey>`. Ensures one review per reviewer per resource via addressable event semantics.
* `t` (REQUIRED): Protocol family marker. MUST be `"resource-review"`.
* `a` (REQUIRED): NIP-01 `a` tag referencing the Resource Listing being reviewed. Format: `30410:<listing-author-pubkey>:<d-tag>`.
* `rating` (REQUIRED, at least one): Multi-value tag: `["rating", "<criterion>", "<value>"]`. The `overall` criterion MUST be present. Values are integers 1-5. Core criteria: `quality` (content accuracy and depth), `relevance` (fitness for stated purpose), `accessibility` (ease of access for diverse learners/users), `engagement` (how well it holds attention). Applications MAY define additional criteria.
* `reviewer_context` (OPTIONAL): The reviewer's relationship to the resource. Values: `teacher`, `student`, `parent`, `professional`, `self_learner`, `curator`. Provides context for interpreting the review.
* `e` (OPTIONAL): References NIP-EVIDENCE events backing the review (screenshots, test results, usage logs).
* `L` and `l` (OPTIONAL): NIP-32 labels for the review's domain context.

**Content:** Free-text review commentary.

### Rating Scale

| Value | Meaning                                    |
| ----- | ------------------------------------------ |
| 1     | Poor - significant problems, not usable    |
| 2     | Below average - notable shortcomings       |
| 3     | Adequate - serviceable with limitations    |
| 4     | Good - recommended with minor caveats      |
| 5     | Excellent - strongly recommended           |

### Review Responses

Review responses use [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md) comments (kind 1111) referencing the Resource Review event:

```json
{
    "kind": 1111,
    "tags": [
        ["K", "30411"],
        ["E", "<review-event-id>", "wss://relay.example.com"],
        ["p", "<reviewer-pubkey>"]
    ],
    "content": "Thanks for the feedback on accessibility. We have added offline mode in the latest update and are working on improved screen reader support."
}
```

### REQ Filters

```json
// All reviews for a specific resource listing
{"kinds": [30411], "#a": ["30410:<listing-author-pubkey>:khan_academy_algebra"]}

// All reviews by a specific reviewer
{"kinds": [30411], "authors": ["<reviewer_pubkey>"]}
```

---

## Suitability Rating (`kind:30412`)

Published by anyone to rate a resource's appropriateness for specific audiences. Suitability ratings are separate from quality reviews because appropriateness is audience-dependent: a resource may be excellent for adults but unsuitable for children, or high-quality for professionals but confusing for beginners.

```json
{
    "kind": 30412,
    "pubkey": "<rater-hex-pubkey>",
    "created_at": 1709748000,
    "tags": [
        ["d", "nature_documentary_series:suitability:<rater-hex-pubkey>"],
        ["alt", "Suitability rating: Nature documentary series, suitable ages 7+"],
        ["t", "suitability-rating"],
        ["a", "30410:<listing-author-pubkey>:nature_documentary_series", "wss://relay.example.com"],
        ["age_rating", "7"],
        ["content_warning", "animal_predation"],
        ["content_warning", "natural_disaster"],
        ["suitability", "primary_education", "suitable"],
        ["suitability", "secondary_education", "suitable"],
        ["suitability", "early_years", "caution"],
        ["rater_context", "teacher"]
    ],
    "content": "Generally suitable for primary-age children and above. Episodes 3 and 7 contain extended predation sequences that may be distressing for younger viewers. Episode 12 covers natural disasters with real footage of flooding. A teacher or parent should preview these episodes before showing them to children under 7.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<resource_d_tag>:suitability:<rater_pubkey>`. Ensures one suitability rating per rater per resource.
* `t` (REQUIRED): Protocol family marker. MUST be `"suitability-rating"`.
* `a` (REQUIRED): NIP-01 `a` tag referencing the Resource Listing being rated.
* `age_rating` (RECOMMENDED): `["age_rating", "<minimum_age>"]`. Minimum recommended age in years. Clients SHOULD display this prominently.
* `content_warning` (OPTIONAL): One tag per content concern. Core values: `violence`, `sexual_content`, `strong_language`, `animal_predation`, `natural_disaster`, `medical_imagery`, `substance_use`, `discrimination`, `religious_content`, `political_content`, `flashing_imagery`. Applications MAY define additional values.
* `suitability` (OPTIONAL): `["suitability", "<context>", "<verdict>"]`. Audience-specific suitability. Context is application-defined (e.g. `primary_education`, `secondary_education`, `early_years`, `professional`, `family`, `workplace`). Verdict values: `suitable`, `caution`, `unsuitable`.
* `rater_context` (OPTIONAL): The rater's role. Values: `teacher`, `parent`, `safeguarding_officer`, `content_moderator`, `professional`, `community_member`.

**Content:** Free-text notes explaining the suitability assessment, including specific concerns and guidance for different audiences.

### Clean Cuts (Skip Lists)

For video, audio, or interactive resources, suitability ratings MAY include skip lists that identify segments to avoid for specific audiences:

```json
{
    "kind": 30412,
    "pubkey": "<rater-hex-pubkey>",
    "created_at": 1709748000,
    "tags": [
        ["d", "history_documentary:suitability:<rater-hex-pubkey>"],
        ["t", "suitability-rating"],
        ["a", "30410:<listing-author-pubkey>:history_documentary", "wss://relay.example.com"],
        ["age_rating", "12"],
        ["content_warning", "violence"],
        ["skip", "PT12M30S", "PT14M15S", "graphic_violence", "Battle scene with realistic injuries"],
        ["skip", "PT45M00S", "PT46M30S", "medical_imagery", "Period surgical procedures"],
        ["suitability", "secondary_education", "suitable_with_skips"]
    ],
    "content": "Suitable for secondary school history classes if the two flagged segments are skipped. The rest of the documentary is well-produced and historically accurate."
}
```

The `skip` tag format is: `["skip", "<start>", "<end>", "<reason>", "<description>"]`. Times use ISO 8601 duration from the start of the resource.

### Aggregating Suitability

Multiple raters MAY publish suitability ratings for the same resource. Clients SHOULD aggregate these using available trust signals:

- **Rater credentials** - a safeguarding officer's rating carries more weight than an anonymous rating
- **Social distance** - ratings from followed or trusted pubkeys are weighted higher
- **Consensus** - when multiple raters agree on an age rating, confidence increases

The protocol does not prescribe an aggregation algorithm; implementations choose their own strategy.

---

## Resource Collection (`kind:30413`)

Published by a curator to organise resources into an ordered set with editorial context. Collections are the curation layer: a teacher assembles a term's resources, a community group builds a local services directory, or a reviewer compiles a "best of" list.

```json
{
    "kind": 30413,
    "pubkey": "<curator-hex-pubkey>",
    "created_at": 1709751600,
    "tags": [
        ["d", "year9_algebra_term1"],
        ["alt", "Resource collection: Year 9 Algebra - Term 1"],
        ["t", "resource-collection"],
        ["title", "Year 9 Algebra - Term 1"],
        ["description", "Curated resources for Year 9 algebra covering linear equations, inequalities, and basic graphing."],
        ["a", "30410:<pubkey-a>:khan_academy_algebra", "wss://relay.example.com", "Core: watch the intro videos and complete exercises 1-12"],
        ["a", "30410:<pubkey-b>:desmos_graphing", "wss://relay.example.com", "Use for graphing exercises in weeks 3-4"],
        ["a", "30410:<pubkey-a>:corbett_maths_algebra", "wss://relay.example.com", "Extension: attempt the 5-a-day challenges"],
        ["a", "30410:<pubkey-c>:science_museum_london", "wss://relay.example.com", "Optional trip: visit the mathematics gallery"],
        ["age_range", "13", "14"],
        ["language", "en"],
        ["L", "subject"],
        ["l", "mathematics", "subject"],
        ["l", "algebra", "subject"],
        ["L", "level"],
        ["l", "secondary", "level"]
    ],
    "content": "This collection covers the first term of Year 9 algebra. Start with the Khan Academy videos for conceptual grounding, then move to Desmos for interactive graphing practice. Corbett Maths provides daily challenge problems for students who want to push further. The Science Museum trip is optional but gives good context for how algebra underpins real engineering.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Unique identifier for this collection.
* `t` (REQUIRED): Protocol family marker. MUST be `"resource-collection"`.
* `title` (REQUIRED): Human-readable name of the collection.
* `a` (REQUIRED, at least one): Ordered list of Resource Listing references. Format: `["a", "30410:<pubkey>:<d-tag>", "<relay-hint>", "<curation-note>"]`. The fourth element is an optional curation note explaining how this resource fits the collection. Order is significant; clients SHOULD preserve it.
* `description` (OPTIONAL): Brief machine-parseable description of the collection.
* `age_range` (OPTIONAL): Target age range for the collection.
* `language` (OPTIONAL): ISO 639-1 language code.
* `image` (OPTIONAL): URL of a collection cover image or thumbnail.
* `L` and `l` (OPTIONAL): NIP-32 labels for classification.
* `expiration` (OPTIONAL): NIP-40 expiry for time-limited collections (term-specific syllabi, seasonal guides).
* `e` (OPTIONAL): References to NIP-51 list events that this collection extends or replaces.

**Content:** Free-text editorial notes, introduction, or usage guidance for the collection.

### Collection Ordering

The order of `a` tags in the event defines the resource order within the collection. Clients MUST preserve this order when displaying resources. Curators update the order by publishing a new version of the event (same `d` tag, higher `created_at`).

### Heritage Training Provider Directory Example

```json
{
    "kind": 30413,
    "pubkey": "<curator-hex-pubkey>",
    "created_at": 1709751600,
    "tags": [
        ["d", "heritage_lime_mortar_providers_southwest"],
        ["alt", "Resource collection: Heritage Lime Mortar Training - South West England"],
        ["t", "resource-collection"],
        ["title", "Heritage Lime Mortar Training - South West England"],
        ["description", "Accredited training providers for traditional lime mortar techniques in the South West."],
        ["a", "30410:<pubkey-d>:wells_cathedral_stonemasons", "wss://relay.example.com", "Two-day hands-on course, HLF-accredited"],
        ["a", "30410:<pubkey-e>:ty_mawr_lime", "wss://relay.example.com", "Online theory + practical weekend, supplies included"],
        ["a", "30410:<pubkey-f>:spab_repair_course", "wss://relay.example.com", "SPAB flagship repair course, conservation philosophy focus"],
        ["g", "gbux"],
        ["L", "domain"],
        ["l", "heritage_conservation", "domain"],
        ["l", "lime_mortar", "domain"]
    ],
    "content": "Three training providers for traditional lime mortar work in the South West. All are accredited or recognised by heritage bodies. Wells offers the most hands-on experience; Ty-Mawr is best if you need the theory first; SPAB is the gold standard for conservation philosophy but books up months in advance."
}
```

### REQ Filters

```json
// All collections by a specific curator
{"kinds": [30413], "authors": ["<curator_pubkey>"]}

// All collections tagged with a specific subject
{"kinds": [30413], "#l": ["mathematics"]}

// All collections in a geographic area
{"kinds": [30413], "#g": ["gbux"]}
```

---

## Protocol Flow

```
  Listing Author          Relay              Reviewer / Rater / Curator
      |                     |                     |
      |-- kind:30410 ------>|  (Resource Listing) |
      |   Listing           |                     |
      |                     |                     |
      |                     |<--- kind:30411 -----|  (Resource Review)
      |                     |     Review          |
      |                     |                     |
      |                     |<--- kind:30412 -----|  (Suitability Rating)
      |                     |     Suitability     |
      |                     |                     |
      |                     |<--- kind:30413 -----|  (Resource Collection)
      |                     |     Collection      |
      |                     |                     |
      |                     |<--- kind:1111 ------|  (NIP-22 Comment on review)
      |                     |     Response        |
      |                     |                     |
```

1. **Listing:** Anyone publishes `kind:30410` to describe a resource with structured metadata.
2. **Reviewing:** Anyone publishes `kind:30411` to rate and review the resource. One review per reviewer per resource.
3. **Suitability:** Anyone publishes `kind:30412` to rate the resource's appropriateness for specific audiences.
4. **Curating:** Anyone publishes `kind:30413` to organise resources into ordered collections with editorial notes.
5. **Discussion:** Participants use NIP-22 comments (kind 1111) to respond to reviews or discuss resources.

## Composing with NIP-VA

Reviewer and rater credentials can be expressed as [NIP-VA](https://github.com/forgesworn/nostr-attestations/blob/main/NIP-VA.md) Verifiable Attestations (kind 31000). A teacher reviewing educational resources might have a `type: credential` attestation confirming their qualified teacher status. Clients MAY display credential badges alongside reviews and weight reviews from credentialed reviewers more heavily.

```json
// NIP-VA credential attestation for a reviewer
{
    "kind": 31000,
    "pubkey": "<attestation-issuer-pubkey>",
    "tags": [
        ["d", "qts_credential:<reviewer-pubkey>"],
        ["type", "credential"],
        ["p", "<reviewer-pubkey>"],
        ["credential_type", "qualified_teacher_status"],
        ["issuer_type", "authority"]
    ],
    "content": "Confirmed Qualified Teacher Status, specialising in secondary mathematics."
}
```

A Resource Review MAY reference the credential:

```json
{
    "kind": 30411,
    "tags": [
        ["d", "khan_academy_algebra:review:<reviewer-hex-pubkey>"],
        ["t", "resource-review"],
        ["a", "30410:<listing-author-pubkey>:khan_academy_algebra", "wss://relay.example.com"],
        ["a", "31000:<issuer-pubkey>:qts_credential:<reviewer-pubkey>", "wss://relay.example.com"],
        ["rating", "overall", "4"],
        ["reviewer_context", "teacher"]
    ],
    "content": "..."
}
```

The second `a` tag references the NIP-VA credential attestation, allowing clients to verify the reviewer's qualifications.

## Composing with NIP-REPUTATION

A reviewer's [NIP-REPUTATION](./NIP-REPUTATION.md) score (kind 30520) provides a general credibility signal. Clients MAY fetch the reviewer's reputation and use it to weight their resource reviews. This is particularly useful for open platforms where anyone can publish reviews: a reviewer with a strong transaction-backed reputation carries more weight than an anonymous first-time reviewer.

## Use Cases

### Learning Platform Resource Directory

A home education co-operative maintains a shared resource directory. Parents and tutors publish Resource Listings for materials they have used. Teachers publish Resource Reviews with structured ratings. A safeguarding lead publishes Suitability Ratings with content warnings and age recommendations. The co-op's curriculum coordinator publishes Collections organised by term and subject.

### Heritage Skills Training Directory

A heritage conservation body curates training providers across the country. Each provider is listed as a Resource Listing with location, cost, and accreditation details. Practitioners who have attended courses publish Resource Reviews. The body publishes Collections by region and specialism, with editorial notes on each provider's strengths.

### Community Health Resource Hub

A local authority publishes Resource Listings for mental health services, support groups, and self-help materials. Community health workers publish Reviews based on client feedback. Suitability Ratings flag resources appropriate for different demographics (young people, veterans, new parents). Collections organise resources by condition and urgency.

## Security Considerations

* **Listing accuracy.** Resource Listings describe external resources. The listing author's claims (cost, age range, content type) are not verified by the protocol. Clients SHOULD cross-reference listings with multiple reviews and suitability ratings before trusting metadata.
* **Review manipulation.** Without completion verification (unlike NIP-REPUTATION), resource reviews are vulnerable to astroturfing. Clients SHOULD weight reviews using social distance (NIP-02 follow graph), reviewer credentials (NIP-VA), and reviewer reputation (NIP-REPUTATION) to mitigate this.
* **Suitability gaming.** Malicious actors could publish false suitability ratings to make inappropriate content appear safe, or safe content appear inappropriate. Clients SHOULD aggregate suitability ratings from multiple trusted sources and display warnings when ratings conflict significantly.
* **Content warnings as censorship.** Overly broad content warnings could suppress legitimate resources. Implementations SHOULD distinguish between community-sourced suitability ratings and authoritative safeguarding assessments, and present both transparently.
* **URL integrity.** Resource URLs may change or be compromised after listing. Clients SHOULD verify URL accessibility and MAY include `file_hash` tags (as in NIP-EVIDENCE) for resources with downloadable content.
* **Collection authority.** Collections are published by individual curators, not by the resources' authors. Clients SHOULD clearly attribute collections to their curators and not imply endorsement by the listed resource providers.
* **Privacy of reviews.** Review content is public by default. For sensitive domains (health resources, support services), implementations MAY encrypt review text using NIP-44 to limit visibility to relevant parties.

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md): Comments (review responses)
* [NIP-32](https://github.com/nostr-protocol/nips/blob/master/32.md): Labelling (category classification)
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps (time-limited resources and collections)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads (sensitive review content)
* [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md): Lists (collection interoperability)

## Reference Implementation

No reference implementation exists yet. A minimal implementation requires:

1. A Nostr client that supports addressable event publishing and NIP-32 label filtering.
2. Resource discovery logic subscribing to `kind:30410` events and filtering by `l` tags, `t` tags, geohash (`g`), or author.
3. Review aggregation logic fetching `kind:30411` events by `a` tag and computing weighted averages.
4. Collection rendering that preserves `a` tag order and displays curation notes.
5. Suitability display logic that aggregates `kind:30412` events and presents age ratings, content warnings, and skip lists.
