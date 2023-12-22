// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRedux, PluginSetting} from '@mattermost/types/plugins';

import {t} from 'utils/i18n';

import SchemaAdminSettings from '../schema_admin_settings';
import type {AdminDefinitionSetting} from '../types';

export default function getEnablePluginSetting(plugin: PluginRedux): Partial<AdminDefinitionSetting & PluginSetting> {
    const escapedPluginId = SchemaAdminSettings.escapePathPart(plugin.id);
    const pluginEnabledConfigKey = 'PluginSettings.PluginStates.' + escapedPluginId + '.Enable';

    return {
        type: 'bool',
        key: pluginEnabledConfigKey,
        label: t('admin.plugin.enable_plugin'),
        label_default: 'Enable Plugin: ',
        help_text: t('admin.plugin.enable_plugin.help'),
        help_text_default: 'When true, this plugin is enabled.',
    };
}
