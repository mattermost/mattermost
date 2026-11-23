// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page, Request} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';
import type {FieldType, PropertyField, PropertyPermissionLevel} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {getAdminClient, test} from '@mattermost/playwright-lib';
import type {ChannelsPage, ChannelsPost, PlaywrightExtended} from '@mattermost/playwright-lib';

export const GROUP = 'access_control';
export const OBJECT_TYPE = 'post';

// Templates and the user fields linked to them live in the same group as post fields, and
// count toward its 200-field limit, so a spec that makes them must delete them.
export const TEMPLATE_OBJECT_TYPE = 'template';
export const USER_OBJECT_TYPE = 'user';

// Prefix on every field these specs create, so cleanup never touches a real one.
export const FIELD_PREFIX = 'postattr_e2e';

// The values endpoint the chips must never hit. Hydration is the whole point of the
// feature: the values ride on the post, so a per-post fetch means it regressed.
export const VALUES_ROUTE = `/api/v4/properties/groups/${GROUP}/${OBJECT_TYPE}/values/`;

// The query parameter that asks a posts endpoint to hydrate.
export const HYDRATION_PARAM = `propertyGroup=${GROUP}`;

// The SKUs the webapp's `isPostAttributesEnabled` accepts. `hasEnterpriseLicense` is not
// used because it also accepts the legacy E20 SKU, which the webapp rejects.
const POST_ATTRIBUTES_SKUS = ['enterprise', 'advanced', 'entry'];

/**
 * Skips unless the server's licence enables post attributes. Mirrors the webapp's
 * `isPostAttributesEnabled`, so a Professional or E20 server skips instead of timing out
 * on a chip that never renders.
 */
export async function skipIfNoPostAttributesLicense() {
    const {adminClient} = await getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    test.skip(
        license.IsLicensed !== 'true' || !POST_ATTRIBUTES_SKUS.includes(license.SkuShortName),
        'Skipping test - server needs an Enterprise, Enterprise Advanced or Entry licence',
    );
}

export function fieldName(suffix: string, uniqueId: string): string {
    return `${FIELD_PREFIX}_${suffix}_${uniqueId}`;
}

type CreateOptions = {
    type?: FieldType;

    // A bare string is an option with no colour. The object form carries one — any
    // string, since the server stores options as opaque maps and validates only their
    // ids, so an unrecognised token reaches the client exactly as written.
    options?: Array<string | {name: string; color: string}>;

    visibility?: 'always' | 'when_set' | 'hidden';
    sortOrder?: number;

    // A text field's subtype: `channel`, `team`, `timestamp` or `post` store an id or an
    // epoch the chip resolves, and any other string is shown as plain text.
    subType?: string;

    // Who may write a value. Omitted means `creator`, what the System Console gives the
    // post field of an attribute that applies to posts: the post's author and an admin
    // of its channel. A test that needs another level says so. `none` is the one level
    // nobody satisfies, including a system admin over HTTP.
    permissionValues?: PropertyPermissionLevel;
};

// What the field's template is, by the id of the linked post field made from it. A linked
// field takes its type and options from the template and refuses options of its own, so
// whatever edits or deletes options has to find the template behind the field.
const templatesByPostField = new Map<string, PropertyField>();

/**
 * The template a post field made by `createField` is linked to.
 */
export function templateOf(field: PropertyField): PropertyField {
    const template = templatesByPostField.get(field.id);
    if (!template) {
        throw new Error(`no template recorded for ${field.name}`);
    }

    return template;
}

type OptionInput = string | {name: string; color: string};

// The server fills in the ids; what comes back is the authority on them. A rank field's
// options each need a rank.
function toOptionAttrs(options: OptionInput[], type: FieldType) {
    return options.map((option, index) => {
        const rank = type === 'rank' ? {rank: index + 1} : {};

        if (typeof option === 'string') {
            return {id: '', name: option, ...rank};
        }

        return {id: '', name: option.name, color: option.color, ...rank};
    });
}

/**
 * Creates a system-scoped template, the way the Global Attributes admin page does. It is
 * the definition: type and options live here, and the post field linked to it serves them.
 */
export async function createTemplate(
    adminClient: Client4,
    name: string,
    options: OptionInput[] = [],
    type: FieldType = 'select',
): Promise<PropertyField> {
    const attrs: Record<string, unknown> = {display_name: name};
    if (options.length) {
        attrs.options = toOptionAttrs(options, type);
    }

    return adminClient.createPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, {
        name,
        type,
        target_type: 'system',
        target_id: '',
        attrs,
    });
}

/**
 * Creates the post field linked to a template, the second request the Global Attributes
 * page sends. The type and options come from the template and are not sent.
 */
export async function createLinkedPostField(
    adminClient: Client4,
    template: PropertyField,
    name: string,
    {
        visibility,
        sortOrder,
        subType,
        permissionValues = 'creator',
    }: Pick<CreateOptions, 'visibility' | 'sortOrder' | 'subType' | 'permissionValues'> = {},
): Promise<PropertyField> {
    // No display_name: it is the template's, and a linked field that carried one of its own
    // would show it instead of its name, which a rename of the field would not change.
    const attrs: Record<string, unknown> = {};
    if (visibility) {
        attrs.visibility = visibility;
    }
    if (sortOrder !== undefined) {
        attrs.sort_order = sortOrder;
    }
    if (subType) {
        attrs.subType = subType;
    }

    return adminClient.createPropertyField(GROUP, OBJECT_TYPE, {
        name,
        type: template.type,
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
        permission_values: permissionValues,
        attrs,
    } as Parameters<Client4['createPropertyField']>[2]);
}

/**
 * Creates one post attribute field the way Global Attributes does: a template holding the
 * type and options, then the post field linked to it. Returns the linked post field, the
 * one chips, the modal and values are keyed on; `templateOf` finds the template, for a
 * test that edits options. The template shares the field's name, and `deleteFields` and
 * `purgeFields` remove the pair, field first.
 *
 * Provisioned through the API rather than the UI to seed a starting state without driving
 * the console; post_attributes_creator.spec.ts covers the console itself.
 */
export async function createField(
    adminClient: Client4,
    name: string,
    {type, options = [], visibility, sortOrder, subType, permissionValues}: CreateOptions = {},
): Promise<PropertyField> {
    const fieldType = type ?? (options.length ? 'select' : 'text');
    const template = await createTemplate(adminClient, name, options, fieldType);

    try {
        const field = await createLinkedPostField(adminClient, template, name, {
            visibility,
            sortOrder,
            subType,
            permissionValues,
        });
        templatesByPostField.set(field.id, template);

        return field;
    } catch (error) {
        await deleteFieldsOf(adminClient, TEMPLATE_OBJECT_TYPE, [template]);
        throw error;
    }
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

/**
 * Changes some of a field's attrs, keeping the rest. The server merges a patch's attrs into
 * the field's, so only the ones that change are sent. The options of a linked field belong
 * to its template, so they are patched there, and the server carries them over to the linked
 * field; sending them with the field's own patch would be refused as an options change.
 * Everything else (sort order, visibility) is the post field's own.
 */
export async function patchFieldAttrs(
    adminClient: Client4,
    field: PropertyField,
    attrs: Record<string, unknown>,
): Promise<PropertyField> {
    const {options, ...own} = attrs;

    if (options !== undefined) {
        const template = templateOf(field);
        const patched = await adminClient.patchPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, template.id, {
            attrs: {...template.attrs, options},
        });
        templatesByPostField.set(field.id, patched);

        if (!Object.keys(own).length) {
            return field;
        }
    }

    return adminClient.patchPropertyField(GROUP, OBJECT_TYPE, field.id, {attrs: own});
}

// The most options one request to the options endpoint may carry.
const OPTIONS_PER_REQUEST = 200;

/**
 * Adds options to a field's template through its options endpoint, as many requests as
 * the count takes. The client has no method for that endpoint, so it is called directly.
 */
export async function addFieldOptions(adminClient: Client4, field: PropertyField, names: string[]): Promise<void> {
    const template = templateOf(field);
    const route = adminClient.getPropertyFieldOptionsRoute(GROUP, TEMPLATE_OBJECT_TYPE, template.id);

    for (let start = 0; start < names.length; start += OPTIONS_PER_REQUEST) {
        const batch = names.slice(start, start + OPTIONS_PER_REQUEST).map((name) => ({name}));
        const res = await fetch(route, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${adminClient.getToken()}`},
            body: JSON.stringify(batch),
        });

        if (!res.ok) {
            throw new Error(`adding options to ${field.name} failed: ${res.status} ${await res.text()}`);
        }
    }
}

/**
 * Counts full page loads after the point it is called, so "without a reload" is asserted
 * rather than assumed: a value or field that changes in place leaves the count at zero.
 */
export function countLoads(page: Page): () => number {
    let loads = 0;

    page.on('load', () => {
        loads++;
    });

    return () => loads;
}

/**
 * Creates a post the way the composer does: the values ride on the create request as
 * `metadata.property_values`, so the server writes them as the post is made and announces
 * them over the websocket, rather than a second request setting them afterwards.
 */
export async function createPostWithValues(
    client: Client4,
    channelId: string,
    message: string,
    items: SentValue[],
    {rootId, type}: {rootId?: string; type?: string} = {},
): Promise<Post> {
    return client.createPost({
        channel_id: channelId,
        message,
        root_id: rootId,
        type,
        metadata: {property_values: items},
    } as unknown as Parameters<Client4['createPost']>[0]);
}

export type MemberOptions = {
    // A guest account. The server refuses to make one while guest accounts are off.
    guest?: boolean;

    // Roles to hold on top of a plain account's.
    systemAdmin?: boolean;
    teamAdmin?: boolean;
    channelAdmin?: boolean;
};

/**
 * Creates another user, puts them on the team and in the given channels, and logs a
 * client in as them, for a case that needs a second person acting on the same posts.
 *
 * `channelAdmin` applies to every channel given. `initSetup` already makes the first
 * user and team; this is the second one, and the third.
 */
export async function addMember(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    channelIds: string[],
    {guest, systemAdmin, teamAdmin, channelAdmin}: MemberOptions = {},
): Promise<{user: UserProfile & {password: string}; client: Client4}> {
    const user = await pw.createNewUserProfile(adminClient, {prefix: guest ? 'guest' : 'member'});

    if (guest) {
        await adminClient.demoteUserToGuest(user.id);
    }
    if (systemAdmin) {
        await adminClient.updateUserRoles(user.id, 'system_user system_admin');
    }

    await adminClient.addToTeam(team.id, user.id);

    if (teamAdmin) {
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);
    }

    for (const channelId of channelIds) {
        await adminClient.addToChannel(user.id, channelId);
        if (channelAdmin) {
            await adminClient.updateChannelMemberRoles(channelId, user.id, 'channel_user channel_admin');
        }
    }

    const {client} = await pw.makeClient(user);

    return {user, client};
}

/**
 * Turns guest accounts on and gives back what undoes it, or undefined when the licence
 * has no guest accounts at all, which is the case's cue to skip.
 */
export async function enableGuestAccounts(adminClient: Client4): Promise<(() => Promise<void>) | undefined> {
    const license = await adminClient.getClientLicenseOld();
    if (license.GuestAccounts !== 'true') {
        return undefined;
    }

    const before = (await adminClient.getConfig()).GuestAccountsSettings.Enable;
    await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});

    return async () => {
        await adminClient.patchConfig({GuestAccountsSettings: {Enable: before}});
    };
}

/**
 * Deletes post fields made by `createField`, then their templates.
 */
export async function deleteFields(adminClient: Client4, fields: PropertyField[]): Promise<void> {
    const templates: PropertyField[] = [];
    for (const field of fields) {
        const template = templatesByPostField.get(field.id);
        if (template) {
            templates.push(template);
        }
    }

    await deleteTemplateSet(adminClient, {posts: fields, templates});
    for (const field of fields) {
        templatesByPostField.delete(field.id);
    }
}

/**
 * Best-effort cleanup of fields an interrupted run left behind: post fields, holder fields
 * and templates, in the order `deleteTemplateSet` uses.
 *
 * Post fields are system-scoped, so one left behind applies to every channel and would
 * leak chips into an unrelated spec, and it counts toward the 50-field cap and the
 * group's 200-field limit. Only fields with the suite's prefix are touched.
 */
export async function purgeFields(adminClient: Client4): Promise<void> {
    // Masking first: a holder field cannot be deleted while a template masks by it.
    try {
        const templates = await adminClient.getPropertyFields(GROUP, TEMPLATE_OBJECT_TYPE, {targetType: 'system'});
        for (const template of (templates ?? []).filter((field) => field.name.startsWith(FIELD_PREFIX))) {
            await unmaskTemplate(adminClient, template);
        }
    } catch {} // eslint-disable-line no-empty

    // Templates last: one cannot be deleted while a linked field is on it.
    for (const objectType of [OBJECT_TYPE, USER_OBJECT_TYPE, TEMPLATE_OBJECT_TYPE]) {
        try {
            const fields = await adminClient.getPropertyFields(GROUP, objectType, {targetType: 'system'});
            const stale = (fields ?? []).filter(
                (field) => field.name.startsWith(FIELD_PREFIX) && field.delete_at === 0,
            );

            await deleteFieldsOf(adminClient, objectType, stale);
        } catch {} // eslint-disable-line no-empty
    }
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
 * The active system-scoped fields on the server, for a case that needs "no other field"
 * to decide whether it can run. Call it after `purgeFields` and before the case creates
 * its own: anything left then is either not the suite's to touch, or one of the suite's
 * that the purge failed to delete, and either one would be offered alongside the case's.
 */
export async function activeSystemFields(adminClient: Client4): Promise<PropertyField[]> {
    const fields = await adminClient.getPropertyFields(GROUP, OBJECT_TYPE, {targetType: 'system'});
    return (fields ?? []).filter((field) => field.delete_at === 0);
}

// The edit modal's locators for one field. The modal is a dialog on the page, so they are
// found from the page rather than from a post.
export function modalRow(page: Page, field: PropertyField) {
    return page.getByTestId(`post-attribute-row-${field.name}`);
}

export function modalTrigger(page: Page, field: PropertyField) {
    return page.getByTestId(`post-attribute-trigger-${field.name}`);
}

export function modalClear(page: Page, field: PropertyField) {
    return page.getByTestId(`post-attribute-clear-${field.name}`);
}

export function modalInput(page: Page, field: PropertyField) {
    return page.getByTestId(`post-attribute-input-${field.name}`);
}

/**
 * Opens the post's `…` menu with the pointer and picks `Attributes`. The message text is
 * hovered rather than the post, so the pointer never rests on the chip row and the hover
 * card is not what opened the modal.
 */
export async function openModalFromPostMenu(
    channelsPage: ChannelsPage,
    post: ChannelsPost,
    {keyboard = false}: {keyboard?: boolean} = {},
) {
    await post.messageText.hover();
    await post.postMenu.toBeVisible();

    if (keyboard) {
        // Opened with Enter so the pointer is not left over a menu item: on a post whose
        // menu opens under it, the pointer lands on `Remind` and its submenu replaces the menu.
        await post.postMenu.dotMenuButton.focus();
        await post.postMenu.dotMenuButton.press('Enter');
    } else {
        await post.postMenu.dotMenuButton.click();
    }

    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.container.getByRole('menuitem', {name: 'Attributes'}).click();
}

/**
 * Creates the user field a masking template reads each viewer's holdings from, linked to
 * the template. Only a sysadmin may write it: a field that filters people cannot be
 * writable by the people it filters.
 */
export async function createHolderField(
    adminClient: Client4,
    name: string,
    template: PropertyField,
): Promise<PropertyField> {
    return adminClient.createPropertyField(GROUP, USER_OBJECT_TYPE, {
        name,
        type: 'select',
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
        permission_values: 'sysadmin',
        attrs: {},
    });
}

/**
 * Turns masking on for a template, keyed on the user field that holds each viewer's
 * options. Done after the fields are linked, the order an admin would follow.
 */
export async function maskTemplateBy(
    adminClient: Client4,
    template: PropertyField,
    holder: PropertyField,
): Promise<PropertyField> {
    // The admin driving the spec is exempt: a masked holder field hides each user's holding
    // from everyone who does not hold the same option, and the server refuses a write over a
    // value the caller cannot read, so without this the admin could not change a holding.
    const admin = await adminClient.getMe();

    return adminClient.patchPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, template.id, {
        permissions: {masking: {mask_by_field_id: holder.id, except: [{type: 'user', id: admin.id}]}},
    });
}

/**
 * Sets what one user holds in a holder field. The value is an option id.
 */
export async function setHolding(adminClient: Client4, userId: string, holder: PropertyField, value: string) {
    await adminClient.patchPropertyValues(GROUP, USER_OBJECT_TYPE, userId, [{field_id: holder.id, value}]);
}

/**
 * Deletes fields of any object type, ignoring the ones already gone.
 */
export async function deleteFieldsOf(adminClient: Client4, objectType: string, fields: PropertyField[]) {
    for (const field of fields) {
        try {
            await adminClient.deletePropertyField(GROUP, objectType, field.id);
        } catch {} // eslint-disable-line no-empty
    }
}

/**
 * Takes masking off a template, so the holder field it names can be deleted: the server
 * refuses to delete a field a template masks by, and a template cannot go while a linked
 * field is on it, so without this a masking template and its holder outlive the spec.
 */
export async function unmaskTemplate(adminClient: Client4, template: PropertyField) {
    try {
        await adminClient.patchPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, template.id, {permissions: {masking: null}});
    } catch {} // eslint-disable-line no-empty
}

/**
 * Deletes what a template spec made, in the only order the server allows: masking comes
 * off the templates first, then the post and holder fields go, and a template, which
 * cannot be deleted while a linked field is on it, goes last.
 */
export async function deleteTemplateSet(
    adminClient: Client4,
    {
        posts = [],
        holders = [],
        templates = [],
    }: {posts?: PropertyField[]; holders?: PropertyField[]; templates?: PropertyField[]},
) {
    for (const template of templates) {
        await unmaskTemplate(adminClient, template);
    }
    await deleteFieldsOf(adminClient, OBJECT_TYPE, posts);
    await deleteFieldsOf(adminClient, USER_OBJECT_TYPE, holders);
    await deleteFieldsOf(adminClient, TEMPLATE_OBJECT_TYPE, templates);
}

/**
 * Keeps `property_field_updated` frames from reaching the page, forwarding every other
 * websocket message both ways. Call it before the page first loads, so the socket it opens
 * is the filtered one.
 *
 * For a test that changes a field's permission while the page is looking at it and needs
 * the page to find out only from the server's answer. The composer and the modal react to
 * the update by taking the control away (the composer stops sending the field's value, the
 * modal locks the row), so with the update delivered the write the test wants refused is
 * never attempted. The filter is on the page's socket, not on the server, so the server
 * still enforces the new permission.
 */
export async function dropFieldUpdates(page: Page): Promise<void> {
    await page.routeWebSocket(/\/api\/v4\/websocket/, (ws) => {
        const server = ws.connectToServer();

        ws.onMessage((message) => server.send(message));
        server.onMessage((message) => {
            if (typeof message === 'string' && /"event":\s*"property_field_updated"/.test(message)) {
                return;
            }

            ws.send(message);
        });
    });
}

/**
 * Makes nobody able to write a post field's values, a system admin included, while the
 * values it already holds stay readable. A linked field's `permission_values` can only be
 * patched to `member` or `sysadmin`, so `none` goes through the v3 `permissions` object,
 * which has to carry all five levels; the rest are what a post field has by default.
 *
 * This is how a value ends up under a `none` field: it is stored while the field is
 * writable, then the field is sealed. Nothing stores one under a field that is `none` from
 * the start.
 */
export async function sealField(adminClient: Client4, field: PropertyField): Promise<PropertyField> {
    return adminClient.patchPropertyField(GROUP, OBJECT_TYPE, field.id, {
        permissions: {
            restrictions: {
                value: {read: 'everyone', write: 'none'},
                option: {read: 'everyone', write: 'sysadmin'},
                field: {write: 'sysadmin'},
            },
        },
    });
}
