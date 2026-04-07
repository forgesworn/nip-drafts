# CLAUDE.md — NIP Drafts

## Repo structure

| Directory | Contents |
|-----------|----------|
| `nips/` | NIP markdown drafts (nostr-protocol/nips format) |
| `lips/` | L402 Improvement Proposals |
| `comments/` | Feedback on other proposals (NIP-105, PR descriptions) |
| `scripts/` | Publishing tools (announce.sh, publish.sh, publish-attestations.sh) |
| `images/` | Mermaid source (.mmd) and rendered PNG diagrams |

## Privacy rules (CRITICAL)

These NIPs are PUBLIC. Before committing, verify:

- **No personal names** or real identities of contributors
- **No private GitHub org or repo references** — use `forgesworn/*` for public repos only
- **No internal project names** as role names or identifiers — use generic equivalents
- **forgesworn/* links are fine** — this is the public GitHub org
- Run the privacy check from `~/.claude/CLAUDE.md` before pushing

## NIP format conventions

Every NIP MUST have:
- `draft` `optional` status header
- Motivation section explaining the gap
- "Why not NIP-XX?" subsections pre-empting obvious reuse questions
- JSON examples with realistic tags for every kind
- Tag reference table with REQUIRED/OPTIONAL/RECOMMENDED
- REQ filter examples showing client subscription patterns
- Validation rules table (V-XX-NN format)
- Security considerations section
- Dependencies section listing only merged, accepted NIPs
- Mermaid protocol flow diagram (not ASCII art)
- Test vectors section with minimal valid and invalid examples

## Diagrams

- Source files: `images/<nip_name>-<n>.mmd`
- Rendered PNGs: `images/<nip_name>-<n>.png`
- Config: `images/mermaid-config.json`
- Inline mermaid blocks in the NIP markdown for GitHub rendering

## Kind allocation

Check for collisions before picking kind numbers:
1. Official table: https://github.com/nostr-protocol/nips (README event kinds section)
2. Open PRs: `gh pr list --repo nostr-protocol/nips --state open`
3. NostrHub community NIPs

## Publishing scripts

All scripts require `NOSTR_SECRET_KEY=nsec1...` env var.

- `scripts/publish.sh` — publish NIP content to relays
- `scripts/announce.sh <topic>` — publish announcement notes (summary, location, etc.)
- `scripts/publish-attestations.sh` — publish NIP-VA authorship attestations
- `scripts/tombstone-and-fix.sh` — tombstone and republish events

Use `--dry-run` flag to preview without publishing.

## Cross-repo

British English everywhere. NIP-44 encryption (not NIP-04). NIP-40 `expiration` (not `expiry`).
Amounts in smallest currency unit. See parent CLAUDE.md for full conventions.
