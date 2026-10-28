// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import type {ResourceObjectType} from './global_attributes_helpers';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/constants.ts
const PROPERTY_GROUP = 'access_control';
const TARGET_TYPE = 'system';

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
