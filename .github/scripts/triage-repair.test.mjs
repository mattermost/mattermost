import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {currentRepairMaster, disposition} from './triage-guardian.mjs';
import {ownerFor} from './triage-queue.mjs';

test('product suspicion persists an actionable account without tracker access or a test edit', async () => {
    const calls = [];
    const account = 'The reproduced server response violates the unchanged test assertion.';
    await disposition({decision: 'product_suspect', account}, {
        complete: async (outcome, description) => calls.push({outcome, description}),
        defect: async () => assert.fail('Tracker access must not be required'),
        repair: async () => assert.fail('A product suspicion must not request a test patch'),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].outcome, 'product_suspect');
    assert.ok(calls[0].description.startsWith(account));
    assert.match(calls[0].description, /Human action required.*assigned owner.*resolve this queue item/s);
    assert.match(calls[0].description, /test remains unchanged and red/);
});

test('lost lease during human handoff remains an error without another side effect', async () => {
    await assert.rejects(disposition({decision: 'product_suspect', account: 'Specific product evidence'}, {
        complete: async () => { throw new Error('Lease token no longer owns this work'); },
        defect: async () => assert.fail('Tracker side effect after lost lease'),
        repair: async () => assert.fail('Repair side effect after lost lease'),
    }), /Lease token/);
});

test('blocked and repair diagnoses retain their separate disposition', async () => {
    const calls = [];
    const callbacks = {complete: async (...args) => calls.push(args), repair: async account => calls.push(['repair', account])};
    await disposition({decision: 'blocked', account: 'Missing causal evidence'}, callbacks);
    await disposition({decision: 'repair', account: 'Reproduced incorrect test synchronization'}, callbacks);
    assert.deepEqual(calls, [['blocked', 'Missing causal evidence'], ['repair', 'Reproduced incorrect test synchronization']]);
    await assert.rejects(disposition({decision: 'unknown', account: 'Invalid'}, callbacks), /Unknown diagnosis/);
    assert.equal(calls.length, 2);
});

test('the user-selected reviewer covers both E2E frameworks without changing existing security owners', async () => {
    const owners = await readFile(new URL('../../CODEOWNERS', import.meta.url), 'utf8');
    assert.equal(ownerFor(owners, 'e2e-tests/cypress/tests/integration/channels/example_spec.js'), '@yasserfaraazkhan');
    assert.equal(ownerFor(owners, 'e2e-tests/playwright/specs/channels/example.spec.ts'), '@yasserfaraazkhan');
    assert.equal(ownerFor(owners, 'server/channels/app/authentication.go'), '@mattermost/product-security');
    assert.equal(ownerFor(owners, 'server/channels/app/authorization.go'), '@mattermost/product-security');
    assert.throws(() => ownerFor(owners, 'e2e-tests/detox/example.spec.ts'), /No GitHub CODEOWNERS/);
});

test('historical queue evidence is rejected before reproduction without substituting a newer image or commit', async () => {
    const item = {commit_sha: 'a'.repeat(40), image_digest: 'mattermost/server@sha256:' + 'c'.repeat(64)};
    const snapshot = structuredClone(item);
    const reads = [];
    await assert.rejects(currentRepairMaster(async path => {
        reads.push(path);
        return {object: {sha: 'b'.repeat(40)}};
    }, item), /fresh master evidence and revalidation required/);
    assert.deepEqual(reads, ['/git/ref/heads/master']);
    assert.deepEqual(item, snapshot);
    const current = {object: {sha: item.commit_sha}};
    assert.equal(await currentRepairMaster(async () => current, item), current);
});
