# woia-marketing-channel-execution

WOIA Marketing v0.5.6 provider for `marketing.channel-execution`.

- Primary skill: `$marketing-channel-execution`
- Authoring profile: thin
- Origin: WOIA-native

Capability-owned deterministic tools/templates live in this plugin. Generic certification/release tooling lives in `woia-ecosystem`.

The generic structural validator is backward compatible. The Real Estate effective action set permits only Marketing public, non-person, non-paid publication through the guarded dispatcher. External-person communication belongs to Customer Service/Communications; paid effects belong to Ads. See [the routing contract](skills/marketing-channel-execution/references/real-estate-routing.md).

## Maintenance

Edit only this canonical repository. Keep `plugin.json`, `package.json` and `dev.woia/manifest.json` versions aligned. From the canonical WOIA Ecosystem repository, run `mise run plugin:certify-thin --repo <absolute-plugin-repository>`, then use its release preparation/publication tasks. Install and update consumers from immutable published artifacts; keep Project personalization in overlays.
