// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';
import {connect} from 'react-redux';

import type {PluginRedux, PluginSetting, PluginSettingSection} from '@mattermost/types/plugins';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {appsFeatureFlagEnabled} from 'mattermost-redux/selectors/entities/apps';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getRoles} from 'mattermost-redux/selectors/entities/roles';

import {getAdminConsoleCustomComponents, getAdminConsoleCustomSections} from 'selectors/admin_console';

import {appsPluginID} from 'utils/apps';
import {Constants} from 'utils/constants';

import type {AdminConsolePluginComponent, AdminConsolePluginCustomSection} from 'types/store/plugins';

import CustomPluginSettings from './custom_plugin_settings';
import getEnablePluginSetting from './enable_plugin_setting';

import {it} from '../admin_definition';
import {escapePathPart} from '../schema_admin_settings';
import type {AdminDefinitionSetting, AdminDefinitionSubSectionSchema, AdminDefinitionConfigSchemaSection} from '../types';

type OwnProps = { match: { params: { plugin_id: string } } }

function makeGetPluginSchema() {
    return createSelector(
        'makeGetPluginSchema',
        (state: GlobalState, pluginId: string) => state.entities.admin.plugins?.[pluginId],
        (state: GlobalState, pluginId: string) => getAdminConsoleCustomComponents(state, pluginId),
        (state: GlobalState, pluginId: string) => getAdminConsoleCustomSections(state, pluginId),
        (state) => appsFeatureFlagEnabled(state),
        isCurrentLicenseCloud,
        (plugin: PluginRedux | undefined, customComponents: Record<string, AdminConsolePluginComponent>, customSections: Record<string, AdminConsolePluginCustomSection>, appsFeatureFlagIsEnabled, isCloudLicense) => {
            if (!plugin) {
                return null;
            }

            const escapedPluginId = escapePathPart(plugin.id);
            const pluginEnabledConfigKey = 'PluginSettings.PluginStates.' + escapedPluginId + '.Enable';

            const parsePluginSettings = (settings: PluginSetting[]) => {
                return settings.map((setting) => {
                    const key = setting.key.toLowerCase();
                    let component = null;
                    let bannerType = '';
                    let type = setting.type;
                    let displayName: string | MessageDescriptor = setting.display_name;
                    let isDisabled = it.any(it.stateIsFalse(pluginEnabledConfigKey), it.not(it.userHasWritePermissionOnResource('plugins')));

                    if (customComponents[key]) {
                        component = customComponents[key].component;
                        type = Constants.SettingsTypes.TYPE_CUSTOM;
                    } else if (setting.type === Constants.SettingsTypes.TYPE_CUSTOM) {
                        // Show a warning banner to enable the plugin in order to display the custom component.
                        type = Constants.SettingsTypes.TYPE_BANNER;
                        displayName = defineMessage({id: 'admin.plugin.customSetting.pluginDisabledWarning', defaultMessage: 'In order to view this setting, enable the plugin and click Save.'});
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
                    } as Partial<AdminDefinitionSetting>;
                });
            };

            const parsePluginSettingSections = (sections: PluginSettingSection[]) => {
                return sections.map((section) => {
                    const key = section.key.toLowerCase();
                    let component;
                    let settings: Array<Partial<AdminDefinitionSetting>> = [];
                    if (section.custom) {
                        if (customSections[key]) {
                            component = customSections[key]?.component;
                            settings = parsePluginSettings(section.settings);
                        } else if (section.fallback) {
                            settings = parsePluginSettings(section.settings);
                        } else {
                            // Show warning banner for custom sections when the plugin is disabled and there's no fallback.
                            settings = [{
                                key: key + 'disabledWarning',
                                type: Constants.SettingsTypes.TYPE_BANNER,
                                label: defineMessage({
                                    id: 'admin.plugin.customSection.pluginDisabledWarning',
                                    defaultMessage: 'In order to view this section, enable the plugin and click Save.',
                                }),
                                banner_type: 'warning',
                            }];
                        }
                    } else {
                        settings = parsePluginSettings(section.settings);
                    }

                    return {
                        key,
                        title: section.title,
                        subtitle: section.subtitle,
                        settings,
                        header: section.header,
                        footer: section.footer,
                        component,
                    } as AdminDefinitionConfigSchemaSection;
                });
            };

            let sections: AdminDefinitionConfigSchemaSection[] = [];
            let settings: Array<Partial<AdminDefinitionSetting>> = [];
            if (plugin.settings_schema && plugin.settings_schema.sections) {
                sections = parsePluginSettingSections(plugin.settings_schema.sections);
            } else if (plugin.settings_schema && plugin.settings_schema.settings) {
                settings = parsePluginSettings(plugin.settings_schema.settings);
            }

            if (plugin.id !== appsPluginID || appsFeatureFlagIsEnabled) {
                const pluginEnableSetting = getEnablePluginSetting(plugin) as AdminDefinitionSetting;

                const hasAllCustomSectionsDisabled = plugin.settings_schema?.sections?.every((s) => s.custom && !customSections[s.key.toLowerCase()]);
                const allCustomSectionsAllowFallback = plugin.settings_schema?.sections?.every((s) => s.custom && s.fallback);

                if (plugin.settings_schema && hasAllCustomSectionsDisabled && !allCustomSectionsAllowFallback) {
                    // If the plugin is composed of purely custom sections (e.g. Calls), it's disabled (custom components are not found), and they don't allow a fallback, we show a single warning.
                    const warningBanner = {
                        key: 'admin.plugin.customSections.pluginDisabledWarning',
                        type: Constants.SettingsTypes.TYPE_BANNER,
                        label: defineMessage({id: 'admin.plugin.customSections.pluginDisabledWarning', defaultMessage: 'In order to view and configure plugin settings, enable the plugin and click Save.'}),
                        banner_type: 'warning' as const,
                    };

                    sections = [{
                        key: pluginEnabledConfigKey + '.Section',
                        header: plugin.settings_schema?.header,
                        footer: plugin.settings_schema?.footer,
                        settings: [pluginEnableSetting, warningBanner],
                    }];
                } else if (sections.length > 0) {
                    // Have a separate section on top with the plugin enable/disable setting.
                    sections.unshift({
                        key: pluginEnabledConfigKey + '.Section',
                        header: plugin.settings_schema?.header,
                        footer: plugin.settings_schema?.footer,
                        settings: [pluginEnableSetting],
                    });
                } else {
                    // Otherwise we retain existing behaviour and add the setting in front.
                    settings.unshift(pluginEnableSetting);
                }
            }

            const checkDisableSetting = (s: Partial<AdminDefinitionSetting>) => {
                if (s.isDisabled) {
                    s.isDisabled = it.any(s.isDisabled, it.not(it.userHasWritePermissionOnResource('plugins')));
                } else {
                    s.isDisabled = it.not(it.userHasWritePermissionOnResource('plugins'));
                }
            };

            if (sections.length > 0) {
                sections.forEach((section) => section.settings.forEach(checkDisableSetting));
            } else {
                settings.forEach(checkDisableSetting);
            }

            return {
                ...plugin.settings_schema,
                id: plugin.id,
                name: plugin.name,
                settings: sections.length > 0 ? undefined : settings,
                sections: sections.length > 0 ? sections : undefined,
                translate: Boolean(plugin.translate),
            } as AdminDefinitionSubSectionSchema;
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
