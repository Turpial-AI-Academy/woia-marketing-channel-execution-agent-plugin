import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizePublication, dispatchPublication, publicationDigest } from '../skills/marketing-channel-execution/scripts/authorize-publication.mjs';

function fixture() {
  const plan = { org_id: 'org:synthetic', operation: 'publish', audience: 'public-non-person', paid: false, effect_classes: ['publication'], target_ref: 'channel:synthetic', source_ref: 'source:synthetic', source_version: '1', idempotency_key: 'effect:synthetic', authority: { status: 'authorized', approval_ref: 'approval:synthetic' }, recovery: { strategy: 'reconcile-before-retry' }, content: { text: 'Synthetic public copy' } };
  const context = { department: 'marketing', org_id: plan.org_id, now: '2026-10-10T12:00:00Z', binding_revision: 1, source_map_revision: 1,
    authorization_state: { org_id: plan.org_id, current: true, active: true, revoked: false, hold: false, emergency_stop: false, revision_ref: 'authorization:1' },
    surface: { org_id: plan.org_id, target_ref: plan.target_ref, audience: plan.audience, paid: false, status: 'qualified', binding_revision: 'surface:1' },
    grant: { status: 'accepted', org_id: plan.org_id, department: 'marketing', target_ref: plan.target_ref, operation: plan.operation, approval_ref: plan.authority.approval_ref, payload_sha256: publicationDigest(plan), authorization_revision_ref: 'authorization:1', surface_binding_revision: 'surface:1', expires_at: '2026-10-10T13:00:00Z' },
    accepted_source: { status: 'accepted', org_id: plan.org_id, ref: plan.source_ref, version: plan.source_version, current: true, acceptance_ref: 'source-acceptance:1', authority_map_ref: 'source-map:1', source_map_revision: 1 },
    reservation: { org_id: plan.org_id, idempotency_key: plan.idempotency_key, payload_sha256: publicationDigest(plan), state: 'reserved', reservation_ref: 'reservation:synthetic', revision_ref: 'reservation:1' },
  };
  return { plan, context };
}

// Synthetic in-memory CAS demonstrates call order only; it is not a durable adapter.
function syntheticPort(context, { execute, beforeResolve, failTerminal = false } = {}) {
  let record = structuredClone(context.reservation), generation = 1, calls = 0;
  const journal = [];
  const port = { qualification: 'PASS', binding_revision: context.surface.binding_revision,
    async persist({ expected_revision_ref, record: next }) {
      if (expected_revision_ref !== record.revision_ref || (failTerminal && calls)) return { committed: false };
      record = { ...structuredClone(next), revision_ref: `reservation:${++generation}` };
      journal.push(`persist:${record.state}`);
      return { committed: true, revision_ref: record.revision_ref };
    },
    async resolveContext() { beforeResolve?.(context); return { ...structuredClone(context), reservation: structuredClone(record) }; },
    async execute(plan, authorization) { calls++; journal.push('execute'); return execute ? execute(plan, authorization) : { state: 'CONFIRMED', remote_ids: ['remote:synthetic'] }; },
    get record() { return structuredClone(record); }, get calls() { return calls; }, journal,
  };
  return port;
}

test('generic publication preserves authority/source/CAS gates and calls adapter after claim', async () => {
  const { plan, context } = fixture(), port = syntheticPort(context);
  assert.equal(authorizePublication(plan, context).result, 'AUTHORIZED_PUBLIC_PUBLICATION');
  const result = await dispatchPublication(plan, context, port);
  assert.equal(result.state, 'CONFIRMED');
  assert.deepEqual(port.journal, ['persist:UNKNOWN', 'execute', 'persist:CONFIRMED']);
  assert.equal(port.record.state, 'CONFIRMED');
});

test('payload, source, revision, expiry, holds, audience and policy cannot bypass gates', () => {
  const mutations = [
    ({ plan }) => { plan.content.text = 'Changed'; },
    ({ context }) => { context.accepted_source.current = false; },
    ({ context }) => { context.accepted_source.source_map_revision = 2; },
    ({ context }) => { context.authorization_state.revision_ref = 'authorization:2'; },
    ({ context }) => { context.surface.binding_revision = 'surface:2'; },
    ({ context }) => { context.now = context.grant.expires_at; },
    ({ context }) => { context.authorization_state.hold = true; },
    ({ plan }) => { plan.paid = true; },
    ({ plan }) => { plan.recipient_refs = ['person:synthetic']; },
    ({ context }) => { context.reservation.state = 'UNKNOWN'; },
    ({ context }) => { context.publication_policy_required = true; },
    ({ context }) => { context.accepted_source.expires_at = '2026-10-10T11:59:59Z'; },
  ];
  for (const mutate of mutations) { const input = fixture(); mutate(input); assert.throws(() => authorizePublication(input.plan, input.context)); }
});

test('two concurrent claims dispatch exactly once and CAS conflict never enters adapter', async () => {
  const { plan, context } = fixture(), port = syntheticPort(context);
  const results = await Promise.allSettled([dispatchPublication(plan, context, port), dispatchPublication(plan, context, port)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(port.calls, 1);
});

test('fresh authority revocation after claim preserves UNKNOWN without invoking adapter', async () => {
  const { plan, context } = fixture(), port = syntheticPort(context, { beforeResolve: value => { value.authorization_state.revoked = true; } });
  await assert.rejects(dispatchPublication(plan, context, port), /authorization/);
  assert.equal(port.calls, 0);
  assert.equal(port.record.state, 'UNKNOWN');
});

test('timeout becomes UNKNOWN and a fresh-context replay is blocked', async () => {
  const { plan, context } = fixture(), port = syntheticPort(context, { execute: () => { throw new Error('synthetic timeout'); } });
  assert.equal((await dispatchPublication(plan, context, port)).state, 'UNKNOWN');
  await assert.rejects(dispatchPublication(plan, await port.resolveContext(), port), /reservation/);
  assert.equal(port.calls, 1);
});

test('failed terminal CAS retains UNKNOWN and observed IDs for reconciliation', async () => {
  const { plan, context } = fixture(), port = syntheticPort(context, { failTerminal: true });
  const result = await dispatchPublication(plan, context, port);
  assert.equal(result.state, 'UNKNOWN');
  assert.equal(result.evidence_persisted, false);
  assert.deepEqual(result.observed.remote_ids, ['remote:synthetic']);
  assert.equal(port.record.state, 'UNKNOWN');
});

test('unqualified or mismatched adapter never claims or dispatches', async () => {
  for (const mutate of [port => { port.qualification = 'NOT_RUN'; }, port => { port.binding_revision = 'surface:other'; }, port => { delete port.resolveContext; }]) {
    const { plan, context } = fixture(), port = syntheticPort(context); mutate(port);
    await assert.rejects(dispatchPublication(plan, context, port), /qualified/);
    assert.equal(port.calls, 0); assert.equal(port.record.state, 'reserved');
  }
});

test('terminal persistence failure preserves observed IDs and UNKNOWN claim', async () => {
  const { plan, context } = fixture(), port = syntheticPort(context), original = port.persist;
  port.persist = async command => { if (port.calls) throw new Error('synthetic persistence timeout'); return original(command); };
  const result = await dispatchPublication(plan, context, port);
  assert.equal(result.state, 'UNKNOWN'); assert.equal(result.evidence_persisted, false);
  assert.deepEqual(result.observed.remote_ids, ['remote:synthetic']); assert.equal(port.record.state, 'UNKNOWN');
});
