// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

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
