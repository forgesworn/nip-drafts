# AGENTS.md: NIP Drafts

Nostr protocol extension drafts (NIPs) for service coordination, trust, payments,
dispute resolution, key hierarchy, resource curation, identity, and paid API
discovery, written in [nostr-protocol/nips](https://github.com/nostr-protocol/nips)
format. Each NIP works independently; none requires adoption of a specific
platform or framework. There is no build step: this is a documentation
repository of markdown drafts, reference TypeScript snippets, test vectors and
publishing scripts.

## Repo structure

| Directory | Contents |
|-----------|----------|
| `nips/` | NIP markdown drafts (nostr-protocol/nips format) |
| `lips/` | L402 Improvement Proposals |
| `comments/` | Feedback on other proposals (NIP-105, PR descriptions) |
| `reference/` | Reference TypeScript snippets (e.g. `key-hierarchy.ts`, `resource-curation.ts`) |
| `vectors/` | Known-answer test vectors for select NIPs (`contact-card.json`, `device-credential.json`, `succession.json`) |
| `scripts/` | Publishing tools: `announce.sh`, `publish.sh`, `tombstone-and-fix.sh` |
| `images/` | Mermaid source (`.mmd`) and rendered PNG diagrams |

## Commands

There is no install, build, test, lint or typecheck step. The only generated
artefacts are the diagram PNGs. Diagram conventions:

- Source files: `images/<nip_name>-<n>.mmd`.
- Rendered PNGs: `images/<nip_name>-<n>.png`.
- Config: `images/mermaid-config.json`.
- Inline mermaid blocks in the NIP markdown for GitHub rendering.

Re-render after editing a `.mmd` file:

```bash
npx -y @mermaid-js/mermaid-cli -i images/<name>.mmd -o images/<name>.png \
  -c images/mermaid-config.json -w 2400 -b transparent --scale 2
```

Publishing scripts (`scripts/announce.sh`, `scripts/publish.sh`,
`scripts/tombstone-and-fix.sh`) all require `NOSTR_SECRET_KEY=nsec1...` in the
environment (or `NOSTR_SECRET_KEY_FILE`, or a prompt via `nak --prompt-sec`).
Each supports `--dry-run` to preview without publishing. For NIP-VA authorship
attestations, use the `bray` MCP `publish` command instead of a local script.

## Privacy rules (critical)

These NIPs are PUBLIC. Before committing, verify:

- No personal names or real identities of contributors.
- No private GitHub org or repo references: use `forgesworn/*` for public repos only.
- No internal project names as role names or identifiers: use generic equivalents.
- `forgesworn/*` links are fine; this is the public GitHub org.

## NIP format conventions

Every NIP MUST have:
- `draft` `optional` status header.
- Motivation section explaining the gap.
- "Why not NIP-XX?" subsections pre-empting obvious reuse questions.
- JSON examples with realistic tags for every kind.
- Tag reference table with REQUIRED/OPTIONAL/RECOMMENDED.
- REQ filter examples showing client subscription patterns.
- Validation rules table (V-XX-NN format).
- Security considerations section.
- Dependencies section listing only merged, accepted NIPs.
- Mermaid protocol flow diagram (not ASCII art).
- Test vectors section with minimal valid and invalid examples.

## Kind allocation

Check for collisions before picking kind numbers:
1. Official table: https://github.com/nostr-protocol/nips (README event kinds section).
2. Open PRs: `gh pr list --repo nostr-protocol/nips --state open`.
3. NostrHub community NIPs.

The current allocation is summarised in the README's "Kind Allocation" section;
keep it in sync when a NIP claims or drops a kind.

## Conventions

- British English everywhere.
- NIP-44 encryption (not NIP-04). NIP-40 `expiration` (not `expiry`).
- Amounts in smallest currency unit.

## Verifying a change

- Check every kind number against the README's "Kind Allocation" table and the
  other NIPs in `nips/` for collisions.
- Check that every internal link (to another NIP, to `vectors/`, to `images/`)
  resolves to a file that exists.
- If a diagram source (`.mmd`) changes, re-render its PNG with the command above.
- After adding, renaming or removing a NIP, update the NIP index and kind ranges
  in `llms.txt` and the README, since both drift quickly.
