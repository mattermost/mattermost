// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import type {AutoTranslationSettings} from '@mattermost/types/config';

import DropdownSetting from 'components/admin_console/dropdown_setting';
import MultiSelectSetting from 'components/admin_console/multiselect_settings';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';
import Toggle from 'components/toggle';

import AutoTranslationInfo from './auto_translation_info';
import LibreTranslateSettings from './libreTranslate_settings';

import * as I18n from 'i18n/i18n.jsx';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';
import './localization.scss';
import type {SearchableStrings} from '../types';

const locales = I18n.getAllLanguages();

const messages = defineMessages({
    enableAutoTranslationTitle: {
        id: 'admin.site.localization.enableAutoTranslationTitle',
        defaultMessage: 'Auto-translation',
    },
    enableAutoTranslationDescription: {
        id: 'admin.site.localization.enableAutoTranslationDescription',
        defaultMessage: 'Configure auto-translation for channels and direct messages',
    },
});

export const searchableStrings: SearchableStrings = Object.values(messages);

export default function AutoTranslation(props: SystemConsoleCustomSettingsComponentProps) {
    const [autoTranslationSettings, setAutoTranslationSettings] = useState<AutoTranslationSettings>(props.value as AutoTranslationSettings);

    const handleChange = useCallback((id: string, value: any) => {
        const updatedSettings = {
            ...autoTranslationSettings,
            [id]: value,
        };
        setAutoTranslationSettings(updatedSettings);
        props.onChange(props.id, updatedSettings);
    }, [props, autoTranslationSettings]);

    const handleToggle = useCallback(() => {
        handleChange('Enable', !autoTranslationSettings.Enable);
    }, [autoTranslationSettings, handleChange]);

    const availableLanguages = useMemo(() => {
        const values: Array<{value: string; text: string; order: number}> = [];
        for (const l of Object.values(locales)) {
            values.push({value: l.value, text: l.name, order: l.order});
        }
        values.sort((a, b) => a.order - b.order);
        return values;
    }, []);

    const providerHelpTextValues = useMemo(() => ({
        br: <br/>,
        strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
    }), []);

    const on = (
        <FormattedMessage
            id='admin.site.localization.auto_translation.on'
            defaultMessage='On'
        />
    );
    const off = (
        <FormattedMessage
            id='admin.site.localization.auto_translation.off'
            defaultMessage='Off'
        />
    );

    return (
        <AdminSection>
            <SectionHeader>
                <div className='autotranslation-section-header'>
                    <hgroup>
                        <h1 className='localization-section-title'>
                            <FormattedMessage {...messages.enableAutoTranslationTitle}/>
                        </h1>
                        <h5 className='localization-section-description'>
                            <FormattedMessage {...messages.enableAutoTranslationDescription}/>
                        </h5>
                    </hgroup>
                    <div className='autotranslation-section-toggle'>
                        <span style={{marginRight: '12px'}}>
                            {autoTranslationSettings.Enable ? on : off}
                        </span>
                        <Toggle
                            size='btn-md'
                            disabled={props.disabled || props.setByEnv}
                            toggled={autoTranslationSettings.Enable}
                            id={'Enable'}
                            tabIndex={-1}
                            toggleClassName='btn-toggle-primary'
                            onToggle={handleToggle}
                        />
                    </div>
                </div>
            </SectionHeader>
            {autoTranslationSettings.Enable &&
            <SectionContent>
                <DropdownSetting
                    id={'Provider'}
                    label={
                        <FormattedMessage
                            id='admin.site.localization.autoTranslationProviderTitle'
                            defaultMessage='Translation Service:'
                        />
                    }
                    values={[
                        {value: 'libretranslate', text: 'LibreTranslate'},
                    ]}
                    helpText={
                        <FormattedMessage
                            id='admin.site.localization.autoTranslationProviderDescription'
                            defaultMessage='<strong>NOTE:</strong> If using external translation services (e.g., cloud based),{br}message data may be processed outside of your environment.'
                            values={providerHelpTextValues}
                        />
                    }
                    value={autoTranslationSettings.Provider || 'libretranslate'}
                    disabled={props.disabled || props.setByEnv}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
                />
                <MultiSelectSetting
                    id={'TargetLanguages'}
                    label={
                        <FormattedMessage
                            id='admin.site.localization.targetLanguagesTitle'
                            defaultMessage='Target Languages'
                        />
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage
                            id='admin.site.localization.targetLanguagesDescription'
                            defaultMessage='Select which languages to translate messages into. Messages will automatically be translated to these languages in channels where auto-translation is enabled. Users will see translations based on their language preference.'
                        />
                    }
                    selected={(autoTranslationSettings as any).TargetLanguages || ['en']}
                    onChange={handleChange}
                    disabled={props.disabled || props.setByEnv}
                    setByEnv={props.setByEnv}
                />
                {autoTranslationSettings.Provider === 'libretranslate' &&
                <LibreTranslateSettings
                    {...props}
                    onChange={handleChange}
                />
                }
                <AutoTranslationInfo/>
            </SectionContent>
            }
        </AdminSection>
    );
}
