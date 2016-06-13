// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';
import * as I18n from 'i18n/i18n.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import GeneratedSetting from './generated_setting.jsx';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import RecycleDbButton from './recycle_db.jsx';
import DropdownSetting from './dropdown_setting.jsx';

export default class DatabaseSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            driverName: this.props.config.SqlSettings.DriverName,
            dataSource: this.props.config.SqlSettings.DataSource,
            maxIdleConns: props.config.SqlSettings.MaxIdleConns,
            maxOpenConns: props.config.SqlSettings.MaxOpenConns,
            atRestEncryptKey: props.config.SqlSettings.AtRestEncryptKey,
            trace: props.config.SqlSettings.Trace,
            postgresTextSeachConfig: props.config.SqlSettings.PostgresTextSearchConfig
        });
    }

    getConfigFromState(config) {
        // driverName and dataSource are read-only from the UI

        config.SqlSettings.MaxIdleConns = this.parseIntNonZero(this.state.maxIdleConns);
        config.SqlSettings.MaxOpenConns = this.parseIntNonZero(this.state.maxOpenConns);
        config.SqlSettings.AtRestEncryptKey = this.state.atRestEncryptKey;
        config.SqlSettings.Trace = this.state.trace;
        config.SqlSettings.PostgresTextSearchConfig = Utils.getI18nLanguage(this.state.postgresTextSeachConfig);

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.database.title'
                    defaultMessage='Database Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        const dataSource = '**********' + this.state.dataSource.substring(this.state.dataSource.indexOf('@'));

        let textSearchConfig = null;
        if (this.state.driverName === 'postgres') {
            const locales = I18n.getAllLanguages();

            const languages = Object.keys(locales).map((l) => {
                return {value: locales[l].value, text: locales[l].name};
            });
            textSearchConfig = (
                <DropdownSetting
                    id='postgresTextSeachConfig'
                    values={languages}
                    label={
                        <FormattedMessage
                            id='admin.sql.postgresTextSeachConfig'
                            defaultMessage='Postgres Text Search Localization:'
                        />
                    }
                    value={this.state.postgresTextSeachConfig}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.postgresTextSeachConfigDescription'
                            defaultMessage='Language used to search the PostgreSQL database.'
                        />
                    }
                />
            );
        }

        return (
            <SettingsGroup>
                <p>
                    <FormattedMessage
                        id='admin.sql.noteDescription'
                        defaultMessage='Changing properties in this section will require a server restart before taking effect.'
                    />
                </p>
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
                        <p className='help-text'>{this.state.driverName}</p>
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
                        <p className='help-text'>{dataSource}</p>
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
                    placeholder={Utils.localizeMessage('admin.sql.maxConnectionsExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.maxConnectionsDescription'
                            defaultMessage='Maximum number of idle connections held open to the database.'
                        />
                    }
                    value={this.state.maxIdleConns}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='maxOpenConns'
                    label={
                        <FormattedMessage
                            id='admin.sql.maxOpenTitle'
                            defaultMessage='Maximum Open Connections:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.maxOpenExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.maxOpenDescription'
                            defaultMessage='Maximum number of open connections held open to the database.'
                        />
                    }
                    value={this.state.maxOpenConns}
                    onChange={this.handleChange}
                />
                {textSearchConfig}
                <GeneratedSetting
                    id='atRestEncryptKey'
                    label={
                        <FormattedMessage
                            id='admin.sql.keyTitle'
                            defaultMessage='At Rest Encrypt Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.keyExample', 'Ex "gxHVDcKUyP2y1eiyW8S8na1UYQAfq6J6"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sql.keyDescription'
                            defaultMessage='32-character salt available to encrypt and decrypt sensitive fields in database.'
                        />
                    }
                    value={this.state.atRestEncryptKey}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='trace'
                    label={
                        <FormattedMessage
                            id='admin.sql.traceTitle'
                            defaultMessage='Trace: '
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
                />
                <RecycleDbButton/>
            </SettingsGroup>
        );
    }
}
