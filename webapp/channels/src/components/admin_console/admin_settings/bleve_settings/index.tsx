// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import SettingsGroup from 'components/admin_console/settings_group';

import BulkIndexing from './bulk_indexing';
import {FIELD_IDS} from './constants';
import EnableAutocomplete from './enable_autocomplete';
import EnableIndexing from './enable_indexing';
import EnableSearching from './enable_searching';
import IndexDir from './index_dir';
import {messages} from './messages';
import PurgeIndexes from './purge_indexes';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction, HandleSaveFunction} from '../types';

export {searchableStrings} from './messages';

type State = {
    [FIELD_IDS.INDEX_DIR]: string;
    [FIELD_IDS.ENABLE_INDEXING]: boolean;
    [FIELD_IDS.ENABLE_SEARCHING]: boolean;
    [FIELD_IDS.ENABLE_AUTOCOMPLETE]: boolean;
    [FIELD_IDS.CAN_PURGE_AND_INDEX]: boolean;
}

const getConfigFromState: GetConfigFromStateFunction<State> = (state) => {
    return {
        BleveSettings: {
            IndexDir: state[FIELD_IDS.INDEX_DIR],
            EnableIndexing: state[FIELD_IDS.ENABLE_INDEXING],
            EnableSearching: state[FIELD_IDS.ENABLE_SEARCHING],
            EnableAutocomplete: state[FIELD_IDS.ENABLE_AUTOCOMPLETE],
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction<State> = (config) => {
    return {
        [FIELD_IDS.ENABLE_INDEXING]: config.BleveSettings?.EnableIndexing ?? false,
        [FIELD_IDS.INDEX_DIR]: config.BleveSettings?.IndexDir ?? '',
        [FIELD_IDS.ENABLE_SEARCHING]: config.BleveSettings?.EnableSearching ?? false,
        [FIELD_IDS.ENABLE_AUTOCOMPLETE]: config.BleveSettings?.EnableAutocomplete ?? false,
        [FIELD_IDS.CAN_PURGE_AND_INDEX]: config.BleveSettings?.EnableIndexing ?? false,
    };
};

const handleSaved: HandleSaveFunction = (config, updateState) => {
    updateState(FIELD_IDS.CAN_PURGE_AND_INDEX, config.BleveSettings?.EnableIndexing && config.BleveSettings.IndexDir !== '');
};

function renderTitle() {
    return (<FormattedMessage {...messages.title}/>);
}

type Props = {
    isDisabled?: boolean;
}

const BleveSettings = ({
    isDisabled,
}: Props) => {
    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig, undefined, handleSaved);

    const handleSettingChanged = useCallback((id: string, value: boolean) => {
        if (id === FIELD_IDS.ENABLE_INDEXING) {
            if (value === false) {
                handleChange(FIELD_IDS.ENABLE_SEARCHING, false);
                handleChange(FIELD_IDS.ENABLE_AUTOCOMPLETE, false);
            }
        }

        if (id !== FIELD_IDS.ENABLE_SEARCHING && id !== FIELD_IDS.ENABLE_AUTOCOMPLETE) {
            handleChange(FIELD_IDS.CAN_PURGE_AND_INDEX, false);
        }

        handleChange(id, value);
    }, [handleChange]);

    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <EnableIndexing
                    onChange={handleSettingChanged}
                    value={settingValues[FIELD_IDS.ENABLE_INDEXING]}
                    isDisabled={isDisabled}
                />
                <IndexDir
                    onChange={handleSettingChanged}
                    value={settingValues[FIELD_IDS.INDEX_DIR]}
                    isDisabled={isDisabled}
                />
                <BulkIndexing
                    canPurgeAndIndex={settingValues[FIELD_IDS.CAN_PURGE_AND_INDEX]}
                    isDisabled={isDisabled}
                />
                <PurgeIndexes
                    canPurgeAndIndex={settingValues[FIELD_IDS.CAN_PURGE_AND_INDEX]}
                    isDisabled={isDisabled}
                />
                <EnableSearching
                    onChange={handleSettingChanged}
                    value={settingValues[FIELD_IDS.ENABLE_SEARCHING]}
                    isDisabled={isDisabled}
                    indexingEnabled={settingValues[FIELD_IDS.ENABLE_INDEXING]}
                />
                <EnableAutocomplete
                    onChange={handleSettingChanged}
                    value={settingValues[FIELD_IDS.ENABLE_AUTOCOMPLETE]}
                    isDisabled={isDisabled}
                    indexingEnabled={settingValues[FIELD_IDS.ENABLE_INDEXING]}
                />
            </SettingsGroup>
        );
    }, [handleSettingChanged, isDisabled, settingValues]);

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

export default BleveSettings;
