// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const agentsBridgeMessages = defineMessages({
    pluginNotActive: {
        id: 'app.agents.bridge.not_available.plugin_not_active',
        defaultMessage: 'Mattermost Agents plugin is not active.',
    },
    pluginVersionTooOld: {
        id: 'app.agents.bridge.not_available.plugin_version_too_old',
        defaultMessage: 'Mattermost Agents plugin version is too old. Please update to the latest version.',
    },
    pluginEnvNotInit: {
        id: 'app.agents.bridge.not_available.plugin_env_not_initialized',
        defaultMessage: 'Plugin environment is not initialized.',
    },
    pluginNotRegistered: {
        id: 'app.agents.bridge.not_available.plugin_not_registered',
        defaultMessage: 'Mattermost Agents plugin is not registered.',
    },
    pluginVersionParseFailed: {
        id: 'app.agents.bridge.not_available.plugin_version_parse_failed',
        defaultMessage: 'Failed to parse AI plugin version.',
    },
    agentsBridgeUnavailableDefault: {
        id: 'admin.site.localization.autoTranslationAgentsError',
        defaultMessage: 'An unknown error occurred while checking the Agents plugin status.',
    },
    agentsBridgeUnavailableReason: {
        id: 'app.agents.bridge.unavailable_reason',
        defaultMessage: 'Mattermost Agents plugin is unavailable.',
    },
});

