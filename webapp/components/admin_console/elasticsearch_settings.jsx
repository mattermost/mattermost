// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {elasticsearchTest} from 'actions/admin_actions.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import RequestButton from './request_button/request_button.jsx';

export default class ElasticsearchSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ElasticSearchSettings.ConnectionUrl = this.state.connectionUrl;
        config.ElasticSearchSettings.Username = this.state.username;
        config.ElasticSearchSettings.Password = this.state.password;
        config.ElasticSearchSettings.Sniff = this.state.sniff;
        config.ElasticSearchSettings.EnableIndexing = this.state.enableIndexing;
        config.ElasticSearchSettings.EnableSearching = this.state.enableSearching;

        return config;
    }

    getStateFromConfig(config) {
        return {
            connectionUrl: config.ElasticSearchSettings.ConnectionUrl,
            username: config.ElasticSearchSettings.Username,
            password: config.ElasticSearchSettings.Password,
            sniff: config.ElasticSearchSettings.Sniff,
            enableIndexing: config.ElasticSearchSettings.EnableIndexing,
            enableSearching: config.ElasticSearchSettings.EnableSearching
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.elasticsearch.title'
                defaultMessage='Elasticsearch Settings'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <p>
                    <FormattedMessage
                        id='admin.elasticsearch.noteDescription'
                        defaultMessage='Changing properties in this section will require a server restart before taking effect.'
                    />
                </p>
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
                                        href='http://www.mattermost.com'
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
                    placeholder={Utils.localizeMessage('admin.elasticsearch.connectionUrlExample', 'Ex https://elasticsearch.example.org:9200')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.connectionUrlDescription'
                            defaultMessage='The address of the elasticsearch server. {documentationLink}'
                            values={{
                                documentationLink: (
                                    <a
                                        href='http://www.mattermost.com'
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
                    placeholder={Utils.localizeMessage('admin.elasticsearch.usernameExample', 'Ex elastic')}
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
                    placeholder={Utils.localizeMessage('admin.elasticsearch.password', 'Ex changeme')}
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
                    requestAction={elasticsearchTest}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.testHelpText'
                            defaultMessage='Saves the configuration and tests if the Mattermost server can connect to the Elasticsearch server specified. See log file for more detailed error messages.'
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.elasticsearch.elasticsearch_test_button'
                            defaultMessage='Test Connection'
                        />
                    }
                    disabled={!this.state.enableIndexing}
                    saveNeeded={this.state.saveNeeded}
                    saveConfigAction={this.doSubmit}
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
                            defaultMessage='When true, Elasticsearch will be used for all search queries using the latest index. Search results may be incomplete until a bulk index of the existing post database is finished. When false, database search is used.'
                        />
                    }
                    value={this.state.enableSearching}
                    disabled={!this.state.enableIndexing}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
