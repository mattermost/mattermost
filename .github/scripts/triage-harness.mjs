import {readFile, writeFile, rm, mkdir, realpath, lstat, cp} from 'node:fs/promises';
import {resolve, basename, join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {invariant, digestPattern, testPath, harnessEnv, run, artifact} from './triage-lib.mjs';

const identity = test => JSON.stringify([test.file ?? '', test.project ?? '', test.title]);
function testIdentities(tests) {
    invariant(tests.every(t => typeof t.title === 'string' && t.title), 'Missing test identity');
    const identities = tests.map(identity).sort();
    invariant(new Set(identities).size === identities.length, 'Duplicate test identities cannot verify a repair');
    return identities;
}
export function reportTests(framework, report, project, expectedFile, exitCode) {
    const tests = [];
    const reportFile = value => value ? testPath(framework, value) : '';
    const targetFile = expectedFile ? testPath(framework, expectedFile) : '';
    if (framework === 'playwright') {
        invariant(!(report.errors || []).length, 'Playwright reported infrastructure/global setup errors');
        function walk(suite, titles = [], inheritedFile = '') {
            const path = [...titles, suite.title || suite.file].filter(Boolean);
            const file = suite.file || inheritedFile;
            for (const spec of suite.specs || []) for (const test of spec.tests || []) {
                invariant(test.projectName === project, 'Unexpected project in verification report');
                tests.push({file: reportFile(spec.file || file), project: test.projectName, title: [...path, spec.title].join(' > '), state: test.results?.[0]?.status, attempts: test.results?.length || 0, retry: test.results?.[0]?.retry, errors: test.results?.flatMap(r => r.errors || []) || []});
            }
            for (const child of suite.suites || []) walk(child, path, file);
        }
        for (const suite of report.suites || []) walk(suite);
    } else {
        invariant(framework === 'cypress', 'Unsupported verification framework');
        function walk(suite, inheritedFile = '') {
            const file = suite.fullFile || suite.file || inheritedFile;
            for (const test of suite.tests || []) tests.push({file: reportFile(file), project, title: test.fullTitle, state: test.state, attempts: test.attempts?.length || 0, retry: 0, errors: test.err?.message ? [test.err.message] : []});
            for (const child of suite.suites || []) walk(child, file);
        }
        for (const suite of report.results || []) walk(suite);
    }
    invariant(tests.length > 0, 'Verification report is empty');
    testIdentities(tests);
    invariant(!targetFile || tests.every(t => t.file === targetFile), 'Verification report file differs from the selected spec');
    invariant(tests.every(t => t.attempts === 1 && t.retry === 0), 'Verification requires exactly one attempt per test and retry=0');
    invariant(tests.every(t => ['passed', 'failed', 'timedOut'].includes(t.state)), 'Skipped/pending/interrupted tests cannot verify a repair');
    invariant(tests.every(t => t.state !== 'passed' || !t.errors.length), 'Passed test contains errors; verification is inconsistent');
    if (exitCode !== undefined) {
        invariant(exitCode === 0 || exitCode === 1, 'Runner exited without a normal test outcome');
        invariant(exitCode === (tests.some(t => t.state !== 'passed') ? 1 : 0), 'Runner exit and reported test outcome disagree');
    }
    return tests;
}
export function verifyClean(runs, baseline, target, requiredRuns) {
    invariant(Number.isInteger(requiredRuns) && requiredRuns >= 3 && requiredRuns <= 20 && runs.length === requiredRuns, 'Require 3–20 independent clean runs');
    const identities = testIdentities(baseline);
    invariant(baseline.filter(t => t.title === target).length === 1, 'Claimed failed test missing or ambiguous in reproduction');
    for (const tests of runs) {
        invariant(tests.length > 0 && JSON.stringify(testIdentities(tests)) === JSON.stringify(identities), 'Verification test identities changed or became empty');
        invariant(tests.every(t => t.state === 'passed' && t.attempts === 1 && t.retry === 0), 'Verification requires every test passing without retries');
    }
}
export function validateEnvironment(item, env = process.env) {
    invariant(process.platform === 'linux' && process.arch === 'x64' && process.getuid() !== 0, 'Guardian harness supports nonroot Linux x64 runners only');
    invariant(digestPattern.test(item.image_digest), 'A pullable recorded server image@sha256 digest is required');
    const metadata = item.environment_metadata;
    invariant(metadata && metadata.server === 'onprem', 'Only recorded onprem environments are supported');
    invariant(metadata.license_secret_present === false || metadata.license_secret_present === true && env.MM_LICENSE, 'Recorded license configuration is missing');
    if (item.framework === 'playwright') {
        invariant(['chrome', 'firefox', 'ipad'].includes(item.project), 'Unsupported Playwright project');
        invariant(metadata.testcontainers === true && typeof metadata.testcontainers_services === 'string' && metadata.playwright_version, 'Recorded Testcontainers services/Playwright version are required');
    } else {
        invariant(item.framework === 'cypress' && ['', 'electron'].includes(item.project), 'Unsupported Cypress browser/project; only recorded default Electron is supported');
        invariant(typeof metadata.enabled_docker_services === 'string' && metadata.cypress_version, 'Recorded Cypress services/version are required');
    }
    return metadata;
}
// The candidate never executes in a process that can inspect the controller's
// environment, Docker socket, GitHub token or provider credential.
export function sandboxArgs({name, image, cwd, file, candidate, config, runtime, framework, cache, command}) {
    const args = ['run', '--rm', '--name', name, '--network=host', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=512', '--user', `${process.getuid()}:${process.getgid()}`, '--tmpfs', '/tmp:rw,nosuid,size=2g', '--mount', `type=bind,src=${cwd},dst=/work,readonly`, '--mount', `type=bind,src=${candidate},dst=/work/${file},readonly`, '--workdir', `/work/e2e-tests/${framework}`];
    for (const [path, host] of Object.entries(runtime)) args.push('--mount', `type=bind,src=${host},dst=/work/e2e-tests/${framework}/${path}`);
    if (framework === 'cypress') args.push('--mount', `type=bind,src=${cache},dst=/cypress-cache,readonly`);
    for (const [key, value] of Object.entries(config)) { invariant(!/TOKEN|SECRET|API_KEY|GH_|GITHUB_|OPENAI|TRIAGE/i.test(key), 'Secret-like sandbox environment key rejected'); args.push('--env', `${key}=${value}`); }
    args.push('--entrypoint', command[0], image, ...command.slice(1));
    return args;
}
async function readJSON(root, path) {
    const actual = await realpath(path); const stat = await lstat(actual);
    invariant(actual.startsWith(await realpath(root) + '/') && stat.isFile() && stat.size < 16000000, 'Untrusted report escaped its bounded artifact directory');
    return JSON.parse(await readFile(actual, 'utf8'));
}
export function cypressRuntime(compose, edition) {
    const allowed = new Set(['dbConnection', 'smtpUrl', 'webhookBaseUrl', 'firstTest', 'resetBeforeTest', 'allowedUntrustedInternalConnections', 'ldapServer', 'runLDAPSync', 'minioS3Endpoint', 'keycloakBaseUrl', 'elasticsearchConnectionURL']);
    const expose = {};
    for (const [key, value] of Object.entries(compose.services.cypress.environment || {})) {
        const name = key.replace(/^CYPRESS_/, '');
        if (key.startsWith('CYPRESS_') && allowed.has(name)) expose[name] = value === 'true' ? true : value === 'false' ? false : value;
    }
    expose.serverEdition = edition === 'team' ? 'Team' : 'E20';
    return expose;
}
export async function harness(item, cwd, output, signal) {
    const metadata = validateEnvironment(item);
    const file = testPath(item.framework, item.file); const dir = resolve(cwd, `e2e-tests/${item.framework}`); const spec = file.replace(`e2e-tests/${item.framework}/`, '');
    const env = {...harnessEnv(), CI: 'true', TZ: 'Etc/UTC', SERVER_IMAGE: item.image_digest, SERVER: 'onprem', TEST: item.framework, BRANCH: 'master', BUILD_ID: `triage-${item.id}`, CI_BASE_URL: 'localhost'};
    if (!metadata.license_secret_present) delete env.MM_LICENSE;
    Object.assign(env, item.framework === 'playwright' ? {PW_USE_TESTCONTAINERS: 'true', PW_TESTCONTAINERS_REUSE: 'true', PW_TESTCONTAINERS_SERVICES: metadata.testcontainers_services, PW_WORKERS: '1'} : {ENABLED_DOCKER_SERVICES: metadata.enabled_docker_services, CYPRESS_retries: '0'});
    async function cmd(command, args, where = cwd) { return run(command, args, {cwd: where, env, signal}); }
    await cmd('docker', ['info']); await cmd('docker', ['pull', '--platform=linux/amd64', item.image_digest]);
    const image = JSON.parse((await cmd('docker', ['image', 'inspect', item.image_digest])).stdout)[0];
    invariant(image.RepoDigests.includes(item.image_digest) && image.Architecture === 'amd64', 'Pulled image differs from recorded amd64 digest');
    await cmd('make', ['node_modules'], resolve(cwd, 'webapp'));
    await cmd('npm', ['ci'], dir);
    const version = JSON.parse(await readFile(resolve(dir, `node_modules/${item.framework === 'playwright' ? '@playwright/test' : 'cypress'}/package.json`), 'utf8')).version;
    invariant((metadata.playwright_version || metadata.cypress_version).trim().replace(/^Version /, '') === version, 'Installed framework version differs from evidence');
    let runnerImage; let cypressExpose;
    if (item.framework === 'playwright') {
        await cmd('npx', ['--no-install', 'playwright', 'install', '--with-deps', item.project === 'firefox' ? 'firefox' : 'chromium'], dir);
        const tag = `mcr.microsoft.com/playwright:v${version}-noble`;
        await cmd('docker', ['pull', '--platform=linux/amd64', tag]);
        runnerImage = JSON.parse((await cmd('docker', ['image', 'inspect', tag])).stdout)[0].RepoDigests[0];
        // Preserve existing test/project/use settings. Trusted host setup already
        // provisioned the exact stack; candidate code gets no Docker authority.
        await writeFile(resolve(dir, '.triage.config.ts'), `import base from './playwright.config';\nexport default {...base, globalSetup: undefined, globalTeardown: undefined, retries: 0, workers: 1, projects: base.projects?.map(p => ({...p, dependencies: []}))};\n`);
    } else {
        await writeFile(resolve(dir, '.triage.config.ts'), `import base from './cypress.config';\nexport default {...base, retries: 0, expose: {...base.expose, ...JSON.parse(process.env.MM_E2E_EXPOSE || '{}')}};\n`);
    }
    const candidate = resolve(output, 'candidate-source.' + (item.framework === 'playwright' ? 'ts' : file.split('.').at(-1)));
    await mkdir(output, {recursive: true}); await writeFile(candidate, await readFile(resolve(cwd, file)));
    async function cleanup(name) {
        const options = {cwd: dir, env, signal: AbortSignal.timeout(60000), allowFailure: true};
        await run('docker', ['rm', '-f', name], options);
        const stopped = item.framework === 'playwright' ? await run('npm', ['run', 'testcontainers:down'], options) : await run('docker', ['compose', '-p', 'mmserver', '-f', 'server.yml', 'down', '-v', '--remove-orphans'], {...options, cwd: resolve(cwd, 'e2e-tests/.ci')});
        invariant(stopped.code === 0, 'Trusted test stack teardown failed');
    }
    return {candidate, async apply(source) { await writeFile(candidate, source); }, async execute(label) {
        const folder = resolve(output, label); await mkdir(folder, {recursive: true});
        const name = `mm-triage-${randomUUID()}`;
        try {
            if (item.framework === 'playwright') await cmd('npx', ['--no-install', 'playwright', 'test', '--project=setup', '--retries=0'], dir);
            else {
                await cmd('make', ['cloud-init'], resolve(cwd, 'e2e-tests'));
                await cmd('make', ['start-server'], resolve(cwd, 'e2e-tests'));
                const compose = JSON.parse((await cmd('docker', ['compose', '-p', 'mmserver', '-f', 'server.yml', 'config', '--format', 'json'], resolve(cwd, 'e2e-tests/.ci'))).stdout);
                runnerImage = JSON.parse((await cmd('docker', ['image', 'inspect', compose.services.cypress.image])).stdout)[0].RepoDigests[0];
                cypressExpose = cypressRuntime(compose, metadata.server_edition);
            }
            invariant(digestPattern.test(runnerImage), 'Runner image must resolve to a pullable digest');
            const running = (await cmd('docker', ['ps', '-q', '--filter', `ancestor=${item.image_digest}`])).stdout.trim().split(/\s+/).filter(Boolean);
            invariant(running.length === 1, 'Expected one running server from the recorded digest');
            const actual = JSON.parse((await cmd('docker', ['inspect', running[0]])).stdout)[0];
            invariant(actual.Image === image.Id, 'Running server differs from recorded image');
            const runtime = {};
            const paths = item.framework === 'playwright' ? ['results', 'test-results', 'logs', 'storage_state'] : ['results', 'tests/screenshots', 'tests/videos', 'tests/downloads', 'logs'];
            for (const path of paths) {
                const target = resolve(folder, path); await mkdir(target, {recursive: true});
                await mkdir(resolve(dir, path), {recursive: true});
                if (path === 'storage_state') await cp(resolve(dir, path), target, {recursive: true});
                runtime[path] = target;
            }
            const config = {CI: 'true', TZ: 'Etc/UTC', HOME: '/tmp', XDG_CONFIG_HOME: '/tmp/xdg', PW_USE_TESTCONTAINERS: 'false', PW_HEADLESS: 'true', PW_WORKERS: '1', CYPRESS_CACHE_FOLDER: '/cypress-cache', CYPRESS_retries: '0'};
            if (item.framework === 'cypress') config.MM_E2E_EXPOSE = JSON.stringify(cypressExpose);
            let command;
            if (item.framework === 'playwright') command = ['node', 'node_modules/@playwright/test/cli.js', 'test', '--config', '.triage.config.ts', '--project', item.project, '--no-deps', '--retries=0', '--workers=1', spec];
            else command = ['node', 'node_modules/cypress/bin/cypress', 'run', '--posix-exit-codes', '--config-file', '.triage.config.ts', '--browser', 'electron', '--config', 'retries=0', '--reporter', 'cypress-multi-reporters', '--reporter-options', 'configFile=reporter-config.json', '--spec', spec];
            const args = sandboxArgs({name, image: runnerImage, cwd, file, candidate, config, runtime, framework: item.framework, cache: resolve(process.env.HOME, '.cache/Cypress'), command});
            if (item.framework === 'cypress') args.splice(args.indexOf('--entrypoint'), 0, '--env', 'TSIO_CYPRESS_ATTEMPTS_DIR=/work/e2e-tests/cypress/results/attempts');
            const result = await run('docker', args, {cwd: dir, env, signal, allowFailure: true});
            let report;
            if (item.framework === 'playwright') report = await readJSON(folder, resolve(folder, 'results/reporter/results.json'));
            else {
                report = await readJSON(folder, resolve(folder, `results/mochawesome-report/json/tests/${basename(spec).replace(/\.(js|ts)$/, '')}.json`));
                const sidecar = await readJSON(folder, resolve(folder, 'results/attempts', createHash('sha256').update(spec).digest('hex') + '.json'));
                invariant(sidecar.schema_version === 1 && sidecar.spec_path === spec, 'Cypress attempt sidecar spec mismatch');
                mergeAttempts(report, sidecar);
            }
            await artifact(folder, 'report.json', report);
            await artifact(folder, 'execution.json', {exit_code: result.code, image_digest: item.image_digest, runner_image_digest: runnerImage, commit_sha: item.commit_sha, retries: 0, isolation: 'docker-no-socket-no-host-pid-readonly-source'});
            const tests = reportTests(item.framework, report, item.project, item.file, result.code);
            return tests;
        } finally { await cleanup(name); }
    }};
}
export function mergeAttempts(report, sidecar) {
    invariant(Array.isArray(sidecar.tests), 'Missing actual Cypress after:spec attempts');
    const used = new Set();
    function walk(suite) {
        for (const test of suite.tests || []) {
            const match = sidecar.tests.filter(s => (Array.isArray(s.title) ? s.title.join(' ') : s.full_title || s.fullTitle) === test.fullTitle);
            invariant(match.length === 1 && Array.isArray(match[0].attempts), 'Cypress attempt identity missing or ambiguous');
            invariant(!used.has(match[0]), 'Duplicate Cypress test identity in report');
            used.add(match[0]);
            invariant(match[0].attempts.length && match[0].attempts.at(-1).state === test.state, 'Cypress final state/attempt mismatch');
            test.attempts = match[0].attempts;
        }
        for (const child of suite.suites || []) walk(child);
    }
    for (const suite of report.results || []) walk(suite);
    invariant(used.size === sidecar.tests.length, 'Cypress report omitted executed test identities');
}
