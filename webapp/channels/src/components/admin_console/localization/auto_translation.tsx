// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AutoTranslationSettings} from '@mattermost/types/config';

import DropdownSetting from 'components/admin_console/dropdown_setting';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';
import Toggle from 'components/toggle';

import AutoTranslationInfo from './auto_translation_info';
import LibreTranslateSettings from './libreTranslate_settings';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';
import './localization.scss';

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
                            <FormattedMessage
                                id='admin.site.localization.enableAutoTranslationTitle'
                                defaultMessage='Auto-translation'
                            />
                        </h1>
                        <h5 className='localization-section-description'>
                            <FormattedMessage
                                id='admin.site.localization.enableAutoTranslationDescriptio'
                                defaultMessage='Configure auto-translation for channels and direct messages'
                            />
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
                            onToggle={() => handleChange('Enable', !autoTranslationSettings.Enable)}
                        />
                    </div>
                </div>
            </SectionHeader>
            {autoTranslationSettings.Enable &&
            <SectionContent>
                <DropdownSetting
                    key={props.id + '_Provider_' + props.id + '.AutoTranslationSettings.Provider'}
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
                            values={{br: <br/>, strong: (msg: string) => <strong>{msg}</strong>}}
                        />
                    }
                    value={autoTranslationSettings.Provider || 'libretranslate'}
                    disabled={props.disabled || props.setByEnv}
                    setByEnv={props.setByEnv}
                    onChange={handleChange}
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
