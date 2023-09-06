// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

import type {TeamWithMembership} from '../system_user_detail/team_list/types';

export const PAGE_SIZE = 10;

type Paging = {
    startCount: number;
    endCount: number;
    total: number;
};

type Props = {
    data: Array<Group | TeamWithMembership>;
    onPageChangedCallback?: (page: Paging, data: Array<Group | Team>) => void;
    total: number;
    header: JSX.Element;
    renderRow: (item: Group | TeamWithMembership) => JSX.Element;
    emptyListTextId: string;
    emptyListTextDefaultMessage: string;
    actions: {
        getData: (page: number, perPage: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean, includeDeleted?: boolean) => Promise<Array<Group | Team>>;
    };
    noPadding?: boolean;
};

type State = {
    loading: boolean;
    page: number;
};

export default class AbstractList extends React.PureComponent<Props, State> {
    static defaultProps = {
        data: [],
        noPadding: false,
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
            page: 0,
        };
    }

    componentDidMount() {
        this.performSearch(this.state.page);
    }

    previousPage = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
        e.preventDefault();
        const page = this.state.page < 1 ? 0 : this.state.page - 1;
        this.setState({page, loading: true});
        this.performSearch(page);
    };

    nextPage = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
        e.preventDefault();
        const page = this.state.page + 1;
        this.setState({page, loading: true});
        this.performSearch(page);
    };

    renderHeader = (): JSX.Element | null => {
        if (this.props.data.length > 0) {
            return this.props.header;
        }
        return null;
    };

    renderRows = (): JSX.Element | JSX.Element[] => {
        if (this.state.loading) {
            return (
                <div className='groups-list-loading'>
                    <i className='fa fa-spinner fa-pulse fa-2x'/>
                </div>
            );
        }
        if (this.props.data.length === 0) {
            return (
                <div className='groups-list-empty'>
                    <FormattedMessage
                        id={this.props.emptyListTextId}
                        defaultMessage={this.props.emptyListTextDefaultMessage}
                    />
                </div>
            );
        }
        const offset = this.state.page * PAGE_SIZE;
        return this.props.data.slice(offset, offset + PAGE_SIZE).map(this.props.renderRow);
    };

    performSearch = (page: number): void => {
        this.setState({loading: true});

        this.props.actions.getData(page, PAGE_SIZE, '', false, true).then((response) => {
            if (this.props.onPageChangedCallback) {
                this.props.onPageChangedCallback(this.getPaging(), response);
            }
            this.setState({loading: false});
        });
    };

    getPaging(): Paging {
        const startCount = (this.state.page * PAGE_SIZE) + 1;
        let endCount = (this.state.page * PAGE_SIZE) + PAGE_SIZE;
        const total = this.props.total;
        if (endCount > total) {
            endCount = total;
        }
        return {startCount, endCount, total};
    }

    render = () => {
        const {startCount, endCount, total} = this.getPaging();
        const {noPadding} = this.props;
        const lastPage = endCount === total;
        const firstPage = this.state.page === 0;
        return (
            <div
                className={classNames(
                    'groups-list',
                    'groups-list-no-padding',
                    {
                        'groups-list-less-padding': noPadding,
                    },
                )}
            >
                {this.renderHeader()}
                <div
                    id='groups-list--body'
                    className='groups-list--body'
                >
                    {this.renderRows()}
                </div>
                {total > 0 && <div className='groups-list--footer'>
                    <div className='counter'>
                        <FormattedMessage
                            id='admin.team_channel_settings.list.paginatorCount'
                            defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                            values={{
                                startCount,
                                endCount,
                                total,
                            }}
                        />
                    </div>
                    <button
                        type='button'
                        className={'btn btn-tertiary prev ' + (firstPage ? 'disabled' : '')}
                        onClick={firstPage ? undefined : this.previousPage}
                        disabled={firstPage}
                    >
                        <PreviousIcon/>
                    </button>
                    <button
                        type='button'
                        className={'btn btn-tertiary next ' + (lastPage ? 'disabled' : '')}
                        onClick={lastPage ? undefined : this.nextPage}
                        disabled={lastPage}
                        data-testid='page-link-next'
                    >
                        <NextIcon/>
                    </button>
                </div>}
            </div>
        );
    };
}
