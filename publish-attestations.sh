#!/usr/bin/env bash
set -euo pipefail

# Publish NIP-VA kind 31000 authorship attestations for each published NIP draft.
# NIP-VA eating its own dog food: each attestation proves authorship of a custom NIP.
#
# Usage:
#   NOSTR_SECRET_KEY=nsec1... ./publish-attestations.sh
#   NOSTR_SECRET_KEY=nsec1... ./publish-attestations.sh --dry-run

RELAYS=(
  "wss://relay.damus.io"
  "wss://nos.lol"
  "wss://relay.primal.net"
)

if [[ -z "${NOSTR_SECRET_KEY:-}" ]]; then
  echo "Error: NOSTR_SECRET_KEY not set."
  echo "  NOSTR_SECRET_KEY=nsec1... ./publish-attestations.sh"
  exit 1
fi

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Get our pubkey from the secret key
PUBKEY=$(nak key public "$NOSTR_SECRET_KEY" 2>/dev/null)
echo "Publisher: ${PUBKEY}"
echo ""

# Published NIP drafts (kind 30817 custom NIPs)
# Only attest NIPs that have been published and reviewed
# Format: slug|display_name
NIPS=(
  # Batch 1 (published 2026-03-24)
  "nip-location|NIP-LOCATION: Privacy-Preserving Location Discovery"
  "nip-credentials|NIP-CREDENTIALS: Credential Verification & Gating"
  "nip-approval|NIP-APPROVAL: Multi-Party Approval Gates"
  "nip-custody|NIP-CUSTODY: Chain-of-Custody Tracking"
  "nip-consensus|NIP-CONSENSUS: Multi-Party Consensus"
  "nip-matching|NIP-MATCHING: Competitive Matching & Selection"
  "nip-evidence|NIP-EVIDENCE: Timestamped Evidence Recording"
  # Batch 2 (reviewed via nostr-nip-review)
  "nip-quote|NIP-QUOTE: Structured Pricing & Payment Terms"
  "nip-escrow|NIP-ESCROW: Conditional Payment Coordination"
  "nip-trust|NIP-TRUST: Portable Trust Networks"
  "nip-disputes|NIP-DISPUTES: Dispute Resolution Protocol"
  "nip-reputation|NIP-REPUTATION: Structured Reputation & Reviews"
  "nip-booking|NIP-BOOKING: Calendar Availability & Booking"
  "nip-variation|NIP-VARIATION: Scope & Price Change Management"
  "nip-channels|NIP-CHANNELS: Context-Scoped Messaging Primitives"
  "nip-provider-profiles|NIP-PROVIDER-PROFILES: Service Provider Profiles"
  "nip-l402-services|NIP-L402-SERVICES: Paid API Service Announcements"
  "nip-invoicing|NIP-INVOICING: Structured Invoicing"
  "nip-provenance|NIP-PROVENANCE: Product & Supply Chain Provenance"
  "nip-crafts|NIP-CRAFTS: Craft Technique Documentation"
  "nip-scarcity|NIP-SCARCITY: Workforce & Resource Scarcity Signals"
  "nip-spatial-signals|NIP-SPATIAL-SIGNALS: Spatial Signals & Corroboration"
  "nip-data-access|NIP-DATA-ACCESS: Scoped, Revocable Data Access Grants"
  "nip-mentorship|NIP-MENTORSHIP: Mentorship Pipelines & Training Progression"
  "nip-sla|NIP-SLA: Service Level Agreements (Composition Guide)"
  "nip-community-governance|NIP-COMMUNITY-GOVERNANCE: Community Governance (Composition Guide)"
  "nip-referral-routing|NIP-REFERRAL-ROUTING: Institutional Referral Routing (Composition Guide)"
  "nip-oracle|NIP-ORACLE: Oracle Dispute Resolution"
)

published=0
failed=0

for entry in "${NIPS[@]}"; do
  IFS='|' read -r slug display_name <<< "$entry"

  # Build the a-tag reference to the kind 30817 custom NIP event
  # Format: <kind>:<pubkey>:<d-tag>
  A_TAG="30817:${PUBKEY}:${slug}"

  if $DRY_RUN; then
    echo "  [DRY] Attest authorship: ${display_name}"
    echo "        d=authorship:${slug}  a=${A_TAG}"
    continue
  fi

  echo -n "  Attesting ${slug}..."

  if nak event \
    -k 31000 \
    -d "authorship:${slug}" \
    -t "type=authorship" \
    -t "a=${A_TAG}" \
    -t "summary=Original author of ${display_name}" \
    -c "" \
    --sec "$NOSTR_SECRET_KEY" \
    "${RELAYS[@]}" 2>/dev/null; then
    echo " ✓"
    ((published++))
  else
    echo " ✗"
    ((failed++))
  fi

  sleep 10
done

echo ""
if $DRY_RUN; then
  echo "Dry run complete. ${#NIPS[@]} attestations would be published."
else
  echo "Done: ${published} attestations published, ${failed} failed"
fi
