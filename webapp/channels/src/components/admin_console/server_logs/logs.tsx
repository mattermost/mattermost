// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {debounce} from 'lodash';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {
    LogFilter,
    LogLevels,
    LogObject,
    LogServerNames,
} from '@mattermost/types/admin';

import type {ActionFunc} from 'mattermost-redux/types/actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import LogList from './log_list';
import PlainLogList from './plain_log_list';

type Props = {
    logs: LogObject[];
    plainLogs: string[];
    isPlainLogs: boolean;
    actions: {
        getLogs: (logFilter: LogFilter) => ActionFunc;
        getPlainLogs: (
            page?: number | undefined,
            perPage?: number | undefined
        ) => ActionFunc;
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
    page: number;
    perPage: number;
    loadingPlain: boolean;
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
            page: 0,
            perPage: 1000,
            loadingPlain: true,
        };
    }

    componentDidMount() {
        if (this.props.isPlainLogs) {
            this.reloadPlain();
        } else {
            this.reload();
        }
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (this.state.page !== prevState.page && this.props.isPlainLogs) {
            this.reloadPlain();
        }
    }

    nextPage = () => {
        this.setState({page: this.state.page + 1});
    };

    previousPage = () => {
        this.setState({page: this.state.page - 1});
    };

    reload = async () => {
        this.setState({loadingLogs: true});
        await this.props.actions.getLogs({
            serverNames: this.state.serverNames,
            logLevels: this.state.logLevels,
            dateFrom: this.state.dateFrom,
            dateTo: this.state.dateTo,
        });
        this.setState({loadingLogs: false});
    };

    reloadPlain = async () => {
        this.setState({loadingPlain: true});
        await this.props.actions.getPlainLogs(
            this.state.page,
            this.state.perPage,
        );
        this.setState({loadingPlain: false});
    };

    onSearchChange = (search: string) => {
        this.setState({search}, () => this.performSearch());
    };

    performSearch = debounce(() => {
        const {search} = this.state;
        const filteredLogs = this.props.logs.filter((log) => {
            // to be improved
            return `${log.caller}${log.msg}${log.worker}${log.worker}`.toLowerCase().includes(search.toLowerCase());
        });
        this.setState({filteredLogs});
    }, 200);

    onFiltersChange = ({
        dateFrom,
        dateTo,
        logLevels,
        serverNames,
    }: LogFilter) => {
        this.setState({dateFrom, dateTo, logLevels, serverNames}, () =>
            this.reload(),
        );
    };

    render() {
        const content = this.props.isPlainLogs ? (
            <>
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
                    onClick={this.reloadPlain}
                >
                    <FormattedMessage
                        id='admin.logs.ReloadLogs'
                        defaultMessage='Reload Logs'
                    />
                </button>
                <PlainLogList
                    logs={this.props.plainLogs}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    page={this.state.page}
                    perPage={this.state.perPage}
                />
            </>
        ) : (
            <>
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
                            defaultMessage='Reload Logs'
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
            </>
        );
        return (
            <div className='wrapper--admin'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.logs.title'
                        defaultMessage='Server Logs'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-logs-content admin-console__content'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}
