// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as I18n from 'i18n/i18n.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import MultiSelectSetting from './multiselect_settings.jsx';

export default class LocalizationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
        this.canSave = this.canSave.bind(this);

        const locales = I18n.getAllLanguages();

        this.state = Object.assign(this.state, {
            hasErrors: false,
            defaultServerLocale: props.config.LocalizationSettings.DefaultServerLocale,
            defaultClientLocale: props.config.LocalizationSettings.DefaultClientLocale,
            availableLocales: props.config.LocalizationSettings.AvailableLocales.split(','),
            languages: Object.keys(locales).map((l) => {
                return {value: locales[l].value, text: locales[l].name};
            })
        });
    }

    canSave() {
        return this.state.availableLocales.join(',').indexOf(this.state.defaultClientLocale) !== -1;
    }

    getConfigFromState(config) {
        config.LocalizationSettings.DefaultServerLocale = this.state.defaultServerLocale;
        config.LocalizationSettings.DefaultClientLocale = this.state.defaultClientLocale;
        config.LocalizationSettings.AvailableLocales = this.state.availableLocales.join(',');

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.title'
                    defaultMessage='General Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.general.localization'
                        defaultMessage='Localization'
                    />
                }
            >
                <DropdownSetting
                    id='defaultServerLocale'
                    values={this.state.languages}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.serverLocaleTitle'
                            defaultMessage='Default Server Language:'
                        />
                    }
                    value={this.state.defaultServerLocale}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.serverLocaleDescription'
                            defaultMessage='This setting sets the default language for the system messages and logs. (NEED SERVER RESTART)'
                        />
                    }
                />
                <DropdownSetting
                    id='defaultClientLocale'
                    values={this.state.languages}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.clientLocaleTitle'
                            defaultMessage='Default Client Language:'
                        />
                    }
                    value={this.state.defaultClientLocale}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.clientLocaleDescription'
                            defaultMessage="This setting sets the Default language for newly created users and for pages where the user hasn't loggged in."
                        />
                    }
                />
                <MultiSelectSetting
                    id='availableLocales'
                    values={this.state.languages}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesTitle'
                            defaultMessage='Available Languages:'
                        />
                    }
                    selected={this.state.availableLocales}
                    mustBePresent={this.state.defaultClientLocale}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesDescription'
                            defaultMessage='This setting determines the available languages that a user can set using the Account Settings.'
                        />
                    }
                    noResultText={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesNoResults'
                            defaultMessage='No results found'
                        />
                    }
                    errorText={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesError'
                            defaultMessage='There has to be at least one language available'
                        />
                    }
                    notPresent={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesNotPresent'
                            defaultMessage='The default client language must be included in the available list'
                        />
                    }
                />
            </SettingsGroup>
        );
    }
}