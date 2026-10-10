---
name: marketing-channel-execution
description: Plan, dispatch, verify, and reconcile authorized public, non-person, non-paid Marketing publication. Route paid effects to Ads and person-directed effects to Communications under Customer Service coordination.
license: MIT
metadata:
  author: Turpial AI Academy
  version: "0.5.8"
---

# Marketing Channel Execution

This is an effectful capability. Use only when the Task requires a real external channel action.

## Before execution

1. Resolve exact target account/channel/campaign/resource.
2. Resolve exact action and configuration.
3. Classify effects: public publication/external-write remains here; paid or financial effects route to Ads, and person-directed effects route to Communications under Customer Service coordination.
4. Confirm the effective authority and required Human Review/approval.
5. Prepare rollback/recovery or reconciliation behavior.
6. When possible, use the target integration's native dry-run/preview semantics. Never claim dry-run when the tool cannot prove it.
7. Validate the execution plan with the bundled deterministic validator, then load [the publication routing contract](references/publication-routing.md) before adapter dispatch.

## Deterministic execution-plan validator

`node scripts/validate-execution-plan.mjs --file <plan.json>`

The plan must explicitly bind target, operation, effect classes, authority status, approval requirement, and recovery/reconciliation behavior before an effectful call.

## Execution

- Use `authorizePublication` and `dispatchPublication` from `scripts/authorize-publication.mjs` with the selected qualified adapter port and independently resolved host context.
- Persist the UNKNOWN claim with atomic CAS before calling the adapter; resolve and recheck current authority, source and binding immediately before dispatch.
- Do not widen target, audience, budget or operation after authorization.
- Record operation identifiers and response evidence.
- If an external call times out or returns an ambiguous result after submission, record effect state `unknown` and reconcile before retry.
- Never retry an unknown publication/spend/communication effect blindly.

## Completion

Return confirmed/partial/rejected/unknown effect evidence, exact target/configuration, resulting identifiers, and rollback/reconciliation state.

Tool availability never grants business authority.

## Policy contributions

Use only additional policy contributions resolved from the host's admitted specialization snapshot. Requests cannot select policy modules or assert domain acceptance. A required missing, stale or mismatched policy blocks dispatch. Remote publication evidence never changes accepted source truth. Interaction with the current root-agent user remains direct.
