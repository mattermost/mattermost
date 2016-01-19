// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, FormattedHTMLMessage, defineMessages} from 'react-intl';
import * as utils from '../utils/utils.jsx';
import SettingUpload from './setting_upload.jsx';

const messages = defineMessages({
    uploadHelp1: {
        id: 'team_import_tab.uploadHelp1',
        defaultMessage: 'Slack does not allow you to export files, images, private groups or direct messages stored in Slack. Therefore, Slack import to Mattermost only supports importing of text messages in your Slack team\'\s public channels.'
    },
    uploadHelp2: {
        id: 'team_import_tab.uploadHelp2',
        defaultMessage: 'The Slack import to Mattermost is in "Preview". Slack bot posts do not yet import and Slack @mentions are not currently supported.'
    },
    importSlack: {
        id: 'team_import_tab.importSlack',
        defaultMessage: 'Import from Slack (Beta)'
    },
    importing: {
        id: 'team_import_tab.importing',
        defaultMessage: ' Importing...'
    },
    successful: {
        id: 'team_import_tab.successful',
        defaultMessage: ' Import successful: '
    },
    summary: {
        id: 'team_import_tab.summary',
        defaultMessage: 'View Summary'
    },
    failure: {
        id: 'team_import_tab.failure',
        defaultMessage: ' Import failure: '
    },
    close: {
        id: 'team_import_tab.close',
        defaultMessage: 'Close'
    },
    import: {
        id: 'team_import_tab.import',
        defaultMessage: 'Import'
    },
    importHelp: {
        id: 'team_import_tab.importHelp',
        defaultMessage: '<p>To import a team from Slack go to Slack > Team Settings > Import/Export Data > Export > Start Export. Slack does not allow you to export files, images, private groups or direct messages stored in Slack. Therefore, Slack import to Mattermost only supports importing of text messages in your Slack team\'\s public channels.</p><p>The Slack import to Mattermost is in "Beta". Slack bot posts do not yet import and Slack @mentions are not currently supported.</p>'
    }
});

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
        this.setState({status: 'fail', link: ''});
    }

    onImportSuccess(data) {
        this.setState({status: 'done', link: 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(data)});
    }

    doImportSlack(file) {
        this.setState({status: 'in-progress', link: ''});
        utils.importSlack(file, this.onImportSuccess, this.onImportFailure);
    }

    render() {
        const {formatMessage} = this.props.intl;
        var uploadHelpText = (
            <div>
                <FormattedHTMLMessage id='team_import_tab.importHelp' />
            </div>
        );

        var uploadSection = (
            <SettingUpload
                title={formatMessage(messages.importSlack)}
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
                <p className='confirm-import alert alert-warning'><i className='fa fa-spinner fa-pulse'></i>{formatMessage(messages.importing)}</p>
            );
            break;
        case 'done':
            messageSection = (
                <p className='confirm-import alert alert-success'>
                    <i className='fa fa-check' />
                    {formatMessage(messages.successful)}
                    <a
                        href={this.state.link}
                        download='ImportSummary.txt'
                    >
                        {formatMessage(messages.summary)}
                    </a>
                </p>
        );
            break;
        case 'fail':
            messageSection = (
                <p className='confirm-import alert alert-warning'>
                    <i className='fa fa-warning' />
                    {formatMessage(messages.failure)}
                    <a
                        href={this.state.link}
                        download='ImportSummary.txt'
                    >
                        {formatMessage(messages.summary)}
                    </a>
                </p>
            );
            break;
        }

        return (
            <div>
                <div className='modal-header'>
                    <button type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label={formatMessage(messages.close)}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    ><i className='modal-back'></i>{formatMessage(messages.import)}</h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>{formatMessage(messages.import)}</h3>
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