# Changesets

Every user-facing change ships with a changeset file in this directory:

```bash
pnpm changeset            # interactive: pick bump type, write the summary
```

The file is a Markdown snippet with YAML front matter naming the package and the bump
(`patch` | `minor` | `major`). `pnpm version-packages` (run by the release workflow) folds all
pending changesets into `CHANGELOG.md`, bumps `package.json` and deletes the files.

Pre-releases: `.changeset/pre.json` keeps the package in `alpha` mode (`1.0.0-alpha.N`).
Leave it with `pnpm changeset pre exit` before the `1.0.0` release.

Full process: `.agent/skills/release.md` · docs: `docs/development.md#releasing`.
