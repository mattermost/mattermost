// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {elasticsearchTest, elasticsearchPurgeIndexes} from 'actions/admin_actions.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import RequestButton from './request_button/request_button.jsx';
import ElasticsearchStatus from './elasticsearch_status';

export default class ElasticsearchSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.doTestConfig = this.doTestConfig.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleSaved = this.handleSaved.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ElasticsearchSettings.ConnectionUrl = this.state.connectionUrl;
        config.ElasticsearchSettings.Username = this.state.username;
        config.ElasticsearchSettings.Password = this.state.password;
        config.ElasticsearchSettings.Sniff = this.state.sniff;
        config.ElasticsearchSettings.EnableIndexing = this.state.enableIndexing;
        config.ElasticsearchSettings.EnableSearching = this.state.enableSearching;

        return config;
    }

    getStateFromConfig(config) {
        return {
            connectionUrl: config.ElasticsearchSettings.ConnectionUrl,
            username: config.ElasticsearchSettings.Username,
            password: config.ElasticsearchSettings.Password,
            sniff: config.ElasticsearchSettings.Sniff,
            enableIndexing: config.ElasticsearchSettings.EnableIndexing,
            enableSearching: config.ElasticsearchSettings.EnableSearching,
            configTested: true,
            canSave: true,
            canPurgeAndIndex: config.ElasticsearchSettings.EnableIndexing
        };
    }

    handleChange(id, value) {
        if (id === 'enableIndexing') {
            if (value === false) {
                this.setState({
                    enableSearching: false
                });
            } else {
                this.setState({
                    canSave: false,
                    configTested: false
                });
            }
        }

        if (id === 'connectionUrl' || id === 'username' || id === 'password' || id === 'sniff') {
            this.setState({
                configTested: false,
                canSave: false
            });
        }

        if (id !== 'enableSearching') {
            this.setState({
                canPurgeAndIndex: false
            });
        }

        super.handleChange(id, value);
    }

    handleSaved() {
        this.setState({
            canPurgeAndIndex: this.state.enableIndexing
        });
    }

    canSave() {
        return this.state.canSave;
    }

    doTestConfig(success, error) {
        const config = JSON.parse(JSON.stringify(this.props.config));
        this.getConfigFromState(config);

        elasticsearchTest(
            config,
            () => {
                this.setState({
                    configTested: true,
                    canSave: true
                });
                success();
                this.doSubmit();
            },
            (err) => {
                this.setState({
                    configTested: false,
                    canSave: false
                });
                error(err);
            }
        );
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.elasticsearch.title'
                defaultMessage='Elasticsearch (Beta)'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.elasticsearch.noteDescription'
                            defaultMessage='Changing properties in this section will require a server restart before taking effect.'
                        />
                    </div>
                </div>
                <BooleanSetting
                    id='enableIndexing'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.enableIndexingTitle'
                            defaultMessage='Enable Elasticsearch Indexing:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.enableIndexingDescription'
                            defaultMessage='When true, indexing of new posts occurs automatically. Search queries will use database search until "Enable Elasticsearch for search queries" is enabled. {documentationLink}'
                            values={{
                                documentationLink: (
                                    <a
                                        href='https://about.mattermost.com/default-elasticsearch-documentation/'
                                        rel='noopener noreferrer'
                                        target='_blank'
                                    >
                                        <FormattedMessage
                                            id='admin.elasticsearch.enableIndexingDescription.documentationLinkText'
                                            defaultMessage='Learn more about Elasticsearch in our documentation.'
                                        />
                                    </a>
                                )
                            }}
                        />
                    }
                    value={this.state.enableIndexing}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='connectionUrl'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.connectionUrlTitle'
                            defaultMessage='Server Connection Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.elasticsearch.connectionUrlExample', 'E.g.: "https://elasticsearch.example.org:9200"')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.connectionUrlDescription'
                            defaultMessage='The address of the Elasticsearch server. {documentationLink}'
                            values={{
                                documentationLink: (
                                    <a
                                        href='https://about.mattermost.com/default-elasticsearch-server-setup/'
                                        rel='noopener noreferrer'
                                        target='_blank'
                                    >
                                        <FormattedMessage
                                            id='admin.elasticsearch.connectionUrlExample.documentationLinkText'
                                            defaultMessage='Please see documentation with server setup instructions.'
                                        />
                                    </a>
                                )
                            }}
                        />
                    }
                    value={this.state.connectionUrl}
                    disabled={!this.state.enableIndexing}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='username'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.usernameTitle'
                            defaultMessage='Server Username:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.elasticsearch.usernameExample', 'E.g.: "elastic"')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.usernameDescription'
                            defaultMessage='(Optional) The username to authenticate to the Elasticsearch server.'
                        />
                    }
                    value={this.state.username}
                    disabled={!this.state.enableIndexing}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='password'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.passwordTitle'
                            defaultMessage='Server Password:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.elasticsearch.password', 'E.g.: "yourpassword"')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.passwordDescription'
                            defaultMessage='(Optional) The password to authenticate to the Elasticsearch server.'
                        />
                    }
                    value={this.state.password}
                    disabled={!this.state.enableIndexing}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='sniff'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.sniffTitle'
                            defaultMessage='Enable Cluster Sniffing:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.sniffDescription'
                            defaultMessage='When true, sniffing finds and connects to all data nodes in your cluster automatically.'
                        />
                    }
                    value={this.state.sniff}
                    disabled={!this.state.enableIndexing}
                    onChange={this.handleChange}
                />
                <RequestButton
                    requestAction={this.doTestConfig}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.testHelpText'
                            defaultMessage='Tests if the Mattermost server can connect to the Elasticsearch server specified. Testing the connection only saves the configuration if the test is successful. See log file for more detailed error messages.'
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.elasticsearch.elasticsearch_test_button'
                            defaultMessage='Test Connection'
                        />
                    }
                    successMessage={{
                        id: 'admin.elasticsearch.testConfigSuccess',
                        defaultMessage: 'Test successful. Configuration saved.'
                    }}
                    disabled={!this.state.enableIndexing}
                />
                <ElasticsearchStatus
                    isConfigured={this.state.canPurgeAndIndex}
                />
                <RequestButton
                    requestAction={elasticsearchPurgeIndexes}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.purgeIndexesHelpText'
                            defaultMessage='Purging will entirely remove the index on the Elasticsearch server. Search results may be incomplete until a bulk index of the existing post database is rebuilt.'
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.elasticsearch.purgeIndexesButton'
                            defaultMessage='Purge Index'
                        />
                    }
                    successMessage={{
                        id: 'admin.elasticsearch.purgeIndexesButton.success',
                        defaultMessage: 'Indexes purged successfully.'
                    }}
                    errorMessage={{
                        id: 'admin.elasticsearch.purgeIndexesButton.error',
                        defaultMessage: 'Failed to purge indexes: {error}'
                    }}
                    disabled={!this.state.canPurgeAndIndex}
                    label={(
                        <FormattedMessage
                            id='admin.elasticsearch.purgeIndexesButton.label'
                            defaultMessage='Purge Indexes:'
                        />
                    )}
                />
                <BooleanSetting
                    id='enableSearching'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.enableSearchingTitle'
                            defaultMessage='Enable Elasticsearch for search queries:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.enableSearchingDescription'
                            defaultMessage='Requires a successful connection to the Elasticsearch server. When true, Elasticsearch will be used for all search queries using the latest index. Search results may be incomplete until a bulk index of the existing post database is finished. When false, database search is used.'
                        />
                    }
                    value={this.state.enableSearching}
                    disabled={!this.state.enableIndexing || !this.state.configTested}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
