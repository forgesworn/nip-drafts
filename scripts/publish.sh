#!/usr/bin/env bash
set -euo pipefail

# Publish NIP drafts as kind 30817 custom NIPs on NostrHub via nak.
#
# Usage:
#   ./publish.sh                    # publishes batch 1 (7 ready NIPs)
#   ./publish.sh --batch 2          # publishes batch 2 (needs-consolidation NIPs)
#   ./publish.sh --only nip-escrow  # publishes a single NIP
#   ./publish.sh --dry-run          # prints events without publishing
#   ./publish.sh --list             # lists all NIPs without publishing
#
# Reads NOSTR_SECRET_KEY from environment or prompts via nak --prompt-sec.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NIPS_DIR="$(cd "$SCRIPT_DIR/../nips" && pwd)"
IMAGES_BASE="https://raw.githubusercontent.com/forgesworn/nip-drafts/main/images"

RELAYS=(
  "wss://relay.damus.io"
  "wss://nos.lol"
  "wss://relay.primal.net"
)

# ── NIP definitions ──────────────────────────────────────────────────────────
# Format: slug|title|filename|kinds (comma-separated)|batch

NIPS=(
  # Batch 1 (published 2026-03-24)
  "nip-location|NIP-LOCATION: Privacy-Preserving Location Discovery|NIP-LOCATION.md|20500,20501|1"
  "nip-credentials|NIP-CREDENTIALS: Credential Verification & Gating|NIP-CREDENTIALS.md|30527,30528|1"
  "nip-approval|NIP-APPROVAL: Multi-Party Approval Gates|NIP-APPROVAL.md|30570,30571|1"
  "nip-custody|NIP-CUSTODY: Chain-of-Custody Tracking|NIP-CUSTODY.md|30572|2"
  "nip-consensus|NIP-CONSENSUS: Multi-Party Consensus|NIP-CONSENSUS.md|30574,30575|1"
  "nip-matching|NIP-MATCHING: Competitive Matching & Selection|NIP-MATCHING.md|30576,30577|1"
  "nip-evidence|NIP-EVIDENCE: Timestamped Evidence Recording|NIP-EVIDENCE.md|30578|2"
  # Batch 2 (reviewed via nostr-nip-review, fixes applied)
  "nip-quote|NIP-QUOTE: Structured Pricing & Payment Terms|NIP-QUOTE.md|30530,30531|2"
  "nip-escrow|NIP-ESCROW: Conditional Payment Coordination|NIP-ESCROW.md|30532,30533,30535|2"
  "nip-trust|NIP-TRUST: Portable Trust Networks|NIP-TRUST.md|30515,30517|2"
  "nip-disputes|NIP-DISPUTES: Dispute Resolution Protocol|NIP-DISPUTES.md|7543,30545|2"
  "nip-reputation|NIP-REPUTATION: Structured Reputation & Reviews|NIP-REPUTATION.md|30520|2"
  "nip-booking|NIP-BOOKING: Calendar Availability & Booking|NIP-BOOKING.md|30582,30583,30584|2"
  "nip-variation|NIP-VARIATION: Scope & Price Change Management|NIP-VARIATION.md|30579|2"
  "nip-channels|NIP-CHANNELS: Context-Scoped Messaging Primitives|NIP-CHANNELS.md|20502,30565|2"
  "nip-provider-profiles|NIP-PROVIDER-PROFILES: Service Provider Profiles|NIP-PROVIDER-PROFILES.md|30510,30511|2"
  "nip-paid-services|NIP-PAID-SERVICES: Paid API Service Announcements|NIP-PAID-SERVICES.md|31402|2"
  # Batch 2 continued (reviewed via nostr-nip-review)
  "nip-invoicing|NIP-INVOICING: Structured Invoicing|NIP-INVOICING.md|30588|2"
  "nip-provenance|NIP-PROVENANCE: Product & Supply Chain Provenance|NIP-PROVENANCE.md|30404|2"
  "nip-crafts|NIP-CRAFTS: Craft Technique Documentation|NIP-CRAFTS.md|30401|2"
  "nip-scarcity|NIP-SCARCITY: Workforce & Resource Scarcity Signals|NIP-SCARCITY.md|30599|2"
  # nip-spatial-signals removed — kinds 1315/1316 originated from Roadstr; reach out before publishing
  "nip-data-access|NIP-DATA-ACCESS: Scoped, Revocable Data Access Grants|NIP-DATA-ACCESS.md|30556|2"
  "nip-mentorship|NIP-MENTORSHIP: Mentorship Pipelines & Training Progression|NIP-MENTORSHIP.md||2"
  "nip-sla|NIP-SLA: Service Level Agreements (Composition Guide)|NIP-SLA.md||2"
  "nip-community-governance|NIP-COMMUNITY-GOVERNANCE: Community Governance (Composition Guide)|NIP-COMMUNITY-GOVERNANCE.md||2"
  "nip-referral-routing|NIP-REFERRAL-ROUTING: Institutional Referral Routing (Composition Guide)|NIP-REFERRAL-ROUTING.md||2"
  "nip-oracle|NIP-ORACLE: Oracle Dispute Resolution|NIP-ORACLE.md|30543,30547,30548,30549|2"
  # Batch 3 (identity, trust, access)
  "nip-va|NIP-VA: Verifiable Attestations|NIP-VA.md|31000|3"
  "nip-signet|NIP-SIGNET: Progressive Identity Verification|NIP-SIGNET.md||3"
  "nip-veil|NIP-VEIL: Anonymous Trust Assertions|NIP-VEIL.md||3"
  "nip-dominion|NIP-DOMINION: Epoch-Based Encrypted Content Access|NIP-DOMINION.md|30480|3"
  # Batch 4 (Heartwood / identity derivation)
  "nip-identity-trees|NIP-IDENTITY-TREES: Purpose-Tagged Identity Derivation (nsec-tree)|NIP-IDENTITY-TREES.md||4"
)

# ── Image insertion map ──────────────────────────────────────────────────────
# Format: filename|mermaid_marker|image_key|alt_text
# The marker is the first unique line after ```mermaid that identifies which block

IMAGES=(
  # Batch 1
  "NIP-LOCATION.md|sequenceDiagram|location-1|Progressive Reveal Flow"
  "NIP-CREDENTIALS.md|flowchart TD|credentials-1|Credential Verification Decision Tree"
  "NIP-APPROVAL.md|flowchart TD|approval-1|Approval Gate State Transitions"
  "NIP-CUSTODY.md|sequenceDiagram|custody-1|Custody Chain with NIP-EVIDENCE Composition"
  "NIP-CONSENSUS.md|flowchart TD|consensus-1|Threshold Resolution Logic"
  "NIP-MATCHING.md|sequenceDiagram|matching-1|Competitive Selection Flow"
  "NIP-EVIDENCE.md|sequenceDiagram|evidence-1|Evidence Recording Flow"
  # Batch 2
  "NIP-QUOTE.md|flowchart|quote-1|Trust Model Decision Tree"
  "NIP-ESCROW.md|sequenceDiagram|escrow-1|Escrow Protocol Flow"
  "NIP-TRUST.md|sequenceDiagram|trust-1|Trust Network Flow"
  "NIP-DISPUTES.md|sequenceDiagram|disputes-1|Dispute Lifecycle"
  "NIP-REPUTATION.md|sequenceDiagram|reputation-1|Rating Flow"
  "NIP-BOOKING.md|sequenceDiagram|booking-1|Booking Lifecycle"
  "NIP-VARIATION.md|sequenceDiagram|variation-1|Variation Flow"
  "NIP-CHANNELS.md|sequenceDiagram|channels-1|Messaging Flow"
  "NIP-PROVIDER-PROFILES.md|sequenceDiagram|provider_profiles-1|Provider Discovery Flow"
  # Batch 3
  "NIP-INVOICING.md|sequenceDiagram|invoicing-1|Invoice Lifecycle"
  "NIP-PROVENANCE.md|flowchart|provenance-1|Product Provenance Lifecycle"
  "NIP-CRAFTS.md|sequenceDiagram|crafts-1|Craft Skill and Technique Flow"
  "NIP-PAID-SERVICES.md|sequenceDiagram|paid_services-1|Paid API Discovery and Payment Flow"
  "NIP-SCARCITY.md|flowchart|scarcity-1|Scarcity Signal Lifecycle"
  "NIP-MENTORSHIP.md|sequenceDiagram|mentorship-1|Mentorship Progression"
  "NIP-DATA-ACCESS.md|sequenceDiagram|data_access-1|Data Access Grant Flow"

  "NIP-SLA.md|sequenceDiagram|sla-1|SLA Monitoring Workflow"
  "NIP-COMMUNITY-GOVERNANCE.md|sequenceDiagram|community_governance-1|Governance Workflow"
  "NIP-REFERRAL-ROUTING.md|sequenceDiagram|referral_routing-1|Referral Flow"
  # Batch 3 (identity, trust, access)
  "NIP-SIGNET.md|sequenceDiagram|signet-1|Progressive Verification Flow"
  "NIP-VEIL.md|sequenceDiagram|veil-1|Anonymous Trust Assertion Flow"
  "NIP-DOMINION.md|sequenceDiagram|dominion-1|Epoch-Based Access Flow"
)

# ── CLI parsing ──────────────────────────────────────────────────────────────

BATCH=""
ONLY=""
DRY_RUN=false
LIST=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch) BATCH="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --list) LIST=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Default to batch 1
[[ -z "$BATCH" && -z "$ONLY" ]] && BATCH="1"

# ── List mode ────────────────────────────────────────────────────────────────

if $LIST; then
  echo ""
  echo "NIP drafts:"
  echo ""
  for entry in "${NIPS[@]}"; do
    IFS='|' read -r slug title file kinds batch <<< "$entry"
    printf "  %-24s batch %s  kinds: %s\n" "$slug" "$batch" "$kinds"
  done
  echo ""
  exit 0
fi

# ── Signer setup ─────────────────────────────────────────────────────────────

SECRET_KEY_FILE="${NOSTR_SECRET_KEY_FILE:-$HOME/.nostr/secret.key}"

if [[ -n "${NOSTR_SECRET_KEY:-}" ]]; then
  SEC_FLAG="--sec $NOSTR_SECRET_KEY"
elif [[ -f "$SECRET_KEY_FILE" ]]; then
  SEC_FLAG="--sec $(cat "$SECRET_KEY_FILE" | tr -d '[:space:]')"
  echo "Using key from ${SECRET_KEY_FILE}"
else
  echo "Error: No signing key found."
  echo ""
  echo "Options:"
  echo "  1. Place your nsec in ~/.nostr/secret.key"
  echo "  2. Set NOSTR_SECRET_KEY=nsec1..."
  echo "  3. Set NOSTR_SECRET_KEY_FILE=/path/to/key"
  exit 1
fi

# ── Insert diagram image before first mermaid block ──────────────────────────

insert_images() {
  local filepath="$1"
  local file="$2"
  local tmpout
  tmpout=$(mktemp)
  cp "$filepath" "$tmpout"

  for img_entry in "${IMAGES[@]}"; do
    IFS='|' read -r img_file _marker key alt <<< "$img_entry"
    if [[ "$img_file" == "$file" ]]; then
      local url="${IMAGES_BASE}/${key}.png"
      # Use awk to insert image line before the first ```mermaid block
      awk -v img="![${alt}](${url})" '
        !done && /^```mermaid/ { print ""; print img; print ""; done=1 }
        { print }
      ' "$tmpout" > "${tmpout}.new" && mv "${tmpout}.new" "$tmpout"
    fi
  done

  cat "$tmpout"
  rm -f "$tmpout"
}

# ── Publish ──────────────────────────────────────────────────────────────────

published=0
failed=0

for entry in "${NIPS[@]}"; do
  IFS='|' read -r slug title file kinds batch <<< "$entry"

  # Filter by batch or --only
  if [[ -n "$ONLY" && "$slug" != "$ONLY" ]]; then continue; fi
  if [[ -n "$BATCH" && "$batch" != "$BATCH" ]]; then continue; fi

  filepath="${NIPS_DIR}/${file}"
  if [[ ! -f "$filepath" ]]; then
    echo "  ✗ ${slug}: file not found: ${filepath}"
    ((failed++))
    continue
  fi

  # Read content and insert diagram images
  content=$(insert_images "$filepath" "$file")

  # Write transformed content to temp file for nak's @file syntax
  tmpfile=$(mktemp)
  printf '%s' "$content" > "$tmpfile"

  # Build tag arguments
  tag_args=("-t" "title=${title}")
  if [[ -n "$kinds" ]]; then
    IFS=',' read -ra kind_arr <<< "$kinds"
    for k in "${kind_arr[@]}"; do
      tag_args+=("-t" "k=${k}")
    done
    kind_count=${#kind_arr[@]}
  else
    kind_count=0
    tag_args+=("-t" "k=composition-guide")
  fi

  char_count=${#content}

  if $DRY_RUN; then
    echo "  [DRY] ${slug} (${char_count} chars, ${kind_count} kinds)"
    rm -f "$tmpfile"
    continue
  fi

  echo -n "  Publishing ${slug} (${char_count} chars)..."

  # Publish via nak
  if nak event \
    -k 30817 \
    -d "$slug" \
    "${tag_args[@]}" \
    -c "@${tmpfile}" \
    $SEC_FLAG \
    --nevent \
    "${RELAYS[@]}"; then
    echo " ✓"
    ((published++))
  else
    echo " ✗"
    ((failed++))
  fi

  rm -f "$tmpfile"

  # Delay between publishes to avoid relay rate limits
  sleep 10
done

echo ""
if $DRY_RUN; then
  echo "Dry run complete."
else
  echo "Done: ${published} published, ${failed} failed"
fi
