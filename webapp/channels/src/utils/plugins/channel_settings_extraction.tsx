// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import {extractSettingsSchema, isRenderableComponent} from 'plugins/settings_schema/extract_settings_schema';

import type {
    ChannelSettingsSchema,
    ChannelSettingsTabBodyProps,
    ChannelSettingsTabShouldRender,
} from 'types/plugins/channel_settings';
import type {ChannelSettingsTabComponent} from 'types/store/plugins';

const defaultShouldRender: ChannelSettingsTabShouldRender = () => true;

/**
 * Defensively validates an untrusted channel settings tab registration into a
 * normalized {@link ChannelSettingsTabComponent}. Returns `undefined` (and the
 * caller warns) for malformed registrations. A registration is either a
 * declarative schema (`sections` + `onSave`) or a custom component.
 */
export function extractChannelSettingsTab(registration: unknown): ChannelSettingsTabComponent | undefined {
    if (!registration || typeof registration !== 'object') {
        return undefined;
    }

    if (!('id' in registration) || typeof registration.id !== 'string' || !registration.id) {
        return undefined;
    }

    if (!('pluginId' in registration) || typeof registration.pluginId !== 'string' || !registration.pluginId) {
        return undefined;
    }

    const id = registration.id;
    const pluginId = registration.pluginId;

    let shouldRender = defaultShouldRender;
    if ('shouldRender' in registration && registration.shouldRender !== undefined) {
        if (typeof registration.shouldRender === 'function') {
            shouldRender = registration.shouldRender as ChannelSettingsTabShouldRender;
        } else {
            return undefined;
        }
    }

    if ('component' in registration && registration.component !== undefined) {
        if (!isRenderableComponent(registration.component)) {
            return undefined;
        }

        const uiName = 'uiName' in registration && typeof registration.uiName === 'string' ? registration.uiName : '';
        if (!uiName) {
            return undefined;
        }

        const icon = 'icon' in registration && typeof registration.icon === 'string' && registration.icon ? registration.icon : undefined;

        return {
            id,
            pluginId,
            kind: 'custom',
            uiName,
            icon,
            shouldRender,
            component: registration.component as React.ComponentType<ChannelSettingsTabBodyProps>,
        };
    }

    type SchemaExtra = {
        onSave: ChannelSettingsSchema['onSave'];
        loadValues?: ChannelSettingsSchema['loadValues'];
    };

    const schema = extractSettingsSchema<SchemaExtra>(registration, pluginId, {
        extraValidation: (raw) => {
            if (!raw || typeof raw !== 'object' || !('onSave' in raw) || typeof raw.onSave !== 'function') {
                return undefined;
            }

            const extra: SchemaExtra = {onSave: raw.onSave as ChannelSettingsSchema['onSave']};

            if ('loadValues' in raw && raw.loadValues !== undefined) {
                if (typeof raw.loadValues !== 'function') {
                    return undefined;
                }
                extra.loadValues = raw.loadValues as ChannelSettingsSchema['loadValues'];
            }

            return extra;
        },
    });

    if (!schema) {
        return undefined;
    }

    return {
        id,
        pluginId,
        kind: 'schema',
        uiName: schema.uiName,
        icon: schema.icon,
        shouldRender,
        schema,
    };
}
