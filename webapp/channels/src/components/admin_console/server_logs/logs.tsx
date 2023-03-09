// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {debounce} from 'lodash';

import {ActionFunc} from 'mattermost-redux/types/actions';

import FormattedAdminHeader from 'components/widgets/admin_console/formatted_admin_header';

import {LogFilter, LogLevels, LogObject, LogServerNames} from '@mattermost/types/admin';

import LogList from './log_list';

type Props = {
    logs: LogObject[];
    actions: {
        getLogs: (logFilter: LogFilter) => ActionFunc;
    };
};

type State = {
    dateFrom: string;
    dateTo: string;
    filteredLogs: LogObject[];
    loadingLogs: boolean;
    logLevels: LogLevels;
    search: string;
    serverNames: LogServerNames;
};

export default class Logs extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            dateFrom: '',
            dateTo: '',
            filteredLogs: [],
            loadingLogs: true,
            logLevels: [],
            search: '',
            serverNames: [],
        };
    }

    componentDidMount() {
        this.reload();
    }

    reload = async () => {
        this.setState({loadingLogs: true});
        await this.props.actions.getLogs({
            serverNames: this.state.serverNames,
            logLevels: this.state.logLevels,
            dateFrom: this.state.dateFrom,
            dateTo: this.state.dateTo,
        });
        this.setState({loadingLogs: false});
    }

    onSearchChange = (search: string) => {
        this.setState({search}, () => this.performSearch());
    }

    performSearch = debounce(() => {
        const {search} = this.state;
        const filteredLogs = this.props.logs.filter((log) => {
            // to be improved
            return `${log.caller}${log.msg}${log.worker}${log.worker}`.toLowerCase().includes(search.toLowerCase());
        });
        this.setState({filteredLogs});
    }, 200);

    onFiltersChange = ({dateFrom, dateTo, logLevels, serverNames}: LogFilter) => {
        this.setState({dateFrom, dateTo, logLevels, serverNames}, () => this.reload());
    }

    render() {
        return (
            <div className='wrapper--admin'>
                <FormattedAdminHeader
                    id='admin.logs.title'
                    defaultMessage='Server Logs'
                />

                <div className='admin-console__wrapper'>
                    <div className='admin-logs-content admin-console__content'>
                        <div className='logs-banner'>
                            <div className='banner'>
                                <div className='banner__content'>
                                    <FormattedMessage
                                        id='admin.logs.bannerDesc'
                                        defaultMessage='To look up users by User ID or Token ID, go to User Management > Users and paste the ID into the search filter.'
                                    />
                                </div>
                            </div>
                            <button
                                type='submit'
                                className='btn btn-primary'
                                onClick={this.reload}
                            >
                                <FormattedMessage
                                    id='admin.logs.ReloadLogs'
                                    defaultMessage='ReloadLogs'
                                />
                            </button>
                        </div>
                        <LogList
                            loading={this.state.loadingLogs}
                            logs={this.state.search ? this.state.filteredLogs : this.props.logs}
                            onSearchChange={this.onSearchChange}
                            search={this.state.search}
                            onFiltersChange={this.onFiltersChange}
                            filters={{
                                dateFrom: this.state.dateFrom,
                                dateTo: this.state.dateTo,
                                logLevels: this.state.logLevels,
                                serverNames: this.state.serverNames,
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    }
}
