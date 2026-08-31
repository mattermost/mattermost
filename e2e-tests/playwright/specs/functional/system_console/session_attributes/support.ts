// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended, SystemConsolePage} from '@mattermost/playwright-lib';

export const SESSION_ATTRIBUTES_GROUP = 'session_attributes';
export const SESSION_ATTRIBUTES_OBJECT_TYPE = 'session';
export const SESSION_ATTRIBUTES_TARGET_TYPE = 'system';

export type SessionAttrPatch = Partial<{
    enabled: boolean;
    ttl_seconds: number;
    grace_period_seconds: number;
}>;

export interface SessionAttributesContext {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
    fields: PropertyField[];
}

/**
 * The seeded session_attributes Property group is gated server-side: requests
 * return HTTP 501 below an Enterprise Advanced license, and the System Console
 * page is hidden unless FeatureFlags.SessionAttributes is true. Probe both and
 * skip (rather than fail) when the environment does not satisfy them, so the
 * suite reports honestly on stacks that cannot exercise the feature.
 */
export async function setupSessionAttributesTest(pw: PlaywrightExtended): Promise<SessionAttributesContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();

    const config = await adminClient.getConfig();
    test.skip(
        config.FeatureFlags?.SessionAttributes !== true,
        'Requires FeatureFlags.SessionAttributes=true on the server',
    );

    let fields: PropertyField[] = [];
    try {
        fields = await getSessionAttributeFields(adminClient);
    } catch (error) {
        test.skip(
            true,
            `session_attributes property group unavailable (requires Enterprise Advanced license): ${String(error)}`,
        );
    }

    test.skip(fields.length === 0, 'No seeded session attributes returned by the server');

    captureSessionAttributesBaseline(adminClient, fields);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, systemConsolePage, fields};
}

/**
 * Baseline snapshot of every seeded session attribute, captured the first time
 * the suite sets up (before any test mutates state). Used by
 * restoreSessionAttributesToBaseline so the suite is order-independent: each
 * test returns the fields to this original state, so a field enabled by one
 * test cannot leak into another's assertions.
 */
let baselineFields: PropertyField[] | null = null;
let baselineClient: Client4 | null = null;

function captureSessionAttributesBaseline(client: Client4, fields: PropertyField[]): void {
    if (!baselineFields) {
        baselineFields = fields.map((field) => ({...field}));
        baselineClient = client;
    }
}

/**
 * Restore every seeded session attribute to the baseline captured at suite
 * start. Call from afterEach so tests that toggle enabled/ttl/grace cannot leak
 * state into later tests, regardless of execution order.
 */
export async function restoreSessionAttributesToBaseline(): Promise<void> {
    if (!baselineClient || !baselineFields) {
        return;
    }
    for (const field of baselineFields) {
        await restoreSessionAttribute(baselineClient, field);
    }
}

export async function getSessionAttributeFields(client: Client4): Promise<PropertyField[]> {
    return client.getPropertyFields(
        SESSION_ATTRIBUTES_GROUP,
        SESSION_ATTRIBUTES_OBJECT_TYPE,
        SESSION_ATTRIBUTES_TARGET_TYPE,
    );
}

export function findFieldByName(fields: PropertyField[], name: string): PropertyField {
    const field = fields.find((f) => f.name === name);
    expect(field, `Seeded session attribute "${name}" not found`).toBeDefined();
    return field as PropertyField;
}

export async function patchSessionAttribute(
    client: Client4,
    fieldId: string,
    attrs: SessionAttrPatch,
): Promise<PropertyField> {
    return client.patchPropertyField(SESSION_ATTRIBUTES_GROUP, SESSION_ATTRIBUTES_OBJECT_TYPE, fieldId, {attrs});
}

/**
 * Re-fetch a single field's tunable attrs from the server (source of truth for
 * persistence assertions).
 */
export async function readSessionAttribute(client: Client4, fieldId: string): Promise<SessionAttrPatch> {
    const fields = await getSessionAttributeFields(client);
    const field = fields.find((f) => f.id === fieldId);
    const attrs = (field?.attrs ?? {}) as Record<string, unknown>;
    return {
        enabled: attrs.enabled === true,
        ttl_seconds: typeof attrs.ttl_seconds === 'number' ? attrs.ttl_seconds : undefined,
        grace_period_seconds: typeof attrs.grace_period_seconds === 'number' ? attrs.grace_period_seconds : undefined,
    };
}

/**
 * Restore a field's tunables to the captured values. Use in a finally block so
 * each test leaves the seeded fields in their original state and tests stay
 * independent.
 */
export async function restoreSessionAttribute(client: Client4, field: PropertyField): Promise<void> {
    const attrs = (field.attrs ?? {}) as Record<string, unknown>;
    try {
        await patchSessionAttribute(client, field.id, {
            enabled: attrs.enabled === true,
            ttl_seconds: typeof attrs.ttl_seconds === 'number' ? attrs.ttl_seconds : undefined,
            grace_period_seconds:
                typeof attrs.grace_period_seconds === 'number' ? attrs.grace_period_seconds : undefined,
        });
    } catch {
        // Best-effort cleanup; ignore if the server rejects (e.g. license downgrade mid-run).
    }
}
