// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import LoadingScreen from '../loading_screen.jsx';
import * as Utils from '../../utils/utils.jsx';
import AdminStore from '../../stores/admin_store.jsx';
import UserStore from '../../stores/user_store.jsx';

import * as Client from '../../utils/web_client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import {FormattedMessage, FormattedDate, FormattedTime} from 'react-intl';

import React from 'react';
import ReactDOM from 'react-dom';

export default class ComplianceReports extends React.Component {
    constructor(props) {
        super(props);

        this.onComplianceReportsListenerChange = this.onComplianceReportsListenerChange.bind(this);
        this.reload = this.reload.bind(this);
        this.runReport = this.runReport.bind(this);
        this.getDateTime = this.getDateTime.bind(this);

        this.state = {
            reports: AdminStore.getComplianceReports(),
            serverError: null
        };
    }

    componentDidMount() {
        AdminStore.addComplianceReportsChangeListener(this.onComplianceReportsListenerChange);

        if (global.window.mm_license.IsLicensed !== 'true' || global.window.mm_config.EnableCompliance !== 'true') {
            return;
        }

        AsyncClient.getComplianceReports();
    }

    componentWillUnmount() {
        AdminStore.removeComplianceReportsChangeListener(this.onComplianceReportsListenerChange);
    }

    onComplianceReportsListenerChange() {
        this.setState({
            reports: AdminStore.getComplianceReports()
        });
    }

    reload() {
        AdminStore.saveComplianceReports(null);
        this.setState({
            reports: null,
            serverError: null
        });

        AsyncClient.getComplianceReports();
    }

    runReport(e) {
        e.preventDefault();
        $('#run-button').button('loading');

        var job = {};
        job.desc = ReactDOM.findDOMNode(this.refs.desc).value;
        job.emails = ReactDOM.findDOMNode(this.refs.emails).value;
        job.keywords = ReactDOM.findDOMNode(this.refs.keywords).value;
        job.start_at = Date.parse(ReactDOM.findDOMNode(this.refs.from).value);
        job.end_at = Date.parse(ReactDOM.findDOMNode(this.refs.to).value);

        Client.saveComplianceReports(
            job,
            () => {
                ReactDOM.findDOMNode(this.refs.emails).value = '';
                ReactDOM.findDOMNode(this.refs.keywords).value = '';
                ReactDOM.findDOMNode(this.refs.desc).value = '';
                ReactDOM.findDOMNode(this.refs.from).value = '';
                ReactDOM.findDOMNode(this.refs.to).value = '';
                this.reload();
                $('#run-button').button('reset');
            },
            (err) => {
                this.setState({serverError: err.message});
                $('#run-button').button('reset');
            }
        );
    }

    getDateTime(millis) {
        const date = new Date(millis);
        return (
            <span style={{whiteSpace: 'nowrap'}}>
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
        var content = null;

        if (global.window.mm_license.IsLicensed !== 'true' || global.window.mm_config.EnableCompliance !== 'true') {
            return <div/>;
        }

        if (this.state.reports === null) {
            content = <LoadingScreen/>;
        } else {
            var list = [];

            for (var i = 0; i < this.state.reports.length; i++) {
                const report = this.state.reports[i];

                var params = '';
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

                var download = '';
                if (report.status === 'finished') {
                    download = (
                        <a href={Client.getAdminRoute() + '/download_compliance_report/' + report.id}>
                            <FormattedMessage
                                id='admin.compliance_table.download'
                                defaultMessage='Download'
                            />
                        </a>
                    );
                }

                var status = report.status;
                if (report.status === 'finished') {
                    status = (
                        <span style={{color: 'green'}}>{report.status}</span>
                    );
                }

                if (report.status === 'failed') {
                    status = (
                        <span style={{color: 'red'}}>{report.status}</span>
                    );
                }

                var user = report.user_id;
                var profile = UserStore.getProfile(report.user_id);
                if (profile) {
                    user = profile.email;
                }

                list[i] = (
                    <tr key={report.id}>
                        <td style={{whiteSpace: 'nowrap'}}>{download}</td>
                        <td>{this.getDateTime(report.create_at)}</td>
                        <td>{status}</td>
                        <td>{report.count}</td>
                        <td>{report.type}</td>
                        <td style={{whiteSpace: 'nowrap'}}>{report.desc}</td>
                        <td>{user}</td>
                        <td style={{whiteSpace: 'nowrap'}}>{params}</td>
                    </tr>
                );
            }

            content = (
                <div style={{margin: '10px'}}>
                    <table className='table'>
                        <thead>
                            <tr>
                                <th></th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.timestamp'
                                        defaultMessage='Timestamp'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='admin.compliance_table.status'
                                        defaultMessage='Status'
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

        let serverError = '';
        if (this.state.serverError) {
            serverError = (
                <div
                    className='form-group has-error'
                    style={{marginTop: '10px'}}
                >
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        return (
            <div className='panel'>
                <h3>
                    <FormattedMessage
                        id='admin.compliance_reports.title'
                        defaultMessage='Compliance Reports'
                    />
                </h3>

                <table>
                    <tbody>
                        <tr>
                            <td colSpan='5'
                                style={{paddingBottom: '6px'}}
                            >
                                <FormattedMessage
                                    id='admin.compliance_reports.desc'
                                    defaultMessage='Job Name:'
                                />
                                <input
                                    style={{width: '425px'}}
                                    type='text'
                                    className='form-control'
                                    id='desc'
                                    ref='desc'
                                    placeholder={Utils.localizeMessage('admin.compliance_reports.desc_placeholder', 'Ex "Audit 445 for HR"')}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <FormattedMessage
                                    id='admin.compliance_reports.from'
                                    defaultMessage='From:'
                                />
                                <input
                                    type='text'
                                    className='form-control'
                                    id='from'
                                    ref='from'
                                    placeholder={Utils.localizeMessage('admin.compliance_reports.from_placeholder', 'Ex "2016-03-11"')}
                                />
                            </td>
                            <td style={{paddingLeft: '4px'}}>
                                <FormattedMessage
                                    id='admin.compliance_reports.to'
                                    defaultMessage='To:'
                                />
                                <input
                                    type='text'
                                    className='form-control'
                                    id='to'
                                    ref='to'
                                    placeholder={Utils.localizeMessage('admin.compliance_reports.to_placeholder', 'Ex "2016-03-15"')}
                                />
                            </td>
                            <td style={{paddingLeft: '4px'}}>
                                <FormattedMessage
                                    id='admin.compliance_reports.emails'
                                    defaultMessage='Emails:'
                                />
                                <input
                                    style={{width: '325px'}}
                                    type='text'
                                    className='form-control'
                                    id='emails'
                                    ref='emails'
                                    placeholder={Utils.localizeMessage('admin.compliance_reports.emails_placeholder', 'Ex "bill@example.com, bob@example.com"')}
                                />
                            </td>
                            <td style={{paddingLeft: '4px'}}>
                                <FormattedMessage
                                    id='admin.compliance_reports.keywords'
                                    defaultMessage='Keywords:'
                                />
                                <input
                                    style={{width: '250px'}}
                                    type='text'
                                    className='form-control'
                                    id='keywords'
                                    ref='keywords'
                                    placeholder={Utils.localizeMessage('admin.compliance_reports.keywords_placeholder', 'Ex "shorting stock"')}
                                />
                            </td>
                            <td>
                                <button
                                    id='run-button'
                                    type='submit'
                                    className='btn btn-primary'
                                    onClick={this.runReport}
                                    style={{marginTop: '20px', marginLeft: '20px'}}
                                >
                                    <FormattedMessage
                                        id='admin.compliance_reports.run'
                                        defaultMessage='Run'
                                    />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {serverError}
                <div style={{marginTop: '20px'}}>
                    <button
                        type='submit'
                        className='btn btn-primary'
                        onClick={this.reload}
                    >
                        <FormattedMessage
                            id='admin.compliance_reports.reload'
                            defaultMessage='Reload'
                        />
                    </button>
                </div>
                <div className='compliance__panel'>
                    {content}
                </div>
            </div>
        );
    }
}
