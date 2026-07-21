// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRedux, PluginSetting} from '@mattermost/types/plugins';

import PluginEnableButton from './enable_plugin_button';

import {escapePathPart} from '../schema_admin_settings';
import type {AdminDefinitionSetting} from '../types';

export default function getEnablePluginSetting(plugin: PluginRedux): Partial<AdminDefinitionSetting & PluginSetting> {
    const escapedPluginId = escapePathPart(plugin.id);
    const pluginEnabledConfigKey = 'PluginSettings.PluginStates.' + escapedPluginId + '.Enable';

    return {
        type: 'custom',
        key: pluginEnabledConfigKey,
        component: PluginEnableButton,
    };
}
