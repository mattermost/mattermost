// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, settle, type App} from '@mattermost/playwright-lib';

import {ignoreNotFound, type ResourceObjectType} from './global_attributes_helpers';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/constants.ts
const PROPERTY_GROUP = 'access_control';
const TARGET_TYPE = 'system';

// Identity sources a field can sync from. An openid link cannot be combined with
// an ldap or saml one (server: validateSyncSources), so a multi-source row is ldap + saml.
export type SyncSource = 'ldap' | 'saml' | 'openid';

export type SeedOwner = {id: string; type: 'plugin' | 'service' | 'role' | 'user'; scopes?: string[]};

type CreateFieldInput = Parameters<Client4['createPropertyField']>[2];

type SeededField = {objectType: string; id: string};

export type TemplateSeed = {
    // Short token; the internal name becomes e2e_<key>_<suffix>.
    key: string;

    // Omit to leave the field without a display name, so the row shows the internal name.
    displayName?: string;
    type?: string;
    attrs?: Record<string, unknown>;
};

/**
 * Seeds Global Attributes listing rows through the admin API and removes every field
 * it created in cleanup(). Names embed `suffix` so a run never collides with another
 * run's rows; call cleanup() from a finally block.
 *
 * Rows the listing shows: templates, plus system user/channel/post fields that link
 * to no template. Channel fields need the ChannelAttributes flag and post fields the
 * PostAttributes flag, which the calling spec must have enabled.
 */
export class ListingSeeder {
    readonly suffix: string;
    private readonly adminClient: Client4;
    private readonly created: SeededField[] = [];
    private readonly labels = new Map<string, string>();

    idForLabel(label: string): string {
        const id = this.labels.get(label);
        if (!id) {
            throw new Error(`No seeded field has label ${label}`);
        }
        return id;
    }

    constructor(adminClient: Client4, suffix: string) {
        this.adminClient = adminClient;
        this.suffix = suffix;
    }

    /**
     * Internal name for a seed key.
     */
    nameFor(key: string): string {
        return `e2e_${key}_${this.suffix}`;
    }

    private async create(objectType: string, field: CreateFieldInput): Promise<PropertyField> {
        const created = await this.adminClient.createPropertyField(PROPERTY_GROUP, objectType, field);
        this.created.push({objectType, id: created.id});
        const label = created.attrs?.display_name;
        this.labels.set(typeof label === 'string' && label ? label : created.name, created.id);
        return created;
    }

    /**
     * A template field. Pass a `displayName` that differs from the internal name
     * to exercise display-name vs name matching.
     */
    async template({key, displayName, type = 'text', attrs = {}}: TemplateSeed): Promise<PropertyField> {
        return this.create('template', {
            name: this.nameFor(key),
            type,
            target_type: TARGET_TYPE,
            target_id: '',
            attrs: {...(displayName ? {display_name: displayName} : {}), ...attrs},
        } as CreateFieldInput);
    }

    /**
     * A field of `objectType` linked to `template`.
     */
    async linkedChild(
        template: PropertyField,
        objectType: ResourceObjectType,
        attrs?: Record<string, unknown>,
    ): Promise<PropertyField> {
        return this.create(objectType, {
            name: `${template.name}_${objectType}`,
            type: template.type,
            target_type: TARGET_TYPE,
            target_id: '',
            linked_field_id: template.id,
            ...(attrs ? {attrs} : {}),
        } as CreateFieldInput);
    }

    /**
     * A system field of `objectType` linked to no template, which the listing shows
     * as its own row.
     */
    async unlinkedField(
        objectType: ResourceObjectType,
        {key, displayName, type = 'text', attrs = {}}: TemplateSeed,
    ): Promise<PropertyField> {
        return this.create(objectType, {
            name: this.nameFor(key),
            type,
            target_type: TARGET_TYPE,
            target_id: '',
            attrs: {...(displayName ? {display_name: displayName} : {}), ...attrs},
        } as CreateFieldInput);
    }

    /**
     * A template mapped to one or more identity sources (attrs.ldap / attrs.saml /
     * attrs.openid hold the external attribute name). A row synced from several
     * sources is expected under each source's filter.
     */
    async syncedTemplate(seed: TemplateSeed, sources: SyncSource[]): Promise<PropertyField> {
        const mappings = Object.fromEntries(sources.map((source) => [source, `${source}_${this.suffix}`]));
        return this.template({...seed, attrs: {...seed.attrs, ...mappings}});
    }

    /**
     * A template whose linked user field declares `owners`. Owners are written by a
     * sysadmin through the REST API, which is the only path that accepts them.
     * A plugin-type owner makes the row a "Plugin" source row; service, role and
     * user owners render "Managed by X" and match the All source filter only.
     *
     * A field written by a real plugin (attrs.source_plugin_id + protected) cannot be seeded:
     * the server rejects both from any non-plugin caller (PreCreatePropertyField). A plugin
     * owner lands in the same Plugin source bucket, so that is what specs seed instead.
     */
    async ownedTemplate(
        seed: TemplateSeed,
        owners: SeedOwner[],
    ): Promise<{template: PropertyField; userField: PropertyField}> {
        const template = await this.template(seed);
        const userField = await this.linkedChild(template, 'user', {
            owners: owners.map((owner) => ({scopes: [], ...owner})),
        });
        return {template, userField};
    }

    /**
     * Deletes everything this seeder created, dependents first (a template delete is
     * refused with 409 while a live linked field exists); a field a test already removed is fine.
     */
    async cleanup() {
        const ordered = [
            ...this.created.filter((field) => field.objectType !== 'template'),
            ...this.created.filter((field) => field.objectType === 'template'),
        ];
        for (const field of ordered) {
            await ignoreNotFound(() =>
                this.adminClient.deletePropertyField(PROPERTY_GROUP, field.objectType, field.id),
            );
        }
        this.created.length = 0;
    }
}

/** Search is debounced; the named response proves the results reflect this term. */
export async function searchListing(app: App, term: string) {
    await settle(app.admin.attributes.search.container, {wait: Api.SearchGlobalAttributes}).fill(term);
    await expect(app.admin.attributes.search.container).toHaveValue(term);
}

type SourceKey = Parameters<App['admin']['attributes']['sourceFilter']['menu']['option']>[0];
type ResourceKey = Parameters<App['admin']['attributes']['resourceTypeFilter']['menu']['option']>[0];

// The labels the filters show, with the option each one's menu item is keyed by.
const SOURCE_OPTIONS = {
    All: 'all',
    'Managed here': 'managed',
    'AD/LDAP': 'ldap',
    SAML: 'saml',
    'OpenID Connect': 'openid',
    Plugin: 'plugin',
} satisfies Record<string, SourceKey>;
const RESOURCE_OPTIONS = {All: 'all', Users: 'user', Channels: 'channel', Posts: 'post'} satisfies Record<
    string,
    ResourceKey
>;

/** Picks an option in the Source or Resource type filter and waits for the search it sends. */
export async function filterListing(app: App, kind: 'source', label: keyof typeof SOURCE_OPTIONS): Promise<void>;
export async function filterListing(app: App, kind: 'resource', label: keyof typeof RESOURCE_OPTIONS): Promise<void>;
export async function filterListing(
    app: App,
    kind: 'source' | 'resource',
    label: keyof typeof SOURCE_OPTIONS | keyof typeof RESOURCE_OPTIONS,
): Promise<void> {
    const attributes = app.admin.attributes;
    if (kind === 'source') {
        const filter = attributes.sourceFilter;
        const option = filter.menu.option(SOURCE_OPTIONS[label as keyof typeof SOURCE_OPTIONS]);
        await filter.container.click();
        await expect(option).toBeVisible();
        await settle(option, {wait: Api.SearchGlobalAttributes}).click();
        await expect(filter.menu).not.toBeVisible();
        await expect(filter.input.container).toHaveValue(label);
        return;
    }

    const filter = attributes.resourceTypeFilter;
    const option = filter.menu.option(RESOURCE_OPTIONS[label as keyof typeof RESOURCE_OPTIONS]);
    await filter.container.click();
    await expect(option).toBeVisible();
    await settle(option, {wait: Api.SearchGlobalAttributes}).click();
    await expect(filter.menu).not.toBeVisible();
    await expect(filter.input.container).toHaveValue(label);
}
