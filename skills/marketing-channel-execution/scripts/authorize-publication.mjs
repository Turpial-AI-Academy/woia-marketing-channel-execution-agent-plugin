import { createHash } from 'node:crypto';

const text = value => typeof value === 'string' && value.trim().length > 0;
const revision = value => text(value) || (Number.isSafeInteger(value) && value > 0);
const operations = ['publish', 'update-publication', 'withdraw-publication'];
const effects = ['publication', 'external-write'];

/** Full payload binding. The caller must pass the same immutable JSON plan at every gate. */
export function publicationDigest(plan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

function checkPublication(plan, context, permittedReservationStates) {
  const deny = reason => { throw new Error(reason); };
  if (!plan || !context || context.department !== 'marketing') deny('Marketing host context required');
  if (!text(context.org_id) || plan.org_id !== context.org_id) deny('organization mismatch');
  const digest = publicationDigest(plan);
  const state = context.authorization_state;
  if (!state || state.org_id !== context.org_id || state.current !== true || state.active !== true || state.revoked !== false || state.hold !== false || state.emergency_stop !== false || !text(state.revision_ref)) deny('current active authorization without hold/revocation/emergency required');
  if (!operations.includes(plan.operation)) deny('operation outside public publication boundary');
  if (plan.audience !== 'public-non-person' || plan.paid !== false || (plan.recipient_refs !== undefined && (!Array.isArray(plan.recipient_refs) || plan.recipient_refs.length))) deny('person-directed or paid action denied; route to Communications through Customer Service or Ads');
  const surface = context.surface;
  if (!surface || surface.org_id !== context.org_id || surface.target_ref !== plan.target_ref || surface.audience !== 'public-non-person' || surface.paid !== false || surface.status !== 'qualified' || !text(surface.binding_revision)) deny('qualified public organic host surface required');
  if (!Array.isArray(plan.effect_classes) || !plan.effect_classes.length || plan.effect_classes.some(effect => !effects.includes(effect))) deny('communication/financial effect denied');
  if (['target_ref', 'source_ref', 'source_version', 'idempotency_key'].some(key => !text(plan[key]))) deny('exact target, accepted source version and idempotency key required');
  if (plan.authority?.status !== 'authorized' || !text(plan.authority.approval_ref)) deny('competent approval required');
  const grant = context.grant;
  if (!grant || grant.status !== 'accepted' || grant.org_id !== context.org_id || grant.department !== 'marketing' || grant.target_ref !== plan.target_ref || grant.operation !== plan.operation || grant.approval_ref !== plan.authority.approval_ref || grant.payload_sha256 !== digest || grant.authorization_revision_ref !== state.revision_ref || grant.surface_binding_revision !== surface.binding_revision) deny('authority does not bind exact payload and current revisions');
  const now = Date.parse(context.now), expiry = Date.parse(grant.expires_at);
  if (!Number.isFinite(now) || !Number.isFinite(expiry) || now >= expiry) deny('missing or expired authority');
  const source = context.accepted_source;
  if (!source || source.status !== 'accepted' || source.org_id !== context.org_id || source.ref !== plan.source_ref || source.version !== plan.source_version || source.current !== true || !text(source.acceptance_ref) || !text(source.authority_map_ref) || !revision(context.source_map_revision) || source.source_map_revision !== context.source_map_revision) deny('current accepted source authority required');
  if (source.expires_at !== undefined && (!Number.isFinite(Date.parse(source.expires_at)) || now >= Date.parse(source.expires_at))) deny('accepted source has expired');
  const reservation = context.reservation;
  if (!reservation || reservation.org_id !== context.org_id || reservation.idempotency_key !== plan.idempotency_key || reservation.payload_sha256 !== digest || !permittedReservationStates.includes(reservation.state) || !text(reservation.reservation_ref) || !text(reservation.revision_ref)) deny('host durable reservation required; UNKNOWN/submitted effects reconcile before retry');
  if (plan.recovery?.strategy !== 'reconcile-before-retry') deny('reconciliation policy required');
  const policy = context.publication_policy;
  if (context.publication_policy_required === true || policy !== undefined) {
    if (!policy || policy.status !== 'accepted' || policy.current !== true || policy.org_id !== context.org_id || policy.payload_sha256 !== digest || policy.target_ref !== plan.target_ref || policy.source_map_revision !== context.source_map_revision || policy.binding_revision !== context.binding_revision || !text(policy.policy_ref) || !revision(policy.revision_ref) || policy.operation !== plan.operation) deny('current accepted policy contribution for exact publication required');
  }
  return Object.freeze({ result: 'AUTHORIZED_PUBLIC_PUBLICATION', target_ref: plan.target_ref, operation: plan.operation, payload_sha256: digest, reservation_ref: reservation.reservation_ref, binding_revision: surface.binding_revision, authorization_revision_ref: state.revision_ref, source_map_revision: context.source_map_revision });
}

/** Semantic gate only. Context is independently resolved by the qualified host. */
export function authorizePublication(plan, context) {
  return checkPublication(plan, context, ['reserved']);
}

/** Persist an UNKNOWN claim with atomic CAS before entering the remote adapter.
 * port.persist({expected_revision_ref, record}) returns {committed:true, revision_ref}.
 * The host supplies durable persistence and a fresh context resolver; this module has no backend.
 */
export async function dispatchPublication(plan, context, port) {
  const frozenPlan = structuredClone(plan);
  const authorization = authorizePublication(frozenPlan, context);
  if (!port || port.qualification !== 'PASS' || port.binding_revision !== authorization.binding_revision || ['persist', 'resolveContext', 'execute'].some(key => typeof port[key] !== 'function')) throw new Error('qualified bound adapter with durable CAS persistence and context resolver required');
  const claim = { ...structuredClone(context.reservation), state: 'UNKNOWN', authorization, remote_ids: [] };
  const claimed = await port.persist({ expected_revision_ref: context.reservation.revision_ref, record: claim });
  if (claimed?.committed !== true || !text(claimed.revision_ref) || claimed.revision_ref === context.reservation.revision_ref) throw new Error('reservation CAS failed; adapter not invoked');
  claim.revision_ref = claimed.revision_ref;
  // An error after the claim preserves UNKNOWN. Reconciliation owns any later retry.
  const fresh = await port.resolveContext();
  const rechecked = checkPublication(frozenPlan, fresh, ['UNKNOWN']);
  if (port.binding_revision !== authorization.binding_revision || fresh.reservation.reservation_ref !== claim.reservation_ref || fresh.reservation.revision_ref !== claimed.revision_ref || JSON.stringify(rechecked) !== JSON.stringify(authorization)) throw new Error('authority/source/binding changed after reservation; reconcile UNKNOWN claim');
  let observation;
  try {
    observation = await port.execute(structuredClone(frozenPlan), authorization);
  } catch (error) {
    observation = { state: 'UNKNOWN', remote_ids: [], error: error instanceof Error ? error.message : String(error) };
  }
  if (!observation || !['CONFIRMED', 'REJECTED', 'UNKNOWN'].includes(observation.state) || !Array.isArray(observation.remote_ids) || observation.remote_ids.some(id => !text(id)) || (observation.state === 'CONFIRMED' && !observation.remote_ids.length)) observation = { state: 'UNKNOWN', remote_ids: [], error: 'adapter observation incomplete' };
  const record = { ...claim, state: observation.state, observation: structuredClone(observation), remote_ids: [...observation.remote_ids] };
  let persisted;
  try {
    persisted = await port.persist({ expected_revision_ref: claimed.revision_ref, record });
  } catch (error) {
    return { state: 'UNKNOWN', reconciliation_required: true, reservation_ref: claim.reservation_ref, observed: structuredClone(observation), evidence_persisted: false, persistence_error: error instanceof Error ? error.message : String(error) };
  }
  if (persisted?.committed !== true || !text(persisted.revision_ref) || persisted.revision_ref === claimed.revision_ref) return { state: 'UNKNOWN', reconciliation_required: true, reservation_ref: claim.reservation_ref, observed: structuredClone(observation), evidence_persisted: false };
  return { ...structuredClone(observation), reservation_ref: claim.reservation_ref, revision_ref: persisted.revision_ref, reconciliation_required: observation.state === 'UNKNOWN', evidence_persisted: true };
}
