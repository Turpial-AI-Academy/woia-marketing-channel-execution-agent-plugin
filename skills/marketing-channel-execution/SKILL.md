---
name: marketing-channel-execution
description: Plan, execute, verify, and reconcile authorized Marketing channel effects such as publication, campaign activation, external communication, configuration, or spend using available integrations without treating tool access as authority.
license: MIT
metadata:
  author: Turpial AI Academy
  version: "0.5.1"
---

# Marketing Channel Execution

This is an effectful capability. Use only when the Task requires a real external channel action.

## Before execution

1. Resolve exact target account/channel/campaign/resource.
2. Resolve exact action and configuration.
3. Classify effects: external-write, communication, publication and/or financial.
4. Confirm the effective authority and required Human Review/approval.
5. Prepare rollback/recovery or reconciliation behavior.
6. When possible, use the target integration's native dry-run/preview semantics. Never claim dry-run when the tool cannot prove it.
7. Validate the execution plan with the bundled deterministic validator.

## Deterministic execution-plan validator

`node scripts/validate-execution-plan.mjs --file <plan.json>`

The plan must explicitly bind target, operation, effect classes, authority status, approval requirement, and recovery/reconciliation behavior before an effectful call.

## Execution

- Use only the selected authorized integration/tool.
- Do not widen target, audience, budget or operation after authorization.
- Record operation identifiers and response evidence.
- If an external call times out or returns an ambiguous result after submission, record effect state `unknown` and reconcile before retry.
- Never retry an unknown publication/spend/communication effect blindly.

## Completion

Return confirmed/partial/rejected/unknown effect evidence, exact target/configuration, resulting identifiers, and rollback/reconciliation state.

Tool availability never grants business authority.

## Real Estate effective execution

In Real Estate, only public/non-person/non-paid Marketing publication is eligible. Structural validation never authorizes execution. Every Real Estate adapter must invoke the guarded dispatch helper in scripts/authorize-real-estate-publication.mjs using host-resolved authority, source acceptance and durable reservation context. Read [the routing contract](references/real-estate-routing.md) before executing. Person-directed effects route to Customer Service/Communications; paid effects route to Ads. Preserve UNKNOWN and reconcile before retry.
