// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Api, duration, expect, settle, test, type App, type PlaywrightExtended} from '@mattermost/playwright-lib';

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
    app: App;
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

    const {app} = await pw.testBrowser.login(adminUser);
    await app.adminConsolePage.goto();
    await expect(app.admin.sidebar).toBeVisible();

    return {adminClient, app, fields};
}

const SESSION_ATTRIBUTES_PATH = '/admin_console/system_attributes/session_attributes';

/** Opens System Console > Session Attributes, waiting for its rows. */
export async function openSessionAttributes(app: App): Promise<App['admin']['sessionAttributes']> {
    await app.page.goto(SESSION_ATTRIBUTES_PATH);
    const sa = app.admin.sessionAttributes;
    await expect(sa.rowList).not.toHaveKeyCount(0);
    return sa;
}

/**
 * Opens a row's actions menu. The row is centred first: one near the bottom of the table can only open its menu
 * upward, and the popover's flip and remeasure push its first paint (and its hover-opened submenus) past the usual
 * budget.
 */
export async function openActions(
    app: App,
    field: {id: string},
): Promise<App['admin']['sessionAttributes']['actionsMenu']> {
    const sa = app.admin.sessionAttributes;
    await sa.row(field.id).actionsButton.locator.evaluate((el) => el.scrollIntoView({block: 'center'}));
    await sa.row(field.id).actionsButton.click();
    await expect(sa.actionsMenu.enableMenuItem.locator.or(sa.actionsMenu.disableMenuItem.locator)).toBeVisible();
    return sa.actionsMenu;
}

/**
 * Stages a TTL or grace-period preset (in seconds) through the row's actions menu.
 *
 * The submenu opens on hover and collapses when the pointer leaves its trigger, so it's opened with the keyboard
 * (ArrowRight on the trigger) and the pointer never has to travel. The menu's mount and unmount transitions can
 * swallow a click or drop focus, so the whole open sequence retries, each attempt starting from Escape (closed).
 */
export async function choosePreset(app: App, field: {id: string}, kind: 'ttl' | 'grace', seconds: number) {
    const sa = app.admin.sessionAttributes;
    const menu = sa.actionsMenu;
    const trigger = kind === 'ttl' ? menu.ttlOptionsMenuItem : menu.graceOptionsMenuItem;
    const option = kind === 'ttl' ? menu.ttl(seconds) : menu.grace(seconds);
    await sa.row(field.id).actionsButton.locator.evaluate((el) => el.scrollIntoView({block: 'center'}));

    await expect(async () => {
        await app.page.keyboard.press('Escape');
        await expect(trigger).toBeHidden({timeout: duration.two_sec});
        await sa.row(field.id).actionsButton.click();
        await expect(trigger).toBeVisible({timeout: duration.two_sec});
        await trigger.press('ArrowRight');
        await expect(option).toBeVisible({timeout: duration.two_sec});
    }).toPass({timeout: duration.half_min, intervals: [250, 500, 1000]});

    // choosing a preset closes the whole menu; wait for it so a following menu opens clean
    await option.click();
    await expect(trigger).toBeHidden();
}

/**
 * Saves the staged edits and waits for the field's PATCH, then for Save to go back to disabled. It awaits one PATCH,
 * so it assumes the edits are on one field (as every test here stages).
 */
export async function saveAndSettle(app: App) {
    const save = app.admin.sessionAttributes.savePanel.saveButton;
    await expect(save).toBeEnabled();
    await settle(save, {wait: Api.UpdatePropertyField, params: {group_name: 'session_attributes'}}).click();
    await expect(save).toBeDisabled();
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
    return client.getPropertyFields(SESSION_ATTRIBUTES_GROUP, SESSION_ATTRIBUTES_OBJECT_TYPE, {
        targetType: SESSION_ATTRIBUTES_TARGET_TYPE,
    });
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
 * Restore a field's tunables to the captured values. Call it from an afterEach so each test leaves the seeded fields
 * in their original state and tests stay independent. A failing restore is reported, not hidden.
 */
export async function restoreSessionAttribute(client: Client4, field: PropertyField): Promise<void> {
    const attrs = (field.attrs ?? {}) as Record<string, unknown>;
    await patchSessionAttribute(client, field.id, {
        enabled: attrs.enabled === true,
        ttl_seconds: typeof attrs.ttl_seconds === 'number' ? attrs.ttl_seconds : undefined,
        grace_period_seconds: typeof attrs.grace_period_seconds === 'number' ? attrs.grace_period_seconds : undefined,
    });
}
