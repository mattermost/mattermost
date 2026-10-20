// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {logTestcontainers} from '../containers/log';

import {
    defineSplitMockFlags,
    getSplitMockState,
    setSplitMockFlags,
    setSplitMockSegments,
    waitForServerFeatureFlags,
} from './split_mock';
import type {FeatureFlagDefinition, FeatureFlagRule, FeatureFlagValue} from './split_mock';
import {getAdminClient} from './init';

import {testConfig} from '@/test_config';
import {wait} from '@/util';

/**
 * Sets the given feature flag(s) on the server if they aren't already, then verifies the running server reports
 * those values, skipping the test otherwise. Accepts either a single `(flagName, value)` pair or a
 * `{flagName: value}` map. Values are booleans, or strings for the string flags such as TestFeature.
 *
 * The server boots on its default flags, and this is the only way a spec changes them. The server takes its flags
 * from the mock Split service (the `splitmock` service, always started in Testcontainers mode), so a change reaches
 * the running server within its sync interval and nothing restarts. A change that doesn't arrive fails the test.
 * Against an external server (no Testcontainers) there is no mock: a flag that already has the value is fine, and
 * otherwise the test is skipped.
 *
 * Call via `pw.ensureFeatureFlag(...)`. Each spec file starts again from the defaults, so a flag a spec changed
 * never leaks into the next file.
 */
export async function ensureFeatureFlag(flagName: string, value: FeatureFlagValue): Promise<void>;
export async function ensureFeatureFlag(flags: Record<string, FeatureFlagValue>): Promise<void>;
export async function ensureFeatureFlag(
    flagNameOrFlags: string | Record<string, FeatureFlagValue>,
    value?: FeatureFlagValue,
): Promise<void> {
    const flags =
        typeof flagNameOrFlags === 'string' ? {[flagNameOrFlags]: value as FeatureFlagValue} : flagNameOrFlags;
    const flagEntries = Object.entries(flags);
    const describeFlags = () => flagEntries.map(([name, val]) => `${name}=${String(val)}`).join(', ');

    if (testConfig.splitMockEnabled) {
        await ensureThroughSplitMock(flagEntries, describeFlags);
        return;
    }

    try {
        const {adminClient} = await getAdminClient();
        const config = await adminClient.getConfig();

        const mismatched = flagEntries.filter(
            ([flagName, flagValue]) => String(config.FeatureFlags?.[flagName]) !== String(flagValue),
        );
        if (mismatched.length > 0) {
            test.skip(true, 'Skipping test - changing a feature flag requires PW_USE_TESTCONTAINERS=true');
        }
    } catch (error) {
        test.skip(true, `Skipping test - feature flag check (${describeFlags()}) failed: ${String(error)}`);
    }
}

async function ensureThroughSplitMock(
    flagEntries: Array<[string, FeatureFlagValue]>,
    describeFlags: () => string,
): Promise<void> {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getConfig();

    const mismatched = flagEntries.filter(
        ([flagName, flagValue]) => String(config.FeatureFlags?.[flagName]) !== String(flagValue),
    );
    if (mismatched.length === 0) {
        logTestcontainers(`feature flags already match (${describeFlags()}); nothing to change.`);
        return;
    }

    assertSyncedFromSplitMock(config);

    const wanted = Object.fromEntries(mismatched);
    // What each flag is now is what the server booted with, which reset restores for the next spec file.
    const before = Object.fromEntries(mismatched.map(([flagName]) => [flagName, config.FeatureFlags[flagName]]));
    await setSplitMockFlags(wanted, before);
    await waitForServerFeatureFlags(adminClient, wanted);
    logTestcontainers(`feature flags set through the mock Split service (${describeFlags()}); no restart.`);
}

// The server syncs flags from the mock Split service only when it was booted with a SplitKey, which the API
// reports as a masked value, never the key itself. A server that wasn't (e.g. a stack left running from before the
// service was on) would ignore the mock, and a restart is not an acceptable way around that, so stop with the fix.
function assertSyncedFromSplitMock(config: {ServiceSettings?: {SplitKey?: string}}): void {
    if (!config.ServiceSettings?.SplitKey) {
        throw new Error(
            'The mock Split service is enabled, but the running server was not booted to sync feature flags from it ' +
                '(ServiceSettings.SplitKey is empty). Run "npm run testcontainers:down" and start the stack again.',
        );
    }
}

/**
 * The key the server evaluates feature flags with, for targeting rules that name keys (see defineFeatureFlags()).
 * It is the server's diagnostic id, which is also what the client config reports as DiagnosticId.
 */
export async function getFeatureFlagKey(): Promise<string> {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getClientConfig();

    return config.DiagnosticId;
}

/**
 * Serves feature flags with targeting rules, like Split does: each flag has a default value and rules that give
 * other values to chosen keys, members of a segment, evaluations carrying certain attributes, or a percentage of
 * keys. Rules that only name keys apply first, the others in the order given. Waits until the server reports the
 * value its own key gets, so a rule naming getFeatureFlagKey() is in effect when this resolves. The server sends no
 * attributes, so a rule that needs one never matches it.
 *
 * Needs the mock Split service, and skips the test without it.
 */
export async function defineFeatureFlags(definitions: Record<string, FeatureFlagDefinition>): Promise<void> {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getConfig();
    if (!testConfig.splitMockEnabled) {
        test.skip(true, 'Skipping test - feature flag targeting requires the mock Split service (splitmock)');
        return;
    }
    assertSyncedFromSplitMock(config);

    const before = Object.fromEntries(Object.keys(definitions).map((name) => [name, config.FeatureFlags[name]]));
    await defineSplitMockFlags(definitions, before);

    const key = await getFeatureFlagKey();
    const {segments} = await getSplitMockState();
    const expected: Record<string, FeatureFlagValue> = {};
    let unpredictable = false;
    for (const [name, definition] of Object.entries(definitions)) {
        const value = expectedFlagValue(definition, key, segments);
        if (value === undefined) {
            unpredictable = true;
        } else {
            expected[name] = value;
        }
    }

    await waitForServerFeatureFlags(adminClient, expected);
    if (unpredictable) {
        // A percentage rule depends on how the key hashes, so there is no value to wait for. The change has reached
        // the server once a sync interval has passed, plus a moment to push and fetch it.
        // featureFlagSyncIntervalSeconds is in seconds and wait() takes milliseconds: 1s * 1000 + 2000ms = 3s by default.
        await wait(testConfig.featureFlagSyncIntervalSeconds * 1000 + 2000);
    }
}

// The value the server reports for a flag, which evaluates with its own key and no attributes, the way the mock
// Split service serves it: rules that only name keys come first, the rest follow in order. Undefined when a
// percentage rule between 1 and 99 decides, which depends on how the key hashes.
function expectedFlagValue(
    definition: FeatureFlagDefinition,
    key: string,
    segments: Record<string, string[]>,
): FeatureFlagValue | undefined {
    const rules = definition.rules ?? [];
    const keysOnly = (rule: FeatureFlagRule) =>
        Boolean(rule.keys?.length) && !rule.segment && !rule.attributes && rule.percentage === undefined;

    const whitelisted = rules.find((rule) => keysOnly(rule) && rule.keys?.includes(key));
    if (whitelisted) {
        return whitelisted.value;
    }

    for (const rule of rules.filter((candidate) => !keysOnly(candidate))) {
        if (rule.keys?.length && !rule.keys.includes(key)) {
            continue;
        }
        if (rule.segment && !segments[rule.segment]?.includes(key)) {
            continue;
        }
        if (rule.attributes && Object.keys(rule.attributes).length > 0) {
            continue;
        }
        if (rule.percentage !== undefined && rule.percentage < 100) {
            if (rule.percentage <= 0) {
                continue;
            }
            return undefined;
        }

        return rule.value;
    }

    return definition.value;
}

/** Defines the segments that feature flag rules can refer to, with the keys in each. */
export async function setFeatureFlagSegments(segments: Record<string, string[]>): Promise<void> {
    await setSplitMockSegments(segments);
}
