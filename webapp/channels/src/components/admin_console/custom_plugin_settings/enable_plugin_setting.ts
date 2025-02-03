// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

import type {PluginRedux, PluginSetting} from '@mattermost/types/plugins';

import {escapePathPart} from '../schema_admin_settings';
import type {AdminDefinitionSetting} from '../types';

export default function getEnablePluginSetting(plugin: PluginRedux): Partial<AdminDefinitionSetting & PluginSetting> {
    const escapedPluginId = escapePathPart(plugin.id);
    const pluginEnabledConfigKey = 'PluginSettings.PluginStates.' + escapedPluginId + '.Enable';

    return {
        type: 'bool',
        key: pluginEnabledConfigKey,
        label: defineMessage({id: 'admin.plugin.enable_plugin', defaultMessage: 'Enable Plugin: '}),
        help_text: defineMessage({id: 'admin.plugin.enable_plugin.help', defaultMessage: 'When true, this plugin is enabled.'}),
    };
}
