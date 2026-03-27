#!/usr/bin/env bash
set -euo pipefail

# Tombstone stale NIP events and re-publish corrected attestation.
#
# 1. Tombstone nip-l402-services kind 30817 (replaced by nip-paid-services)
# 2. Tombstone nip-l402-services attestation (kind 31000)
# 3. Tombstone nip-spatial-signals kind 30817 (pulled)
# 4. Tombstone nip-spatial-signals attestation (kind 31000)
# 5. Re-publish nip-paid-services attestation with corrected slug
#
# Usage:
#   NOSTR_SECRET_KEY=nsec1... ./tombstone-and-fix.sh
#   NOSTR_SECRET_KEY=nsec1... ./tombstone-and-fix.sh --dry-run

RELAYS=(
  "wss://relay.damus.io"
  "wss://nos.lol"
  "wss://relay.primal.net"
)

SECRET_KEY_FILE="${NOSTR_SECRET_KEY_FILE:-$HOME/.nostr/secret.key}"

if [[ -z "${NOSTR_SECRET_KEY:-}" ]]; then
  if [[ -f "$SECRET_KEY_FILE" ]]; then
    NOSTR_SECRET_KEY=$(cat "$SECRET_KEY_FILE" | tr -d '[:space:]')
    echo "Using key from ${SECRET_KEY_FILE}"
  else
    echo "Error: No signing key found."
    echo "  Place your nsec in ~/.nostr/secret.key or set NOSTR_SECRET_KEY"
    exit 1
  fi
fi

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

PUBKEY=$(nak key public "$NOSTR_SECRET_KEY" 2>/dev/null)
echo "Publisher: ${PUBKEY}"
echo ""

publish_or_dry() {
  local description="$1"
  shift

  if $DRY_RUN; then
    echo "  [DRY] ${description}"
    echo "        nak event $*"
    return
  fi

  echo -n "  ${description}..."
  if nak event "$@" --sec "$NOSTR_SECRET_KEY" "${RELAYS[@]}" 2>/dev/null; then
    echo " ✓"
  else
    echo " ✗"
  fi
  sleep 5
}

echo "=== Tombstoning stale events ==="
echo ""

# 1. Tombstone nip-l402-services kind 30817 (empty content overwrites the old event)
publish_or_dry "Tombstone nip-l402-services (kind 30817)" \
  -k 30817 -d "nip-l402-services" -c ""

# 2. Tombstone nip-l402-services attestation (kind 31000)
publish_or_dry "Tombstone nip-l402-services attestation (kind 31000)" \
  -k 31000 -d "authorship:nip-l402-services" -c ""

# 3. Tombstone nip-spatial-signals kind 30817
publish_or_dry "Tombstone nip-spatial-signals (kind 30817)" \
  -k 30817 -d "nip-spatial-signals" -c ""

# 4. Tombstone nip-spatial-signals attestation (kind 31000)
publish_or_dry "Tombstone nip-spatial-signals attestation (kind 31000)" \
  -k 31000 -d "authorship:nip-spatial-signals" -c ""

echo ""
echo "=== Re-publishing corrected attestation ==="
echo ""

# 5. Re-publish nip-paid-services attestation with corrected a-tag
A_TAG="30817:${PUBKEY}:nip-paid-services"
publish_or_dry "Attest nip-paid-services (kind 31000)" \
  -k 31000 \
  -d "authorship:nip-paid-services" \
  -t "type=authorship" \
  -t "a=${A_TAG}" \
  -t "summary=Original author of NIP-PAID-SERVICES: Paid API Service Announcements" \
  -c ""

echo ""
echo "Done."
