# Repository Guidelines

## Project Structure & Module Organization

- `src/`: Action source (ESM). Entry points are `src/main.js` (main) and
  `src/post.js` (post-run), bundled to `dist/`.
- `dist/`: Built artifacts referenced by `action.yml` (`dist/index.js`,
  `dist/post.js`). Keep this in sync with source changes.
- `__tests__/`: Jest tests (`*.test.js`); `__fixtures__/` holds test helpers.
- Config: `action.yml`, `rollup.config.js`, `eslint.config.mjs`,
  `jest.config.js`, `.prettierrc.yml`.
- Generated: `coverage/` and `badges/` are output directories.

## Build, Test, and Development Commands

```bash
npm install               # Install dependencies (Node >= 20;
                          # .node-version pins 24.4.0)
npm run bundle            # Format + build action into dist/
npm run package           # Build dist/ only (Rollup)
npm run package:watch     # Rebuild dist/ on changes
npm run lint              # ESLint checks
npm run format:check      # Prettier check
npm run format:write      # Prettier fix
npm test                  # Jest test run with coverage
npm run coverage          # Update coverage badge
npm run local-action      # Run action locally using .env
npm run all               # Format, lint, test, coverage, build
```

## Coding Style & Naming Conventions

- JavaScript ESM (`"type": "module"`). Keep modules small and focused.
- Prettier is authoritative: 2-space indent, single quotes, no semicolons.
- ESLint enforces import and Jest rules—run `npm run lint` before changes.
- Test files use `*.test.js`; fixtures live in `__fixtures__/`.

## Testing Guidelines

- Framework: Jest (`jest.config.js`), tests live in `__tests__/`.
- Coverage is collected for `src/**` and written to `coverage/`.
- Run locally with `npm test`; use `npm run ci-test` for CI parity.

## Commit & Pull Request Guidelines

- Commit messages are short, imperative, sentence case (e.g., “Implement …”).
- PRs should include: summary of behavior changes, test evidence, and any
  updates to `dist/` (run `npm run bundle` and commit output when needed).
- Link related issues if applicable and call out any configuration changes.

## Security & Configuration Tips

- Local runs require `.env` based on `.env.example`. Never commit secrets.
- Prefer GitHub Actions secrets or OIDC for AWS credentials when testing in CI.
