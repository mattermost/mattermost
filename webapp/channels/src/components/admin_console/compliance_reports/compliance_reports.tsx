// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedTime, type IntlShape, injectIntl} from 'react-intl';

import type {Compliance} from '@mattermost/types/compliance';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingScreen from 'components/loading_screen';
import ReloadIcon from 'components/widgets/icons/fa_reload_icon';

type Props = {

    /*
        * Set if compliance reports are licensed
        */
    isLicensed: boolean;

    /*
        * Set if compliance reports are enabled in the config
        */
    enabled: boolean;

    /*
        * Array of reports to render
        */
    reports: Compliance[];
    users: Record<string, UserProfile>;

    /*
        * Error message to display
        */
    serverError?: string;

    readOnly?: boolean;

    intl: IntlShape;

    actions: {

        /*
            * Function to get compliance reports
            */
        getComplianceReports: () => Promise<ActionResult<Compliance[]>>;

        /*
            * Function to save compliance reports
            */
        createComplianceReport: (job: Partial<Compliance>) => Promise<ActionResult<Compliance>>;
    };
}

type State = {
    loadingReports: boolean;
    runningReport?: boolean;
}

class ComplianceReports extends React.PureComponent<Props, State> {
    private descInput: React.RefObject<HTMLInputElement>;
    private emailsInput: React.RefObject<HTMLInputElement>;
    private fromInput: React.RefObject<HTMLInputElement>;
    private keywordsInput: React.RefObject<HTMLInputElement>;
    private toInput: React.RefObject<HTMLInputElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            loadingReports: true,
        };

        this.descInput = React.createRef();
        this.emailsInput = React.createRef();
        this.fromInput = React.createRef();
        this.keywordsInput = React.createRef();
        this.toInput = React.createRef();
    }

    componentDidMount() {
        if (!this.props.isLicensed || !this.props.enabled) {
            return;
        }

        this.props.actions.getComplianceReports().then(
            () => this.setState({loadingReports: false}),
        );
    }

    reload = () => {
        this.setState({loadingReports: true});

        this.props.actions.getComplianceReports().then(
            () => this.setState({loadingReports: false}),
        );
    };

    runReport = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        this.setState({runningReport: true});

        const job: Partial<Compliance> = {};
        job.desc = this.descInput.current?.value;
        job.emails = this.emailsInput.current?.value;
        job.keywords = this.keywordsInput.current?.value;
        job.start_at = this.fromInput.current ? Date.parse(this.fromInput.current.value) : undefined;
        job.end_at = this.toInput.current ? Date.parse(this.toInput.current.value) : undefined;

        this.props.actions.createComplianceReport(job).then(
            ({data}) => {
                if (data) {
                    if (this.emailsInput.current) {
                        this.emailsInput.current.value = '';
                    }
                    if (this.keywordsInput.current) {
                        this.keywordsInput.current.value = '';
                    }
                    if (this.descInput.current) {
                        this.descInput.current.value = '';
                    }
                    if (this.fromInput.current) {
                        this.fromInput.current.value = '';
                    }
                    if (this.toInput.current) {
                        this.toInput.current.value = '';
                    }
                }
                this.setState({runningReport: false});
                this.props.actions.getComplianceReports();
            },
        );
    };

    getDateTime(millis: number) {
        const date = new Date(millis);
        return (
            <span style={style.date}>
                <FormattedDate
                    value={date}
                    day='2-digit'
                    month='short'
                    year='numeric'
                />
                {' - '}
                <FormattedTime
                    value={date}
                    hour='2-digit'
                    minute='2-digit'
                />
            </span>
        );
    }

    render() {
        if (!this.props.isLicensed || !this.props.enabled) {
            return <div/>;
        }

        let content = null;
        if (this.state.loadingReports) {
            content = <LoadingScreen/>;
        } else {
            const list = [];

            for (let i = 0; i < this.props.reports.length; i++) {
                const report = this.props.reports[i];

                let params: string | JSX.Element = '';
                if (report.type === 'adhoc') {
                    params = (
                        <span>
                            <FormattedMessage
                                id='admin.compliance_reports.from'
                                defaultMessage='From:'
                            />{' '}{this.getDateTime(report.start_at)}
                            <br/>
                            <FormattedMessage
                                id='admin.compliance_reports.to'
                                defaultMessage='To:'
                            />{' '}{this.getDateTime(report.end_at)}
                            <br/>
                            <FormattedMessage
                                id='admin.compliance_reports.emails'
                                defaultMessage='Emails:'
                            />{' '}{report.emails}
                            <br/>
                            <FormattedMessage
                                id='admin.compliance_reports.keywords'
                                defaultMessage='Keywords:'
                            />{' '}{report.keywords}
                        </span>);
                }
                let download: string | JSX.Element = '';
                let status: string | JSX.Element = '';
                if (report.status === 'finished') {
                    download = (
                        <a href={`${Client4.getBaseRoute()}/compliance/reports/${report.id}/download`}>
                            <FormattedMessage
                                id='admin.compliance_table.download'
                                defaultMessage='Download'
                            />
                        </a>
                    );

                    status = (
                        <span className='status-icon-success'>
                            <FormattedMessage
                                id='admin.compliance_table.success'
                                defaultMessage='Success'
                            />
                        </span>
                    );
                } else if (report.status === 'running') {
                    status = (
                        <span className='status-icon-warning'>
                            <FormattedMessage
                                id='admin.compliance_table.pending'
                                defaultMessage='Pending'
                            />
                        </span>
                    );
                } else if (report.status === 'failed') {
                    status = (
                        <span className='status-icon-error'>
                            <FormattedMessage
                                id='admin.compliance_table.failed'
                                defaultMessage='Failed'
                            />
                        </span>
                    );
                }

                let user = report.user_id;
                const profile = this.props.users[report.user_id];
                if (profile) {
                    user = profile.email;
                }

                list[i] = (
                    <tr key={report.id}>
                        <td>{status}</td>
                        <td style={style.dataCell}>{download}</td>
                        <td>{this.getDateTime(report.create_at)}</td>
                        <td>{report.count}</td>
                        <td>{report.type}</td>
                        <td style={style.dataCell}>{report.desc}</td>
                        <td>{user}</td>
                        <td style={style.dataCell}>{params}</td>
                    </tr>
                );
            }

            content = (
                <div style={style.content}>
                    <table className='table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.status'
                                        defaultMessage='Status'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.files'
                                        defaultMessage='Files'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.timestamp'
                                        defaultMessage='Timestamp'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.records'
                                        defaultMessage='Records'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.type'
                                        defaultMessage='Type'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.desc'
                                        defaultMessage='Description'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.userId'
                                        defaultMessage='Requested By'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.params'
                                        defaultMessage='Params'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {list}
                        </tbody>
                    </table>
                </div>
            );
        }

        let serverError: string | JSX.Element = '';
        if (this.props.serverError) {
            serverError = (
                <div
                    className='form-group has-error'
                    style={style.serverError}
                >
                    <label className='control-label'>{this.props.serverError}</label>
                </div>
            );
        }

        return (
            <div className='panel compliance-panel'>
                <h4>
                    <FormattedMessage
                        id='admin.compliance_reports.title'
                        defaultMessage='Compliance Reports'
                    />
                </h4>
                <div className='row'>
                    <div className='col-sm-6 col-md-4 form-group'>
                        <label>
                            <FormattedMessage
                                id='admin.compliance_reports.desc'
                                defaultMessage='Job Name:'
                            />
                        </label>
                        <input
                            type='text'
                            className='form-control'
                            id='desc'
                            ref={this.descInput}
                            placeholder={this.props.intl.formatMessage({id: 'admin.compliance_reports.desc_placeholder', defaultMessage: 'E.g. "Audit 445 for HR"'})}
                            disabled={this.props.readOnly}
                        />
                    </div>
                    <div className='col-sm-3 col-md-2 form-group'>
                        <label>
                            <FormattedMessage
                                id='admin.compliance_reports.from'
                                defaultMessage='From:'
                            />
                        </label>
                        <input
                            type='text'
                            className='form-control'
                            id='from'
                            ref={this.fromInput}
                            placeholder={this.props.intl.formatMessage({id: 'admin.compliance_reports.from_placeholder', defaultMessage: 'E.g. "2016-03-11"'})}
                            disabled={this.props.readOnly}
                        />
                    </div>
                    <div className='col-sm-3 col-md-2 form-group'>
                        <label>
                            <FormattedMessage
                                id='admin.compliance_reports.to'
                                defaultMessage='To:'
                            />
                        </label>
                        <input
                            type='text'
                            className='form-control'
                            id='to'
                            ref={this.toInput}
                            placeholder={this.props.intl.formatMessage({id: 'admin.compliance_reports.to_placeholder', defaultMessage: 'E.g. "2016-03-15"'})}
                            disabled={this.props.readOnly}
                        />
                    </div>
                </div>
                <div className='row'>
                    <div className='col-sm-6 col-md-4 form-group'>
                        <label>
                            <FormattedMessage
                                id='admin.compliance_reports.emails'
                                defaultMessage='Emails:'
                            />
                        </label>
                        <input
                            type='text'
                            className='form-control'
                            id='emails'
                            ref={this.emailsInput}
                            placeholder={this.props.intl.formatMessage({id: 'admin.compliance_reports.emails_placeholder', defaultMessage: 'E.g. "bill@example.com, bob@example.com"'})}
                            disabled={this.props.readOnly}
                        />
                    </div>
                    <div className='col-sm-6 col-md-4 form-group'>
                        <label>
                            <FormattedMessage
                                id='admin.compliance_reports.keywords'
                                defaultMessage='Keywords:'
                            />
                        </label>
                        <input
                            type='text'
                            className='form-control'
                            id='keywords'
                            ref={this.keywordsInput}
                            placeholder={this.props.intl.formatMessage({id: 'admin.compliance_reports.keywords_placeholder', defaultMessage: 'E.g. "shorting stock"'})}
                            disabled={this.props.readOnly}
                        />
                    </div>
                </div>
                <div className='clearfix'>
                    <button
                        id='run-button'
                        type='submit'
                        className='btn btn-primary'
                        onClick={this.runReport}
                        disabled={this.props.readOnly}
                    >
                        <FormattedMessage
                            id='admin.compliance_reports.run'
                            defaultMessage='Run Compliance Report'
                        />
                    </button>
                </div>
                {serverError}
                <div className='text-right'>
                    <button
                        type='submit'
                        className='btn btn-tertiary'
                        disabled={this.state.runningReport}
                        onClick={this.reload}
                    >
                        <ReloadIcon/>
                        <FormattedMessage
                            id='admin.compliance_reports.reload'
                            defaultMessage='Reload Completed Compliance Reports'
                        />
                    </button>
                </div>
                <div className='compliance-panel__table'>
                    {content}
                </div>
            </div>
        );
    }
}

const style: Record<string, React.CSSProperties> = {
    content: {margin: 10},
    greenStatus: {color: 'green'},
    redStatus: {color: 'red'},
    dataCell: {whiteSpace: 'nowrap'},
    date: {whiteSpace: 'nowrap'},
    serverError: {marginTop: '10px'},
};

export default injectIntl(ComplianceReports);
