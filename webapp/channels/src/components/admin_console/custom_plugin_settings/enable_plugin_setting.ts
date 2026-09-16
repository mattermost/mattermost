// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRedux, PluginSetting} from '@mattermost/types/plugins';

import {getPluginEnabledConfigKey} from '../schema_admin_settings';
import type {AdminDefinitionSetting} from '../types';

export default function getEnablePluginSetting(plugin: PluginRedux): Partial<AdminDefinitionSetting & PluginSetting> {
    return {
        type: 'bool',
        key: getPluginEnabledConfigKey(plugin.id),
        label: '',
        isHidden: true,
    };
}
