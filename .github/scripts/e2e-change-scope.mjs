import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const sha = /^[a-f0-9]{40}$/;
const documentationOnly = (file) => file.startsWith('docs/') || /^(README(?:\.[^/]*)?|LICENSE(?:\.[^/]*)?|NOTICE\.txt|CONTRIBUTING\.md|SECURITY\.md|CODE_OF_CONDUCT\.md)$/.test(file);
const harnessOnly = (file) => file.startsWith('e2e-tests/') || /^\.github\/workflows\/e2e-.*\.ya?ml$/.test(file) || /^\.github\/scripts\/(?:e2e-|triage-|manual-e2e-verification|impact-gate-)/.test(file);

export function classifyChanges(files, {manual = false, headRef = ''} = {}) {
    if (!Array.isArray(files) || files.some(file => typeof file !== 'string' || !file || file.includes('\0'))) throw new Error('Expected a complete changed-file list');
    // This policy grants a skip only to an explicit documentation-only set.
    // CSS/assets, SQL, configuration, dependencies, build tools and unknown paths
    // can change behavior even when no Go/JS source file changes.
    const relevant = files.filter(file => !documentationOnly(file));
    return {
        should_run: manual || files.length === 0 || relevant.length > 0,
        should_run_fips: /fips/i.test(headRef) || files.some(file => /(^|\/)(go\.(?:mod|sum|work)|go\.work\.sum)$/.test(file) || /^server\/build\/Dockerfile.*fips/.test(file)),
        e2e_test_only: files.length > 0 && files.every(harnessOnly),
        changed_files: files,
        reason: manual ? 'Explicit manual full-suite request' : files.length === 0 ? 'Empty comparison: keep the full suite' : relevant.length ? 'Runtime, harness or unassessed changes: keep the full suite' : 'Only explicitly recognized documentation paths changed',
    };
}

export function readChanges({base, head, cwd = process.cwd()}) {
    if (!sha.test(base) || !sha.test(head)) throw new Error('Full resolved base and tested-head SHAs are required');
    const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
    if (git('rev-parse', '--verify', `${base}^{commit}`).trim() !== base || git('rev-parse', '--verify', `${head}^{commit}`).trim() !== head) throw new Error('Commit identity mismatch');
    const mergeBase = git('merge-base', '--all', base, head).trim();
    if (!sha.test(mergeBase)) throw new Error('A single merge base is required');
    // Disabling rename detection includes both removed and added names, while
    // NUL delimiters preserve paths containing newlines. Git failures are fatal.
    const raw = git('diff', '--name-only', '--no-renames', '-z', `${mergeBase}..${head}`, '--');
    if (raw && !raw.endsWith('\0')) throw new Error('Incomplete changed-file output');
    return {base_sha: base, merge_base_sha: mergeBase, head_sha: head, files: raw ? raw.slice(0, -1).split('\0') : []};
}

export function main(args = process.argv.slice(2), env = process.env) {
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const flag = args[i];
        if (flag === '--manual' && options.manual === undefined) options.manual = true;
        else if (['--base', '--head', '--head-ref'].includes(flag) && args[i + 1] !== undefined) {
            const key = flag.slice(2).replace('-ref', 'Ref');
            if (options[key] !== undefined) throw new Error(`Duplicate option ${flag}`);
            options[key] = args[++i];
        } else throw new Error(`Unknown or incomplete option ${flag}`);
    }
    const changes = readChanges(options);
    const scope = {...classifyChanges(changes.files, options), base_sha: changes.base_sha, merge_base_sha: changes.merge_base_sha, head_sha: changes.head_sha};
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, ['should_run', 'should_run_fips', 'e2e_test_only'].map(key => `${key}=${scope[key]}\n`).join(''));
    process.stdout.write(`${JSON.stringify(scope, null, 2)}\n`);
    return scope;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch (error) {
        console.error(`Cannot establish E2E change scope: ${error.message}`);
        process.exitCode = 1;
    }
}
