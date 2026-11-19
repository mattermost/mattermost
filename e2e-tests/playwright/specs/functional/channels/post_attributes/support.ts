// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page, Request} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {FieldType, PropertyField, PropertyPermissionLevel} from '@mattermost/types/properties';

export const GROUP = 'post_attributes';
export const OBJECT_TYPE = 'post';

// Prefix on every field these specs create, so cleanup never touches a real one.
export const FIELD_PREFIX = 'postattr_e2e';

// The values endpoint the chips must never hit. Hydration is the whole point of the
// feature: the values ride on the post, so a per-post fetch means it regressed.
export const VALUES_ROUTE = `/api/v4/properties/groups/${GROUP}/${OBJECT_TYPE}/values/`;

// The query parameter that asks a posts endpoint to hydrate.
export const HYDRATION_PARAM = `propertyGroup=${GROUP}`;

export function fieldName(suffix: string, uniqueId: string): string {
    return `${FIELD_PREFIX}_${suffix}_${uniqueId}`;
}

type CreateOptions = {
    type?: FieldType;

    // A bare string is an option with no colour. The object form carries one — any
    // string, since the server stores options as opaque maps and validates only their
    // ids, so an unrecognised token reaches the client exactly as written.
    options?: Array<string | {name: string; color: string}>;

    // Omitted means system-scoped, which applies to every channel. A channel id
    // scopes the field to that channel only, and a team id to that team's channels
    // (and so never to a direct or group message).
    channelId?: string;
    teamId?: string;

    visibility?: 'always' | 'when_set' | 'hidden';
    sortOrder?: number;

    // Who may write a value. Omitted means the server's default, which for a
    // post-object field is `member` — so a field created without this is already
    // writable by any member of the channel, and only a field that needs to render
    // as read-only has to say anything here. `none` is the one level nobody
    // satisfies, including a system admin over HTTP.
    permissionValues?: PropertyPermissionLevel;
};

/**
 * Creates one post attribute field.
 *
 * Provisioned through the API rather than the UI because there is no admin UI for
 * post attribute fields yet — and the local `/post-attributes-seed` slash command must
 * never be committed, so it cannot back an E2E spec.
 */
export async function createField(
    adminClient: Client4,
    name: string,
    {type, options = [], channelId, teamId, visibility, sortOrder, permissionValues}: CreateOptions = {},
): Promise<PropertyField> {
    const attrs: Record<string, unknown> = {};

    if (options.length) {
        // The server fills in the ids; what comes back is the authority on them.
        attrs.options = options.map((option) => {
            if (typeof option === 'string') {
                return {id: '', name: option};
            }

            return {id: '', name: option.name, color: option.color};
        });
    }
    if (visibility) {
        attrs.visibility = visibility;
    }
    if (sortOrder !== undefined) {
        attrs.sort_order = sortOrder;
    }

    const field: Record<string, unknown> = {
        name,
        type: type ?? (options.length ? 'select' : 'text'),
        target_type: (channelId && 'channel') || (teamId && 'team') || 'system',
        target_id: channelId ?? teamId ?? '',
        attrs,
    };

    if (permissionValues) {
        field.permission_values = permissionValues;
    }

    return adminClient.createPropertyField(GROUP, OBJECT_TYPE, field as Parameters<Client4['createPropertyField']>[2]);
}

export function optionId(field: PropertyField, name: string): string {
    const options = (field.attrs?.options ?? []) as Array<{id: string; name: string}>;
    const match = options.find((option) => option.name === name);

    if (!match) {
        throw new Error(`option ${name} not found on ${field.name}`);
    }

    return match.id;
}

/**
 * Sets a post's values. `items` holds option ids for an option-bearing field and an
 * array of them for a multiselect.
 */
export async function setPostValues(
    client: Client4,
    postId: string,
    items: Array<{field_id: string; value: unknown}>,
): Promise<void> {
    await client.patchPropertyValues(GROUP, OBJECT_TYPE, postId, items as Array<{field_id: string; value: unknown}>);
}

export async function deleteFields(adminClient: Client4, fields: PropertyField[]): Promise<void> {
    for (const field of fields) {
        try {
            await adminClient.deletePropertyField(GROUP, OBJECT_TYPE, field.id);
        } catch {} // eslint-disable-line no-empty
    }
}

/**
 * Best-effort cleanup of fields an interrupted run left behind.
 *
 * Only the system scope is swept: a channel-scoped field belongs to a channel this run
 * created, so it dies with the fixture, while a system-scoped one applies everywhere
 * and would leak chips into an unrelated spec.
 */
export async function purgeFields(adminClient: Client4): Promise<void> {
    try {
        const fields = await adminClient.getPropertyFields(GROUP, OBJECT_TYPE, {targetType: 'system'});
        const stale = (fields ?? []).filter((field) => field.name.startsWith(FIELD_PREFIX) && field.delete_at === 0);

        await deleteFields(adminClient, stale);
    } catch {} // eslint-disable-line no-empty
}

/**
 * Collects the URLs of requests matching `fragment` into an array the caller asserts on.
 *
 * For asserting a request was *never* made, which `waitForResponse` cannot express — it
 * waits for something to happen, so the negative form is a timeout, and a timeout is a
 * guess about how long is long enough. Filtering here rather than at assert time keeps
 * the array small: a channel load makes hundreds of requests.
 *
 * Attach before the first navigation. The requests that matter are the ones the initial
 * channel load makes, and a listener added afterwards has already missed them.
 */
export function recordRequests(page: Page, fragment: string): string[] {
    const urls: string[] = [];

    page.on('request', (request: Request) => {
        if (request.url().includes(fragment)) {
            urls.push(request.url());
        }
    });

    return urls;
}

/**
 * Resolves with the request the composer sends to create a post. Arm it before the
 * click that sends, or the request is missed.
 *
 * Matches the path exactly, so the per-post values and reaction calls that share the
 * `/posts` prefix are not mistaken for it.
 */
export function waitForCreatePost(page: Page): Promise<Request> {
    return page.waitForRequest((request) => {
        return request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v4/posts');
    });
}

export type SentValue = {field_id: string; value: unknown};

/**
 * What a create-post request carried as `metadata.property_values`, or undefined when
 * the body has none.
 */
export function sentValues(request: Request): SentValue[] | undefined {
    return request.postDataJSON()?.metadata?.property_values;
}

/**
 * The composer-side locators for one field, scoped to one composer (centre or thread
 * sidebar): both can be on screen at once and carry the same test ids.
 */
export function composerChips(scope: Locator) {
    return scope.getByTestId('post-attributes-composer');
}

export function composerChip(scope: Locator, field: PropertyField) {
    return scope.getByTestId(`post-attribute-chip-${field.name}`);
}

export function composerRest(scope: Locator, field: PropertyField) {
    return scope.getByTestId(`post-attribute-rest-${field.name}`);
}

export function composerTrigger(scope: Locator, field: PropertyField) {
    return scope.getByTestId(`post-attribute-trigger-${field.name}`);
}

export function composerInput(scope: Locator, field: PropertyField) {
    return scope.getByTestId(`post-attribute-input-${field.name}`);
}

export function composerRemove(scope: Locator, field: PropertyField) {
    return scope.getByTestId(`post-attribute-remove-${field.name}`);
}

// The `+` in the action row, and the `Add attribute` control that follows the chips.
export function composerPlus(scope: Locator) {
    return scope.getByTestId('post-attributes-composer-add');
}

export function composerInlineAdd(scope: Locator) {
    return scope.getByTestId('post-attributes-add');
}

// The picker menu is portalled out of the composer, so it is found from the page.
export function pickerItem(page: Page, field: PropertyField) {
    return page.getByTestId(`post-attribute-add-${field.name}`);
}

/**
 * Stages a field by opening the `+` in the action row and choosing it from the
 * picker. A select field's value menu opens by itself afterwards, and a text or user
 * field's control takes focus.
 */
export async function stageField(page: Page, scope: Locator, field: PropertyField) {
    await composerPlus(scope).click();
    await pickerItem(page, field).click();
}

/**
 * Picks an option in the value menu a select, rank or multiselect chip has open. The
 * role differs by type: a multiselect's items are checkboxes and the others radios.
 */
export async function chooseOption(page: Page, name: string, {multi = false}: {multi?: boolean} = {}) {
    await page.getByRole(multi ? 'menuitemcheckbox' : 'menuitemradio', {name, exact: true}).click();
}

/**
 * The system-scoped fields on the server that this suite did not create. They are
 * not the suite's to touch, but they decide whether a case that needs "no other
 * field" can run.
 */
export async function foreignSystemFields(adminClient: Client4): Promise<PropertyField[]> {
    const fields = await adminClient.getPropertyFields(GROUP, OBJECT_TYPE, {targetType: 'system'});
    return (fields ?? []).filter((field) => !field.name.startsWith(FIELD_PREFIX) && field.delete_at === 0);
}
