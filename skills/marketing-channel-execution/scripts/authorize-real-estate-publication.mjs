import { createHash } from 'node:crypto';

// Semantic gate only. The qualified host supplies immutable context and owns
// durable idempotency/CAS reservations; plan data cannot grant its own authority.
export function publicationDigest(plan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

export function authorizeRealEstatePublication(plan, context) {
  const deny = (reason) => { throw new Error(reason); };
  if (!context || context.profile !== 'real-estate' || context.department !== 'marketing') deny('real-estate Marketing host context required');
  if (!context.org_id || plan?.org_id !== context.org_id) deny('organization mismatch');
  const authorizationState = context.authorization_state;
  if (!authorizationState || authorizationState.org_id !== context.org_id || authorizationState.current !== true || authorizationState.active !== true || authorizationState.revoked !== false || authorizationState.hold !== false || authorizationState.emergency_stop !== false || !authorizationState.revision_ref) deny('current active authorization without hold/revocation/emergency required');
  if (!['publish', 'update-publication', 'withdraw-publication'].includes(plan.operation)) deny('operation outside public publication boundary');
  if (plan.audience !== 'public-non-person' || plan.paid !== false || (plan.recipient_refs !== undefined && (!Array.isArray(plan.recipient_refs) || plan.recipient_refs.length))) deny('person-directed or paid action denied; route to Customer Service or Ads');
  const surface = context.surface;
  if (!surface || surface.org_id !== context.org_id || surface.target_ref !== plan.target_ref || surface.audience !== 'public-non-person' || surface.paid !== false || surface.status !== 'qualified') deny('qualified public organic host surface required');
  if (!Array.isArray(plan.effect_classes) || !plan.effect_classes.length || plan.effect_classes.some(e => !['publication', 'external-write'].includes(e))) deny('communication/financial effect denied');
  if (!plan.target_ref || !plan.source_ref || !plan.source_version || !plan.idempotency_key) deny('exact target, accepted source version and idempotency key required');
  if (plan.authority?.status !== 'authorized' || !plan.authority.approval_ref) deny('competent approval required');
  const grant = context.grant;
  if (!grant || grant.status !== 'accepted' || grant.org_id !== context.org_id || grant.department !== 'marketing' || grant.target_ref !== plan.target_ref || grant.operation !== plan.operation || grant.approval_ref !== plan.authority.approval_ref || grant.payload_sha256 !== publicationDigest(plan)) deny('authority does not bind exact payload');
  const now = Date.parse(context.now), expiry = Date.parse(grant.expires_at);
  if (!Number.isFinite(now) || !Number.isFinite(expiry) || now >= expiry) deny('missing or expired authority');
  const source = context.accepted_source;
  if (!source || source.status !== 'accepted' || source.org_id !== context.org_id || source.ref !== plan.source_ref || source.version !== plan.source_version || source.current !== true || !source.acceptance_ref || !source.authority_map_ref) deny('current accepted source authority required');
  const attempt = context.reservation;
  if (!attempt || attempt.org_id !== context.org_id || attempt.idempotency_key !== plan.idempotency_key || attempt.payload_sha256 !== publicationDigest(plan) || attempt.state !== 'reserved' || !attempt.reservation_ref) deny('host durable reservation required; unknown/submitted effects reconcile before retry');
  if (plan.recovery?.strategy !== 'reconcile-before-retry') deny('reconciliation policy required');
  return Object.freeze({ result: 'AUTHORIZED_PUBLIC_PUBLICATION', target_ref: plan.target_ref, operation: plan.operation, payload_sha256: publicationDigest(plan), reservation_ref: attempt.reservation_ref });
}

export async function dispatchRealEstatePublication(plan, context, adapter) {
  const authorization = authorizeRealEstatePublication(plan, context);
  if (typeof adapter !== 'function') throw new Error('qualified adapter required');
  // Recheck immediately before invocation. Qualified adapter atomically consumes
  // the reservation and records submitted/unknown/confirmed evidence.
  authorizeRealEstatePublication(plan, context);
  return adapter(structuredClone(plan), authorization);
}
