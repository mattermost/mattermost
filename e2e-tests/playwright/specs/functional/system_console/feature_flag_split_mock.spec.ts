// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {ensureDefaultServerEnv, expect, flagPropagationTimeoutMs, test, testConfig} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

const execFileAsync = promisify(execFile);

// TestFeature and TestBoolFeature exist only so tests can change a flag: TestFeature is a string flag ("off" by
// default, reported by the ping endpoint when it isn't "off"), TestBoolFeature a bool flag that is false by default.
const DEFAULTS = {TestFeature: 'off', TestBoolFeature: 'false'};

test.describe('feature flags through the mock Split service', () => {
    test.beforeEach(async () => {
        test.skip(
            !testConfig.splitMockEnabled,
            'Skipping test - needs the mock Split service (PW_USE_TESTCONTAINERS=true with the splitmock service)',
        );

        // The fixture puts flags back once per spec file, so start each test here from the defaults too.
        await ensureDefaultServerEnv();
    });

    // Identifies the running server container and when it started, so a restart can't go unnoticed.
    async function serverProcess(): Promise<string> {
        const {stdout} = await execFileAsync('docker', [
            'inspect',
            '--format',
            '{{.Id}} {{.State.StartedAt}}',
            testConfig.mattermostContainerId,
        ]);

        return stdout.trim();
    }

    async function flags(pw: PlaywrightExtended): Promise<Record<string, unknown>> {
        const {adminClient} = await pw.getAdminClient();
        const config = await adminClient.getConfig();

        return config.FeatureFlags as unknown as Record<string, unknown>;
    }

    async function pingedTestFeature(): Promise<unknown> {
        const response = await fetch(`${testConfig.baseURL}/api/v4/system/ping`);
        return ((await response.json()) as Record<string, unknown>).TestFeatureFlag;
    }

    /**
     * @objective Verify the server is set up to take its flags from the mock Split service and to re-read them on the
     * configured sync interval, so a change never needs a restart.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('the server syncs flags on the configured interval', async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        const config = await adminClient.getConfig();

        // * Verify the synchronizer is on (the key is masked) and uses the interval the harness set
        expect(config.ServiceSettings.SplitKey).toBeTruthy();
        expect(config.ServiceSettings.FeatureFlagSyncIntervalSeconds).toBe(testConfig.featureFlagSyncIntervalSeconds);
    });

    /**
     * @objective Verify a flag change reaches the server within its sync interval, and that nothing is passed to
     * the server's environment or restarts it to get there.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('a change lands within the sync interval and never touches the server environment', async ({pw}) => {
        const before = await serverProcess();

        // # Change a flag and time how long the server takes to report it
        const startedAt = Date.now();
        await pw.ensureFeatureFlag('TestBoolFeature', true);
        const elapsed = Date.now() - startedAt;

        // * Verify it took no longer than the sync interval plus the time to push and fetch the change
        expect(elapsed).toBeLessThanOrEqual(flagPropagationTimeoutMs());
        expect(String((await flags(pw)).TestBoolFeature)).toBe('true');

        // * Verify the server was not restarted and no flag was passed to it as an environment variable
        expect(await serverProcess()).toBe(before);
        const {stdout} = await execFileAsync('docker', [
            'inspect',
            '--format',
            '{{json .Config.Env}}',
            testConfig.mattermostContainerId,
        ]);
        const env = JSON.parse(stdout) as string[];
        expect(env.filter((entry) => entry.startsWith('MM_FEATUREFLAGS_'))).toEqual([]);
        expect(Object.keys(testConfig.bootEnvOverrides).filter((key) => key.startsWith('MM_FEATUREFLAGS_'))).toEqual(
            [],
        );
    });

    /**
     * @objective Verify the server boots on its default feature flags, so a spec only sees a non-default value
     * after it asks for one through ensureFeatureFlag().
     *
     * @precondition
     * The mock Split service is running and no earlier spec file left a flag changed.
     */
    test('the server starts on the default flags', async ({pw}) => {
        const current = await flags(pw);

        // * Verify both test flags have their defaults
        expect(String(current.TestFeature)).toBe(DEFAULTS.TestFeature);
        expect(String(current.TestBoolFeature)).toBe(DEFAULTS.TestBoolFeature);
        expect(await pingedTestFeature()).toBeUndefined();
    });

    /**
     * @objective Verify a bool flag changes on the running server without restarting it.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('sets a bool flag without restarting the server', async ({pw}) => {
        const before = await serverProcess();

        // # Turn TestBoolFeature on
        await pw.ensureFeatureFlag('TestBoolFeature', true);

        // * Verify the server reports it, in its config and in the client config users read
        expect(String((await flags(pw)).TestBoolFeature)).toBe('true');
        const {adminClient} = await pw.getAdminClient();
        const clientConfig = (await adminClient.getClientConfig()) as unknown as Record<string, string>;
        expect(clientConfig.FeatureFlagTestBoolFeature).toBe('true');

        // * Verify the server was not restarted, and the other flag did not change
        expect(await serverProcess()).toBe(before);
        expect(String((await flags(pw)).TestFeature)).toBe(DEFAULTS.TestFeature);
    });

    /**
     * @objective Verify a string flag changes on the running server without restarting it, and that the
     * server reports the new value from the ping endpoint too.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('sets a string flag without restarting the server', async ({pw}) => {
        const before = await serverProcess();

        // # Set TestFeature to a value other than its default
        await pw.ensureFeatureFlag('TestFeature', 'on');

        // * Verify the config and the ping endpoint report it
        expect(String((await flags(pw)).TestFeature)).toBe('on');
        expect(await pingedTestFeature()).toBe('on');

        // # Set it to another value
        await pw.ensureFeatureFlag('TestFeature', 'experiment-b');

        // * Verify the new string comes through as is
        expect(String((await flags(pw)).TestFeature)).toBe('experiment-b');
        expect(await pingedTestFeature()).toBe('experiment-b');
        expect(await serverProcess()).toBe(before);
    });

    /**
     * @objective Verify several flags can be set in one call and change together.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('sets several flags at once', async ({pw}) => {
        const before = await serverProcess();

        // # Set both test flags with a single call
        await pw.ensureFeatureFlag({TestBoolFeature: true, TestFeature: 'on'});

        // * Verify the server reports both
        const current = await flags(pw);
        expect(String(current.TestBoolFeature)).toBe('true');
        expect(String(current.TestFeature)).toBe('on');
        expect(await serverProcess()).toBe(before);
    });

    /**
     * @objective Verify a flag can be turned on, off and on again within one spec file, which a boot-time
     * environment variable could only do by restarting the server each time.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('changes a flag back and forth', async ({pw}) => {
        const before = await serverProcess();

        for (const value of [true, false, true, false]) {
            // # Switch the flag
            await pw.ensureFeatureFlag('TestBoolFeature', value);

            // * Verify the server follows
            expect(String((await flags(pw)).TestBoolFeature)).toBe(String(value));
        }

        expect(await serverProcess()).toBe(before);
    });

    /**
     * @objective Verify asking for the value a flag already has does nothing.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('leaves a flag that already matches alone', async ({pw}) => {
        await pw.ensureFeatureFlag('TestBoolFeature', true);
        const before = await serverProcess();

        // # Ask for the same value again
        const startedAt = Date.now();
        await pw.ensureFeatureFlag('TestBoolFeature', true);

        // * Verify it returns at once, with the flag unchanged and the server not restarted
        expect(Date.now() - startedAt).toBeLessThan(5000);
        expect(String((await flags(pw)).TestBoolFeature)).toBe('true');
        expect(await serverProcess()).toBe(before);
    });

    /**
     * @objective Verify a change reaches the web app without a reload, since the server announces config changes
     * to connected clients.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('a flag change reaches a logged-in client', async ({pw}) => {
        const {user} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Change the flag while the page is open
        await pw.ensureFeatureFlag('TestBoolFeature', true);

        // * Verify the open page's client config now reports it
        await expect
            .poll(
                async () =>
                    (await page.evaluate(() => fetch('/api/v4/config/client?format=old').then((r) => r.json())))
                        .FeatureFlagTestBoolFeature,
            )
            .toBe('true');
    });

    /**
     * @objective Verify the flags a spec changed go back to the defaults when the next spec file starts, without
     * restarting the server.
     *
     * @precondition
     * The mock Split service is running.
     */
    test('restores the defaults for the next spec file', async ({pw}) => {
        await pw.ensureFeatureFlag({TestBoolFeature: true, TestFeature: 'on'});
        const before = await serverProcess();

        // # Do what the test fixture does before each spec file
        await ensureDefaultServerEnv();

        // * Verify both flags are back to the defaults, and the server kept running
        const current = await flags(pw);
        expect(String(current.TestBoolFeature)).toBe(DEFAULTS.TestBoolFeature);
        expect(String(current.TestFeature)).toBe(DEFAULTS.TestFeature);
        expect(await pingedTestFeature()).toBeUndefined();
        expect(await serverProcess()).toBe(before);
    });

    test.describe('targeting', () => {
        /**
         * @objective Verify a rule naming the server's own key gives a flag another value, the way a Split
         * targeting rule does, while other keys keep the default.
         *
         * @precondition
         * The mock Split service is running.
         */
        test('a rule for the server key overrides the default', async ({pw}) => {
            const key = await pw.getFeatureFlagKey();

            // # Give the server's key a different value than everyone else
            await pw.defineFeatureFlags({
                TestFeature: {value: 'off', rules: [{value: 'targeted', keys: [key]}]},
            });
            expect(String((await flags(pw)).TestFeature)).toBe('targeted');

            // # Aim the rule at some other key
            await pw.defineFeatureFlags({
                TestFeature: {value: 'off', rules: [{value: 'targeted', keys: ['someone-else']}]},
            });

            // * Verify this server falls back to the default
            await expect.poll(async () => String((await flags(pw)).TestFeature)).toBe('off');
        });

        /**
         * @objective Verify segment membership drives a flag, and that changing the segment later moves the flag
         * without redefining it.
         *
         * @precondition
         * The mock Split service is running.
         */
        test('a segment rule follows the segment members', async ({pw}) => {
            const key = await pw.getFeatureFlagKey();

            // # Define a flag for the members of a segment the server's key is not in yet
            await pw.setFeatureFlagSegments({'e2e-beta': ['someone-else']});
            await pw.defineFeatureFlags({
                TestFeature: {value: 'off', rules: [{value: 'beta', segment: 'e2e-beta'}]},
            });

            // * Verify a non-member gets the default
            expect(String((await flags(pw)).TestFeature)).toBe('off');

            // # Add the server's key to the segment
            await pw.setFeatureFlagSegments({'e2e-beta': ['someone-else', key]});

            // * Verify the flag follows the membership
            await expect.poll(async () => String((await flags(pw)).TestFeature)).toBe('beta');

            // # Take it out again
            await pw.setFeatureFlagSegments({'e2e-beta': ['someone-else']});

            // * Verify it reverts
            await expect.poll(async () => String((await flags(pw)).TestFeature)).toBe('off');
        });

        /**
         * @objective Verify a rule that needs an attribute the server doesn't send never matches, and that
         * redefining a flag without rules removes the earlier rules.
         *
         * @precondition
         * The mock Split service is running.
         */
        test('attribute rules and redefining a flag', async ({pw}) => {
            const key = await pw.getFeatureFlagKey();

            // # Define a flag whose only rule asks for an attribute the server does not send
            await pw.defineFeatureFlags({
                TestFeature: {value: 'off', rules: [{value: 'cloud', attributes: {installation_id: 'abc'}}]},
            });

            // * Verify the rule is skipped
            expect(String((await flags(pw)).TestFeature)).toBe('off');

            // # Add a rule for this server's key as well as that one, then drop the rules by redefining the flag
            await pw.defineFeatureFlags({
                TestFeature: {
                    value: 'off',
                    rules: [
                        {value: 'cloud', attributes: {installation_id: 'abc'}},
                        {value: 'keyed', keys: [key]},
                    ],
                },
            });
            expect(String((await flags(pw)).TestFeature)).toBe('keyed');
            await pw.defineFeatureFlags({TestFeature: {value: 'plain'}});

            // * Verify only the flag's own value is left
            await expect.poll(async () => String((await flags(pw)).TestFeature)).toBe('plain');
        });

        /**
         * @objective Verify a percentage rule gives every key the same answer on every evaluation, since it
         * buckets by a hash of the key, and that 100 percent reaches every key.
         *
         * @precondition
         * The mock Split service is running.
         */
        test('a percentage rule is stable for a key', async ({pw}) => {
            // # Give half of all keys another value
            await pw.defineFeatureFlags({
                TestFeature: {value: 'off', rules: [{value: 'half', percentage: 50}]},
            });
            const first = String((await flags(pw)).TestFeature);
            expect(['off', 'half']).toContain(first);

            // * Verify the same key keeps landing in the same bucket
            for (let i = 0; i < 3; i++) {
                expect(String((await flags(pw)).TestFeature)).toBe(first);
            }

            // # Widen the rule to every key
            await pw.defineFeatureFlags({
                TestFeature: {value: 'off', rules: [{value: 'everyone', percentage: 100}]},
            });

            // * Verify this server gets it too
            await expect.poll(async () => String((await flags(pw)).TestFeature)).toBe('everyone');
        });
    });
});
