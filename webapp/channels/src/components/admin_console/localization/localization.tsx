// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {LocalizationSettings} from '@mattermost/types/config';

import BooleanSetting from 'components/admin_console/boolean_setting';
import DropdownSetting from 'components/admin_console/dropdown_setting';
import MultiSelectSetting from 'components/admin_console/multiselect_settings';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';
import ExternalLink from 'components/external_link';

import * as I18n from 'i18n/i18n.jsx';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';
import './localization.scss';

const locales = I18n.getAllLanguages();

export default function Localization(props: SystemConsoleCustomSettingsComponentProps) {
    const [localizationSettings, setLocalizationSettings] = useState<LocalizationSettings>(props.value as LocalizationSettings);

    const handleChange = useCallback((id: string, value: any) => {
        const updatedSettings = {
            ...localizationSettings,
            [id]: value,
        };
        setLocalizationSettings(updatedSettings);
        props.onChange(props.id, updatedSettings);
    }, [props, localizationSettings]);

    const availableLanguages = useMemo(() => {
        const values: Array<{value: string; text: string; order: number}> = [];
        for (const l of Object.values(locales)) {
            values.push({value: l.value, text: l.name, order: l.order});
        }
        values.sort((a, b) => a.order - b.order);
        return values;
    }, []);

    return (
        <AdminSection style={{marginTop: '0'}}>
            <SectionHeader>
                <hgroup>
                    <h1 className='localization-section-title'>
                        <FormattedMessage
                            id='admin.site.localization.languages.title'
                            defaultMessage='Languages'
                        />
                    </h1>
                    <h5 className='localization-section-description'>
                        <FormattedMessage
                            id='admin.site.localization.languages.description'
                            defaultMessage='Choose which languages should be the defaults'
                        />
                    </h5>
                </hgroup>
            </SectionHeader>

            <SectionContent>
                <DropdownSetting
                    key={props.id + '_language_' + props.id + '.DefaultServerLocale'}
                    id={'DefaultServerLocale'}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.serverLocaleTitle'
                            defaultMessage='Default Server Language:'
                        />
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.serverLocaleDescription'
                            defaultMessage='Default language for system messages.'
                        />
                    }
                    value={localizationSettings.DefaultServerLocale || availableLanguages[0].value}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
                />
                <DropdownSetting
                    key={props.id + '_language_' + props.id + '.DefaultClientLocale'}
                    id={'DefaultClientLocale'}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.clientLocaleTitle'
                            defaultMessage='Default Client Language:'
                        />
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.clientLocaleDescription'
                            defaultMessage="Default language for newly created users and pages where the user hasn't logged in."
                        />
                    }
                    value={localizationSettings.DefaultClientLocale || availableLanguages[0].value}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
                />
                <MultiSelectSetting
                    key={props.id + '_language_' + props.id + '.AvailableLocales'}
                    id={'AvailableLocales'}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesTitle'
                            defaultMessage='Available Languages:'
                        />
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesDescription'
                            defaultMessage="Set which languages are available for users in <strong>Settings > Display > Language</strong> (leave this field blank to have all supported languages available). If you\'re manually adding new languages, the <strong>Default Client Language</strong> must be added before saving this setting.\n \nWould like to help with translations? Join the <link>Mattermost Translation Server</link> to contribute."
                            values={{
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='http://translate.mattermost.com/'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: string) => <strong>{msg}</strong>,
                            }}
                        />
                    }
                    selected={(localizationSettings.AvailableLocales.split(',')) || []}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={(changedId, value) => handleChange(changedId, value.join(','))}
                    noOptionsMessage={
                        <FormattedMessage
                            id='admin.general.localization.availableLocalesNoResults'
                            defaultMessage='No results found'
                        />
                    }
                />
                <BooleanSetting
                    key={props.id + '_language_' + props.id + '.EnableExperimentalLocales'}
                    id={'EnableExperimentalLocales'}
                    label={
                        <FormattedMessage
                            id='admin.general.localization.enableExperimentalLocalesTitle'
                            defaultMessage='Enable Experimental Locales:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.general.localization.enableExperimentalLocalesDescription'
                            defaultMessage='When true, it allows users to select experimental (e.g., in progress) languages.'
                        />
                    }
                    value={localizationSettings.EnableExperimentalLocales}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
                />
            </SectionContent>
        </AdminSection>
    );
}
