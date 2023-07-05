// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {elasticsearchPurgeIndexes, elasticsearchTest} from 'actions/admin_actions.jsx';
import {DocLinks, JobStatuses, JobTypes} from 'utils/constants';
import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';

import ExternalLink from 'components/external_link';

import AdminSettings, {BaseProps, BaseState} from './admin_settings';
import BooleanSetting from './boolean_setting';
import JobsTable from './jobs';
import RequestButton from './request_button/request_button';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';
import {AdminConfig} from '@mattermost/types/config';
import {Job, JobType} from '@mattermost/types/jobs';

interface State extends BaseState {
    connectionUrl: string;
    skipTLSVerification: boolean;
    ca: string;
    clientCert: string;
    clientKey: string;
    username: string;
    password: string;
    sniff: boolean;
    enableIndexing: boolean;
    enableSearching: boolean;
    enableAutocomplete: boolean;
    configTested: boolean;
    canSave: boolean;
    canPurgeAndIndex: boolean;
    ignoredPurgeIndexes: string;
}

type Props = BaseProps & {
    config: AdminConfig;
};

export default class ElasticsearchSettings extends AdminSettings<Props, State> {
    getConfigFromState = (config: AdminConfig) => {
        config.ElasticsearchSettings.ConnectionURL = this.state.connectionUrl;
        config.ElasticsearchSettings.SkipTLSVerification = this.state.skipTLSVerification;
        config.ElasticsearchSettings.CA = this.state.ca;
        config.ElasticsearchSettings.ClientCert = this.state.clientCert;
        config.ElasticsearchSettings.ClientKey = this.state.clientKey;
        config.ElasticsearchSettings.Username = this.state.username;
        config.ElasticsearchSettings.Password = this.state.password;
        config.ElasticsearchSettings.Sniff = this.state.sniff;
        config.ElasticsearchSettings.EnableIndexing = this.state.enableIndexing;
        config.ElasticsearchSettings.EnableSearching = this.state.enableSearching;
        config.ElasticsearchSettings.EnableAutocomplete = this.state.enableAutocomplete;
        config.ElasticsearchSettings.IgnoredPurgeIndexes = this.state.ignoredPurgeIndexes;

        return config;
    };

    getStateFromConfig(config: AdminConfig) {
        return {
            connectionUrl: config.ElasticsearchSettings.ConnectionURL,
            skipTLSVerification: config.ElasticsearchSettings.SkipTLSVerification,
            ca: config.ElasticsearchSettings.CA,
            clientCert: config.ElasticsearchSettings.ClientCert,
            clientKey: config.ElasticsearchSettings.ClientKey,
            username: config.ElasticsearchSettings.Username,
            password: config.ElasticsearchSettings.Password,
            sniff: config.ElasticsearchSettings.Sniff,
            enableIndexing: config.ElasticsearchSettings.EnableIndexing,
            enableSearching: config.ElasticsearchSettings.EnableSearching,
            enableAutocomplete: config.ElasticsearchSettings.EnableAutocomplete,
            configTested: true,
            canSave: true,
            canPurgeAndIndex: config.ElasticsearchSettings.EnableIndexing,
            ignoredPurgeIndexes: config.ElasticsearchSettings.IgnoredPurgeIndexes,
        };
    }

    handleSettingChanged = (id: string, value: boolean) => {
        if (id === 'enableIndexing') {
            if (value === false) {
                this.setState({
                    enableSearching: false,
                    enableAutocomplete: false,
                });
            } else {
                this.setState({
                    canSave: false,
                    configTested: false,
                });
            }
        }

        if (id === 'connectionUrl' || id === 'skipTLSVerification' || id === 'username' || id === 'password' || id === 'sniff' || id === 'ca' || id === 'clientCert' || id === 'clientKey') {
            this.setState({
                configTested: false,
                canSave: false,
            });
        }

        if (id !== 'enableSearching' && id !== 'enableAutocomplete') {
            this.setState({
                canPurgeAndIndex: false,
            });
        }

        this.handleChange(id, value);
    };

    handleSaved = () => {
        this.setState({
            canPurgeAndIndex: this.state.enableIndexing,
        });
    };

    canSave = () => {
        return this.state.canSave;
    };

    doTestConfig = (success: (data?: any) => void, error: (error: any) => void): void => {
        const config = JSON.parse(JSON.stringify(this.props.config));
        this.getConfigFromState(config);

        elasticsearchTest(
            config,
            () => {
                this.setState({
                    configTested: true,
                    canSave: true,
                });
                success();
            },
            (err: string) => {
                this.setState({
                    configTested: false,
                    canSave: false,
                });
                error(err);
            },
        );
    };

    getExtraInfo(job: Job) {
        if (job.status === JobStatuses.IN_PROGRESS) {
            return (
                <FormattedMessage
                    id='admin.elasticsearch.percentComplete'
                    defaultMessage='{percent}% Complete'
                    values={{percent: Number(job.progress)}}
                />
            );
        }

        return null;
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.elasticsearch.title'
                defaultMessage='Elasticsearch'
            />
        );
    }

    renderSettings = () => {
        return (
            <SettingsGroup>
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
                                    <ExternalLink
                                        location='elasticsearch_settings'
                                        href={DocLinks.ELASTICSEARCH}
                                    >
                                        <FormattedMessage
                                            id='admin.elasticsearch.enableIndexingDescription.documentationLinkText'
                                            defaultMessage='Learn more about Elasticsearch in our documentation.'
                                        />
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.EnableIndexing')}
                    disabled={this.props.isDisabled}
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
                                    <ExternalLink
                                        location='elasticsearch_settings'
                                        href={DocLinks.ELASTICSEARCH}
                                    >
                                        <FormattedMessage
                                            id='admin.elasticsearch.connectionUrlExample.documentationLinkText'
                                            defaultMessage='Please see documentation with server setup instructions.'
                                        />
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.connectionUrl}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.ConnectionURL')}
                />
                <TextSetting
                    id='ca'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.caTitle'
                            defaultMessage='CA path:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.elasticsearch.caExample', 'E.g.: "./elasticsearch/ca.pem"')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.caDescription'
                            defaultMessage='(Optional) Custom Certificate Authority certificates for the Elasticsearch server. Leave this empty to use the default CAs from the operating system.'
                        />
                    }
                    value={this.state.ca}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.CA')}
                />
                <TextSetting
                    id='clientCert'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.clientCertTitle'
                            defaultMessage='Client Certificate path:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.elasticsearch.clientCertExample', 'E.g.: "./elasticsearch/client-cert.pem"')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.clientCertDescription'
                            defaultMessage='(Optional) The client certificate for the connection to the Elasticsearch server in the PEM format.'
                        />
                    }
                    value={this.state.clientCert}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.ClientCert')}
                />
                <TextSetting
                    id='clientKey'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.clientKeyTitle'
                            defaultMessage='Client Certificate Key path:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.elasticsearch.clientKeyExample', 'E.g.: "./elasticsearch/client-key.pem"')}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.clientKeyDescription'
                            defaultMessage='(Optional) The key for the client certificate in the PEM format.'
                        />
                    }
                    value={this.state.clientKey}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.ClientKey')}
                />
                <BooleanSetting
                    id='skipTLSVerification'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.skipTLSVerificationTitle'
                            defaultMessage='Skip TLS Verification:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.skipTLSVerificationDescription'
                            defaultMessage='When true, Mattermost will not require the Elasticsearch certificate to be signed by a trusted Certificate Authority.'
                        />
                    }
                    value={this.state.skipTLSVerification}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.SkipTLSVerification')}
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
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Username')}
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
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Password')}
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
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Sniff')}
                />
                <RequestButton
                    id='testConfig'
                    requestAction={this.doTestConfig}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.testHelpText'
                            defaultMessage='Tests if the Mattermost server can connect to the Elasticsearch server specified. Testing the connection only saves the configuration if the test is successful. A successful test will also re-initialize the client if you have started Elasticsearch after starting Mattermost. But this will not restart the workers. To do that, please toggle "Enable Elasticsearch Indexing".'
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.elasticsearch.elasticsearch_test_button'
                            defaultMessage='Test Connection'
                        />
                    }
                    successMessage={{
                        id: t('admin.elasticsearch.testConfigSuccess'),
                        defaultMessage: 'Test successful. Configuration saved.',
                    }}
                    disabled={!this.state.enableIndexing}
                />
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                    >
                        <FormattedMessage
                            id='admin.elasticsearch.bulkIndexingTitle'
                            defaultMessage='Bulk Indexing:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <div className='job-table-setting'>
                            <JobsTable
                                jobType={JobTypes.ELASTICSEARCH_POST_INDEXING as JobType}
                                disabled={!this.state.canPurgeAndIndex || this.props.isDisabled!}
                                createJobButtonText={
                                    <FormattedMessage
                                        id='admin.elasticsearch.createJob.title'
                                        defaultMessage='Index Now'
                                    />
                                }
                                createJobHelpText={
                                    <FormattedMessage
                                        id='admin.elasticsearch.createJob.help'
                                        defaultMessage='All users, channels and posts in the database will be indexed from oldest to newest. Elasticsearch is available during indexing but search results may be incomplete until the indexing job is complete.'
                                    />
                                }
                                getExtraInfoText={this.getExtraInfo}
                            />
                        </div>
                    </div>
                </div>
                <RequestButton
                    id='purgeIndexesSection'
                    requestAction={elasticsearchPurgeIndexes}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.purgeIndexesHelpText'
                            defaultMessage='Purging will entirely remove the indexes on the Elasticsearch server. Search results may be incomplete until a bulk index of the existing database is rebuilt.'
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.elasticsearch.purgeIndexesButton'
                            defaultMessage='Purge Index'
                        />
                    }
                    successMessage={{
                        id: t('admin.elasticsearch.purgeIndexesButton.success'),
                        defaultMessage: 'Indexes purged successfully.',
                    }}
                    errorMessage={{
                        id: t('admin.elasticsearch.purgeIndexesButton.error'),
                        defaultMessage: 'Failed to purge indexes: {error}',
                    }}
                    disabled={this.props.isDisabled || !this.state.canPurgeAndIndex}
                    label={(
                        <FormattedMessage
                            id='admin.elasticsearch.purgeIndexesButton.label'
                            defaultMessage='Purge Indexes:'
                        />
                    )}
                />
                <TextSetting
                    id='ignoredPurgeIndexes'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.ignoredPurgeIndexes'
                            defaultMessage='Indexes to skip while purging:'
                        />
                    }
                    placeholder={'E.g.: .opendistro*,.security*'}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.ignoredPurgeIndexesDescription'
                            defaultMessage='When filled in, these indexes will be ignored during the purge, separated by commas.'
                        />
                    }
                    value={this.state.ignoredPurgeIndexes}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.IgnoredPurgeIndexes')}
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
                    disabled={this.props.isDisabled || !this.state.enableIndexing || !this.state.configTested}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.EnableSearching')}
                />
                <BooleanSetting
                    id='enableAutocomplete'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.enableAutocompleteTitle'
                            defaultMessage='Enable Elasticsearch for autocomplete queries:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.enableAutocompleteDescription'
                            defaultMessage='Requires a successful connection to the Elasticsearch server. When true, Elasticsearch will be used for all autocompletion queries on users and channels using the latest index. Autocompletion results may be incomplete until a bulk index of the existing users and channels database is finished. When false, database autocomplete is used.'
                        />
                    }
                    value={this.state.enableAutocomplete}
                    disabled={this.props.isDisabled || !this.state.enableIndexing || !this.state.configTested}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.EnableAutocomplete')}
                />
            </SettingsGroup>
        );
    };
}
