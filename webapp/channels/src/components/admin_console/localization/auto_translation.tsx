// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessage, defineMessages, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {AutoTranslationSettings} from '@mattermost/types/config';

import BooleanSetting from 'components/admin_console/boolean_setting';
import MultiSelectSetting from 'components/admin_console/multiselect_settings';
import Setting from 'components/admin_console/setting';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';
import TextSetting from 'components/admin_console/text_setting';
import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import Toggle from 'components/toggle';

import * as I18n from 'i18n/i18n.jsx';

import AgentsSettings from './agents_settings';
import AutoTranslationInfo from './auto_translation_info';
import LibreTranslateSettings from './libreTranslate_settings';

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
    const {available: isAgentsBridgeEnabled, reason: agentsBridgeUnavailableReason} = useGetAgentsBridgeEnabled();
    const [autoTranslationSettings, setAutoTranslationSettings] = useState<AutoTranslationSettings>(() => {
        const settings = props.value as AutoTranslationSettings;
        if (!settings.Provider) {
            return {...settings, Provider: 'libretranslate'};
        }
        return settings;
    });

    // Track timeout input separately to allow intermediate invalid states while typing
    const [timeoutInputValue, setTimeoutInputValue] = useState<string>(
        String(autoTranslationSettings.TimeoutMs || 5000),
    );
    const [timeoutError, setTimeoutError] = useState<string>('');

    const handleChange = useCallback((id: string, value: AutoTranslationSettings[keyof AutoTranslationSettings] | string[]) => {
        const updatedSettings = {
            ...autoTranslationSettings,
            [id]: value,
        };
        setAutoTranslationSettings(updatedSettings);
        props.onChange(props.id, updatedSettings);
    }, [props, autoTranslationSettings]);

    const handleTimeoutChange = useCallback((id: string, value: string) => {
        setTimeoutInputValue(value);

        const numValue = parseInt(value, 10);
        if (value === '' || isNaN(numValue) || numValue <= 0) {
            setTimeoutError('Timeout must be a positive number');

            // Propagate 0 so backend validation will reject the save
            handleChange(id, 0);
            return;
        }

        setTimeoutError('');
        handleChange(id, numValue);
    }, [handleChange]);

    const handleToggle = useCallback(() => {
        const newValue = !autoTranslationSettings.Enable;
        const newSettings = {
            ...autoTranslationSettings,
            Enable: newValue,
        };

        // Ensure provider is set when enabling
        if (newValue && !newSettings.Provider) {
            newSettings.Provider = 'libretranslate';
        }

        setAutoTranslationSettings(newSettings);
        props.onChange(props.id, newSettings);
    }, [autoTranslationSettings, props]);

    const availableLanguages = useMemo(() => {
        const values: Array<{value: string; text: string; order: number}> = [];
        for (const l of Object.values(locales)) {
            values.push({value: l.value, text: l.name, order: l.order});
        }
        values.sort((a, b) => a.order - b.order);
        return values;
    }, []);

    const showAgentsError = autoTranslationSettings.Provider === 'agents' && !isAgentsBridgeEnabled;

    const providerDescription = useMemo(() => (
        <div className='auto-translation-provider-description'>
            <FormattedMessage
                id='admin.site.localization.autoTranslationProviderHint'
                defaultMessage="Choose the provider you'd like to use for translation."
            />
        </div>
    ), []);

    const providerNote = useMemo(() => (
        <FormattedMessage
            id='admin.site.localization.autoTranslationProviderDescription'
            defaultMessage='<strong>NOTE:</strong> If using external translation services (e.g., cloud-based LLMs), message data may be processed outside your environment.'
            values={{
                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            }}
        />
    ), []);

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

    const selectedLanguages = autoTranslationSettings.TargetLanguages || ['en'];

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
            <SectionContent $compact={true}>
                <AutoTranslationInfo/>
                <div className={showAgentsError ? 'autotranslation-provider-error' : ''}>
                    <Setting
                        label={
                            <FormattedMessage
                                id='admin.site.localization.autoTranslationProviderTitle'
                                defaultMessage='Translation provider'
                            />
                        }
                        inputId={'Provider'}
                        setByEnv={props.setByEnv}
                        helpText={providerNote}
                    >
                        <div className='auto-translation-provider-body'>
                            {providerDescription}
                            <select
                                data-testid='Providerdropdown'
                                className='form-control'
                                id='Provider'
                                value={autoTranslationSettings.Provider || 'libretranslate'}
                                onChange={(e) => handleChange('Provider', e.target.value as AutoTranslationSettings['Provider'])}
                                disabled={props.disabled || props.setByEnv}
                            >
                                <option value='libretranslate'>{'LibreTranslate'}</option>
                                <option value='agents'>{'Mattermost Agents'}</option>
                            </select>
                            {showAgentsError && (
                                <div className='auto-translation-provider-error-message'>
                                    <i className='icon icon-alert-outline'/>
                                    <FormattedMessage
                                        id={agentsBridgeUnavailableReason || 'admin.site.localization.autoTranslationAgentsError'}
                                        defaultMessage={agentsBridgeUnavailableReason ? 'Mattermost AI plugin is unavailable.' : 'Mattermost Agents plugin is either disabled or not configured properly.'}
                                    />
                                </div>
                            )}
                            {showAgentsError && (
                                <Link
                                    to='/admin_console/plugins/plugin_mattermost-ai'
                                    className='agents-config-link'
                                >
                                    <FormattedMessage
                                        id='admin.site.localization.goToAgentsConfig'
                                        defaultMessage='Go to Agents plugin config'
                                    />
                                    <i className='icon icon-chevron-right'/>
                                </Link>
                            )}
                        </div>
                    </Setting>
                </div>
                {autoTranslationSettings.Provider === 'agents' && !showAgentsError &&
                <AgentsSettings
                    {...props}
                    onChange={handleChange}
                />
                }
                {autoTranslationSettings.Provider === 'libretranslate' &&
                <LibreTranslateSettings
                    {...props}
                    onChange={handleChange}
                />
                }
                <MultiSelectSetting
                    id={'TargetLanguages'}
                    label={
                        <FormattedMessage
                            id='admin.site.localization.targetLanguagesTitle'
                            defaultMessage='Languages allowed'
                        />
                    }
                    values={availableLanguages}
                    helpText={
                        <FormattedMessage
                            id='admin.site.localization.targetLanguagesDescription'
                            defaultMessage="Choose which languages you'd like to make available for auto-translation."
                        />
                    }
                    selected={selectedLanguages}
                    onChange={handleChange}
                    disabled={props.disabled || props.setByEnv}
                    setByEnv={props.setByEnv}
                />
                <TextSetting
                    id='TimeoutMs'
                    label={
                        <FormattedMessage
                            id='admin.site.localization.autoTranslationTimeoutTitle'
                            defaultMessage='Translation timeout (ms):'
                        />
                    }
                    placeholder={defineMessage({
                        id: 'admin.site.localization.autoTranslationTimeoutPlaceholder',
                        defaultMessage: 'e.g.: 5000',
                    })}
                    helpText={timeoutError ? (
                        <span className='autotranslation-error error-message'>{timeoutError}</span>
                    ) : (
                        <FormattedMessage
                            id='admin.site.localization.autoTranslationTimeoutDescription'
                            defaultMessage='Maximum time in milliseconds to wait for a translation response. Default is 5000ms (5 seconds).'
                        />
                    )}
                    type='number'
                    value={timeoutInputValue}
                    setByEnv={props.setByEnv}
                    onChange={handleTimeoutChange}
                    disabled={props.disabled}
                />
                <BooleanSetting
                    id='RestrictDMAndGM'
                    label={
                        <FormattedMessage
                            id='admin.site.localization.restrictDMAndGMTitle'
                            defaultMessage='Restrict auto-translation on direct messages and group messages'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.site.localization.restrictDMAndGMDescription'
                            defaultMessage='By default, any member of a direct message or group message can enable auto-translation in those channels. If restricted, auto-translation will not be available in direct messages and group messages.'
                        />
                    }
                    value={autoTranslationSettings.RestrictDMAndGM}
                    onChange={handleChange}
                    disabled={props.disabled || props.setByEnv}
                    setByEnv={props.setByEnv}
                />
            </SectionContent>
            }
        </AdminSection>
    );
}
