// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage} from 'react-intl';

import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {JobTypes} from 'utils/constants';

import JobsTable from './jobs';

interface Props {
    isDisabled?: boolean;
}

const messages = defineMessages({
    title: {id: 'admin.wikiExport.title', defaultMessage: 'Wiki Export'},
    description: {id: 'admin.wikiExport.description', defaultMessage: 'Export wiki pages and comments to JSONL format for backup or migration.'},
    exportButton: {id: 'admin.wikiExport.exportButton', defaultMessage: 'Run Wiki Export Now'},
    exportHelp: {id: 'admin.wikiExport.exportHelp', defaultMessage: 'Initiates a Wiki Export job immediately.'},
    importTitle: {id: 'admin.wikiImport.title', defaultMessage: 'Wiki Import'},
    importDescription: {id: 'admin.wikiImport.description', defaultMessage: 'Import wiki pages from a JSONL file.'},
    importButton: {id: 'admin.wikiImport.importButton', defaultMessage: 'Run Wiki Import'},
    importHelp: {id: 'admin.wikiImport.importHelp', defaultMessage: 'Import wiki pages from a JSONL file in the import directory.'},
});

export const searchableStrings: Array<
string | MessageDescriptor | [MessageDescriptor, { [key: string]: any }]
> = [
    messages.title,
    messages.description,
    messages.exportButton,
    messages.exportHelp,
    messages.importTitle,
    messages.importDescription,
    messages.importButton,
    messages.importHelp,
];

const WikiExportSettings: React.FC<Props> = (props: Props) => {
    const {isDisabled = false} = props;

    return (
        <div className='admin-console__wrapper'>
            <div className='admin-console__content'>
                <AdminPanel
                    id='wikiExportPanel'
                    title={messages.title}
                    subtitle={messages.description}
                >
                    <JobsTable
                        jobType={JobTypes.WIKI_EXPORT}
                        disabled={isDisabled}
                        createJobButtonText={
                            <FormattedMessage {...messages.exportButton}/>
                        }
                        createJobHelpText={
                            <FormattedMessage {...messages.exportHelp}/>
                        }
                    />
                </AdminPanel>

                <AdminPanel
                    id='wikiImportPanel'
                    title={messages.importTitle}
                    subtitle={messages.importDescription}
                >
                    <JobsTable
                        jobType={JobTypes.WIKI_IMPORT}
                        disabled={isDisabled}
                        createJobButtonText={
                            <FormattedMessage {...messages.importButton}/>
                        }
                        createJobHelpText={
                            <FormattedMessage {...messages.importHelp}/>
                        }
                    />
                </AdminPanel>
            </div>
        </div>
    );
};

export default WikiExportSettings;
