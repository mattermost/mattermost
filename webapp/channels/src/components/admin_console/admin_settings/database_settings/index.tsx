// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {ping} from 'actions/admin_actions';

import SettingsGroup from 'components/admin_console/settings_group';

import ActiveSearchBackend from './active_search_backend';
import ConnMaxIdleTimeMilliseconds from './conn_max_idle_time_milliseconds';
import ConnMaxLifetimeMilliseconds from './conn_max_lifetime_miliseconds';
import {FIELD_IDS} from './constants';
import DataSource from './data_source';
import DisableDatabaseSearch from './disable_database_search';
import DriverName from './driver_name';
import MaxIdleConns from './max_idle_conns';
import MaxOpenConns from './max_open_conns';
import {messages} from './messages';
import MinimumHashtagLength from './minimum_hashtag_length';
import QueryTimeout from './query_timeout';
import RecycleDBButton from './recycle_db_button';
import SchemaMigrations from './schema_migrations';
import Trace from './trace';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';
import {parseIntNonNegative, parseIntNonZero} from '../utils';

export {searchableStrings} from './messages';

const getConfigFromState: GetConfigFromStateFunction = (config) => {
    // driverName and dataSource are read-only from the UI

    return {
        SqlSettings: {
            MaxIdleConns: parseIntNonZero(config[FIELD_IDS.MAX_IDLE_CONNS]),
            MaxOpenConns: parseIntNonZero(config[FIELD_IDS.MAX_OPEN_CONNS]),
            Trace: config[FIELD_IDS.TRACE],
            DisableDatabaseSearch: config[FIELD_IDS.DISABLE_DATABASE_SEARCH],
            QueryTimeout: parseIntNonZero(config[FIELD_IDS.QUERY_TIMEOUT]),
            ConnMaxLifetimeMilliseconds: parseIntNonNegative(config[FIELD_IDS.CONN_MAX_LIFETIME_MILLISECONDS]),
            ConnMaxIdleTimeMilliseconds: parseIntNonNegative(config[FIELD_IDS.CONN_MAX_IDLE_TIME_MILLISECONDS]),
            MinimumHashtagLength: parseIntNonZero(config[FIELD_IDS.MINIMUM_HASHTAG_LENGTH], 3, 2),
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    return {
        [FIELD_IDS.DRIVER_NAME]: config.SqlSettings.DriverName,
        [FIELD_IDS.DATA_SOURCE]: config.SqlSettings.DataSource,
        [FIELD_IDS.MAX_IDLE_CONNS]: config.SqlSettings.MaxIdleConns,
        [FIELD_IDS.MAX_OPEN_CONNS]: config.SqlSettings.MaxOpenConns,
        [FIELD_IDS.TRACE]: config.SqlSettings.Trace,
        [FIELD_IDS.DISABLE_DATABASE_SEARCH]: config.SqlSettings.DisableDatabaseSearch,
        [FIELD_IDS.QUERY_TIMEOUT]: config.SqlSettings.QueryTimeout,
        [FIELD_IDS.CONN_MAX_LIFETIME_MILLISECONDS]: config.SqlSettings.ConnMaxLifetimeMilliseconds,
        [FIELD_IDS.CONN_MAX_IDLE_TIME_MILLISECONDS]: config.SqlSettings.ConnMaxIdleTimeMilliseconds,
        [FIELD_IDS.MINIMUM_HASHTAG_LENGTH]: config.ServiceSettings.MinimumHashtagLength,
    };
};

function renderTitle() {
    return (<FormattedMessage {...messages.title}/>);
}

type Props = {
    isDisabled: boolean;
};

const DatabaseSettings = ({
    isDisabled,
}: Props) => {
    const [searchBackend, setSearchBackend] = useState('');
    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig);

    useEffect(() => {
        const getSearchBackend = async () => {
            const res = await ping()();
            setSearchBackend(res.ActiveSearchBackend);
        };

        getSearchBackend();
    }, []);

    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <div className='banner'>
                    <FormattedMessage {...messages.noteDescription}/>
                </div>
                <DriverName value={settingValues[FIELD_IDS.DRIVER_NAME]}/>
                <DataSource value={settingValues[FIELD_IDS.DATA_SOURCE]}/>
                <MaxIdleConns
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.MAX_IDLE_CONNS]}
                    isDisabled={isDisabled}
                />
                <MaxOpenConns
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.MAX_OPEN_CONNS]}
                    isDisabled={isDisabled}
                />
                <QueryTimeout
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.QUERY_TIMEOUT]}
                    isDisabled={isDisabled}
                />
                <ConnMaxLifetimeMilliseconds
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.CONN_MAX_LIFETIME_MILLISECONDS]}
                    isDisabled={isDisabled}
                />
                <ConnMaxIdleTimeMilliseconds
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.CONN_MAX_IDLE_TIME_MILLISECONDS]}
                    isDisabled={isDisabled}
                />
                <MinimumHashtagLength
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.MINIMUM_HASHTAG_LENGTH]}
                    isDisabled={isDisabled}
                />
                <Trace
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.TRACE]}
                    isDisabled={isDisabled}
                />
                <RecycleDBButton isDisabled={isDisabled}/>
                <DisableDatabaseSearch
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.DISABLE_DATABASE_SEARCH]}
                    isDisabled={isDisabled}
                />
                <SchemaMigrations/>
                <ActiveSearchBackend value={searchBackend}/>
            </SettingsGroup>
        );
    }, [handleChange, isDisabled, searchBackend, settingValues]);

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

export default DatabaseSettings;
