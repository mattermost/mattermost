import test from 'node:test';
import assert from 'node:assert/strict';
import {provider} from './triage-provider.mjs';
import {harnessEnv} from './triage-lib.mjs';

const config = {MM_TRIAGE_PROVIDER: 'openai', OPENAI_API_KEY: 'fixture-api-key', MM_TRIAGE_MODEL: 'configured-model'};
const account = 'The assertion remains valid; the test uses an incorrect synchronization condition.';
const response = value => ({status: 'completed', output: [{content: [{type: 'output_text', text: JSON.stringify(value)}]}]});
const adapter = value => provider(config, async () => ({ok: true, status: 200, json: async () => value}));

test('existing provider remains explicit and sandbox processes cannot inherit either provider credential', () => {
    assert.throws(() => provider({...config, OPENAI_API_KEY: ''}), /OPENAI_API_KEY/);
    assert.throws(() => provider({...config, MM_TRIAGE_MODEL: ''}), /MM_TRIAGE_MODEL/);
    assert.throws(() => provider({...config, MM_TRIAGE_PROVIDER: 'other'}), /Supported Guardian provider/);
    assert.deepEqual(harnessEnv({PATH: '/bin', OPENAI_API_KEY: 'fixture-openai', ANTHROPIC_API_KEY: 'fixture-anthropic'}), {PATH: '/bin'});
});

test('incomplete, refused, ambiguous and invalid JSON responses cannot authorize a repair', async () => {
    for (const result of [
        {...response({decision: 'repair', account}), status: 'incomplete'},
        {status: 'completed', output: [{content: [{type: 'refusal', refusal: 'No'}]}]},
        {status: 'completed', output: [...response({decision: 'repair', account}).output, ...response({decision: 'repair', account}).output]},
        {status: 'completed', output: [{content: [{type: 'output_text', text: 'not JSON'}]}]},
    ]) await assert.rejects(adapter(result).diagnose({source: 'public fixture test'}));
});

test('diagnosis rejects test edits and malformed or oversized accounts', async () => {
    for (const value of [null, {decision: 'repair', account: 'Too short'}, {decision: 'repair', account: 'x'.repeat(6001)}, {decision: 'repair', account, source: 'unsafe edit'}, {decision: 'other', account}]) {
        await assert.rejects(adapter(response(value)).diagnose({source: 'public fixture test'}));
    }
    assert.deepEqual(await adapter(response({decision: 'blocked', account})).diagnose({}), {decision: 'blocked', account});
});

test('replacement source must be bounded and have exactly the requested fields', async () => {
    for (const value of [null, {account, source: ''}, {account, source: 'x'.repeat(250001)}, {account: 'short', source: 'test source'}, {account, source: 'test source', command: 'unexpected authority'}]) {
        await assert.rejects(adapter(response(value)).propose({source: 'public fixture test'}));
    }
    assert.deepEqual(await adapter(response({account, source: 'test source'})).propose({}), {account, source: 'test source'});
});
