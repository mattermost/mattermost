// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {extractSettingsSchema} from 'plugins/settings_schema/extract_settings_schema';

import type {
    PluginConfiguration,
    PluginConfigurationAction,
    PluginConfigurationSection,
} from 'types/plugins/user_settings';

type SchemaExtra = {
    action?: PluginConfigurationAction;
};

type SectionExtra = {
    onSubmit?: PluginConfigurationSection['onSubmit'];
};

export function extractPluginUserSettings(pluginConfiguration: unknown, pluginId: string): PluginConfiguration | undefined {
    const schema = extractSettingsSchema<SchemaExtra, SectionExtra>(pluginConfiguration, pluginId, {
        extraValidation: (raw) => {
            // The action is best-effort: a malformed action is dropped but never
            // invalidates the whole schema.
            if (!raw || typeof raw !== 'object' || !('action' in raw) || !raw.action) {
                return {action: undefined};
            }

            return {action: extractPluginConfigurationAction(raw.action)};
        },
        sectionExtraValidation: (section) => {
            if (!section || typeof section !== 'object') {
                return undefined;
            }

            if ('onSubmit' in section && section.onSubmit) {
                if (typeof section.onSubmit !== 'function') {
                    return undefined;
                }
                return {onSubmit: section.onSubmit as PluginConfigurationSection['onSubmit']};
            }

            return {};
        },
    });

    if (!schema) {
        return undefined;
    }

    return {
        ...schema,
        id: pluginId,
    };
}

function extractPluginConfigurationAction(action: unknown): PluginConfigurationAction | undefined {
    if (!action) {
        return undefined;
    }

    if (typeof action !== 'object') {
        return undefined;
    }

    if (!('title' in action) || !action.title || typeof action.title !== 'string') {
        return undefined;
    }

    if (!('text' in action) || !action.text || typeof action.text !== 'string') {
        return undefined;
    }

    if (!('buttonText' in action) || !action.buttonText || typeof action.buttonText !== 'string') {
        return undefined;
    }

    if (!('onClick' in action) || !action.onClick || typeof action.onClick !== 'function') {
        return undefined;
    }

    return {
        title: action.title,
        text: action.text,
        buttonText: action.buttonText,
        onClick: action.onClick as PluginConfigurationAction['onClick'],
    };
}
