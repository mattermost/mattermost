import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const failedConclusions = new Set(['failure', 'startup_failure', 'timed_out', 'cancelled']);
export const workflows = new Set(['.github/workflows/e2e-tests-ci.yml', '.github/workflows/e2e-tests-on-merge.yml', '.github/workflows/e2e-tests-on-release.yml']);
export const invariant = (ok, message) => { if (!ok) throw new Error(message); };
export const main = (url, fn) => { if (process.argv[1] && url === pathToFileURL(process.argv[1]).href) fn().catch((e) => { console.error(`::error::${e.message.replace(/[\r\n]/g, ' ')}`); process.exitCode = 1; }); };
export const required = (env, key) => { invariant(env[key], `${key} is required when triage is enabled`); return env[key]; };
export const selector = (g) => Object.fromEntries(['repository', 'commit_sha', 'gh_run_id', 'gh_run_attempt', 'name'].map(k => [k, String(g[k])]));
export const sameRun = (a, b) => ['repository', 'commit_sha', 'gh_run_id', 'gh_run_attempt', 'name'].every(k => String(a[k]) === String(b[k]));
export const query = (p) => new URLSearchParams(p).toString();
export const digestPattern = /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/;
export const shaPattern = /^[a-f0-9]{40}$/;
export const testPath = (framework, file) => {
    const prefix = framework === 'playwright' ? 'e2e-tests/playwright/' : framework === 'cypress' ? 'e2e-tests/cypress/' : '';
    invariant(prefix && typeof file === 'string', 'Unsupported test framework or missing file');
    const full = file.startsWith(prefix) ? file : prefix + (framework === 'playwright' && !file.startsWith('specs/') ? 'specs/' : '') + file;
    invariant(!full.includes('..') && !/[\0\r\n\\]/.test(full), 'Unsafe test path');
    invariant(/^(e2e-tests\/playwright\/specs\/.+\.spec\.ts|e2e-tests\/cypress\/tests\/integration\/.+_spec\.(js|ts))$/.test(full), 'Only existing Playwright/Cypress test files can be repaired');
    return full;
};

export async function request(url, {token, header = 'Authorization', body, method, signal, fetcher = fetch} = {}) {
    const u = new URL(url);
    invariant(u.protocol === 'https:' || (u.hostname === '127.0.0.1' && process.env.NODE_ENV === 'test'), 'HTTPS API URL required');
    invariant(!u.username && !u.password, 'API URL must not contain credentials');
    const response = await fetcher(u, {
        method: method || (body === undefined ? 'GET' : 'POST'), redirect: 'error',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
        headers: {Accept: 'application/json', ...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...(token ? {[header]: header === 'Authorization' ? `Bearer ${token}` : token} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) { const error = new Error(`${u.hostname}${u.pathname} returned HTTP ${response.status}`); error.status = response.status; throw error; }
    if (response.status === 204) return null;
    return response.json();
}
export function clients(env = process.env) {
    const base = required(env, 'TSIO_URL').replace(/\/$/, '');
    invariant(new URL(base).pathname.replace(/\/$/, '') === '/api/v1', 'TSIO_URL must end with /api/v1');
    const key = env.TSIO_TRIAGE_API_KEY;
    if (!key) { required(env, 'ACTIONS_ID_TOKEN_REQUEST_URL'); required(env, 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'); }
    const github = required(env, 'GH_TOKEN');
    return {tsio: async (path, body) => {
        if (key) return request(`${base}${path}`, {token: key, header: 'X-Triage-Key', body});
        const oidcURL = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
        oidcURL.searchParams.set('audience', env.TSIO_OIDC_AUDIENCE || 'mattermost-test-system-io');
        const signed = await request(oidcURL, {token: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN});
        invariant(typeof signed.value === 'string' && signed.value, 'GitHub returned no OIDC identity');
        return request(`${base}${path}`, {token: signed.value, body});
    }, gh: (path, body, method, signal) => request(`https://api.github.com/repos/${required(env, 'GITHUB_REPOSITORY')}${path}`, {token: github, body, method, signal})};
}
export async function recentReports(tsio, hours = 72) {
    const reports = []; const cutoff = Date.now() - hours * 3600000;
    for (let offset = 0; offset < 20000; offset += 200) {
        const page = await tsio(`/reports?limit=200&offset=${offset}`);
        invariant(Array.isArray(page.reports), 'Invalid report listing');
        for (const g of page.reports) if (Date.parse(g.created_at) >= cutoff) reports.push(g);
        if (offset + page.reports.length >= page.total || page.reports.some(g => Date.parse(g.created_at) < cutoff)) return reports;
    }
    throw new Error('Report reconciliation exceeded 20000 groups; narrow interval or reconcile manually');
}
export function validateWorkflow(run, repository, {master = false, source} = {}) {
    invariant(run.repository?.full_name === repository && workflows.has(run.path?.split('@')[0]), 'Untrusted workflow/repository');
    invariant(run.status === 'completed' && Number.isInteger(run.run_attempt) && run.run_attempt > 0 && shaPattern.test(run.head_sha), 'Incomplete or invalid GitHub run');
    if (master) invariant(run.path?.split('@')[0] === '.github/workflows/e2e-tests-on-merge.yml' && run.head_branch === 'master', 'Repair evidence must originate from the master merge workflow');
    if (source) {
        invariant(source.repository === repository && String(run.id) === String(source.gh_run_id) && String(run.run_attempt) === String(source.gh_run_attempt), 'Verified source run identity mismatch');
        invariant(shaPattern.test(source.source_workflow_sha) && run.head_sha === source.source_workflow_sha, 'Verified source workflow revision missing or differs from GitHub run head; fresh evidence required');
    }
}
export async function artifact(dir, name, data) { await mkdir(dir, {recursive: true}); await writeFile(`${dir}/${name}`, JSON.stringify(data, null, 2)); }
export async function event() { return JSON.parse(await readFile(required(process.env, 'GITHUB_EVENT_PATH'), 'utf8')); }
// Processes executing repository/test code receive no GitHub, OIDC, triage, or provider credentials.
export function harnessEnv(env = process.env) {
    return Object.fromEntries(Object.entries(env).filter(([key]) => !/TOKEN|SECRET|API_KEY|ACTIONS_ID|GH_|GITHUB_|OPENAI|TRIAGE/i.test(key)));
}
export function run(command, args, {cwd, env = harnessEnv(), signal, input, allowFailure = false, maxBytes = 16 * 1024 * 1024} = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {cwd, env, stdio: ['pipe', 'pipe', 'pipe'], signal});
        let stdout = '', stderr = ''; let overflow = false;
        child.stdout.on('data', (d) => { stdout += d; if (stdout.length + stderr.length > maxBytes) { overflow = true; child.kill('SIGKILL'); } });
        child.stderr.on('data', (d) => { stderr += d; if (stdout.length + stderr.length > maxBytes) { overflow = true; child.kill('SIGKILL'); } });
        child.on('error', reject);
        child.on('close', (code) => { if (overflow || (code !== 0 && !allowFailure)) reject(new Error(`${command} failed (${overflow ? 'output limit' : code}); see local verification artifact`)); else resolve({code, stdout, stderr}); });
        child.stdin.end(input);
    });
}
