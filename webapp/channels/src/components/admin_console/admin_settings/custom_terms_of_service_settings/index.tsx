// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getTermsOfService, createTermsOfService} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import AdminSetting from 'components/admin_console/admin_settings/admin_settings';
import SettingsGroup from 'components/admin_console/settings_group';
import LoadingScreen from 'components/loading_screen';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {FIELD_IDS} from './constants';
import CustomTermsOfServiceEnabled from './custom_terms_of_service_enabled';
import CustomTermsOfServiceReAcceptancePeriod from './custom_terms_of_service_re_acceptance_period';
import CustomTermsOfServiceText from './custom_terms_of_service_text';
import {messages} from './messages';

import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';
import {parseIntNonZero} from '../utils';

export {searchableStrings, messages} from './messages';

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    return {
        [FIELD_IDS.TERMS_ENABLED]: config.SupportSettings?.CustomTermsOfServiceEnabled,
        [FIELD_IDS.RE_ACCEPTANCE_PERIOD]: parseIntNonZero(String(config.SupportSettings?.CustomTermsOfServiceReAcceptancePeriod), Constants.DEFAULT_TERMS_OF_SERVICE_RE_ACCEPTANCE_PERIOD),
    };
};

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    return {
        SupportSettings: {
            CustomTermsOfServiceEnabled: Boolean(state[FIELD_IDS.TERMS_ENABLED]),
            CustomTermsOfServiceReAcceptancePeriod: parseIntNonZero(String(state[FIELD_IDS.RE_ACCEPTANCE_PERIOD]), Constants.DEFAULT_TERMS_OF_SERVICE_RE_ACCEPTANCE_PERIOD),
        },
    };
};

function renderTitle() {
    return (<FormattedMessage {...messages.termsOfServiceTitle}/>);
}

type Props = {
    isDisabled?: boolean;
}

const CustomTermsOfServiceSettings = ({
    isDisabled,
}: Props) => {
    const dispatch = useDispatch();
    const [loadingTermsText, setLoadingTermsText] = useState(true);
    const [receivedTermsText, setReceivedTermsText] = useState('');

    const licenseAllows = useSelector((state: GlobalState) => {
        const license = getLicense(state);
        return license.IsLicensed && (license.CustomTermsOfService === 'true');
    });

    const customTermsOfServiceEnabled = useSelector((state: GlobalState) => getConfig(state).SupportSettings?.CustomTermsOfServiceEnabled);

    const preSave = useCallback(async (values: {[x: string]: any}) => {
        if (values[FIELD_IDS.TERMS_ENABLED] && (receivedTermsText !== values[FIELD_IDS.TERMS_TEXT] || !customTermsOfServiceEnabled)) {
            const result = await dispatch(createTermsOfService(values[FIELD_IDS.TERMS_TEXT]));
            if (result.error) {
                return result.error.message || 'Unknown error creating the terms of service';
            }
        }

        return '';
    }, [customTermsOfServiceEnabled, dispatch, receivedTermsText]);

    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig, preSave);

    const renderSettings = useCallback(() => {
        if (loadingTermsText) {
            return <LoadingScreen/>;
        }

        const generalDisabled = isDisabled || !settingValues[FIELD_IDS.TERMS_ENABLED];
        return (
            <SettingsGroup>
                <CustomTermsOfServiceEnabled
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.TERMS_ENABLED]}
                    isDisabled={isDisabled || !licenseAllows}
                />
                <CustomTermsOfServiceText
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.TERMS_TEXT]}
                    isDisabled={generalDisabled}
                />
                <CustomTermsOfServiceReAcceptancePeriod
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.RE_ACCEPTANCE_PERIOD]}
                    isDisabled={generalDisabled}
                />
            </SettingsGroup>
        );
    }, [handleChange, isDisabled, licenseAllows, loadingTermsText, settingValues]);

    useEffect(() => {
        const loadTerms = async () => {
            const {data} = await dispatch(getTermsOfService());
            if (data) {
                handleChange(FIELD_IDS.TERMS_TEXT, data.text);
                setReceivedTermsText(data.text);
            }
            setLoadingTermsText(false);
        };

        loadTerms();
    }, []);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            isDisabled={isDisabled}
            serverError={serverError}
        />
    );
};

export default CustomTermsOfServiceSettings;
