// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from '../utils/utils.jsx';
import SettingUpload from './setting_upload.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const holders = defineMessages({
    importSlack: {
        id: 'team_import_tab.importSlack',
        defaultMessage: 'Import from Slack (Beta)'
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
                <FormattedHTMLMessage
                    id='team_import_tab.importHelp'
                    defaultMessage="<p>To import a team from Slack go to Slack > Team Settings > Import/Export Data > Export > Start Export. Slack does not allow you to export files, images, private groups or direct messages stored in Slack. Therefore, Slack import to Mattermost only supports importing of text messages in your Slack team's public channels.</p><p>The Slack import to Mattermost is in 'Beta'. Slack bot posts do not yet import and Slack @mentions are not currently supported.</p>"
                />
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
                <p className='confirm-import alert alert-warning'><i className='fa fa-spinner fa-pulse'></i>
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
                    <button type='button'
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
                            <i className='fa fa-angle-left'></i>
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