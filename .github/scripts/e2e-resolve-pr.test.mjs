import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolvePR} from './e2e-resolve-pr.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = 'mattermost/mattermost';
const pr = (overrides = {}) => ({number: 38356, state: 'open', merged_at: null, base: {sha: base, repo: {full_name: repository}}, head: {sha: head, ref: 'feature/test'}, ...overrides});
const call = (options) => resolvePR({repository, ...options});

test('manual target freezes actual base and tested SHA, independent of workflow SHA', async () => {
    const result = await call({prNumber: '38356', github: async () => pr()});
    assert.deepEqual([result.PR_NUMBER, result.BASE_SHA, result.COMMIT_SHA], ['38356', base, head]);
});
test('short automatic SHA resolves to full current head instead of first associated PR', async () => {
    const result = await call({commitSHA: head.slice(0, 7), github: async path => path === `/commits/${head.slice(0, 7)}` ? {sha: head} : path.includes('?') ? [pr({number: 1, state: 'closed', merged_at: '2026-01-01'}), pr()] : pr()});
    assert.equal(result.PR_NUMBER, '38356'); assert.equal(result.COMMIT_SHA, head);
});
test('old commit association cannot select a newer PR head or set its status', async () => {
    const result = await call({commitSHA: head, github: async path => path.includes('?') ? [pr({head: {sha: 'c'.repeat(40), ref: 'feature/test'}})] : {sha: head}});
    assert.equal(result.PR_NUMBER, ''); assert.equal(result.COMMIT_SHA, '');
});
test('closed parent PR and feature-branch merge are not current PR evidence', async () => {
    const result = await call({commitSHA: head, github: async path => path.includes('?') ? [pr({state: 'closed', merged_at: '2026-01-01'})] : {sha: head}});
    assert.equal(result.PR_NUMBER, '');
});
test('associated PR lookup paginates and rejects ambiguity', async () => {
    let pages = 0;
    const github = async path => {
        if (path.endsWith('&page=1')) { pages++; return Array.from({length: 100}, (_, i) => pr({number: i + 1, state: 'closed'})); }
        if (path.endsWith('&page=2')) { pages++; return [pr()]; }
        return path.startsWith('/pulls/') ? pr() : {sha: head};
    };
    assert.equal((await call({commitSHA: head, github})).PR_NUMBER, '38356'); assert.equal(pages, 2);
    await assert.rejects(call({commitSHA: head, github: async path => path.includes('?') ? [pr(), pr({number: 38392})] : {sha: head}}), /Multiple/);
});
test('PR movement during resolution is rejected', async () => {
    await assert.rejects(call({commitSHA: head, github: async path => path.includes('?') ? [pr()] : path.startsWith('/pulls/') ? pr({head: {sha: 'c'.repeat(40), ref: 'feature/test'}}) : {sha: head}}), /changed/);
});
test('manual wrong SHA, wrong repository and output injection fail closed', async () => {
    await assert.rejects(call({prNumber: '38356', commitSHA: head, github: async path => path.startsWith('/commits/') ? {sha: head} : pr({head: {sha: 'c'.repeat(40), ref: 'feature/test'}})}), /current PR head/);
    await assert.rejects(call({prNumber: '38356', github: async () => pr({base: {sha: base, repo: {full_name: 'attacker/repo'}}})}));
    await assert.rejects(call({prNumber: '38356', github: async () => pr({head: {sha: head, ref: 'branch\nCOMMIT_SHA=other'}})}));
    await assert.rejects(call({prNumber: '38356', github: async () => pr({state: 'closed'})}));
});
