// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ArrowDownIcon, ArrowUpIcon} from '@mattermost/compass-icons/components';

import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import {FilterOptions} from 'components/admin_console/filter/filter';

import {LogFilter, LogLevelEnum, LogObject} from '@mattermost/types/admin';
import {ChannelSearchOpts} from '@mattermost/types/channels';
import './log_list.scss';
import FullLogEventModal from '../full_log_event_modal';

type Props = {
    loading: boolean;
    logs: LogObject[];
    onFiltersChange: (filters: LogFilter) => void;
    onSearchChange: (term: string) => void;
    search: string;
    filters: LogFilter;
};

type State = {
    modalLog: null | LogObject;
    modalOpen: boolean;
    page: number;
    dateAsc: boolean;
}

const PAGE_SIZE = 50;

export default class LogList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            modalLog: null,
            modalOpen: false,
            page: 0,
            dateAsc: true,
        };
    }

    isSearching = (term: string, filters: ChannelSearchOpts) => {
        return term.length > 0 || Object.keys(filters).length > 0;
    }

    onSearch = (term: string) => {
        this.props.onSearchChange(term);
    }

    nextPage = () => {
        const page = this.state.page + 1;
        this.setState({page});
    }

    previousPage = () => {
        const page = this.state.page - 1;
        this.setState({page});
    }

    getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {page} = this.state;
        const startCount = (page * PAGE_SIZE) + 1;
        const total = this.props.logs?.length ?? 0;

        let endCount = 0;

        endCount = (page + 1) * PAGE_SIZE;
        endCount = endCount > total ? total : endCount;

        return {startCount, endCount, total};
    }

    handleDateSort = () => {
        this.setState({dateAsc: !this.state.dateAsc});
        this.getColumns(this.state.dateAsc);
    }

    getColumns = (dateAsc: boolean): Column[] => {
        const timestamp: JSX.Element = (
            <div
                className='timestamp'
                onClick={this.handleDateSort}
            >
                <FormattedMessage
                    id='admin.compliance_table.timestamp'
                    defaultMessage='Timestamp'
                />
                {dateAsc ? (<ArrowUpIcon size={18}/>) : (<ArrowDownIcon size={18}/>)}
            </div>
        );
        const level: JSX.Element = (
            <FormattedMessage
                id='admin.log.logLevel'
                defaultMessage='Level'
            />
        );
        const msg: JSX.Element = (
            <FormattedMessage
                id='user.settings.notifications.autoResponderPlaceholder'
                defaultMessage='Message'
            />
        );
        const caller: JSX.Element = (
            <FormattedMessage
                id='admin.logs.caller'
                defaultMessage='Caller'
            />
        );
        const options: JSX.Element = (
            <FormattedMessage
                id='admin.logs.options'
                defaultMessage='Options'
            />
        );

        return [
            {
                field: 'timestamp',
                fixed: true,
                name: timestamp,
                textAlign: 'left',
                width: 1.5,
            },
            {
                field: 'level',
                fixed: true,
                name: level,
                textAlign: 'left',
                width: 0.5,
            },
            {
                field: 'msg',
                fixed: true,
                name: msg,
                textAlign: 'left',
                width: 2.5,
            },
            {
                field: 'caller',
                fixed: true,
                name: caller,
                textAlign: 'left',
                width: 1.5,
            },
            {
                field: 'options',
                fixed: true,
                name: options,
                textAlign: 'left',
                width: 1,
            },
        ];
    }

    getRows = (): Row[] => {
        const {startCount, endCount} = this.getPaginationProps();
        const sortedLogs = this.props.logs.sort((a, b) => {
            const timeA = new Date(a.timestamp).valueOf();
            const timeB = new Date(b.timestamp).valueOf();

            if (this.state.dateAsc) {
                return timeA - timeB;
            }
            return timeB - timeA;
        });

        const logsToDisplay = sortedLogs.slice(startCount - 1, endCount);

        return logsToDisplay.map((log: LogObject) => {
            return {
                cells: {
                    timestamp: (
                        <span
                            className='group-name overflow--ellipsis row-content'
                            data-testid='timestamp'
                        >
                            <span className='group-description row-content'>
                                {log.timestamp}
                            </span>
                        </span>
                    ),
                    level: (
                        <span className='group-description adjusted row-content'>
                            {log.level}
                        </span>
                    ),
                    msg: (
                        <span
                            className='group-description row-content'
                            title={log.msg}
                        >
                            {log.msg}
                        </span>
                    ),
                    caller: (
                        <span
                            className='group-description row-content'
                        >
                            {log.caller}
                        </span>
                    ),
                    options: (
                        <button
                            type='submit'
                            className='btn btn-inverted'
                        >
                            <FormattedMessage
                                id='admin.logs.fullEvent'
                                defaultMessage='Full Log event'
                            />
                        </button>
                    ),
                },
                onClick: () => this.showFullLogEvent(log),
            };
        });
    }

    showFullLogEvent = (log: LogObject) => {
        this.setState({
            modalLog: log,
            modalOpen: true,
        });
    }

    hideModal = () => {
        this.setState({
            modalLog: null,
            modalOpen: false,
        });
    }

    onFilter = (filterOptions: FilterOptions) => {
        const filters = {} as unknown as LogFilter;
        const levelValues = filterOptions.levels.values;
        if (levelValues.all.value) {
            filters.logLevels = [];
        } else {
            filters.logLevels = Object.keys(levelValues).reduce<LogFilter['logLevels']>((acc, key) => {
                if (levelValues[key].value) {
                    acc.push(key as LogLevelEnum);
                }
                return acc;
            }, []);
        }
        this.props.onFiltersChange(filters);
    }

    showErrors = () => {
        this.props.onFiltersChange({logLevels: ['error']} as unknown as LogFilter);
    }

    getErrorCount = (): number => {
        let n = 0;
        this.props.logs.map((log) => log.level === 'error' && ++n);
        return n;
    }

    render = (): JSX.Element => {
        const {search} = this.props;
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns(this.state.dateAsc);
        const {startCount, endCount, total} = this.getPaginationProps();

        const placeholderEmpty: JSX.Element = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.no_channels_found'
                defaultMessage='No channels found'
            />
        );

        const rowsContainerStyles = {
            minHeight: `${rows.length * 40}px`,
        };

        const errorsButton: JSX.Element = (
            <button
                className='btn btn-dangerous'
                onClick={this.showErrors}
            >
                <FormattedMessage
                    id='admin.logs.showErrors'
                    defaultMessage='Show last {n} errors'
                    values={{n: this.getErrorCount()}}
                />
            </button>
        );

        const filterOptions: FilterOptions = {
            levels: {
                name: 'Levels',
                values: {
                    all: {
                        name: (
                            <FormattedMessage
                                id='admin.logs.Alllevels'
                                defaultMessage='All levels'
                            />
                        ),
                        value: true,
                    },
                    error: {
                        name: (
                            <FormattedMessage
                                id='admin.logs.Error'
                                defaultMessage='Error'
                            />
                        ),
                        value: false,
                    },
                    warn: {
                        name: (
                            <FormattedMessage
                                id='admin.logs.Warn'
                                defaultMessage='Warn'
                            />
                        ),
                        value: false,
                    },
                    info: {
                        name: (
                            <FormattedMessage
                                id='admin.logs.Info'
                                defaultMessage='Info'
                            />
                        ),
                        value: false,
                    },
                    debug: {
                        name: (
                            <FormattedMessage
                                id='admin.logs.Debug'
                                defaultMessage='Debug'
                            />
                        ),
                        value: false,
                    },
                },
                keys: ['all', 'error', 'info', 'debug'],
            },
        };

        const filterProps = {
            options: filterOptions,
            keys: ['levels'],
            onFilter: this.onFilter,
        };

        return (
            <div className='LogTable'>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    loading={this.props.loading}
                    startCount={startCount}
                    endCount={endCount}
                    total={total}
                    onSearch={this.onSearch}
                    term={search}
                    placeholderEmpty={placeholderEmpty}
                    rowsContainerStyles={rowsContainerStyles}
                    page={this.state.page}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    filterProps={filterProps}
                    extraComponent={errorsButton}
                />
                <FullLogEventModal
                    log={this.state.modalLog}
                    show={this.state.modalOpen}
                    onModalDismissed={this.hideModal}
                />
            </div>
        );
    }
}
