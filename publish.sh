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
IMAGES_BASE="https://raw.githubusercontent.com/forgesworn/nip-drafts/main/images"

RELAYS=(
  "wss://relay.damus.io"
  "wss://nos.lol"
  "wss://relay.nostr.band"
)

# ── NIP definitions ──────────────────────────────────────────────────────────
# Format: slug|title|filename|kinds (comma-separated)|batch

NIPS=(
  "nip-location|NIP-LOCATION: Privacy-Preserving Location Discovery|NIP-LOCATION.md|20500,20501|1"
  "nip-credentials|NIP-CREDENTIALS: Credential Verification & Gating|NIP-CREDENTIALS.md|30527,30528|1"
  "nip-approval|NIP-APPROVAL: Multi-Party Approval Gates|NIP-APPROVAL.md|30570,30571|1"
  "nip-custody|NIP-CUSTODY: Chain-of-Custody Tracking|NIP-CUSTODY.md|30572,30573|1"
  "nip-consensus|NIP-CONSENSUS: Multi-Party Consensus|NIP-CONSENSUS.md|30574,30575|1"
  "nip-matching|NIP-MATCHING: Competitive Matching & Selection|NIP-MATCHING.md|30576,30577|1"
  "nip-evidence|NIP-EVIDENCE: Timestamped Evidence Recording|NIP-EVIDENCE.md|30578|1"
  "nip-provider-profiles|NIP-PROVIDER-PROFILES: Service Provider Profiles|NIP-PROVIDER-PROFILES.md|30510,30511,30525,30526|2"
  "nip-trust|NIP-TRUST: Portable Trust Networks|NIP-TRUST.md|30512,30513,30515,30517,30518,30519|2"
  "nip-channels|NIP-CHANNELS: Multi-Party Encrypted Channels|NIP-CHANNELS.md|20502,30564,30565|2"
  "nip-reputation|NIP-REPUTATION: Structured Reputation & Reviews|NIP-REPUTATION.md|30520,30521,31000,30523,30524|2"
  "nip-escrow|NIP-ESCROW: Conditional Payment Coordination|NIP-ESCROW.md|30530,30531,30532,30533,30534,30535,30536,30537|2"
  "nip-disputes|NIP-DISPUTES: Dispute Resolution Protocol|NIP-DISPUTES.md|7543,7544,30545,30546,7547|2"
  "nip-variation|NIP-VARIATION: Scope & Price Change Management|NIP-VARIATION.md|30579,30580,30581|2"
  "nip-booking|NIP-BOOKING: Calendar Availability & Booking|NIP-BOOKING.md|30582,30583,30584,30585,30586,30587|2"
)

# ── Image insertion map ──────────────────────────────────────────────────────
# Format: filename|mermaid_marker|image_key|alt_text
# The marker is the first unique line after ```mermaid that identifies which block

IMAGES=(
  "NIP-LOCATION.md|sequenceDiagram|location-1-progressive-reveal|Progressive Reveal Flow"
  "NIP-CREDENTIALS.md|flowchart TD|credentials-1-verification-decision|Credential Verification Decision Tree"
  "NIP-APPROVAL.md|flowchart TD|approval-1-gate-state|Approval Gate State Transitions"
  "NIP-CUSTODY.md|sequenceDiagram|custody-1-multi-leg-chain|Multi-Leg Custody Chain"
  "NIP-CONSENSUS.md|flowchart TD|consensus-1-threshold-resolution|Threshold Resolution Logic"
  "NIP-MATCHING.md|sequenceDiagram|matching-1-competitive-selection|Competitive Selection Flow"
  "NIP-ESCROW.md|flowchart TD|escrow-1-trust-model-decision|Trust Model Decision Tree"
  "NIP-ESCROW.md|sequenceDiagram|escrow-3-full-flow|Full Payment Flow"
  "NIP-DISPUTES.md|sequenceDiagram|disputes-1-dispute-flow|Dispute Lifecycle"
  "NIP-DISPUTES.md|flowchart TD|disputes-2-state-machine|Dispute State Machine"
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

if [[ -z "${NOSTR_SECRET_KEY:-}" ]]; then
  echo "Error: NOSTR_SECRET_KEY not set."
  echo ""
  echo "Usage:"
  echo "  export NOSTR_SECRET_KEY=nsec1..."
  echo "  ./publish.sh"
  echo ""
  echo "Or inline:"
  echo "  NOSTR_SECRET_KEY=nsec1... ./publish.sh"
  exit 1
fi
SEC_FLAG="--sec $NOSTR_SECRET_KEY"

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

  filepath="${SCRIPT_DIR}/${file}"
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
  IFS=',' read -ra kind_arr <<< "$kinds"
  for k in "${kind_arr[@]}"; do
    tag_args+=("-t" "k=${k}")
  done

  char_count=${#content}

  if $DRY_RUN; then
    echo "  [DRY] ${slug} (${char_count} chars, ${#kind_arr[@]} kinds)"
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

  # Small delay between publishes
  sleep 2
done

echo ""
if $DRY_RUN; then
  echo "Dry run complete."
else
  echo "Done: ${published} published, ${failed} failed"
fi
