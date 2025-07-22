// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {
    LogFilter,
    LogLevels,
    LogObject,
    LogServerNames,
} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';

import ExternalLink from 'components/external_link';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import LogList from './log_list';
import PlainLogList from './plain_log_list';

type LogObjectWithAdditionalInfo = LogObject & {
    [key: string]: string;
};

type Props = {
    logs: LogObjectWithAdditionalInfo[];
    plainLogs: string[];
    isPlainLogs: boolean;
    actions: {
        getLogs: (logFilter: LogFilter) => Promise<unknown>;
        getPlainLogs: (
            page?: number | undefined,
            perPage?: number | undefined
        ) => Promise<unknown>;
    };
};

type State = {
    dateFrom: string;
    dateTo: string;
    filteredLogs: LogObject[];
    loading: boolean;
    logLevels: LogLevels;
    search: string;
    serverNames: LogServerNames;
    page: number;
    perPage: number;
    isPlainLogs: boolean;
};

const messages = defineMessages({
    title: {id: 'admin.logs.title', defaultMessage: 'Server Logs'},
    bannerDesc: {id: 'admin.logs.bannerDesc', defaultMessage: 'To look up users by User ID or Token ID, go to User Management > Users and paste the ID into the search filter.'},
    logFormatTitle: {id: 'admin.logs.logFormatTitle', defaultMessage: 'Log Format:'},
    logFormatJson: {id: 'admin.logs.logFormatJson', defaultMessage: 'JSON'},
    logFormatPlain: {id: 'admin.logs.logFormatPlain', defaultMessage: 'Plain text'},
});
export const searchableStrings = [
    messages.title,
    messages.bannerDesc,
];

export default class Logs extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            dateFrom: '',
            dateTo: '',
            filteredLogs: [],
            loading: true,
            logLevels: [],
            search: '',
            serverNames: [],
            page: 0,
            perPage: 1000,
            isPlainLogs: props.isPlainLogs,
        };
    }

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (this.state.isPlainLogs && (this.state.page !== prevState.page || !this.props.plainLogs?.length)) {
            this.reload();
        }
    }

    nextPage = () => {
        this.setState({page: this.state.page + 1});
    };

    previousPage = () => {
        this.setState({page: this.state.page - 1});
    };

    reload = async () => {
        this.setState({loading: true});
        if (this.state.isPlainLogs) {
            await this.props.actions.getPlainLogs(
                this.state.page,
                this.state.perPage,
            );
        } else {
            await this.props.actions.getLogs({
                serverNames: this.state.serverNames,
                logLevels: this.state.logLevels,
                dateFrom: this.state.dateFrom,
                dateTo: this.state.dateTo,
            });
        }
        this.setState({loading: false});
    };

    onLogFormatToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({isPlainLogs: event.target.value === 'plain'});
    };

    onSearchChange = (search: string) => {
        this.setState({search}, () => this.performSearch());
    };

    performSearch = debounce(() => {
        const {search} = this.state;

        // Excluding level and timestamp from search
        const excludedKeys = new Set(['level', 'timestamp']);

        const filteredLogs = this.props.logs.filter((log) =>
            Object.entries(log).some(([key, value]) => {
                if (excludedKeys.has(key)) {
                    return false;
                }
                return String(value).toLowerCase().includes(search.toLowerCase());
            }),
        );
        this.setState({filteredLogs});
    }, 200);

    componentWillUnmount(): void {
        this.performSearch.cancel();
    }

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
        const list = this.state.isPlainLogs ? (
            <PlainLogList
                loading={this.state.loading}
                logs={this.props.plainLogs}
                nextPage={this.nextPage}
                previousPage={this.previousPage}
                page={this.state.page}
                perPage={this.state.perPage}
            />
        ) : (
            <LogList
                loading={this.state.loading}
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
        );

        let toggleLogFormat;
        if (!this.props.isPlainLogs) {
            toggleLogFormat = (
                <div
                    className='banner-buttons__log-format'
                    id='admin.logs.LogFormat'
                    role='radiogroup'
                    aria-labelledby='admin.logs.LogFormat.legend'
                >
                    <span
                        id='admin.logs.LogFormat.legend'
                    >
                        <FormattedMessage {...messages.logFormatTitle}/>
                    </span>

                    <label>
                        <input
                            type='radio'
                            id='admin.logs.LogFormat.json'
                            name='log-format'
                            value='json'
                            checked={!this.state.isPlainLogs}
                            onChange={this.onLogFormatToggle}
                        />
                        <FormattedMessage {...messages.logFormatJson}/>
                    </label>
                    <label>
                        <input
                            type='radio'
                            id='admin.logs.LogFormat.plain'
                            name='log-format'
                            value='plain'
                            checked={this.state.isPlainLogs}
                            onChange={this.onLogFormatToggle}
                        />
                        <FormattedMessage {...messages.logFormatPlain}/>
                    </label>
                </div>
            );
        }

        return (
            <div className='wrapper--admin'>
                <AdminHeader>
                    <FormattedMessage {...messages.title}/>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-logs-content admin-console__content'>
                        <div className='logs-banner'>
                            <div className='banner'>
                                <div className='banner__content'>
                                    <FormattedMessage {...messages.bannerDesc}/>
                                </div>
                            </div>
                            <div className='banner-buttons'>
                                {toggleLogFormat}
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
                                <ExternalLink
                                    location='download_logs'
                                    className='btn btn-primary'
                                    href={Client4.getUrl() + '/api/v4/logs/download'}
                                >
                                    <FormattedMessage
                                        id='admin.logs.DownloadLogs'
                                        defaultMessage='Download Logs'
                                    />
                                </ExternalLink>
                            </div>
                        </div>
                        {list}
                    </div>
                </div>
            </div>
        );
    }
}
