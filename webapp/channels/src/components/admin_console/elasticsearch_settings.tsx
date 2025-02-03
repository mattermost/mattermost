// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {Job, JobType} from '@mattermost/types/jobs';

import {elasticsearchPurgeIndexes, elasticsearchTest, rebuildChannelsIndex} from 'actions/admin_actions.jsx';

import ExternalLink from 'components/external_link';

import {DocLinks, JobStatuses, JobTypes} from 'utils/constants';

import BooleanSetting from './boolean_setting';
import JobsTable from './jobs';
import OLDAdminSettings from './old_admin_settings';
import type {BaseProps, BaseState} from './old_admin_settings';
import RequestButton from './request_button/request_button';
import SettingSet from './setting_set';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

interface State extends BaseState {
    connectionUrl: string;
    backend: string;
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

export const messages = defineMessages({
    title: {id: 'admin.elasticsearch.title', defaultMessage: 'Elasticsearch'},
    enableIndexingTitle: {id: 'admin.elasticsearch.enableIndexingTitle', defaultMessage: 'Enable Elasticsearch Indexing:'},
    enableIndexingDescription: {id: 'admin.elasticsearch.enableIndexingDescription', defaultMessage: 'When true, indexing of new posts occurs automatically. Search queries will use database search until "Enable Elasticsearch for search queries" is enabled. <link>Learn more about Elasticsearch in our documentation.</link>'},
    connectionUrlTitle: {id: 'admin.elasticsearch.connectionUrlTitle', defaultMessage: 'Server Connection Address:'},
    connectionUrlDescription: {id: 'admin.elasticsearch.connectionUrlDescription', defaultMessage: 'The address of the Elasticsearch server. <link>Please see documentation with server setup instructions.</link>'},
    skipTLSVerificationTitle: {id: 'admin.elasticsearch.skipTLSVerificationTitle', defaultMessage: 'Skip TLS Verification:'},
    skipTLSVerificationDescription: {id: 'admin.elasticsearch.skipTLSVerificationDescription', defaultMessage: 'When true, Mattermost will not require the Elasticsearch certificate to be signed by a trusted Certificate Authority.'},
    usernameTitle: {id: 'admin.elasticsearch.usernameTitle', defaultMessage: 'Server Username:'},
    usernameDescription: {id: 'admin.elasticsearch.usernameDescription', defaultMessage: '(Optional) The username to authenticate to the Elasticsearch server.'},
    passwordTitle: {id: 'admin.elasticsearch.passwordTitle', defaultMessage: 'Server Password:'},
    passwordDescription: {id: 'admin.elasticsearch.passwordDescription', defaultMessage: '(Optional) The password to authenticate to the Elasticsearch server.'},
    sniffTitle: {id: 'admin.elasticsearch.sniffTitle', defaultMessage: 'Enable Cluster Sniffing:'},
    sniffDescription: {id: 'admin.elasticsearch.sniffDescription', defaultMessage: 'When true, sniffing finds and connects to all data nodes in your cluster automatically.'},
    testHelpText: {id: 'admin.elasticsearch.testHelpText', defaultMessage: 'Tests if the Mattermost server can connect to the Elasticsearch server specified. Testing the connection only saves the configuration if the test is successful. A successful test will also re-initialize the client if you have started Elasticsearch after starting Mattermost. But this will not restart the workers. To do that, please toggle "Enable Elasticsearch Indexing".'},
    elasticsearch_test_button: {id: 'admin.elasticsearch.elasticsearch_test_button', defaultMessage: 'Test Connection'},
    bulkIndexingTitle: {id: 'admin.elasticsearch.bulkIndexingTitle', defaultMessage: 'Bulk Indexing:'},
    help: {id: 'admin.elasticsearch.createJob.help', defaultMessage: 'All users, channels and posts in the database will be indexed from oldest to newest. Elasticsearch is available during indexing but search results may be incomplete until the indexing job is complete.'},
    rebuildChannelsIndexTitle: {id: 'admin.elasticsearch.rebuildChannelsIndexTitle', defaultMessage: 'Rebuild Channels Index'},
    rebuildChannelIndexHelpText: {id: 'admin.elasticsearch.rebuildChannelsIndex.helpText', defaultMessage: 'This purges the channels index and re-indexes all channels in the database, from oldest to newest. Channel autocomplete is available during indexing but search results may be incomplete until the indexing job is complete.\n<b>Note- Please ensure no other indexing job is in progress in the table above.</b>'},
    rebuildChannelsIndexButtonText: {id: 'admin.elasticsearch.rebuildChannelsIndex.title', defaultMessage: 'Rebuild Channels Index'},
    purgeIndexesHelpText: {id: 'admin.elasticsearch.purgeIndexesHelpText', defaultMessage: 'Purging will entirely remove the indexes on the Elasticsearch server. Search results may be incomplete until a bulk index of the existing database is rebuilt.'},
    purgeIndexesButton: {id: 'admin.elasticsearch.purgeIndexesButton', defaultMessage: 'Purge Index'},
    label: {id: 'admin.elasticsearch.purgeIndexesButton.label', defaultMessage: 'Purge Indexes:'},
    enableSearchingTitle: {id: 'admin.elasticsearch.enableSearchingTitle', defaultMessage: 'Enable Elasticsearch for search queries:'},
    enableSearchingDescription: {id: 'admin.elasticsearch.enableSearchingDescription', defaultMessage: 'Requires a successful connection to the Elasticsearch server. When true, Elasticsearch will be used for all search queries using the latest index. Search results may be incomplete until a bulk index of the existing post database is finished. When false, database search is used.'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [
    [messages.connectionUrlDescription, {documentationLink: ''}],
    [messages.enableIndexingDescription, {documentationLink: ''}],
    messages.title,
    messages.enableIndexingTitle,
    messages.connectionUrlTitle,
    messages.skipTLSVerificationTitle,
    messages.skipTLSVerificationDescription,
    messages.usernameTitle,
    messages.usernameDescription,
    messages.passwordTitle,
    messages.passwordDescription,
    messages.sniffTitle,
    messages.sniffDescription,
    messages.testHelpText,
    messages.elasticsearch_test_button,
    messages.bulkIndexingTitle,
    messages.help,
    messages.purgeIndexesHelpText,
    messages.purgeIndexesButton,
    messages.label,
    messages.enableSearchingTitle,
    messages.enableSearchingDescription,
];

export default class ElasticsearchSettings extends OLDAdminSettings<Props, State> {
    getConfigFromState = (config: AdminConfig) => {
        config.ElasticsearchSettings.ConnectionURL = this.state.connectionUrl;
        config.ElasticsearchSettings.Backend = this.state.backend;
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
            backend: config.ElasticsearchSettings.Backend,
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

        if (id === 'connectionUrl' || id === 'backend' || id === 'skipTLSVerification' || id === 'username' || id === 'password' || id === 'sniff' || id === 'ca' || id === 'clientCert' || id === 'clientKey') {
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

    doTestConfig = (success: () => void, error: (error: {message: string; detailed_message?: string}) => void): void => {
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
            (err: {message: string; detailed_message?: string}) => {
                this.setState({
                    configTested: false,
                    canSave: false,
                });
                error(err);
            },
        );
    };

    getExtraInfo(job: Job) {
        let jobSubType = null;
        if (job.data?.sub_type === 'channels_index_rebuild') {
            jobSubType = (
                <span>
                    {'. '}
                    <FormattedMessage
                        id='admin.elasticsearch.channelIndexRebuildJobTitle'
                        defaultMessage='Channels index rebuild job.'
                    />
                </span>
            );
        }

        let jobProgress = null;
        if (job.status === JobStatuses.IN_PROGRESS) {
            jobProgress = (
                <FormattedMessage
                    id='admin.elasticsearch.percentComplete'
                    defaultMessage='{percent}% Complete'
                    values={{percent: Number(job.progress)}}
                />
            );
        }

        return (<span>{jobProgress}{jobSubType}</span>);
    }

    renderTitle() {
        return (
            <FormattedMessage {...messages.title}/>
        );
    }

    renderSettings = () => {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableIndexing'
                    label={
                        <FormattedMessage {...messages.enableIndexingTitle}/>
                    }
                    helpText={
                        <FormattedMessage
                            {...messages.enableIndexingDescription}
                            values={{
                                link: (chunks) => (
                                    <ExternalLink
                                        location='elasticsearch_settings'
                                        href={DocLinks.ELASTICSEARCH}
                                    >
                                        {chunks}
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
                    id='backend'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.backendTitle'
                            defaultMessage='Backend type:'
                        />
                    }
                    placeholder={defineMessage({id: 'admin.elasticsearch.backendExample', defaultMessage: 'E.g.: "elasticsearch"'})}
                    helpText={
                        <FormattedMessage
                            id='admin.elasticsearch.backendDescription'
                            defaultMessage='The type of the search backend.'
                        />
                    }
                    value={this.state.backend}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Backend')}
                />
                <TextSetting
                    id='connectionUrl'
                    label={
                        <FormattedMessage {...messages.connectionUrlTitle}/>
                    }
                    placeholder={defineMessage({id: 'admin.elasticsearch.connectionUrlExample', defaultMessage: 'E.g.: "https://elasticsearch.example.org:9200"'})}
                    helpText={
                        <FormattedMessage
                            {...messages.connectionUrlDescription}
                            values={{
                                link: (chunks) => (
                                    <ExternalLink
                                        location='elasticsearch_settings'
                                        href={DocLinks.ELASTICSEARCH}
                                    >
                                        {chunks}
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
                    placeholder={defineMessage({id: 'admin.elasticsearch.caExample', defaultMessage: 'E.g.: "./elasticsearch/ca.pem"'})}
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
                    placeholder={defineMessage({id: 'admin.elasticsearch.clientCertExample', defaultMessage: 'E.g.: "./elasticsearch/client-cert.pem"'})}
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
                    placeholder={defineMessage({id: 'admin.elasticsearch.clientKeyExample', defaultMessage: 'E.g.: "./elasticsearch/client-key.pem"'})}
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
                    label={<FormattedMessage {...messages.skipTLSVerificationTitle}/>}
                    helpText={<FormattedMessage {...messages.skipTLSVerificationDescription}/>}
                    value={this.state.skipTLSVerification}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.SkipTLSVerification')}
                />
                <TextSetting
                    id='username'
                    label={<FormattedMessage {...messages.usernameTitle}/>}
                    placeholder={defineMessage({id: 'admin.elasticsearch.usernameExample', defaultMessage: 'E.g.: "elastic"'})}
                    helpText={<FormattedMessage {...messages.usernameDescription}/>}
                    value={this.state.username}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Username')}
                />
                <TextSetting
                    id='password'
                    label={<FormattedMessage {...messages.passwordTitle}/>}
                    placeholder={defineMessage({id: 'admin.elasticsearch.password', defaultMessage: 'E.g.: "yourpassword"'})}
                    helpText={<FormattedMessage {...messages.passwordDescription}/>}
                    value={this.state.password}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Password')}
                />
                <BooleanSetting
                    id='sniff'
                    label={<FormattedMessage {...messages.sniffTitle}/>}
                    helpText={<FormattedMessage {...messages.sniffDescription}/>}
                    value={this.state.sniff}
                    disabled={this.props.isDisabled || !this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('ElasticsearchSettings.Sniff')}
                />
                <RequestButton
                    id='testConfig'
                    requestAction={this.doTestConfig}
                    helpText={<FormattedMessage {...messages.testHelpText}/>}
                    buttonText={<FormattedMessage {...messages.elasticsearch_test_button}/>}
                    successMessage={defineMessage({
                        id: 'admin.elasticsearch.testConfigSuccess',
                        defaultMessage: 'Test successful. Configuration saved.',
                    })}
                    disabled={!this.state.enableIndexing}
                />
                <SettingSet
                    label={<FormattedMessage {...messages.bulkIndexingTitle}/>}
                >
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
                            createJobHelpText={<FormattedMessage {...messages.help}/>}
                            getExtraInfoText={this.getExtraInfo}
                        />
                    </div>
                </SettingSet>
                <RequestButton
                    id='rebuildChannelsIndexButton'
                    requestAction={rebuildChannelsIndex}
                    helpText={
                        <FormattedMessage
                            {...messages.rebuildChannelIndexHelpText}
                            values={{
                                b: (chunks: React.ReactNode) => (<b>{chunks}</b>),
                            }}
                        />
                    }
                    buttonText={<FormattedMessage {...messages.rebuildChannelsIndexButtonText}/>}
                    successMessage={defineMessage({
                        id: 'admin.elasticsearch.rebuildIndexSuccessfully.success',
                        defaultMessage: 'Channels index rebuild job triggered successfully.',
                    })}
                    errorMessage={defineMessage({
                        id: 'admin.elasticsearch.rebuildIndexSuccessfully.error',
                        defaultMessage: 'Failed to trigger channels index rebuild job: {error}',
                    })}
                    disabled={!this.state.canPurgeAndIndex || this.props.isDisabled!}
                    label={<FormattedMessage {...messages.rebuildChannelsIndexButtonText}/>}
                />
                <RequestButton
                    id='purgeIndexesSection'
                    requestAction={elasticsearchPurgeIndexes}
                    helpText={<FormattedMessage {...messages.purgeIndexesHelpText}/>}
                    buttonText={<FormattedMessage {...messages.purgeIndexesButton}/>}
                    successMessage={defineMessage({
                        id: 'admin.elasticsearch.purgeIndexesButton.success',
                        defaultMessage: 'Indexes purged successfully.',
                    })}
                    errorMessage={defineMessage({
                        id: 'admin.elasticsearch.purgeIndexesButton.error',
                        defaultMessage: 'Failed to purge indexes: {error}',
                    })}
                    disabled={this.props.isDisabled || !this.state.canPurgeAndIndex}
                    label={<FormattedMessage {...messages.label}/>}
                />
                <TextSetting
                    id='ignoredPurgeIndexes'
                    label={
                        <FormattedMessage
                            id='admin.elasticsearch.ignoredPurgeIndexes'
                            defaultMessage='Indexes to skip while purging:'
                        />
                    }
                    placeholder={defineMessage({id: 'admin.elasticsearch.ignoredPurgeIndexesDescription.example', defaultMessage: 'E.g.: .opendistro*,.security*'})}
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
                    label={<FormattedMessage {...messages.enableSearchingTitle}/>}
                    helpText={<FormattedMessage {...messages.enableSearchingDescription}/>}
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
