// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from 'components/loading_screen.jsx';
import AuditTable from 'components/audit_table.jsx';
import ComplianceReports from 'components/admin_console/compliance_reports';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class Audits extends React.PureComponent {
    static propTypes = {

        /*
         * Array of audits to render
         */
        audits: PropTypes.arrayOf(PropTypes.object).isRequired,

        actions: PropTypes.shape({

            /*
             * Function to fetch audits
             */
            getAudits: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            loadingAudits: true
        };
    }

    componentDidMount() {
        this.props.actions.getAudits().then(
            () => this.setState({loadingAudits: false})
        );
    }

    reload = () => {
        this.setState({loadingAudits: true});
        this.props.actions.getAudits().then(
            () => this.setState({loadingAudits: false})
        );
    }

    render() {
        let content = null;

        if (global.window.mm_license.IsLicensed !== 'true') {
            return <div/>;
        }

        if (this.state.loadingAudits) {
            content = <LoadingScreen/>;
        } else {
            content = (
                <div style={{margin: '10px'}}>
                    <AuditTable
                        audits={this.props.audits}
                        showUserId={true}
                        showIp={true}
                        showSession={true}
                    />
                </div>
            );
        }

        return (
            <div>
                <ComplianceReports/>

                <div className='panel audit-panel'>
                    <h3 className='admin-console-header'>
                        <FormattedMessage
                            id='admin.audits.title'
                            defaultMessage='User Activity Logs'
                        />
                        <button
                            type='submit'
                            className='btn btn-link pull-right'
                            onClick={this.reload}
                        >
                            <i className='fa fa-refresh'/>
                            <FormattedMessage
                                id='admin.audits.reload'
                                defaultMessage='Reload User Activity Logs'
                            />
                        </button>
                    </h3>
                    <div className='audit-panel__table'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}
