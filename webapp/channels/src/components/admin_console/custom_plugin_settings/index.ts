// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {PluginRedux} from '@mattermost/types/plugins';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {appsFeatureFlagEnabled} from 'mattermost-redux/selectors/entities/apps';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getRoles} from 'mattermost-redux/selectors/entities/roles';

import {getAdminConsoleCustomComponents} from 'selectors/admin_console';

import {appsPluginID} from 'utils/apps';
import {Constants} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {AdminConsolePluginComponent} from 'types/store/plugins';

import CustomPluginSettings from './custom_plugin_settings';
import getEnablePluginSetting from './enable_plugin_setting';

import {it} from '../admin_definition';
import SchemaAdminSettings from '../schema_admin_settings';

type OwnProps = { match: { params: { plugin_id: string } } }

function makeGetPluginSchema() {
    return createSelector(
        'makeGetPluginSchema',
        (state: GlobalState, pluginId: string) => state.entities.admin.plugins?.[pluginId],
        (state: GlobalState, pluginId: string) => getAdminConsoleCustomComponents(state, pluginId),
        (state) => appsFeatureFlagEnabled(state),
        isCurrentLicenseCloud,
        (plugin: PluginRedux | undefined, customComponents: Record<string, AdminConsolePluginComponent>, appsFeatureFlagIsEnabled, isCloudLicense) => {
            if (!plugin) {
                return null;
            }

            const escapedPluginId = SchemaAdminSettings.escapePathPart(plugin.id);
            const pluginEnabledConfigKey = 'PluginSettings.PluginStates.' + escapedPluginId + '.Enable';

            let settings: Array<Partial<SchemaAdminSettings>> = [];
            if (plugin.settings_schema && plugin.settings_schema.settings) {
                settings = plugin.settings_schema.settings.map((setting) => {
                    const key = setting.key.toLowerCase();
                    let component = null;
                    let bannerType = '';
                    let type = setting.type;
                    let displayName = setting.display_name;
                    let isDisabled = it.any(it.stateIsFalse(pluginEnabledConfigKey), it.not(it.userHasWritePermissionOnResource('plugins')));

                    if (customComponents[key]) {
                        component = customComponents[key].component;
                        type = Constants.SettingsTypes.TYPE_CUSTOM;
                    } else if (setting.type === Constants.SettingsTypes.TYPE_CUSTOM) {
                        // Show a warning banner to enable the plugin in order to display the custom component.
                        type = Constants.SettingsTypes.TYPE_BANNER;
                        displayName = localizeMessage('admin.plugin.customSetting.pluginDisabledWarning', 'In order to view this setting, enable the plugin and click Save.');
                        bannerType = 'warning';
                        isDisabled = it.any(it.stateIsTrue(pluginEnabledConfigKey), it.not(it.userHasWritePermissionOnResource('plugins')));
                    }

                    const isHidden = () => {
                        return (isCloudLicense && setting.hosting === 'on-prem') ||
                            (!isCloudLicense && setting.hosting === 'cloud');
                    };

                    return {
                        ...setting,
                        type,
                        key: 'PluginSettings.Plugins.' + escapedPluginId + '.' + key,
                        help_text_markdown: true,
                        label: displayName,
                        translate: Boolean(plugin.translate),
                        isDisabled,
                        isHidden,
                        banner_type: bannerType,
                        component,
                        showTitle: customComponents[key] ? customComponents[key].options.showTitle : false,
                    };
                });
            }

            if (plugin.id !== appsPluginID || appsFeatureFlagIsEnabled) {
                const pluginEnableSetting = getEnablePluginSetting(plugin);
                pluginEnableSetting.isDisabled = it.any(pluginEnableSetting.isDisabled, it.not(it.userHasWritePermissionOnResource('plugins')));
                settings.unshift(pluginEnableSetting);
            }

            settings.forEach((s) => {
                s.isDisabled = it.any(s.isDisabled, it.not(it.userHasWritePermissionOnResource('plugins')));
            });

            return {
                ...plugin.settings_schema,
                id: plugin.id,
                name: plugin.name,
                settings,
                translate: Boolean(plugin.translate),
            };
        },
    );
}

function makeMapStateToProps() {
    const getPluginSchema = makeGetPluginSchema();

    return (state: GlobalState, ownProps: OwnProps) => {
        const pluginId = ownProps.match.params.plugin_id;

        return {
            schema: getPluginSchema(state, pluginId),
            roles: getRoles(state),
        };
    };
}

export default connect(makeMapStateToProps)(CustomPluginSettings);
