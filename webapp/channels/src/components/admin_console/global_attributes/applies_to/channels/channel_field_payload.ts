// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyPermissionLevel} from '@mattermost/types/properties';

import {getPropertyFieldChangePolicy, isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import type {ChannelDisplayLocation, ChannelResourceConfig} from './types';
import {CHANNEL_DISPLAY_LOCATIONS} from './types';

/**
 * Who may set a channel attribute's value. Not configurable: the control is held
 * back until the permissions work lands.
 *
 * Written rather than omitted because the server defaults a channel field to
 * "member", which would let any channel member change a marking. Dropping this
 * loosens access; it is not a tidy-up.
 */
export const CHANNEL_VALUE_SETTER: PropertyPermissionLevel = 'admin';

/**
 * The attrs a channel resource's configuration contributes to its linked field.
 *
 * Written only when they differ from the server default, so a field left at the
 * defaults is indistinguishable from one created before these keys existed.
 */
export function buildChannelFieldAttrs(config: ChannelResourceConfig): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};

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

    return attrs;
}

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
    const attrs = buildChannelFieldAttrs(config);

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

/**
 * The inverse of buildChannelFieldPayload, so a field it wrote round-trips unchanged.
 *
 * Unknown actions are dropped rather than carried: a location the row cannot show
 * must not survive a save through it.
 */
export function parseChannelFieldConfig(field: PropertyField): ChannelResourceConfig {
    const rawActions = field.attrs?.actions;
    const actions = Array.isArray(rawActions) ? rawActions : [];

    return {
        required: isPropertyFieldRequired(field),
        changePolicy: getPropertyFieldChangePolicy(field),
        displayLocations: CHANNEL_DISPLAY_LOCATIONS.filter((location) => actions.includes(location)) as ChannelDisplayLocation[],
    };
}

/**
 * Builds the attrs patch for an existing linked channel field.
 *
 * Every key is written on every save, off states included, because the server merges
 * attrs: an omitted key keeps whatever was there before. `false`, `'any'` and `[]`
 * are each that key's way of spelling "unset".
 *
 * editable needs an explicit null. It predates change_policy and still wins when
 * change_policy is absent, so one left over from a previous "never" would keep the
 * attribute locked however the policy reads.
 */
export function buildChannelFieldPatch(config: ChannelResourceConfig): Partial<PropertyField> & Record<string, unknown> {
    return {
        attrs: {
            required: config.required,
            change_policy: config.changePolicy,
            editable: config.changePolicy === 'never' ? false : null,
            actions: [...config.displayLocations],
        },
    };
}
