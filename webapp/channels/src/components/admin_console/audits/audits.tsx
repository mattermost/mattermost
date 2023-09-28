// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Audit} from '@mattermost/types/audits';

import ComplianceReports from 'components/admin_console/compliance_reports';
import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';
import ReloadIcon from 'components/widgets/icons/fa_reload_icon';

type Props = {
    isLicensed: boolean;
    audits: Audit[];
    isDisabled?: boolean;
    actions: {
        getAudits: () => Promise<{data: Audit[]}>;
    };
};

type State = {
    loadingAudits: boolean;
};

export default class Audits extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            loadingAudits: true,
        };
    }

    public componentDidMount() {
        this.props.actions.getAudits().then(
            () => this.setState({loadingAudits: false}),
        );
    }

    private reload = () => {
        this.setState({loadingAudits: true});
        this.props.actions.getAudits().then(
            () => this.setState({loadingAudits: false}),
        );
    };

    private activityLogHeader = () => {
        const h4Style: CSSProperties = {
            display: 'inline-block',
            marginBottom: '6px',
        };
        const divStyle: CSSProperties = {
            clear: 'both',
        };
        return (
            <div style={divStyle}>
                <h4 style={h4Style}>
                    <FormattedMessage
                        id='admin.complianceMonitoring.userActivityLogsTitle'
                        defaultMessage='User Activity Logs'
                    />
                </h4>
                <button
                    type='submit'
                    className='btn btn-tertiary pull-right'
                    onClick={this.reload}
                >
                    <ReloadIcon/>
                    <FormattedMessage
                        id='admin.audits.reload'
                        defaultMessage='Reload User Activity Logs'
                    />
                </button>
            </div>
        );
    };

    private renderComplianceReports = () => {
        if (!this.props.isLicensed) {
            return <div/>;
        }
        return <ComplianceReports readOnly={this.props.isDisabled}/>;
    };

    public render() {
        let content = null;

        if (this.state.loadingAudits) {
            content = <LoadingScreen/>;
        } else {
            content = (
                <div>
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
                {this.renderComplianceReports()}
                <div className='panel compliance-panel'>
                    {this.activityLogHeader()}
                    <div className='compliance-panel__table'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}
