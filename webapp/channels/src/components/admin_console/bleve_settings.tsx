// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {Job} from '@mattermost/types/jobs';

import {blevePurgeIndexes} from 'actions/admin_actions.jsx';

import ExternalLink from 'components/external_link';

import {JobStatuses, JobTypes} from 'utils/constants';

import AdminSettings from './admin_settings';
import type {BaseProps, BaseState} from './admin_settings';
import BooleanSetting from './boolean_setting';
import JobsTable from './jobs';
import RequestButton from './request_button/request_button';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

type Props = BaseProps & {
    config: AdminConfig;
};

type State = BaseState & {
    indexDir: string;
    enableIndexing: boolean;
    enableSearching: boolean;
    enableAutocomplete: boolean;
    canSave: boolean;
    canPurgeAndIndex: boolean;
};

const messages = defineMessages({
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

export default class BleveSettings extends AdminSettings<Props, State> {
    getConfigFromState = (config: Props['config']) => {
        if (config && config.BleveSettings) {
            config.BleveSettings.IndexDir = this.state.indexDir;
            config.BleveSettings.EnableIndexing = this.state.enableIndexing;
            config.BleveSettings.EnableSearching = this.state.enableSearching;
            config.BleveSettings.EnableAutocomplete = this.state.enableAutocomplete;
        }
        return config;
    };

    getStateFromConfig(config: Props['config']) {
        return {
            enableIndexing: config.BleveSettings.EnableIndexing,
            indexDir: config.BleveSettings.IndexDir,
            enableSearching: config.BleveSettings.EnableSearching,
            enableAutocomplete: config.BleveSettings.EnableAutocomplete,
            canSave: true,
            canPurgeAndIndex: config.BleveSettings.EnableIndexing,
        };
    }

    handleSettingChanged = (id: string, value: boolean) => {
        if (id === 'enableIndexing') {
            if (value === false) {
                this.setState({
                    enableSearching: false,
                    enableAutocomplete: false,
                });
            }
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
            canPurgeAndIndex: this.state.enableIndexing && this.state.indexDir !== '',
        });
    };

    canSave = () => {
        return this.state.canSave;
    };

    getExtraInfo(job: Job) {
        if (job.status === JobStatuses.IN_PROGRESS) {
            return (
                <FormattedMessage
                    id='admin.bleve.percentComplete'
                    defaultMessage='{percent}% Complete'
                    values={{percent: Number(job.progress)}}
                />
            );
        }

        return <></>;
    }

    renderTitle() {
        return (<FormattedMessage {...messages.title}/>);
    }

    renderSettings = () => {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableIndexing'
                    label={<FormattedMessage {...messages.enableIndexingTitle}/>}
                    helpText={
                        <FormattedMessage
                            {...messages.enableIndexingDescription}
                            values={{
                                link: (chunks) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/deploy/bleve-search.html'
                                        location='bleve_settings'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.enableIndexing}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('BleveSettings.EnableIndexing')}
                    disabled={this.props.isDisabled}
                />
                <TextSetting
                    id='indexDir'
                    label={
                        <FormattedMessage
                            id='admin.bleve.indexDirTitle'
                            defaultMessage='Index Directory:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.bleve.indexDirDescription'
                            defaultMessage='Directory path to use for store bleve indexes.'
                        />
                    }
                    value={this.state.indexDir}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('BleveSettings.IndexDir')}
                    disabled={this.props.isDisabled}
                />
                <div className='form-group'>
                    <label className='control-label col-sm-4'>
                        <FormattedMessage {...messages.bulkIndexingTitle}/>
                    </label>
                    <div className='col-sm-8'>
                        <div className='job-table-setting'>
                            <JobsTable
                                jobType={JobTypes.BLEVE_POST_INDEXING}
                                disabled={!this.state.canPurgeAndIndex || Boolean(this.props.isDisabled)}
                                createJobButtonText={
                                    <FormattedMessage
                                        id='admin.bleve.createJob.title'
                                        defaultMessage='Index Now'
                                    />
                                }
                                createJobHelpText={<FormattedMessage {...messages.createJob_help}/>}
                                getExtraInfoText={this.getExtraInfo}
                            />
                        </div>
                    </div>
                </div>
                <RequestButton
                    id='purgeIndexesSection'
                    requestAction={blevePurgeIndexes}
                    helpText={<FormattedMessage {...messages.purgeIndexesHelpText}/>}
                    buttonText={<FormattedMessage {...messages.purgeIndexesButton}/>}
                    successMessage={defineMessage({
                        id: 'admin.bleve.purgeIndexesButton.success',
                        defaultMessage: 'Indexes purged successfully.',
                    })}
                    errorMessage={defineMessage({
                        id: 'admin.bleve.purgeIndexesButton.error',
                        defaultMessage: 'Failed to purge indexes: {error}',
                    })}
                    disabled={!this.state.canPurgeAndIndex || this.props.isDisabled}
                    label={<FormattedMessage {...messages.purgeIndexesButton_label}/>}
                />
                <BooleanSetting
                    id='enableSearching'
                    label={<FormattedMessage {...messages.enableSearchingTitle}/>}
                    helpText={<FormattedMessage {...messages.enableSearchingDescription}/>}
                    value={this.state.enableSearching}
                    disabled={!this.state.enableIndexing || this.props.isDisabled}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('BleveSettings.EnableSearching')}
                />
                <BooleanSetting
                    id='enableAutocomplete'
                    label={
                        <FormattedMessage
                            id='admin.bleve.enableAutocompleteTitle'
                            defaultMessage='Enable Bleve for autocomplete queries:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.bleve.enableAutocompleteDescription'
                            defaultMessage='When true, Bleve will be used for all autocompletion queries on users and channels using the latest index. Autocompletion results may be incomplete until a bulk index of the existing users and channels database is finished. When false, database autocomplete is used.'
                        />
                    }
                    value={this.state.enableAutocomplete}
                    disabled={!this.state.enableIndexing || this.props.isDisabled}
                    onChange={this.handleSettingChanged}
                    setByEnv={this.isSetByEnv('BleveSettings.EnableAutocomplete')}
                />
            </SettingsGroup>
        );
    };
}
