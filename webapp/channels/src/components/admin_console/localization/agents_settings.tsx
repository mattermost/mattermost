// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import type {LLMService} from '@mattermost/types/agents';
import type {AutoTranslationSettings} from '@mattermost/types/config';

import DropdownSetting from 'components/admin_console/dropdown_setting';
import useGetLLMServices from 'components/common/hooks/useGetLLMServices';

import './localization.scss';

import {type SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';

type AgentsSettingsState = {
    LLMServiceID: string;
};

export default function AgentsSettings(props: SystemConsoleCustomSettingsComponentProps) {
    const {formatMessage} = useIntl();
    const values = props.value as AutoTranslationSettings;
    const services = useGetLLMServices();
    const [agentsSettings, setAgentsSettings] = useState<AgentsSettingsState>({
        LLMServiceID: values.Agents?.LLMServiceID || '',
    });

    const handleChange = useCallback((id: string, value: string) => {
        const updatedSettings = {
            ...agentsSettings,
            [id]: value,
        };
        setAgentsSettings(updatedSettings);
        props.onChange('Agents', updatedSettings);
    }, [props, agentsSettings]);

    const llmServicesOptions = useMemo(() => {
        return ((services || []) as LLMService[]).map((service: LLMService) => ({value: service.id, text: service.name}));
    }, [services]);

    const hasLLMServices = llmServicesOptions.length > 0;

    // A saved ID that matches no service would otherwise render as the first option,
    // making the broken selection look valid and impossible to re-select.
    const selectedServiceUnavailable = hasLLMServices &&
        Boolean(agentsSettings.LLMServiceID) &&
        !llmServicesOptions.some((option) => option.value === agentsSettings.LLMServiceID);

    const dropdownValues = useMemo(() => {
        if (!hasLLMServices) {
            return [{value: '', text: ''}];
        }
        if (selectedServiceUnavailable) {
            return [
                {
                    value: agentsSettings.LLMServiceID,
                    text: formatMessage({
                        id: 'admin.site.localization.autoTranslationLLMServiceUnavailableOption',
                        defaultMessage: 'Unavailable service ({serviceId})',
                    }, {serviceId: agentsSettings.LLMServiceID}),
                },
                ...llmServicesOptions,
            ];
        }
        return llmServicesOptions;
    }, [hasLLMServices, selectedServiceUnavailable, agentsSettings.LLMServiceID, llmServicesOptions, formatMessage]);

    useEffect(() => {
        if (!agentsSettings.LLMServiceID && hasLLMServices) {
            handleChange('LLMServiceID', llmServicesOptions[0].value);
        }
    }, [agentsSettings.LLMServiceID, hasLLMServices, llmServicesOptions, handleChange]);

    return (
        <div className={selectedServiceUnavailable ? 'autotranslation-provider-error' : ''}>
            <DropdownSetting
                id={'LLMServiceID'}
                label={
                    <FormattedMessage
                        id='admin.site.localization.autoTranslationLLMServiceTitle'
                        defaultMessage='AI Service'
                    />
                }
                values={dropdownValues}
                helpText={
                    <div className='ai-service-help-text'>
                        {selectedServiceUnavailable && (
                            <div className='auto-translation-provider-error-message'>
                                <i className='icon icon-alert-outline'/>
                                <FormattedMessage
                                    id='admin.site.localization.autoTranslationLLMServiceUnavailable'
                                    defaultMessage='The selected AI service is no longer available in the Agents plugin. Select an available service and save.'
                                />
                            </div>
                        )}
                        <FormattedMessage
                            id='admin.site.localization.autoTranslationLLMConfigNote'
                            defaultMessage='LLMs must first be configured in the Agents plugin.'
                        />
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
                    </div>
                }
                value={agentsSettings.LLMServiceID}
                disabled={props.disabled || props.setByEnv || !hasLLMServices}
                setByEnv={props.setByEnv}
                onChange={handleChange}
            />
        </div>
    );
}
