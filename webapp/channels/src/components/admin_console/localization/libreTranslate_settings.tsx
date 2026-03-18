// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import type {AutoTranslationSettings} from '@mattermost/types/config';

import TextSetting from 'components/admin_console/text_setting';
import ExternalLink from 'components/external_link';

import './localization.scss';

import {type SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';

type LibreTranslateSettings = {
    URL: string;
    APIKey: string;
}

export default function LibreTranslateSettings(props: SystemConsoleCustomSettingsComponentProps) {
    const values = props.value as AutoTranslationSettings;
    const [libreTranslateSettings, setLibreTranslateSettings] = useState<LibreTranslateSettings>(values.LibreTranslate);

    const handleChange = useCallback((id: string, value: any) => {
        const updatedSettings = {
            ...libreTranslateSettings,
            [id]: value,
        };
        setLibreTranslateSettings(updatedSettings);
        props.onChange('LibreTranslate', updatedSettings);
    }, [props, libreTranslateSettings]);

    return (
        <>
            <TextSetting
                id='URL'
                label={
                    <FormattedMessage
                        id='admin.site.localization.autoTranslationProviderLibreTranslateURLTitle'
                        defaultMessage='LibreTranslate API Endpoint:'
                    />
                }
                placeholder={defineMessage({
                    id: 'admin.site.localization.autoTranslationProviderLibreTranslateURLExample',
                    defaultMessage: 'e.g.: "https://libretranslate.yourdomain.com"',
                })}
                type='url'
                value={libreTranslateSettings.URL}
                setByEnv={false}
                onChange={handleChange}
                disabled={props.disabled}
            />
            <TextSetting
                id='APIKey'
                label={
                    <FormattedMessage
                        id='admin.site.localization.autoTranslationProviderLibreTranslateAPIKeyTitle'
                        defaultMessage='LibreTranslate API Key:'
                    />
                }
                placeholder={defineMessage({
                    id: 'admin.site.localization.autoTranslationProviderLibreTranslateAPIKeyExample',
                    defaultMessage: 'Enter LibreTranslate API Key',
                })}
                helpText={
                    <FormattedMessage
                        id='admin.site.localization.autoTranslationProviderLibreTranslateAPIKeyDescription'
                        defaultMessage='If your LibreTranslate server requires an API key, enter it here. Otherwise, leave this field blank. View <link>LibreTranslate docs</link> for API Key management.'
                        values={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.libretranslate.com/guides/manage_api_keys/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />}
                type='password'
                value={libreTranslateSettings.APIKey}
                setByEnv={false}
                onChange={handleChange}
                disabled={props.disabled}
            />
        </>
    );
}
