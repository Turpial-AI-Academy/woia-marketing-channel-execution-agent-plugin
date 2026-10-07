import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { authorizeRealEstatePublication, dispatchRealEstatePublication, publicationDigest } from '../skills/marketing-channel-execution/scripts/authorize-real-estate-publication.mjs';

function fixture() {
  const plan = { org_id: 'org:test', target_ref: 'channel:test', operation: 'publish', audience: 'public-non-person', paid: false, effect_classes: ['publication'], source_ref: 'listing:test', source_version: 'v1', idempotency_key: 'effect:test', authority: { status: 'authorized', approval_required: true, approval_ref: 'approval:test' }, recovery: { strategy: 'reconcile-before-retry' }, content: 'Synthetic listing' };
  const context = { profile: 'real-estate', department: 'marketing', org_id: 'org:test', now: '2026-10-07T12:00:00Z', grant: { org_id: 'org:test', department: 'marketing', status: 'accepted', target_ref: plan.target_ref, operation: plan.operation, approval_ref: plan.authority.approval_ref, payload_sha256: publicationDigest(plan), expires_at: '2026-10-07T13:00:00Z' }, accepted_source: { org_id: 'org:test', status: 'accepted', ref: plan.source_ref, version: 'v1', current: true, acceptance_ref: 'acceptance:test', authority_map_ref: 'source-map:v1' }, reservation: { org_id: 'org:test', idempotency_key: plan.idempotency_key, payload_sha256: publicationDigest(plan), state: 'reserved', reservation_ref: 'reservation:test' } };
  context.surface = { org_id: context.org_id, target_ref: plan.target_ref, audience: 'public-non-person', paid: false, status: 'qualified' };
  context.authorization_state = { org_id: context.org_id, current: true, active: true, revoked: false, hold: false, emergency_stop: false, revision_ref: 'authorization:v1' };
  return { plan, context };
}
test('accepted public publication dispatches exactly once through guard', async () => { const { plan, context } = fixture(); let called = 0; const result = await dispatchRealEstatePublication(plan, context, (p, a) => { called++; assert.equal(p.content, plan.content); assert.equal(a.result, 'AUTHORIZED_PUBLIC_PUBLICATION'); return { state: 'unknown' }; }); assert.equal(called, 1); assert.equal(result.state, 'unknown'); });
const denials = {
  'missing host context': (f) => f.context = null,
  'missing current authorization': f => delete f.context.authorization_state,
  'revoked authorization': f => f.context.authorization_state.revoked = true,
  'authorization hold': f => f.context.authorization_state.hold = true,
  'emergency stop': f => f.context.authorization_state.emergency_stop = true,
  'stale authorization': f => f.context.authorization_state.current = false,
  'inactive authorization': f => f.context.authorization_state.active = false,
  'self-selected generic profile': f => f.context.profile = 'generic',
  'wrong department': f => f.context.department = 'sales',
  'cross-organization': f => f.plan.org_id = 'other',
  'direct message': f => f.plan.audience = 'person',
  'recipient bypass': f => f.plan.recipient_refs = ['person:test'],
  'malformed recipients': f => f.plan.recipient_refs = {},
  'missing qualified surface': f => delete f.context.surface,
  'paid host surface despite plan claim': f => f.context.surface.paid = true,
  'person host surface despite plan claim': f => f.context.surface.audience = 'person',
  'surface target mismatch': f => f.context.surface.target_ref = 'other',
  'paid effect': f => f.plan.paid = true,
  'missing paid classification': f => delete f.plan.paid,
  'financial class': f => f.plan.effect_classes = ['financial'],
  'communication class': f => f.plan.effect_classes = ['communication'],
  'campaign operation': f => f.plan.operation = 'campaign.activate',
  'changed approved content': f => f.plan.content = 'Changed',
  'pending authority': f => f.plan.authority.status = 'pending',
  'expired authority': f => f.context.grant.expires_at = f.context.now,
  'invalid host clock': f => delete f.context.now,
  'source observation not acceptance': f => f.context.accepted_source.status = 'observed',
  'stale source': f => f.context.accepted_source.current = false,
  'source version drift': f => f.context.accepted_source.version = 'v2',
  'missing source map': f => delete f.context.accepted_source.authority_map_ref,
  'unknown previous effect': f => f.context.reservation.state = 'unknown',
  'submitted previous effect': f => f.context.reservation.state = 'submitted',
  'missing reservation': f => delete f.context.reservation,
  'reservation payload drift': f => f.context.reservation.payload_sha256 = 'bad',
  'reservation organization drift': f => f.context.reservation.org_id = 'other',
  'blind retry policy': f => f.plan.recovery.strategy = 'retry',
};
for (const [name, mutate] of Object.entries(denials)) test(`denies ${name} before adapter`, async () => { const f = fixture(); mutate(f); let called = false; await assert.rejects(dispatchRealEstatePublication(f.plan, f.context, () => { called = true; })); assert.equal(called, false); });
test('structural CLI stays backward compatible without becoming an authority grant', () => { const output = execFileSync(process.execPath, ['skills/marketing-channel-execution/scripts/validate-execution-plan.mjs', '--file', 'skills/marketing-channel-execution/assets/execution-plan.example.json'], { encoding: 'utf8' }); assert.equal(JSON.parse(output).result, 'PASS'); });
test('all payload fields bind authorization', () => { const { plan, context } = fixture(); plan.extra = 'unapproved'; assert.throws(() => authorizeRealEstatePublication(plan, context), /payload/); });
