// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {JSX, MouseEvent} from 'react';
import {FormattedMessage, injectIntl, type MessageDescriptor, type WrappedComponentProps} from 'react-intl';

import {
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

import type {TeamWithMembership} from '../system_user_detail/team_list/types';

export const PAGE_SIZE = 10;

type Paging = {
    startCount: number;
    endCount: number;
    total: number;
};

type Props = WrappedComponentProps & {
    data: Array<Group | TeamWithMembership>;
    onPageChangedCallback?: (page: Paging, data: Array<Group | Team>) => void;
    total: number;
    header: JSX.Element;
    renderRow: (item: Group | TeamWithMembership) => JSX.Element;
    emptyListText: MessageDescriptor;
    actions: {
        getData: (page: number, perPage: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean, includeDeleted?: boolean) => Promise<void>;
    };
    noPadding?: boolean;
};

type State = {
    loading: boolean;
    page: number;
};

class AbstractList extends React.PureComponent<Props, State> {
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
                    <FormattedMessage {...this.props.emptyListText}/>
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
                this.props.onPageChangedCallback(this.getPaging(), response as unknown as Array<Group | Team>);
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
                    <WithTooltip title={this.props.intl.formatMessage({id: 'adminConsole.list.table.pagination.previous', defaultMessage: 'Go to previous page'})}>
                        <IconButton
                            size='small'
                            icon={<Icon glyph={<ChevronLeftIcon/>}/>}
                            onClick={this.previousPage}
                            disabled={firstPage}
                            aria-label={this.props.intl.formatMessage({id: 'adminConsole.list.table.pagination.previous', defaultMessage: 'Go to previous page'})}
                        />
                    </WithTooltip>
                    <WithTooltip title={this.props.intl.formatMessage({id: 'adminConsole.list.table.pagination.next', defaultMessage: 'Go to next page'})}>
                        <IconButton
                            size='small'
                            icon={<Icon glyph={<ChevronRightIcon/>}/>}
                            onClick={this.nextPage}
                            disabled={lastPage}
                            data-testid='page-link-next'
                            aria-label={this.props.intl.formatMessage({id: 'adminConsole.list.table.pagination.next', defaultMessage: 'Go to next page'})}
                        />
                    </WithTooltip>
                </div>}
            </div>
        );
    };
}

export default injectIntl(AbstractList);
