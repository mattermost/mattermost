// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyPermissionLevel} from '@mattermost/types/properties';

import type {ChannelResourceConfig} from './types';

/**
 * Who may set a channel attribute's value. Not configurable: the control is held
 * back until the permissions work lands.
 *
 * Written rather than omitted because the server defaults a channel field to
 * "member", which would let any channel member change a marking. Dropping this
 * loosens access; it is not a tidy-up.
 */
const CHANNEL_VALUE_SETTER: PropertyPermissionLevel = 'admin';

/**
 * Builds the linked channel field for a template attribute.
 *
 * The omissions are server rules: options live on the template and are rejected
 * on a linked field, target_type must match the template's, and permission_field
 * and permission_options are left for the server to default.
 */
export function buildChannelFieldPayload(
    template: PropertyField,
    config: ChannelResourceConfig,
): Partial<PropertyField> & Record<string, unknown> {
    const attrs: Record<string, unknown> = {};

    // Written only when they differ from the server default, so a field left at
    // the defaults is indistinguishable from one created before these keys.
    if (config.required) {
        attrs.required = true;
    }
    if (config.changePolicy !== 'any') {
        attrs.change_policy = config.changePolicy;
    }

    // editable predates change_policy and is what every current reader consults, so
    // "never" writes both. The two cannot disagree: only this builder sets them.
    if (config.changePolicy === 'never') {
        attrs.editable = false;
    }
    if (config.displayLocations.length > 0) {
        attrs.actions = [...config.displayLocations];
    }

    return {
        name: template.name,
        type: template.type,
        target_type: template.target_type,
        target_id: template.target_id,
        linked_field_id: template.id,
        permission_values: CHANNEL_VALUE_SETTER,
        ...(Object.keys(attrs).length > 0 ? {attrs} : {}),
    };
}
