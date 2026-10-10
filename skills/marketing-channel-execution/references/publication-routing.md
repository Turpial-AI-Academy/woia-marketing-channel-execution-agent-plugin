# Publication boundary and dispatch

Marketing channel execution owns public, non-person and non-paid publication. Person-directed sends belong to Communications under Customer Service coordination; paid effects belong to Ads. Interaction with the current root-agent user remains direct.

`validate-execution-plan.mjs --file` checks plan structure. Its PASS never authorizes an effect. Integrations call `authorizePublication(plan, hostContext)` and `dispatchPublication(plan, hostContext, port)` from `../scripts/authorize-publication.mjs`. Host context must come from current authenticated resources, never from request assertions.

Approval binds the complete payload digest, exact organization/target/operation, current authorization revision and qualified surface binding. Accepted source evidence binds its version and current Source Authority Map revision. A host-admitted specialization may supply an additional accepted publication policy. Changing any bound value requires a new decision.

The adapter port exposes `qualification: 'PASS'`, its exact `binding_revision`, `execute(plan, authorization)`, `resolveContext()` and `persist({expected_revision_ref, record})`. Persistence must be durable and atomic compare-and-swap (CAS). It returns `{committed: true, revision_ref}` only after the exact expected revision was replaced. The dispatcher persists an UNKNOWN claim before the adapter call, rechecks a freshly resolved context, and persists the observation afterward.

Only a reserved effect is dispatchable. UNKNOWN, submitted, duplicate and completed reservations cannot be replayed. A timeout, incomplete observation, changed authorization after claiming, or failed terminal CAS requires reconciliation. The host owns durable storage and reconciliation; this module does not bundle a backend or qualify a live provider.

Remote observation and accepted source truth are separate evidence. Report observed IDs and source/approval/binding revisions without converting remote success into domain acceptance.
