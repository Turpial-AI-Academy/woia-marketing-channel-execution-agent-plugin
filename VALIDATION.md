# Validation

- `node --test tests/*.test.mjs` / `pnpm test`: deterministic positive and negative domain regression, including unchanged generic structural CLI compatibility.
- `pnpm run ci:fast`: same complete domain suite for this dependency-free thin provider.
- From exact Ecosystem v0.5.4, run `mise run plugin:certify-thin --repo <absolute-provider-path>` after committing a clean candidate. This is the centralized thin release check: official plugin/skills, links, payload/root safety, portable archive, versions and domain regressions.
- Bootstrap: no dependency installation or backend configuration is required. Doctor: validate the runtime tool versions, parse all manifests and syntax-check scripts with the official Ecosystem validation functions. The existing MIT license is preserved; audited migration canonical-license enforcement is not applicable to this WOIA-native provider.

Qualified host/adapter integration must independently prove trusted current authority/source context and atomic durable idempotency consumption. Local helper tests do not qualify an external adapter or demonstrate Operator E2E, production readiness, legal acceptance or financial authority.
