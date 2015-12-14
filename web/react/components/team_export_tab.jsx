// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../utils/client.jsx';

const messages = defineMessages({
    exporting: {
        id: 'team_export_tab.exporting',
        defaultMessage: ' Exporting...'
    },
    ready: {
        id: 'team_export_tab.ready',
        defaultMessage: ' Ready for '
    },
    download: {
        id: 'team_export_tab.download',
        defaultMessage: 'download'
    },
    unable: {
        id: 'team_export_tab.unable',
        defaultMessage: ' Unable to export: '
    },
    export: {
        id: 'team_export_tab.export',
        defaultMessage: 'Export'
    },
    exportTeam: {
        id: 'team_export_tab.exportTeam',
        defaultMessage: 'Export your team'
    }
});

class TeamExportTab extends React.Component {
    constructor(props) {
        super(props);
        this.state = {status: 'request', link: '', err: ''};

        this.onExportSuccess = this.onExportSuccess.bind(this);
        this.onExportFailure = this.onExportFailure.bind(this);
        this.doExport = this.doExport.bind(this);
    }
    onExportSuccess(data) {
        this.setState({status: 'ready', link: data.link, err: ''});
    }
    onExportFailure(e) {
        this.setState({status: 'failure', link: '', err: e.message});
    }
    doExport() {
        if (this.state.status === 'in-progress') {
            return;
        }
        this.setState({status: 'in-progress'});
        Client.exportTeam(this.onExportSuccess, this.onExportFailure);
    }
    render() {
        const {formatMessage} = this.props.intl;
        var messageSection = '';
        switch (this.state.status) {
        case 'request':
            messageSection = '';
            break;
        case 'in-progress':
            messageSection = (
                <p className='confirm-import alert alert-warning'>
                    <i className='fa fa-spinner fa-pulse' />
                    {formatMessage(messages.exporting)}
                </p>
            );
            break;
        case 'ready':
            messageSection = (
                <p className='confirm-import alert alert-success'>
                    <i className='fa fa-check' />
                    {formatMessage(messages.ready)}
                    <a
                        href={this.state.link}
                        download={true}
                    >
                        {formatMessage(messages.download)}
                    </a>
                </p>
            );
            break;
        case 'failure':
            messageSection = (
                <p className='confirm-import alert alert-warning'>
                    <i className='fa fa-warning' />
                    {formatMessage(messages.unable) + this.state.err}
                </p>
            );
            break;
        }

        return (
            <div
                ref='wrapper'
                className='user-settings'
            >
                <h3 className='tab-header'>{formatMessage(messages.export)}</h3>
                <div className='divider-dark first'/>
                <ul className='section-max'>
                    <li className='col-xs-12 section-title'>{formatMessage(messages.exportTeam)}</li>
                    <li className='col-xs-offset-3 col-xs-8'>
                        <ul className='setting-list'>
                            <li className='setting-list-item'>
                                <a
                                    className='btn btn-sm btn-primary btn-file sel-btn'
                                    href='#'
                                    onClick={this.doExport}
                                >
                                {formatMessage(messages.export)}
                                </a>
                            </li>
                        </ul>
                    </li>
                </ul>
                <div className='divider-dark'/>
                {messageSection}
            </div>
        );
    }
}

TeamExportTab.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(TeamExportTab);