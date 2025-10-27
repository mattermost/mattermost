// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import type {LocalizationSettings} from '@mattermost/types/config';

import BooleanSetting from 'components/admin_console/boolean_setting';
import DropdownSetting from 'components/admin_console/dropdown_setting';
import MultiSelectSetting from 'components/admin_console/multiselect_settings';
import {
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';
import ExternalLink from 'components/external_link';

import * as I18n from 'i18n/i18n.jsx';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';
import type {SearchableStrings} from '../types';
import './localization.scss';

const locales = I18n.getAllLanguages();

const AdminSection = styled.section.attrs({className: 'AdminPanel'})`
    && {
        overflow: visible;
        margin-top: 0;
    }
`;

const messages = defineMessages({
    langTitle: {
        id: 'admin.site.localization.languages.title',
        defaultMessage: 'Languages',
    },
    langDescription: {
        id: 'admin.site.localization.languages.description',
        defaultMessage: 'Choose which languages should be the defaults',
    },
    serverLocaleTitle: {
        id: 'admin.general.localization.serverLocaleTitle',
        defaultMessage: 'Default Server Language:',
    },
    serverLocaleDescription: {
        id: 'admin.general.localization.serverLocaleDescription',
        defaultMessage: 'Default language for system messages.',
    },
    clientLocaleTitle: {
        id: 'admin.general.localization.clientLocaleTitle',
        defaultMessage: 'Default Client Language:',
    },
    clientLocaleDescription: {
        id: 'admin.general.localization.clientLocaleDescription',
        defaultMessage: "Default language for newly created users and pages where the user hasn't logged in.",
    },
    availableLocalesTitle: {
        id: 'admin.general.localization.availableLocalesTitle',
        defaultMessage: 'Available Languages:',
    },
    availableLocalesDescription: {
        id: 'admin.general.localization.availableLocalesDescription',
        defaultMessage: "Set which languages are available for users in <strong>Settings > Display > Language</strong> (leave this field blank to have all supported languages available). If you're manually adding new languages, the <strong>Default Client Language</strong> must be added before saving this setting.\n \nWould like to help with translations? Join the <link>Mattermost Translation Server</link> to contribute.",
    },
    availableLocalesNoResults: {
        id: 'admin.general.localization.availableLocalesNoResults',
        defaultMessage: 'No results found',
    },
    enableExperimentalLocalesTitle: {
        id: 'admin.general.localization.enableExperimentalLocalesTitle',
        defaultMessage: 'Enable Experimental Locales:',
    },
    enableExperimentalLocalesDescription: {
        id: 'admin.general.localization.enableExperimentalLocalesDescription',
        defaultMessage: 'When true, it allows users to select experimental (e.g., in progress) languages.',
    },
});

export const searchableStrings: SearchableStrings = Object.values(messages);

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
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <h1 className='localization-section-title'>
                        <FormattedMessage {...messages.langTitle}/>
                    </h1>
                    <h5 className='localization-section-description'>
                        <FormattedMessage {...messages.langDescription}/>
                    </h5>
                </hgroup>
            </SectionHeader>

            <SectionContent>
                <DropdownSetting
                    id={'DefaultServerLocale'}
                    label={
                        <FormattedMessage {...messages.serverLocaleTitle}/>
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage {...messages.serverLocaleDescription}/>
                    }
                    value={localizationSettings.DefaultServerLocale || availableLanguages[0].value}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
                />
                <DropdownSetting
                    id={'DefaultClientLocale'}
                    label={
                        <FormattedMessage {...messages.clientLocaleTitle}/>
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage {...messages.clientLocaleDescription}/>
                    }
                    value={localizationSettings.DefaultClientLocale || availableLanguages[0].value}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
                />
                <MultiSelectSetting
                    id={'AvailableLocales'}
                    label={
                        <FormattedMessage {...messages.availableLocalesTitle}/>
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage
                            {...messages.availableLocalesDescription}
                            values={{
                                link: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='https://translate.mattermost.com/'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                            }}
                        />
                    }
                    selected={(localizationSettings.AvailableLocales.split(',')) || []}
                    disabled={props.disabled}
                    setByEnv={props.setByEnv}
                    onChange={(changedId, value) => handleChange(changedId, value.join(','))}
                    noOptionsMessage={
                        <FormattedMessage {...messages.availableLocalesNoResults}/>
                    }
                />
                <BooleanSetting
                    id={'EnableExperimentalLocales'}
                    label={
                        <FormattedMessage {...messages.enableExperimentalLocalesTitle}/>
                    }
                    helpText={
                        <FormattedMessage {...messages.enableExperimentalLocalesDescription}/>
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
