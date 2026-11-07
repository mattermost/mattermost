// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {testConfig} from '@/test_config';
import {wait} from '@/util';

export type FeatureFlagValue = boolean | string;

/** One targeting rule of a flag. Its conditions are AND-ed. Rules that only name keys apply first, then the rest in order. */
export type FeatureFlagRule = {
    /** The value the flag gets when this rule matches. */
    value: FeatureFlagValue;
    /** Evaluation keys the rule applies to. The server evaluates with its own id (see getFeatureFlagKey()). */
    keys?: string[];
    /** A segment (see setFeatureFlagSegments()) the key must belong to. */
    segment?: string;
    /** Attributes the evaluation must carry with exactly these values. */
    attributes?: Record<string, string>;
    /** Share of keys, 1-99 by hash of the key, that get `value`. The rest get the flag's own value. */
    percentage?: number;
};

export type FeatureFlagDefinition = {
    /** The value the flag has unless a rule matches. */
    value: FeatureFlagValue;
    rules?: FeatureFlagRule[];
};

const CONTROL_TIMEOUT_MS = 10_000;
// What a change needs besides the server's sync interval: the mock pushes it to the server's Split client, which
// fetches it, and the server saves the config once it reads the new value.
const FLAG_PROPAGATION_MARGIN_MS = 5000;
const FLAG_POLL_INTERVAL_MS = 250;

async function control<T>(path: string, init: {method: string; body?: unknown}): Promise<T> {
    const response = await fetch(`${testConfig.splitMockUrl}${path}`, {
        method: init.method,
        headers: {'Content-Type': 'application/json'},
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Mock Split service ${init.method} ${path} failed with ${response.status}.`);
    }

    return (await response.json()) as T;
}

/** Serves each flag with the same value to every key. `baseline` is what each had before, for reset to restore. */
export async function setSplitMockFlags(
    flags: Record<string, FeatureFlagValue>,
    baseline: Record<string, FeatureFlagValue>,
): Promise<void> {
    await control('/flags', {method: 'PUT', body: {set: flags, baseline}});
}

/** Serves each flag with its own default value and targeting rules. */
export async function defineSplitMockFlags(
    definitions: Record<string, FeatureFlagDefinition>,
    baseline: Record<string, FeatureFlagValue>,
): Promise<void> {
    await control('/flags', {method: 'PUT', body: {define: definitions, baseline}});
}

/** Defines segments by name with the keys in each, replacing any earlier members. */
export async function setSplitMockSegments(segments: Record<string, string[]>): Promise<void> {
    await control('/segments', {method: 'PUT', body: segments});
}

/** Puts every flag the specs changed back to its baseline and empties the segments. Resolves with what changed. */
export async function resetSplitMock(): Promise<Record<string, string>> {
    const {restored} = await control<{restored: Record<string, string>}>('/reset', {method: 'POST'});
    return restored;
}

export async function getSplitMockState(): Promise<{
    flags: Record<string, string>;
    rules: Record<string, FeatureFlagRule[]>;
    segments: Record<string, string[]>;
    baselines: Record<string, string>;
}> {
    return control('/flags', {method: 'GET'});
}

/** How long a flag change may take to reach the server: its sync interval, plus FLAG_PROPAGATION_MARGIN_MS. */
export function flagPropagationTimeoutMs(): number {
    return testConfig.featureFlagSyncIntervalSeconds * 1000 + FLAG_PROPAGATION_MARGIN_MS;
}

/**
 * Waits until the running server reports the given flag values. The mock pushes a change to the server's Split
 * client, which the server then reads on its next sync (testConfig.featureFlagSyncIntervalSeconds). Throws if the
 * server still reports something else once the sync interval and the propagation margin have passed, rather than
 * restarting the server to force it.
 */
export async function waitForServerFeatureFlags(
    adminClient: Client4,
    expected: Record<string, FeatureFlagValue>,
): Promise<void> {
    const timeoutMs = flagPropagationTimeoutMs();
    const deadline = Date.now() + timeoutMs;
    let actual: Record<string, unknown> = {};

    while (Date.now() < deadline) {
        const config = await adminClient.getConfig();
        actual = (config.FeatureFlags ?? {}) as unknown as Record<string, unknown>;
        if (Object.entries(expected).every(([name, value]) => String(actual[name]) === String(value))) {
            return;
        }
        await wait(FLAG_POLL_INTERVAL_MS);
    }

    const describe = (flags: Record<string, unknown>) =>
        Object.keys(expected)
            .map((name) => `${name}=${String(flags[name])}`)
            .join(', ');
    throw new Error(
        `Server still reports feature flags ${describe(actual)} ${timeoutMs / 1000}s after the mock Split service ` +
            `changed them to ${describe(expected)} (sync interval ${testConfig.featureFlagSyncIntervalSeconds}s plus ` +
            `${FLAG_PROPAGATION_MARGIN_MS / 1000}s).`,
    );
}
