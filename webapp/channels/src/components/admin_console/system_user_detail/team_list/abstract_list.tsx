// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

import type {TeamWithMembership} from './types';

import './abstract_list.scss';

const PAGE_SIZE = 10;

type Props = {
    userId: string;
    headerLabels: Array<{
        label?: MessageDescriptor;
        style: React.CSSProperties;
    }>;
    data: TeamWithMembership[];
    onPageChangedCallback?: (paging: Paging) => void;
    total: number;
    renderRow: (item: TeamWithMembership) => JSX.Element;
    emptyList: MessageDescriptor;
    actions: {
        getTeamsData: (userId: string) => Promise<ActionResult<Team[]>>;
        removeGroup?: () => void;
    };
}

type State = {
    loading: boolean;
    page: number;
}

type Paging = {
    startCount: number;
    endCount: number;
    total: number;
}

export default class AbstractList extends React.PureComponent<Props, State> {
    public static defaultProps = {
        data: [],
    };

    public constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
            page: 0,
        };
    }

    public componentDidMount() {
        this.performSearch();
    }

    private previousPage = async (e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        e.preventDefault();
        const page = this.state.page < 1 ? 0 : this.state.page - 1;
        this.setState({page, loading: true});
        this.performSearch();
    };

    private nextPage = async (e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        e.preventDefault();
        const page = this.state.page + 1;
        this.setState({page, loading: true});
        this.performSearch();
    };

    private performSearch = (): void => {
        const userId = this.props.userId;

        this.setState({loading: true});

        this.props.actions.getTeamsData(userId).then!(() => {
            if (this.props.onPageChangedCallback) {
                this.props.onPageChangedCallback(this.getPaging());
            }
            this.setState({loading: false});
        });
    };

    private getPaging(): Paging {
        const startCount = (this.state.page * PAGE_SIZE) + 1;
        let endCount = (this.state.page * PAGE_SIZE) + PAGE_SIZE;
        const total = this.props.total;
        if (endCount > total) {
            endCount = total;
        }
        return {startCount, endCount, total};
    }

    private renderHeaderLabels = () => {
        if (this.props.data.length > 0) {
            return (
                <div className='AbstractList__header'>
                    {this.props.headerLabels.map((headerLabel, id) => (
                        <div
                            key={id}
                            className='AbstractList__header-label'
                            style={headerLabel.style}
                        >
                            <FormattedMessage {...headerLabel.label}/>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    private renderRows = (): JSX.Element | JSX.Element[] => {
        if (this.state.loading) {
            return (
                <div className='AbstractList__loading'>
                    <i className='fa fa-spinner fa-pulse fa-2x'/>
                </div>
            );
        }
        if (this.props.data.length === 0) {
            return (
                <div className='AbstractList__empty'>
                    <FormattedMessage {...this.props.emptyList}/>
                </div>
            );
        }
        const pageStart = this.state.page < 1 ? 0 : (this.state.page * PAGE_SIZE); // ie 0, 10, 20, etc.
        const pageEnd = this.state.page < 1 ? PAGE_SIZE : (this.state.page + 1) * PAGE_SIZE; // ie 10, 20, 30, etc.
        const pageData = this.props.data.slice(pageStart, pageEnd).map(this.props.renderRow); // ie 0-10, 10-20, etc.
        return pageData;
    };

    public render = (): JSX.Element => {
        const {startCount, endCount, total} = this.getPaging();
        const lastPage = endCount === total;
        const firstPage = this.state.page === 0;
        return (
            <div className='AbstractList'>
                {this.renderHeaderLabels()}
                <div className='AbstractList__body'>
                    {this.renderRows()}
                </div>
                {total > 0 &&
                    <div className='AbstractList__footer'>
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
                            onClick={firstPage ? () => null : this.previousPage}
                            disabled={firstPage}
                        >
                            <PreviousIcon/>
                        </button>
                        <button
                            type='button'
                            className={'btn btn-tertiary next ' + (lastPage ? 'disabled' : '')}
                            onClick={lastPage ? () => null : this.nextPage}
                            disabled={lastPage}
                        >
                            <NextIcon/>
                        </button>
                    </div>
                }
            </div>
        );
    };
}

