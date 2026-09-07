# Contributing

Thanks for helping make PsyQ compiler output available in the browser. This
project holds itself to production-library standards; the rules below keep
compiler fidelity and code quality verifiable.

## Development process

Work test-first: write the failing test, make it pass with the smallest change,
then refactor. Pull requests are expected to show that shape (tests land with,
or before, the code they cover).

```sh
npm ci
npm run check          # format, lint, typecheck, unit tests + 99% coverage gate
npm run build:wasm     # Docker: emscripten/emsdk image builds dist/cc1psx.{wasm,js}
npm run build:ts       # tsc -> dist/
npm run test:node      # Node API + differential tests against dist/
npx playwright install # once
npm run test:browser   # Chromium, Firefox, WebKit
npm run test:package   # npm pack + consumer apps (needs network)
build/check-gen.sh --fresh # independently regenerate historical build inputs
build/compile-fixtures.sh --verify # compare fixtures with an existing reference build
npm run serve          # http://127.0.0.1:4173/demo/
```

Unit tests never need the compiler artifact. The Node and browser suites do,
and they fail (never skip) when `dist/` is missing.

Development tooling runs on Node 24, TypeScript 6.0, and Vitest 4.1. Keep the
`.npmrc` legacy-peer workaround for local npm 11 installs; `npm ci` is the
standard clean-install path. Compiler builds use Docker exclusively, with
Emscripten 6.0.9 pinned by digest and `linux/amd64` selected on every host.
Each build compiles fresh objects; only Emscripten system libraries are cached.

CI exercises Node 20, 22, and 24 on Linux and Node 24 on macOS and Windows.
The Node package consumer installs into a path containing spaces and `#` to
exercise native file URL handling.

## Test layers

| Layer        | Location       | Runs where   | Needs                       |
| ------------ | -------------- | ------------ | --------------------------- |
| Unit         | `test/unit`    | Vitest, Node | nothing                     |
| Build inputs | `test/build`   | Vitest, Node | nothing (vendor optional)   |
| Node + diff  | `test/node`    | Vitest, Node | `dist/` (built)             |
| Browser      | `test/browser` | Playwright   | `dist/`, browsers installed |
| Package      | `test/package` | Node script  | `dist/`, network            |

The differential suite (`test/node/differential.test.ts`) compiles every entry
of `test/fixtures/manifest.json` and requires byte-identical assembly and
identical stderr compared with the reference PsyQ 4.4 compiler. A single
differing byte fails the build.

## Coverage exclusions

Coverage is measured on `src/**/*.ts` with a 99% threshold on statements,
branches, functions, and lines. The following files are excluded, each for a
reason:

- `src/worker.ts`, `src/worker.node.ts`: bootstraps of a few lines that only
  wire the runtime to the worker global scope. They cannot run under the unit
  test runner and are exercised end to end by the browser and Node suites.
- `src/cc1psx.d.ts`: type declarations for the Emscripten glue; no statements.
- `src/public-types.ts`: type-only module; no statements.

Do not add exclusions to get a change merged; add tests.

## Compiler build changes

Anything under `build/` changes the compiler artifact and needs extra care:

1. Explain why the change is needed for WebAssembly.
2. Explain why native compiler behaviour is preserved.
3. Keep compatibility patches minimal and as separate, reviewable files under
   `build/patches/`. Never modernize old compiler code for its own sake.
4. Update `build/pins.env` and `PROVENANCE.md` together; `npm run check` fails
   if they disagree.
5. Run `npm run build:wasm && npm run test:node` and confirm every fixture is
   still byte-identical.

Changing Emscripten or compiler flags, or removing
`-sEMULATE_FUNCTION_POINTER_CASTS`, requires the full differential run.

## Fixtures

Fixtures are original C under `test/fixtures/src/`. Never copy code from a game,
an SDK, or another decompilation project. To add one:

1. Write `test/fixtures/src/tNN_name.c`.
2. Run `build/build-reference.sh` once (slow; builds the reference compiler in
   the pinned Debian container), then `build/compile-fixtures.sh`, which
   preprocesses and compiles every fixture with the reference toolchain and
   prints each exit code.
3. Add the new entries to `test/fixtures/manifest.json`. The regenerated
   `SHA256SUMS` must show no change for existing fixtures.

## Style

- TypeScript strict mode, ESM, no `any` outside a documented boundary.
- Prettier formats everything; ESLint (type-aware) must pass with no
  file-level disables. A local disable needs a reason in a comment.
- Prefer `@ts-expect-error` over `@ts-ignore`, and only in tests.
- Public API changes need README and CHANGELOG entries in the same pull
  request.

## Releases

Tag `vX.Y.Z` on `main`. The release workflow builds the compiler, freshly builds
the historical reference, verifies generated sources and fixtures without
rewriting them, runs every test layer, and verifies `PROVENANCE.md`. It then
builds the corresponding-source archive in two independent clean directories
and requires both Wasm and glue hashes to match before publishing.

To rehearse the archive checks locally after building:

```sh
scripts/pack-source-archive.sh
scripts/verify-source-archive.sh build/out/release/psyq-wasm-0.1.0-corresponding-source.tar.gz dist/SHA256SUMS --twice
```

The archive includes the current checkout's build inputs and the pinned vendor
export. After extraction, run `build/build-wasm.sh --offline-source` inside its
`psyq-wasm/` directory. The command verifies bundled checksums and pins and
does not need Git or npm; Docker may download its pinned image if not cached.

Publishing requires `NPM_TOKEN` or configured npm trusted publishing. The demo
workflow requires GitHub Pages to be enabled. These are repository/account
settings, not prerequisites for local validation.
