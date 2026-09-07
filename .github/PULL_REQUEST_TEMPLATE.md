## Summary

<!-- What does this change and why? Link the issue if there is one. -->

## Checklist

- [ ] Tests were written first and cover the change (unit, Node, or browser as appropriate).
- [ ] `npm run check` passes locally (format, lint, types, unit tests with the 99% coverage gate).
- [ ] Documentation updated for any public behaviour change (README, CHANGELOG).
- [ ] No unrelated formatting or refactoring.

### If this touches the compiler build (`build/`, `PROVENANCE.md`)

- [ ] The reason the change is required for WebAssembly is explained.
- [ ] Native compiler behaviour is preserved, and why is explained.
- [ ] `npm run build:wasm && npm run test:node` passes: every fixture is byte-identical.
- [ ] `PROVENANCE.md` and `build/pins.env` were updated together.
