// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {licenseTier, test} from '@mattermost/playwright-lib';

import type {ResourceObjectType} from './global_attributes_helpers';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/constants.ts
const PROPERTY_GROUP = 'access_control';
const TARGET_TYPE = 'system';

// Identity sources a field can sync from. An openid link cannot be combined with
// an ldap or saml one (server: validateSyncSources), so a multi-source row is ldap + saml.
export type SyncSource = 'ldap' | 'saml' | 'openid';

/**
 * Skips the test below Enterprise Advanced, the tier the server needs to offer the channel
 * resource type (a channel-scoped access_control read returns 501 without it).
 */
export async function requireChannelResourceLicense(adminClient: Client4) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(
        licenseTier(license.SkuShortName) < 30,
        'Channel attributes require an Enterprise Advanced license (SkuShortName entry or advanced).',
    );
}

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
     * Templates created concurrently in chunks, named `<key>_<index>` and displayed
     * as `<displayPrefix> <zero-padded index>` so they sort in index order.
     * Returns them in index order.
     */
    async bulkTemplates(key: string, displayPrefix: string, count: number): Promise<PropertyField[]> {
        const chunkSize = 10;
        const result: PropertyField[] = [];
        for (let start = 0; start < count; start += chunkSize) {
            const indexes = Array.from({length: Math.min(chunkSize, count - start)}, (_, i) => start + i);
            const chunk = await Promise.all(
                indexes.map((index) =>
                    this.template({
                        key: `${key}_${String(index).padStart(3, '0')}`,
                        displayName: `${displayPrefix} ${String(index).padStart(3, '0')}`,
                    }),
                ),
            );
            result.push(...chunk);
        }
        return result;
    }

    /**
     * A field of `objectType` linked to `template`. A template's Applies-to chips,
     * and its match for the resource-type filter, come from these.
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
     * A template with a linked child for each of `objectTypes`.
     */
    async linkedTemplate(
        seed: TemplateSeed,
        objectTypes: ResourceObjectType[],
    ): Promise<{template: PropertyField; children: PropertyField[]}> {
        const template = await this.template(seed);
        const children: PropertyField[] = [];
        for (const objectType of objectTypes) {
            children.push(await this.linkedChild(template, objectType));
        }
        return {template, children};
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
     * refused with 409 while a live linked field exists), ignoring fields a test already removed.
     */
    async cleanup() {
        const ordered = [
            ...this.created.filter((field) => field.objectType !== 'template'),
            ...this.created.filter((field) => field.objectType === 'template'),
        ];
        for (const field of ordered) {
            try {
                await this.adminClient.deletePropertyField(PROPERTY_GROUP, field.objectType, field.id);
            } catch {
                // Already deleted by the test, or the routes are unavailable.
            }
        }
        this.created.length = 0;
    }
}
