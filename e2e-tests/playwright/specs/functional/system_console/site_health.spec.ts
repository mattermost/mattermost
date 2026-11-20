// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFile} from 'node:fs/promises';

import type {Client4} from '@mattermost/client';

import {duration, expect, licenseTier, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

const PROFESSIONAL_TIER = 10;
const ENTERPRISE_TIER = 20;

// The server picks up a new run within 15 seconds, and a test runs up to four of them.
test.describe.configure({timeout: duration.four_min});

type ConfigPatch = Parameters<Client4['patchConfig']>[0];

// Rules that config alone switches on and off without breaking the server.
const SESSION_EXTEND_OFF = {
    code: 'SESSION_EXTEND_OFF',
    title: 'ExtendSessionLengthWithActivity is disabled',
    fire: {ServiceSettings: {ExtendSessionLengthWithActivity: false}},
    clear: {ServiceSettings: {ExtendSessionLengthWithActivity: true}},
};

const LOG_WEBHOOK_PAYLOADS = {
    code: 'LOG_WEBHOOK_PAYLOADS',
    title: 'Webhook payloads are logged',
    fire: {LogSettings: {EnableWebhookDebugging: true}},
};

// Internal-only: evaluated and stored, but never returned to the product.
const LOG_DEBUG_PROD = {
    code: 'LOG_DEBUG_PROD',
    title: 'File logging at debug or trace level',
    fire: {LogSettings: {FileLevel: 'DEBUG'}},
};

// Never switched on by this spec.
const PLUGIN_HEALTH_OFF_TITLE = 'Plugin health check disabled';

async function getLicenseTier(adminClient: Client4) {
    const license = await adminClient.getClientLicenseOld();
    return licenseTier(license.SkuShortName);
}

async function skipUnlessLicensed(pw: PlaywrightExtended, tier: number) {
    const {adminClient} = await pw.getAdminClient();

    test.skip(
        (await getLicenseTier(adminClient)) < tier,
        tier === ENTERPRISE_TIER
            ? 'Skipping test - running the health check on demand needs an Enterprise or higher license'
            : 'Skipping test - server has no Professional or higher license',
    );
}

// Matches the server's health_check.StaleInProgressAfter: a run with no activity for this long belongs to a
// node that died mid-run, and the next run closes it as failed.
const STALE_RUN_AFTER = 15 * 60 * 1000;

/** Waits for any run already queued or running, so the next run starts from the current config. */
async function waitForIdleHealthCheck(adminClient: Client4) {
    await expect
        .poll(
            async () => {
                const jobs = await adminClient.getJobsByType('health_check', 0, 10);
                return jobs.filter(
                    (job) =>
                        job.status === 'pending' ||
                        (job.status === 'in_progress' && Date.now() - job.last_activity_at < STALE_RUN_AFTER),
                ).length;
            },
            {timeout: 60000},
        )
        .toBe(0);
}

/** Starts a health check run under the current config and waits for it to succeed. */
async function runHealthCheck(adminClient: Client4) {
    await waitForIdleHealthCheck(adminClient);
    const job = await adminClient.createJob({type: 'health_check'});
    await expect
        .poll(
            async () => {
                let latest;
                try {
                    latest = await adminClient.getJob(job.id);
                } catch (error) {
                    // Jobs are read from a replica, which may not have the new job yet.
                    if ((error as {status_code?: number}).status_code === 404) {
                        return 'pending';
                    }
                    throw error;
                }
                if (latest.status === 'error' || latest.status === 'canceled') {
                    throw new Error(
                        `Health check run ${job.id} ended as ${latest.status}: ${latest.data?.error ?? ''}`,
                    );
                }
                return latest.status;
            },
            {timeout: 60000},
        )
        .toMatch(/^(success|warning)$/);
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The logs query's date layout: ISO 8601 in UTC with a space for the T and the Z.
function formatLogFilterDate(time: number) {
    return new Date(time).toISOString().replace('T', ' ').replace('Z', ' +00:00');
}

async function getStoredFinding(adminClient: Client4, code: string) {
    const {findings} = await adminClient.getHealthFindings({muted: 'included'});
    return findings.find((finding) => finding.code === code);
}

async function getFingerprint(adminClient: Client4, code: string) {
    const finding = await getStoredFinding(adminClient, code);
    expect(finding, `${code} should have a stored finding`).toBeDefined();
    return finding!.fingerprint;
}

// The settings the tests switch, saved before each test and restored after it: resetConfig() leaves them alone.
let savedConfig: ConfigPatch;

test.beforeEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    const {ServiceSettings, LogSettings} = await adminClient.getConfig();

    savedConfig = {
        ServiceSettings: {ExtendSessionLengthWithActivity: ServiceSettings.ExtendSessionLengthWithActivity},
        LogSettings: {EnableWebhookDebugging: LogSettings.EnableWebhookDebugging, FileLevel: LogSettings.FileLevel},
    };
});

test.afterEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig(savedConfig);

    const tier = await getLicenseTier(adminClient);
    if (tier < PROFESSIONAL_TIER) {
        return;
    }

    // Mutes are stored with the finding and outlive the test.
    const {evaluated_at: evaluatedAt, findings} = await adminClient.getHealthFindings({muted: 'only'});
    const codes = [SESSION_EXTEND_OFF.code, LOG_WEBHOOK_PAYLOADS.code];
    for (const finding of findings.filter(({code}) => codes.includes(code))) {
        await adminClient.unmuteHealthFinding(finding.fingerprint);
    }

    // Resolve what the test switched on, so the next test starts from findings that match the config.
    // A server that was never evaluated has nothing to resolve, and stays that way for the first-run test.
    if (tier >= ENTERPRISE_TIER && evaluatedAt !== 0) {
        await runHealthCheck(adminClient);
    }
});

/**
 * @objective Verify a system admin can open the Site health page and it loads findings without an error,
 * with the HealthDashboard feature flag at its default (on).
 */
test('shows the Site health page to a system admin', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, PROFESSIONAL_TIER);

    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open Reporting > Site health
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify Site health replaces Workspace Optimization in the sidebar
    await expect(systemConsolePage.sidebar.reporting.siteHealth.link).toBeVisible();
    await expect(systemConsolePage.sidebar.reporting.workspaceOptimization.link).not.toBeVisible();

    await systemConsolePage.sidebar.reporting.siteHealth.click();

    // * Verify the page loaded its findings from the API, rather than the load error
    await systemConsolePage.siteHealth.toBeVisible();
});

/**
 * @objective Verify the first health check on a server can be started from the page, and the page shows
 * the run in progress and then its findings.
 *
 * @precondition
 * The server has never run the health check. Skipped otherwise, as there is no way to clear past runs, except
 * on a retry, which fails instead.
 */
test('runs the first health check from the page', {tag: '@system_console'}, async ({pw}, testInfo) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    const {evaluated_at: evaluatedAt} = await adminClient.getHealthFindings();
    test.skip(
        evaluatedAt !== 0 && testInfo.retry === 0,
        'Skipping test - the health check has already run on this server',
    );

    // A retry must not skip: the failed attempt is what ran the health check.
    expect(evaluatedAt, 'an earlier attempt already ran the health check').toBe(0);

    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;

    // # Open Site health
    await systemConsolePage.gotoSiteHealth();

    // * Verify the page says the server was never evaluated
    await expect(siteHealth.notEvaluated).toBeVisible();
    await expect(siteHealth.lastEvaluated).not.toBeVisible();

    // # Select Re-run checks
    await siteHealth.rerunButton.click();

    // * Verify the button shows the run in progress and can't start another
    await expect(siteHealth.runningButton).toBeDisabled();
    await expect(siteHealth.runningButton).toHaveAttribute('aria-busy', 'true');

    // * Verify the page shows the run's findings once it finishes
    await expect(siteHealth.lastEvaluated).toHaveText('Last evaluated just now', {timeout: 60000});
    await expect(siteHealth.notEvaluated).not.toBeVisible();
    await expect(siteHealth.rerunButton).toBeEnabled();
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).toBeVisible();
});

/**
 * @objective Verify a firing finding is listed in Open and in the tab for its severity, with its
 * severity, area and how long it has been firing.
 */
test('lists a firing finding in Open and in its severity tab', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;

    // # Open Site health and run the checks
    await systemConsolePage.gotoSiteHealth();
    await siteHealth.runChecks();

    // * Verify Open lists the finding under Info, with its area and how long it has been firing
    await expect(siteHealth.openTab).toHaveAttribute('aria-selected', 'true');
    const openRow = siteHealth.section('Info').finding(SESSION_EXTEND_OFF.title);
    await expect(openRow.container).toBeVisible();
    await expect(openRow.area).toHaveText('Authentication');
    // The finding may have been firing since before this test on a reused server.
    await expect(openRow.trend).toHaveText(/^Firing for (\d+d( \d+h)?|\d+h( \d+m)?|\d+m)$/);

    // # Select the Info tab
    await siteHealth.infoTab.click();

    // * Verify the Info tab lists the finding
    await expect(siteHealth.infoTab).toHaveAttribute('aria-selected', 'true');
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).toBeVisible();

    // # Group by category
    await siteHealth.groupByCategoryButton.click();

    // * Verify the finding is listed under Authentication with an Info badge
    const areaRow = siteHealth.area('Authentication').finding(SESSION_EXTEND_OFF.title);
    await expect(areaRow.container).toBeVisible();
    await expect(areaRow.severityBadge).toHaveText('Info');
});

/**
 * @objective Verify an expanded finding shows how to fix it and links to its documentation, and Go to
 * setting opens the setting in the System Console.
 */
test('shows how to fix a finding and opens its setting', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);
    await runHealthCheck(adminClient);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;

    // # Open Site health and expand the finding
    await systemConsolePage.gotoSiteHealth();
    const row = siteHealth.finding(SESSION_EXTEND_OFF.title);
    await row.expand();

    // * Verify the row shows how to fix it and links to the documentation
    await expect(row.remediationHeading).toBeVisible();
    await expect(
        row.container.getByText(
            'Enable ServiceSettings.ExtendSessionLengthWithActivity unless your security policy forbids it.',
        ),
    ).toBeVisible();
    await expect(row.openSettingLink).toHaveAttribute('href', /\/admin_console\/environment\/session_lengths$/);
    await expect(row.docsLink).toHaveAttribute('href', /configure-session-lengths/);

    // # Select Go to setting
    await row.goToSettingButton.click();

    // * Verify System Console > Session Lengths opens
    await expect(systemConsolePage.page).toHaveURL(/\/admin_console\/environment\/session_lengths$/);
    await systemConsolePage.header.toHaveTitle('Session Lengths');
});

/**
 * @objective Verify a finding whose setting is fixed moves from Open to Recently resolved after the next
 * run, a check that never fired is not listed as resolved, and a finding that fires again shows when it
 * was first detected.
 */
test('moves a fixed finding to Recently resolved', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    const hadPluginHealthFinding = Boolean(await getStoredFinding(adminClient, 'PLUGIN_HEALTH_OFF'));
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);
    await runHealthCheck(adminClient);
    const firstSeenAt = (await getStoredFinding(adminClient, SESSION_EXTEND_OFF.code))!.first_seen_at;

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;
    await systemConsolePage.gotoSiteHealth();
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).toBeVisible();

    // # Fix the setting and run the checks again
    await adminClient.patchConfig(SESSION_EXTEND_OFF.clear);
    await siteHealth.runChecks();

    // * Verify the finding is no longer open
    await expect(siteHealth.openTab).toHaveAttribute('aria-selected', 'true');
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();

    // # Select Recently resolved
    await siteHealth.resolvedTab.click();

    // * Verify the finding is listed as resolved just now, with its severity
    const resolvedRow = siteHealth.section('Recently resolved').finding(SESSION_EXTEND_OFF.title);
    await expect(resolvedRow.trend).toHaveText('Resolved just now');
    await resolvedRow.expand();
    await expect(resolvedRow.detail('Severity')).toHaveText('Info');

    // * Verify a check that never fired has no finding and is not listed as resolved, unless the server already
    // * had one for it
    if (!hadPluginHealthFinding) {
        expect(await getStoredFinding(adminClient, 'PLUGIN_HEALTH_OFF')).toBeUndefined();
        await expect(siteHealth.finding(PLUGIN_HEALTH_OFF_TITLE).container).not.toBeVisible();
    }

    // # Break the setting again and run the checks
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);
    await siteHealth.openTab.click();
    await siteHealth.runChecks();

    // * Verify the finding is open again and shows when it was first detected, not when it fired again
    const refired = await getStoredFinding(adminClient, SESSION_EXTEND_OFF.code);
    expect(refired!.first_seen_at).toBe(firstSeenAt);
    expect(refired!.state_since).toBeGreaterThan(firstSeenAt);

    const refiredRow = siteHealth.finding(SESSION_EXTEND_OFF.title);
    await refiredRow.expand();
    const firstDetected = refiredRow.detail('First detected');
    await expect(firstDetected).toHaveText(
        new RegExp(`^[A-Z][a-z]+ \\d{1,2}, ${new Date(firstSeenAt).getFullYear()}$`),
    );

    // The datetime is local time without an offset, so it is parsed in the browser that wrote it.
    const shownAt = await firstDetected
        .locator('time')
        .evaluate((time: HTMLTimeElement) => new Date(time.getAttribute('datetime')!).getTime());
    expect(shownAt).toBe(firstSeenAt);
});

/**
 * @objective Verify muting a finding moves it from Open to Muted, credited to the admin who muted it, and
 * it stays muted after a reload and another run.
 */
test('keeps a muted finding muted across reloads and runs', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);
    await runHealthCheck(adminClient);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;
    await systemConsolePage.gotoSiteHealth();

    // # Mute the finding
    await siteHealth.finding(SESSION_EXTEND_OFF.title).muteButton.click();

    // * Verify the finding leaves Open and the server stores the mute
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();
    await expect
        .poll(async () => (await getStoredFinding(adminClient, SESSION_EXTEND_OFF.code))?.muted_at ?? 0)
        .toBeGreaterThan(0);

    // # Reload the page
    await systemConsolePage.page.reload();
    await siteHealth.toBeVisible();

    // * Verify the finding is still not open
    await expect(siteHealth.openTab).toHaveAttribute('aria-selected', 'true');
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();

    // # Open Muted
    await siteHealth.mutedToggle.click();

    // * Verify the finding is listed as muted by the admin just now
    const mutedRow = siteHealth.finding(SESSION_EXTEND_OFF.title);
    await expect(mutedRow.mutedBy).toHaveText(`Muted by @${adminUser.username} just now`);

    // # Run the checks again
    await siteHealth.runChecks();

    // * Verify the run kept the finding muted
    expect((await getStoredFinding(adminClient, SESSION_EXTEND_OFF.code))?.muted_at).toBeGreaterThan(0);
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).mutedBy).toHaveText(
        new RegExp(`^Muted by @${escapeRegExp(adminUser.username)} `),
    );
    await siteHealth.openTab.click();
    await expect(siteHealth.openTab).toHaveAttribute('aria-selected', 'true');
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();
});

/**
 * @objective Verify unmuting a muted finding returns it to Open.
 */
test('returns an unmuted finding to Open', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);
    await runHealthCheck(adminClient);
    await adminClient.muteHealthFinding(await getFingerprint(adminClient, SESSION_EXTEND_OFF.code));

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;
    await systemConsolePage.gotoSiteHealth();
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();

    // # Open Muted and unmute the finding
    await siteHealth.mutedToggle.click();
    await siteHealth.finding(SESSION_EXTEND_OFF.title).unmuteButton.click();

    // * Verify the finding leaves Muted and the server stores the unmute
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();
    await expect
        .poll(async () => (await getStoredFinding(adminClient, SESSION_EXTEND_OFF.code))?.muted_at ?? 0)
        .toBe(0);

    // # Select Open
    await siteHealth.openTab.click();

    // * Verify the finding is open again
    const row = siteHealth.finding(SESSION_EXTEND_OFF.title);
    await expect(row.muteButton).toBeVisible();
    await expect(row.mutedBy).not.toBeVisible();

    // # Reload the page
    await systemConsolePage.page.reload();
    await siteHealth.toBeVisible();

    // * Verify the server kept the finding unmuted
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).muteButton).toBeVisible();
});

/**
 * @objective Verify a finding muted by one system admin is muted for every system admin, credited to the
 * admin who muted it.
 */
test('shows a mute to every system admin', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig(SESSION_EXTEND_OFF.fire);
    await runHealthCheck(adminClient);
    await adminClient.muteHealthFinding(await getFingerprint(adminClient, SESSION_EXTEND_OFF.code));

    const otherAdmin = await pw.createNewUserProfile(adminClient, {prefix: 'admin'});
    await adminClient.updateUserRoles(otherAdmin.id, 'system_user system_admin');

    // # Open Site health as another system admin
    const {systemConsolePage} = await pw.testBrowser.login(otherAdmin);
    const siteHealth = systemConsolePage.siteHealth;
    await systemConsolePage.gotoSiteHealth();

    // * Verify the finding is not open
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();

    // # Open Muted
    await siteHealth.mutedToggle.click();

    // * Verify the finding is muted, credited to the first admin
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).mutedBy).toHaveText(
        new RegExp(`^Muted by @${escapeRegExp(adminUser.username)} `),
    );
});

/**
 * @objective Verify each severity tab lists only findings of its severity, and grouping by category lists
 * each area with its number of findings.
 */
test('filters findings by severity and groups them by category', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig({...SESSION_EXTEND_OFF.fire, ...LOG_WEBHOOK_PAYLOADS.fire});
    await runHealthCheck(adminClient);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;
    await systemConsolePage.gotoSiteHealth();

    // # Select the Info tab
    await siteHealth.infoTab.click();

    // * Verify it lists the Info finding and not the Warning one
    await expect(siteHealth.infoTab).toHaveAttribute('aria-selected', 'true');
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).toBeVisible();
    await expect(siteHealth.finding(LOG_WEBHOOK_PAYLOADS.title).container).not.toBeVisible();

    // # Select the Warning tab
    await siteHealth.warningTab.click();

    // * Verify it lists the Warning finding and not the Info one
    await expect(siteHealth.warningTab).toHaveAttribute('aria-selected', 'true');
    await expect(siteHealth.finding(LOG_WEBHOOK_PAYLOADS.title).container).toBeVisible();
    await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).not.toBeVisible();

    // # Select Open and group by category
    await siteHealth.openTab.click();
    await siteHealth.groupByCategoryButton.click();

    // * Verify each area lists its finding and counts every open finding in it, including any the server
    // * already had
    const {findings} = await adminClient.getHealthFindings();
    const openIn = (area: string) =>
        findings.filter((finding) => finding.area === area && ['firing', 'unknown'].includes(finding.state)).length;

    for (const [label, area, rule, otherRule] of [
        ['Authentication', 'auth', SESSION_EXTEND_OFF, LOG_WEBHOOK_PAYLOADS],
        ['Platform', 'platform', LOG_WEBHOOK_PAYLOADS, SESSION_EXTEND_OFF],
    ] as const) {
        const section = siteHealth.area(label);
        const count = openIn(area);
        await expect(section.count).toHaveText(`${count} ${count === 1 ? 'finding' : 'findings'}`);
        await section.expand();
        await expect(section.finding(rule.title).container).toBeVisible();
        await expect(section.finding(otherRule.title).container).not.toBeVisible();
    }
});

/**
 * @objective Verify Last evaluated moves forward when the checks run again.
 */
test('updates Last evaluated after another run', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await runHealthCheck(adminClient);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;
    await systemConsolePage.gotoSiteHealth();
    const before = await siteHealth.lastEvaluatedTime.getAttribute('datetime');

    // # Run the checks again
    await siteHealth.runChecks();

    // * Verify Last evaluated is later than before
    const after = await siteHealth.lastEvaluatedTime.getAttribute('datetime');
    expect(Date.parse(after!)).toBeGreaterThan(Date.parse(before!));
});

/**
 * @objective Verify a finding from an internal-only rule is never shown on the page, though the rule fires.
 */
test('never shows internal-only findings', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();

    // # Evaluate with file logging below debug, so the rule fires for the first time in the run under test
    await adminClient.patchConfig({LogSettings: {FileLevel: 'INFO'}});
    await runHealthCheck(adminClient);

    const startedAt = Date.now();
    await adminClient.patchConfig({...LOG_DEBUG_PROD.fire, ...SESSION_EXTEND_OFF.fire});

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;

    // # Open Site health and run the checks
    await systemConsolePage.gotoSiteHealth();
    await siteHealth.runChecks();

    // * Verify the rule fired: the run logs each change of state at debug level, which the file log now keeps
    await expect
        .poll(async () => {
            const logsByNode = await adminClient.getLogs({
                server_names: [],
                log_levels: [],
                date_from: formatLogFilterDate(startedAt - 5000),
                date_to: '',
                fields: {msg: ['Health finding changed state'], code: [LOG_DEBUG_PROD.code], to: ['firing']},
            });
            return Object.values(logsByNode).flat().length;
        })
        .toBeGreaterThan(0);

    // * Verify the findings API doesn't return it
    expect(await getStoredFinding(adminClient, LOG_DEBUG_PROD.code)).toBeUndefined();

    // * Verify Open and Info list the product finding that fired with it, but not the internal one
    for (const tab of [siteHealth.openTab, siteHealth.infoTab]) {
        await tab.click();
        await expect(siteHealth.finding(SESSION_EXTEND_OFF.title).container).toBeVisible();
        await expect(siteHealth.finding(LOG_DEBUG_PROD.title).container).not.toBeVisible();
    }
});

/**
 * @objective Verify a delegated admin without the manage_system permission can't reach Site health, though
 * they can open the System Console.
 */
test('hides Site health from admins without manage_system', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, PROFESSIONAL_TIER);

    const {adminClient, user, userClient} = await pw.initSetup();
    await adminClient.updateUserRoles(user.id, 'system_user system_manager');

    const {systemConsolePage} = await pw.testBrowser.login(user);

    // # Open the System Console as a system manager
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify Site health is not listed among the Reporting pages they can open
    await expect(systemConsolePage.sidebar.reporting.teamStatistics.link).toBeVisible();
    await expect(systemConsolePage.sidebar.reporting.siteHealth.link).not.toBeVisible();

    // # Go straight to the Site health URL
    await systemConsolePage.page.goto('/admin_console/reporting/site_health');

    // * Verify they land on another System Console page instead
    await expect(systemConsolePage.page).toHaveURL(/\/admin_console\/(?!reporting\/site_health)/);
    await expect(systemConsolePage.header.title).toBeVisible();
    await expect(systemConsolePage.header.title).not.toHaveText('Site health');

    // * Verify the findings API refuses them
    await expect(userClient.getHealthFindings()).rejects.toMatchObject({status_code: 403});
});

/**
 * @objective Verify a system admin can download the Site health findings as an HTML report that is named
 * after the site and the date and contains a known finding.
 */
test('downloads the Site health findings as HTML', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessLicensed(pw, ENTERPRISE_TIER);

    const {adminUser, adminClient} = await pw.initSetup();
    await adminClient.patchConfig(LOG_WEBHOOK_PAYLOADS.fire);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const siteHealth = systemConsolePage.siteHealth;
    const {page} = systemConsolePage;

    // # Open Site health and run the checks
    await systemConsolePage.gotoSiteHealth();
    await siteHealth.runChecks();

    // * Verify the finding is listed
    await expect(siteHealth.finding(LOG_WEBHOOK_PAYLOADS.title).container).toBeVisible();

    // # Download the HTML export
    await page.getByTestId('healthDashboardExportButton').click();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('menuitem', {name: 'Download HTML'}).click(),
    ]);

    // * Verify the file name and that the report contains the finding
    expect(download.suggestedFilename()).toMatch(/^mm_site_health_.+_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.html$/);
    const html = await readFile(await download.path(), 'utf8');
    expect(html).toContain(LOG_WEBHOOK_PAYLOADS.title);
});
