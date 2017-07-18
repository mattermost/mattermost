// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from 'utils/utils.jsx';
import SettingUpload from './setting_upload.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

const holders = defineMessages({
    importSlack: {
        id: 'team_import_tab.importSlack',
        defaultMessage: 'Import from Slack (Beta)'
    }
});

import React from 'react';

class TeamImportTab extends React.Component {
    constructor(props) {
        super(props);

        this.onImportFailure = this.onImportFailure.bind(this);
        this.onImportSuccess = this.onImportSuccess.bind(this);
        this.doImportSlack = this.doImportSlack.bind(this);

        this.state = {
            status: 'ready',
            link: ''
        };
    }

    onImportFailure() {
        this.setState({status: 'fail'});
    }

    onImportSuccess(data) {
        this.setState({status: 'done', link: 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(atob(data.results))});
    }

    doImportSlack(file) {
        this.setState({status: 'in-progress', link: ''});
        utils.importSlack(file, this.onImportSuccess, this.onImportFailure);
    }

    render() {
        const {formatMessage} = this.props.intl;
        var uploadDocsLink = (
            <a
                href='https://docs.mattermost.com/administration/migrating.html#migrating-from-slack'
                target='_blank'
                rel='noopener noreferrer'
            >
                <FormattedMessage
                    id='team_import_tab.importHelpDocsLink'
                    defaultMessage='documentation'
                />
            </a>
        );

        var uploadExportInstructions = (
            <strong>
                <FormattedMessage
                    id='team_import_tab.importHelpExportInstructions'
                    defaultMessage='Slack > Team Settings > Import/Export Data > Export > Start Export'
                />
            </strong>
        );

        var uploadExporterLink = (
            <a
                href='https://github.com/grundleborg/slack-advanced-exporter'
                target='_blank'
                rel='noopener noreferrer'
            >
                <FormattedMessage
                    id='team_import_tab.importHelpExporterLink'
                    defaultMessage='Slack Advanced Exporter'
                />
            </a>
        );

        var uploadHelpText = (
            <div>
                <p>
                    <FormattedMessage
                        id='team_import_tab.importHelpLine1'
                        defaultMessage="Slack import to Mattermost supports importing of messages in your Slack team's public channels."
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='team_import_tab.importHelpLine2'
                        defaultMessage='To import a team from Slack, go to {exportInstructions}. See {uploadDocsLink} to learn more.'
                        values={{
                            exportInstructions: uploadExportInstructions,
                            uploadDocsLink
                        }}
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='team_import_tab.importHelpLine3'
                        defaultMessage='To import posts with attached files, see {slackAdvancedExporterLink} for details.'
                        values={{
                            slackAdvancedExporterLink: uploadExporterLink
                        }}
                    />
                </p>
            </div>
        );

        var uploadSection = (
            <SettingUpload
                title={formatMessage(holders.importSlack)}
                submit={this.doImportSlack}
                helpText={uploadHelpText}
                fileTypesAccepted='.zip'
            />
        );

        var messageSection;
        switch (this.state.status) {

        case 'ready':
            messageSection = '';
            break;
        case 'in-progress':
            messageSection = (
                <p className='confirm-import alert alert-warning'><i className='fa fa-spinner fa-pulse'/>
                    <FormattedMessage
                        id='team_import_tab.importing'
                        defaultMessage=' Importing...'
                    />
                </p>
            );
            break;
        case 'done':
            messageSection = (
                <p className='confirm-import alert alert-success'>
                    <i className='fa fa-check'/>
                    <FormattedMessage
                        id='team_import_tab.successful'
                        defaultMessage=' Import successful: '
                    />
                    <a
                        href={this.state.link}
                        download='MattermostImportSummary.txt'
                    >
                        <FormattedMessage
                            id='team_import_tab.summary'
                            defaultMessage='View Summary'
                        />
                    </a>
                </p>
        );
            break;
        case 'fail':
            messageSection = (
                <p className='confirm-import alert alert-warning'>
                    <i className='fa fa-warning'/>
                    <FormattedMessage
                        id='team_import_tab.failure'
                        defaultMessage=' Import failure: '
                    />
                    <a
                        href={this.state.link}
                        download='MattermostImportSummary.txt'
                    >
                        <FormattedMessage
                            id='team_import_tab.summary'
                            defaultMessage='View Summary'
                        />
                    </a>
                </p>
            );
            break;
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i className='fa fa-angle-left'/>
                        </div>
                        <FormattedMessage
                            id='team_import_tab.import'
                            defaultMessage='Import'
                        />
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='team_import_tab.import'
                            defaultMessage='Import'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {uploadSection}
                    <div className='divider-dark'/>
                    {messageSection}
                </div>
            </div>
        );
    }
}

TeamImportTab.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(TeamImportTab);
