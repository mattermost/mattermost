// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

import {elasticsearchTest} from 'actions/admin_actions.jsx';

import SettingsGroup from 'components/admin_console/settings_group';

import Backend from './backend';
import BulkIndexing from './bulk_indexing';
import Ca from './ca';
import ClientCert from './client_cert';
import ClientKey from './client_key';
import ConnectionUrl from './connection_url';
import {FIELD_IDS} from './constants';
import EnableAutocomplete from './enable_autocomplete';
import EnableIndexing from './enable_indexing';
import EnableSearching from './enable_searching';
import IgnoredPurgeIndexes from './ignored_purge_indexes';
import {messages} from './messages';
import Password from './password';
import PurgeIndexesSection from './purge_indexes_section';
import RebuildChannelsIndexButton from './rebuild_channels_index_button';
import SkipTLSVerification from './skip_tls_verification';
import Sniff from './sniff';
import TestConfig from './test_config';
import Username from './username';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction, HandleSaveFunction} from '../types';

export {searchableStrings} from './messages';

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    return {
        ElasticsearchSettings: {
            ConnectionURL: state[FIELD_IDS.CONNECTION_URL],
            Backend: state[FIELD_IDS.BACKEND],
            SkipTLSVerification: state[FIELD_IDS.SKIP_TLS_VERIFICATION],
            CA: state[FIELD_IDS.CA],
            ClientCert: state[FIELD_IDS.CLIENT_CERT],
            ClientKey: state[FIELD_IDS.CLIENT_KEY],
            Username: state[FIELD_IDS.USERNAME],
            Password: state[FIELD_IDS.PASSWORD],
            Sniff: state[FIELD_IDS.SNIFF],
            EnableIndexing: state[FIELD_IDS.ENABLE_INDEXING],
            EnableSearching: state[FIELD_IDS.ENABLE_SEARCHING],
            EnableAutocomplete: state[FIELD_IDS.ENABLE_AUTOCOMPLETE],
            IgnoredPurgeIndexes: state[FIELD_IDS.IGNORED_PURGE_INDEXES],
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config: AdminConfig) => {
    return {
        [FIELD_IDS.CONNECTION_URL]: config.ElasticsearchSettings.ConnectionURL,
        [FIELD_IDS.BACKEND]: config.ElasticsearchSettings.Backend,
        [FIELD_IDS.SKIP_TLS_VERIFICATION]: config.ElasticsearchSettings.SkipTLSVerification,
        [FIELD_IDS.CA]: config.ElasticsearchSettings.CA,
        [FIELD_IDS.CLIENT_CERT]: config.ElasticsearchSettings.ClientCert,
        [FIELD_IDS.CLIENT_KEY]: config.ElasticsearchSettings.ClientKey,
        [FIELD_IDS.USERNAME]: config.ElasticsearchSettings.Username,
        [FIELD_IDS.PASSWORD]: config.ElasticsearchSettings.Password,
        [FIELD_IDS.SNIFF]: config.ElasticsearchSettings.Sniff,
        [FIELD_IDS.ENABLE_INDEXING]: config.ElasticsearchSettings.EnableIndexing,
        [FIELD_IDS.ENABLE_SEARCHING]: config.ElasticsearchSettings.EnableSearching,
        [FIELD_IDS.ENABLE_AUTOCOMPLETE]: config.ElasticsearchSettings.EnableAutocomplete,
        [FIELD_IDS.CONFIG_TESTED]: true,
        [FIELD_IDS.CAN_SAVE]: true,
        [FIELD_IDS.CAN_PURGE_AND_INDEX]: config.ElasticsearchSettings.EnableIndexing,
        [FIELD_IDS.IGNORED_PURGE_INDEXES]: config.ElasticsearchSettings.IgnoredPurgeIndexes,
    };
};

function renderTitle() {
    return <FormattedMessage {...messages.title}/>;
}

type Props = {
    isDisabled?: boolean;
}

const ElasticSearchSettings = ({
    isDisabled,
}: Props) => {
    const handleSaved: HandleSaveFunction = useCallback((config, updateSettings) => {
        updateSettings(FIELD_IDS.CAN_PURGE_AND_INDEX, config.ElasticsearchSettings?.EnableIndexing);
    }, []);

    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig, undefined, handleSaved);
    const handleSettingsChange = useCallback((id: string, value: boolean) => {
        if (id === FIELD_IDS.ENABLE_INDEXING) {
            if (value) {
                handleChange(FIELD_IDS.ENABLE_SEARCHING, false);
                handleChange(FIELD_IDS.ENABLE_AUTOCOMPLETE, false);
            } else {
                handleChange(FIELD_IDS.CAN_SAVE, false);
                handleChange(FIELD_IDS.CONFIG_TESTED, false);
            }
        }

        if ([
            FIELD_IDS.CONNECTION_URL,
            FIELD_IDS.BACKEND,
            FIELD_IDS.SKIP_TLS_VERIFICATION,
            FIELD_IDS.USERNAME,
            FIELD_IDS.PASSWORD,
            FIELD_IDS.SNIFF,
            FIELD_IDS.CA,
            FIELD_IDS.CLIENT_CERT,
            FIELD_IDS.CLIENT_KEY,
        ].includes(id)) {
            handleChange(FIELD_IDS.CAN_SAVE, false);
            handleChange(FIELD_IDS.CONFIG_TESTED, false);
        }

        if (id !== FIELD_IDS.ENABLE_SEARCHING && id !== FIELD_IDS.ENABLE_AUTOCOMPLETE) {
            handleChange(FIELD_IDS.CAN_PURGE_AND_INDEX, false);
        }

        handleChange(id, value);
    }, [handleChange]);

    const doTestConfig = useCallback((
        success: () => void,
        error: (error: {message: string; detailed_message?: string},
        ) => void): void => {
        const config = getConfigFromState(settingValues);

        elasticsearchTest(
            config,
            () => {
                handleChange(FIELD_IDS.CONFIG_TESTED, true);
                handleChange(FIELD_IDS.CAN_SAVE, true);
                success();
            },
            (err: {message: string; detailed_message?: string}) => {
                handleChange(FIELD_IDS.CONFIG_TESTED, false);
                handleChange(FIELD_IDS.CAN_SAVE, false);
                error(err);
            },
        );
    }, [handleChange, settingValues]);

    const generalIsDisabled = isDisabled && !settingValues[FIELD_IDS.ENABLE_INDEXING];
    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <EnableIndexing
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.ENABLE_INDEXING]}
                    isDisabled={isDisabled}
                />
                <Backend
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.BACKEND]}
                    isDisabled={generalIsDisabled}
                />
                <ConnectionUrl
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.CONNECTION_URL]}
                    isDisabled={generalIsDisabled}
                />
                <Ca
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.CA]}
                    isDisabled={generalIsDisabled}
                />
                <ClientCert
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.CLIENT_CERT]}
                    isDisabled={generalIsDisabled}
                />
                <ClientKey
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.CLIENT_KEY]}
                    isDisabled={generalIsDisabled}
                />
                <SkipTLSVerification
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.SKIP_TLS_VERIFICATION]}
                    isDisabled={generalIsDisabled}
                />
                <Username
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.USERNAME]}
                    isDisabled={generalIsDisabled}
                />
                <Password
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.PASSWORD]}
                    isDisabled={generalIsDisabled}
                />
                <Sniff
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.SNIFF]}
                    isDisabled={generalIsDisabled}
                />
                <TestConfig
                    doTestConfig={doTestConfig}
                    isDisabled={!settingValues[FIELD_IDS.ENABLE_INDEXING]}
                />
                <BulkIndexing isDisabled={isDisabled || !settingValues[FIELD_IDS.CAN_PURGE_AND_INDEX]}/>
                <RebuildChannelsIndexButton isDisabled={isDisabled || !settingValues[FIELD_IDS.CAN_PURGE_AND_INDEX]}/>
                <PurgeIndexesSection isDisabled={isDisabled || !settingValues[FIELD_IDS.CAN_PURGE_AND_INDEX]}/>
                <IgnoredPurgeIndexes
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.IGNORED_PURGE_INDEXES]}
                    isDisabled={generalIsDisabled}
                />
                <EnableSearching
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.ENABLE_SEARCHING]}
                    isDisabled={generalIsDisabled || !settingValues[FIELD_IDS.CONFIG_TESTED]}
                />
                <EnableAutocomplete
                    onChange={handleSettingsChange}
                    value={settingValues[FIELD_IDS.ENABLE_AUTOCOMPLETE]}
                    isDisabled={generalIsDisabled || !settingValues[FIELD_IDS.CONFIG_TESTED]}
                />
            </SettingsGroup>
        );
    }, [doTestConfig, generalIsDisabled, handleSettingsChange, isDisabled, settingValues]);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            serverError={serverError}
            isDisabled={isDisabled || !settingValues[FIELD_IDS.CAN_SAVE]}
        />
    );
};

export default ElasticSearchSettings;
