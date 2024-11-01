// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    title: {id: 'admin.bleve.title', defaultMessage: 'Bleve'},
    enableIndexingTitle: {id: 'admin.bleve.enableIndexingTitle', defaultMessage: 'Enable Bleve Indexing:'},
    enableIndexingDescription: {id: 'admin.bleve.enableIndexingDescription', defaultMessage: 'When true, indexing of new posts occurs automatically. Search queries will use database search until "Enable Bleve for search queries" is enabled. <link>Learn more about Bleve in our documentation.</link>'},
    bulkIndexingTitle: {id: 'admin.bleve.bulkIndexingTitle', defaultMessage: 'Bulk Indexing:'},
    createJob_help: {id: 'admin.bleve.createJob.help', defaultMessage: 'All users, channels and posts in the database will be indexed from oldest to newest. Bleve is available during indexing but search results may be incomplete until the indexing job is complete.'},
    purgeIndexesHelpText: {id: 'admin.bleve.purgeIndexesHelpText', defaultMessage: 'Purging will entirely remove the content of the Bleve index directory. Search results may be incomplete until a bulk index of the existing database is rebuilt.'},
    purgeIndexesButton: {id: 'admin.bleve.purgeIndexesButton', defaultMessage: 'Purge Index'},
    purgeIndexesButton_label: {id: 'admin.bleve.purgeIndexesButton.label', defaultMessage: 'Purge Indexes:'},
    enableSearchingTitle: {id: 'admin.bleve.enableSearchingTitle', defaultMessage: 'Enable Bleve for search queries:'},
    enableSearchingDescription: {id: 'admin.bleve.enableSearchingDescription', defaultMessage: 'When true, Bleve will be used for all search queries using the latest index. Search results may be incomplete until a bulk index of the existing post database is finished. When false, database search is used.'},
});

export const searchableStrings = [
    messages.title,
    messages.enableIndexingTitle,
    messages.enableIndexingDescription,
    messages.bulkIndexingTitle,
    messages.createJob_help,
    messages.purgeIndexesHelpText,
    messages.purgeIndexesButton,
    messages.purgeIndexesButton_label,
    messages.enableSearchingTitle,
    messages.enableSearchingDescription,
];
