// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AdminConfig} from '@mattermost/types/config';

import {recycleDatabaseConnection, ping} from 'actions/admin_actions';
import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';

import ExternalLink from 'components/external_link';

import AdminSettings, {BaseState} from './admin_settings';
import BooleanSetting from './boolean_setting';
import RequestButton from './request_button/request_button';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

import MigrationsTable from './database';
import {DocLinks} from 'utils/constants';

interface Props {
    license: {
        IsLicensed: string;
    };
    isDisabled: boolean;
}

interface State extends BaseState {
    searchBackend: string;
    maxIdleConns: number;
    maxOpenConns: number;
    trace: boolean;
    disableDatabaseSearch: boolean;
    queryTimeout: number;
    connMaxLifetimeMilliseconds: number;
    connMaxIdleTimeMilliseconds: number;
    minimumHashtagLength: number;
    dataSource: string;
    driverName: string;
}

export default class DatabaseSettings extends AdminSettings<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            ...this.state,
            searchBackend: '',
        };
    }

    getConfigFromState = (config: AdminConfig) => {
        // driverName and dataSource are read-only from the UI

        config.SqlSettings.MaxIdleConns = this.parseIntNonZero(this.state.maxIdleConns);
        config.SqlSettings.MaxOpenConns = this.parseIntNonZero(this.state.maxOpenConns);
        config.SqlSettings.Trace = this.state.trace;
        config.SqlSettings.DisableDatabaseSearch = this.state.disableDatabaseSearch;
        config.SqlSettings.QueryTimeout = this.parseIntNonZero(this.state.queryTimeout);
        config.SqlSettings.ConnMaxLifetimeMilliseconds = this.parseIntNonNegative(this.state.connMaxLifetimeMilliseconds);
        config.SqlSettings.ConnMaxIdleTimeMilliseconds = this.parseIntNonNegative(this.state.connMaxIdleTimeMilliseconds);
        config.ServiceSettings.MinimumHashtagLength = this.parseIntNonZero(this.state.minimumHashtagLength, 3, 2);

        return config;
    };

    componentDidMount() {
        this.getSearchBackend().then((searchBackend) => {
            this.setState({searchBackend});
        });
    }

    async getSearchBackend() {
        const res = await ping()();
        return res.ActiveSearchBackend;
    }

    getStateFromConfig(config: AdminConfig) {
        return {
            driverName: config.SqlSettings.DriverName,
            dataSource: config.SqlSettings.DataSource,
            maxIdleConns: config.SqlSettings.MaxIdleConns,
            maxOpenConns: config.SqlSettings.MaxOpenConns,
            trace: config.SqlSettings.Trace,
            disableDatabaseSearch: config.SqlSettings.DisableDatabaseSearch,
            queryTimeout: config.SqlSettings.QueryTimeout,
            connMaxLifetimeMilliseconds: config.SqlSettings.ConnMaxLifetimeMilliseconds,
            connMaxIdleTimeMilliseconds: config.SqlSettings.ConnMaxIdleTimeMilliseconds,
            minimumHashtagLength: config.ServiceSettings.MinimumHashtagLength,
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.database.title'
                defaultMessage='Database Settings'
            />
        );
    }

    renderSettings = () => {
        const dataSource = '**********' + this.state.dataSource.substring(this.state.dataSource.indexOf('@'));

        let recycleDbButton = <div/>;
        if (this.props.license.IsLicensed === 'true') {
            recycleDbButton = (
                <RequestButton
                    requestAction={recycleDatabaseConnection}
                    helpText={
                        <FormattedMessage
                            id='admin.recycle.recycleDescription'
                            defaultMessage='Deployments using multiple databases can switch from one master database to another without restarting the Mattermost server by updating "config.json" to the new desired configuration and using the {reloadConfiguration} feature to load the new settings while the server is running. The administrator should then use {featureName} feature to recycle the database connections based on the new settings.'
                            values={{
                                featureName: (
                                    <b>
                                        <FormattedMessage
                                            id='admin.recycle.recycleDescription.featureName'
                                            defaultMessage='Recycle Database Connections'
                                        />
                                    </b>
                                ),
                                reloadConfiguration: (
                                    <a href='../environment/web_server'>
                                        <b>
                                            <FormattedMessage
                                                id='admin.recycle.recycleDescription.reloadConfiguration'
                                                defaultMessage='Environment > Web Server > Reload Configuration from Disk'
                                            />
                                        </b>
                                    </a>
                                ),
                            }}
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.recycle.button'
                            defaultMessage='Recycle Database Connections'
                        />
                    }
                    showSuccessMessage={false}
                    errorMessage={{
                        id: t('admin.recycle.reloadFail'),
                        defaultMessage: 'Recycling unsuccessful: {error}',
                    }}
                    includeDetailedError={true}
                    disabled={this.props.isDisabled}
                />
            );
        }

        return (
            <SettingsGroup>
                <div className='banner'>
                    <FormattedMessage
                        id='admin.sql.noteDescription'
                        defaultMessage='Changing properties in this section will require a server restart before taking effect.'
                    />
                </div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='DriverName'
                    >
                        <FormattedMessage
                            id='admin.sql.driverName'
                            defaultMessage='Driver Name:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='text'
                            className='form-control'
                            value={this.state.driverName}
                            disabled={true}
                        />
                        <div className='help-text'>
                            <FormattedMessage
                                id='admin.sql.driverNameDescription'
                                defaultMessage='Set the database driver in the config.json file.'
                            />
                        </div>
                    </div>
                </div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='DataSource'
                    >
                        <FormattedMessage
                            id='admin.sql.dataSource'
                            defaultMessage='Data Source:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='text'
                            className='form-control'
                            value={dataSource}
                            disabled={true}
                        />
                        <div className='help-text'>
                            <FormattedMessage
                                id='admin.sql.dataSourceDescription'
                                defaultMessage='Set the database source in the config.json file.'
                            />
                        </div>
                    </div>
                </div>
                <TextSetting
                    id='maxIdleConns'
                    label={
                        <FormattedMessage
                            id='admin.sql.maxConnectionsTitle'
                            defaultMessage='Maximum Idle Connections:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.maxConnectionsExample', 'E.g.: "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.maxConnectionsDescription'
                            defaultMessage='Maximum number of idle connections held open to the database.'
                        />
                    }
                    value={this.state.maxIdleConns}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.MaxIdleConns')}
                    disabled={this.props.isDisabled}
                    type='text'
                />
                <TextSetting
                    id='maxOpenConns'
                    label={
                        <FormattedMessage
                            id='admin.sql.maxOpenTitle'
                            defaultMessage='Maximum Open Connections:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.maxOpenExample', 'E.g.: "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.maxOpenDescription'
                            defaultMessage='Maximum number of open connections held open to the database.'
                        />
                    }
                    value={this.state.maxOpenConns}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.MaxOpenConns')}
                    disabled={this.props.isDisabled}
                    type='text'
                />
                <TextSetting
                    id='queryTimeout'
                    label={
                        <FormattedMessage
                            id='admin.sql.queryTimeoutTitle'
                            defaultMessage='Query Timeout:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.queryTimeoutExample', 'E.g.: "30"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.queryTimeoutDescription'
                            defaultMessage='The number of seconds to wait for a response from the database after opening a connection and sending the query. Errors that you see in the UI or in the logs as a result of a query timeout can vary depending on the type of query.'
                        />
                    }
                    value={this.state.queryTimeout}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.QueryTimeout')}
                    disabled={this.props.isDisabled}
                    type='text'
                />
                <TextSetting
                    id='connMaxLifetimeMilliseconds'
                    label={
                        <FormattedMessage
                            id='admin.sql.connMaxLifetimeTitle'
                            defaultMessage='Maximum Connection Lifetime:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.connMaxLifetimeExample', 'E.g.: "3600000"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.connMaxLifetimeDescription'
                            defaultMessage='Maximum lifetime for a connection to the database in milliseconds.'
                        />
                    }
                    value={this.state.connMaxLifetimeMilliseconds}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.ConnMaxLifetimeMilliseconds')}
                    disabled={this.props.isDisabled}
                    type='text'
                />
                <TextSetting
                    id='connMaxIdleTimeMilliseconds'
                    label={
                        <FormattedMessage
                            id='admin.sql.connMaxIdleTimeTitle'
                            defaultMessage='Maximum Connection Idle Time:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.connMaxIdleTimeExample', 'E.g.: "300000"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.connMaxIdleTimeDescription'
                            defaultMessage='Maximum idle time for a connection to the database in milliseconds.'
                        />
                    }
                    value={this.state.connMaxIdleTimeMilliseconds}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.ConnMaxIdleTimeMilliseconds')}
                    disabled={this.props.isDisabled}
                    type='text'
                />
                <TextSetting
                    id='minimumHashtagLength'
                    label={
                        <FormattedMessage
                            id='admin.service.minimumHashtagLengthTitle'
                            defaultMessage='Minimum Hashtag Length:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.minimumHashtagLengthExample', 'E.g.: "3"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.minimumHashtagLengthDescription'
                            defaultMessage='Minimum number of characters in a hashtag. This must be greater than or equal to 2. MySQL databases must be configured to support searching strings shorter than three characters, <link>see documentation</link>.'
                            values={{
                                link: (msg) => (
                                    <ExternalLink
                                        location='database_settings'
                                        href='https://dev.mysql.com/doc/refman/8.0/en/fulltext-fine-tuning.html'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.minimumHashtagLength}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('ServiceSettings.MinimumHashtagLength')}
                    disabled={this.props.isDisabled}
                    type='text'
                />
                <BooleanSetting
                    id='trace'
                    label={
                        <FormattedMessage
                            id='admin.sql.traceTitle'
                            defaultMessage='SQL Statement Logging: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.sql.traceDescription'
                            defaultMessage='(Development Mode) When true, executing SQL statements are written to the log.'
                        />
                    }
                    value={this.state.trace}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.Trace')}
                    disabled={this.props.isDisabled}
                />
                {recycleDbButton}
                <BooleanSetting
                    id='disableDatabaseSearch'
                    label={
                        <FormattedMessage
                            id='admin.sql.disableDatabaseSearchTitle'
                            defaultMessage='Disable database search: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.sql.disableDatabaseSearchDescription'
                            defaultMessage='Disables the use of the database to perform searches. Should only be used when other <link>search engines</link> are configured.'
                            values={{
                                link: (msg) => (
                                    <ExternalLink
                                        location='database_settings'
                                        href={DocLinks.ELASTICSEARCH}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.disableDatabaseSearch}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('SqlSettings.DisableDatabaseSearch')}
                    disabled={this.props.isDisabled}
                />
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                    >
                        <FormattedMessage
                            id='admin.database.migrations_table.title'
                            defaultMessage='Schema Migrations:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <div className='migrations-table-setting'>
                            <MigrationsTable
                                createHelpText={
                                    <FormattedMessage
                                        id='admin.database.migrations_table.help_text'
                                        defaultMessage='All applied migrations.'
                                    />
                                }
                            />
                        </div>
                    </div>
                </div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                    >
                        <FormattedMessage
                            id='admin.database.search_backend.title'
                            defaultMessage='Active Search Backend:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='text'
                            className='form-control'
                            value={this.state.searchBackend}
                            disabled={true}
                        />
                        <div className='help-text'>
                            <FormattedMessage
                                id='admin.database.search_backend.help_text'
                                defaultMessage='Shows the currently active backend used for search. Values can be none, database, elasticsearch, bleve etc.'
                            />
                        </div>
                    </div>
                </div>
            </SettingsGroup>
        );
    };
}
