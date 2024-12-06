// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

import {recycleDatabaseConnection, ping} from 'actions/admin_actions';

import ExternalLink from 'components/external_link';

import {DocLinks} from 'utils/constants';

import BooleanSetting from './boolean_setting';
import MigrationsTable from './database';
import type {BaseState} from './old_admin_settings';
import OLDAdminSettings from './old_admin_settings';
import RequestButton from './request_button/request_button';
import SettingSet from './setting_set';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

type Props = {
    license: {
        IsLicensed: string;
    };
    isDisabled: boolean;
};

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

const messages = defineMessages({
    title: {id: 'admin.database.title', defaultMessage: 'Database Settings'},
    recycleDescription: {id: 'admin.recycle.recycleDescription', defaultMessage: 'Deployments using multiple databases can switch from one master database to another without restarting the Mattermost server by updating "config.json" to the new desired configuration and using the {reloadConfiguration} feature to load the new settings while the server is running. The administrator should then use {featureName} feature to recycle the database connections based on the new settings.'},
    featureName: {id: 'admin.recycle.recycleDescription.featureName', defaultMessage: 'Recycle Database Connections'},
    reloadConfiguration: {id: 'admin.recycle.recycleDescription.reloadConfiguration', defaultMessage: 'Environment > Web Server > Reload Configuration from Disk'},
    button: {id: 'admin.recycle.button', defaultMessage: 'Recycle Database Connections'},
    noteDescription: {id: 'admin.sql.noteDescription', defaultMessage: 'Changing properties in this section will require a server restart before taking effect.'},
    disableDatabaseSearchTitle: {id: 'admin.sql.disableDatabaseSearchTitle', defaultMessage: 'Disable database search: '},
    disableDatabaseSearchDescription: {id: 'admin.sql.disableDatabaseSearchDescription', defaultMessage: 'Disables the use of the database to perform searches. Should only be used when other <link>search engines</link> are configured.'},
    driverName: {id: 'admin.sql.driverName', defaultMessage: 'Driver Name:'},
    driverNameDescription: {id: 'admin.sql.driverNameDescription', defaultMessage: 'Set the database driver in the config.json file.'},
    dataSource: {id: 'admin.sql.dataSource', defaultMessage: 'Data Source:'},
    dataSourceDescription: {id: 'admin.sql.dataSourceDescription', defaultMessage: 'Set the database source in the config.json file.'},
    maxConnectionsTitle: {id: 'admin.sql.maxConnectionsTitle', defaultMessage: 'Maximum Idle Connections:'},
    maxConnectionsDescription: {id: 'admin.sql.maxConnectionsDescription', defaultMessage: 'Maximum number of idle connections held open to the database.'},
    maxOpenTitle: {id: 'admin.sql.maxOpenTitle', defaultMessage: 'Maximum Open Connections:'},
    maxOpenDescription: {id: 'admin.sql.maxOpenDescription', defaultMessage: 'Maximum number of open connections held open to the database.'},
    queryTimeoutTitle: {id: 'admin.sql.queryTimeoutTitle', defaultMessage: 'Query Timeout:'},
    queryTimeoutDescription: {id: 'admin.sql.queryTimeoutDescription', defaultMessage: 'The number of seconds to wait for a response from the database after opening a connection and sending the query. Errors that you see in the UI or in the logs as a result of a query timeout can vary depending on the type of query.'},
    connMaxLifetimeTitle: {id: 'admin.sql.connMaxLifetimeTitle', defaultMessage: 'Maximum Connection Lifetime:'},
    connMaxLifetimeDescription: {id: 'admin.sql.connMaxLifetimeDescription', defaultMessage: 'Maximum lifetime for a connection to the database in milliseconds.'},
    connMaxIdleTimeTitle: {id: 'admin.sql.connMaxIdleTimeTitle', defaultMessage: 'Maximum Connection Idle Time:'},
    connMaxIdleTimeDescription: {id: 'admin.sql.connMaxIdleTimeDescription', defaultMessage: 'Maximum idle time for a connection to the database in milliseconds.'},
    minimumHashtagLengthTitle: {id: 'admin.service.minimumHashtagLengthTitle', defaultMessage: 'Minimum Hashtag Length:'},
    minimumHashtagLengthDescription: {id: 'admin.service.minimumHashtagLengthDescription', defaultMessage: 'Minimum number of characters in a hashtag. This must be greater than or equal to 2. MySQL databases must be configured to support searching strings shorter than three characters, <link>see documentation</link>.'},
    traceTitle: {id: 'admin.sql.traceTitle', defaultMessage: 'SQL Statement Logging: '},
    traceDescription: {id: 'admin.sql.traceDescription', defaultMessage: '(Development Mode) When true, executing SQL statements are written to the log.'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [
    messages.title,
    [messages.recycleDescription, {featureName: '', reloadConfiguration: ''}],
    messages.featureName,
    messages.reloadConfiguration,
    messages.button,
    messages.noteDescription,
    messages.disableDatabaseSearchTitle,
    messages.disableDatabaseSearchDescription,
    messages.driverName,
    messages.driverNameDescription,
    messages.dataSource,
    messages.dataSourceDescription,
    messages.maxConnectionsTitle,
    messages.maxConnectionsDescription,
    messages.maxOpenTitle,
    messages.maxOpenDescription,
    messages.queryTimeoutTitle,
    messages.queryTimeoutDescription,
    messages.connMaxLifetimeTitle,
    messages.connMaxLifetimeDescription,
    messages.connMaxIdleTimeTitle,
    messages.connMaxIdleTimeDescription,
    messages.traceTitle,
    messages.traceDescription,
];

export default class DatabaseSettings extends OLDAdminSettings<Props, State> {
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
        return (<FormattedMessage {...messages.title}/>);
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
                            {...messages.recycleDescription}
                            values={{
                                featureName: (
                                    <b>
                                        <FormattedMessage {...messages.featureName}/>
                                    </b>
                                ),
                                reloadConfiguration: (
                                    <a href='../environment/web_server'>
                                        <b>
                                            <FormattedMessage {...messages.reloadConfiguration}/>
                                        </b>
                                    </a>
                                ),
                            }}
                        />
                    }
                    buttonText={
                        <FormattedMessage {...messages.button}/>
                    }
                    showSuccessMessage={false}
                    errorMessage={defineMessage({
                        id: 'admin.recycle.reloadFail',
                        defaultMessage: 'Recycling unsuccessful: {error}',
                    })}
                    includeDetailedError={true}
                    disabled={this.props.isDisabled}
                />
            );
        }

        return (
            <SettingsGroup>
                <div className='banner'>
                    <FormattedMessage {...messages.noteDescription}/>
                </div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='DriverName'
                    >
                        <FormattedMessage {...messages.driverName}/>
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='text'
                            className='form-control'
                            value={this.state.driverName}
                            disabled={true}
                        />
                        <div className='help-text'>
                            <FormattedMessage {...messages.driverNameDescription}/>
                        </div>
                    </div>
                </div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='DataSource'
                    >
                        <FormattedMessage {...messages.dataSource}/>
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='text'
                            className='form-control'
                            value={dataSource}
                            disabled={true}
                        />
                        <div className='help-text'>
                            <FormattedMessage {...messages.dataSourceDescription}/>
                        </div>
                    </div>
                </div>
                <TextSetting
                    id='maxIdleConns'
                    label={
                        <FormattedMessage {...messages.maxConnectionsTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.sql.maxConnectionsExample', defaultMessage: 'E.g.: "10"'})}
                    helpText={
                        <FormattedMessage {...messages.maxConnectionsDescription}/>
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
                        <FormattedMessage {...messages.maxOpenTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.sql.maxOpenExample', defaultMessage: 'E.g.: "10"'})}
                    helpText={
                        <FormattedMessage {...messages.maxOpenDescription}/>
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
                        <FormattedMessage {...messages.queryTimeoutTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.sql.queryTimeoutExample', defaultMessage: 'E.g.: "30"'})}
                    helpText={
                        <FormattedMessage {...messages.queryTimeoutDescription}/>
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
                        <FormattedMessage {...messages.connMaxLifetimeTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.sql.connMaxLifetimeExample', defaultMessage: 'E.g.: "3600000"'})}
                    helpText={
                        <FormattedMessage {...messages.connMaxLifetimeDescription}/>
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
                        <FormattedMessage {...messages.connMaxIdleTimeTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.sql.connMaxIdleTimeExample', defaultMessage: 'E.g.: "300000"'})}
                    helpText={
                        <FormattedMessage {...messages.connMaxIdleTimeDescription}/>
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
                        <FormattedMessage {...messages.minimumHashtagLengthTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.service.minimumHashtagLengthExample', defaultMessage: 'E.g.: "3"'})}
                    helpText={
                        <FormattedMessage
                            {...messages.minimumHashtagLengthDescription}
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
                        <FormattedMessage {...messages.traceTitle}/>
                    }
                    helpText={
                        <FormattedMessage {...messages.traceDescription}/>
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
                        <FormattedMessage {...messages.disableDatabaseSearchTitle}/>
                    }
                    helpText={
                        <FormattedMessage
                            {...messages.disableDatabaseSearchDescription}
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
                <SettingSet
                    label={
                        <FormattedMessage
                            id='admin.database.migrations_table.title'
                            defaultMessage='Schema Migrations:'
                        />
                    }
                >
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
                </SettingSet>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='activeSearchBackend'
                    >
                        <FormattedMessage
                            id='admin.database.search_backend.title'
                            defaultMessage='Active Search Backend:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <input
                            id='activeSearchBackend'
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
