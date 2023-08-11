// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import LocalizedInput from 'components/localized_input/localized_input';
import QuickInput from 'components/quick_input';
import UserList from 'components/user_list';

import {t} from 'utils/i18n';

const NEXT_BUTTON_TIMEOUT = 500;

type Props = {
    users: UserProfile[] | null;
    usersPerPage: number;
    total: number;
    extraInfo?: {[key: string]: Array<string | JSX.Element>};
    nextPage: () => void;
    previousPage: () => void;
    search: (term: string) => void;
    actions?: React.ReactNode[];
    actionProps?: {
        mfaEnabled: boolean;
        enableUserAccessTokens: boolean;
        experimentalEnableAuthenticationTransfer: boolean;
        doPasswordReset: (user: UserProfile) => void;
        doEmailReset: (user: UserProfile) => void;
        doManageTeams: (user: UserProfile) => void;
        doManageRoles: (user: UserProfile) => void;
        doManageTokens: (user: UserProfile) => void;
        isDisabled: boolean | undefined;
    };
    actionUserProps?: {
        [userId: string]: {
            channel?: Channel;
            teamMember: TeamMembership;
            channelMember?: ChannelMembership;
        };
    };
    focusOnMount?: boolean;
    renderCount?: (count: number, total: number, startCount: number, endCount: number, isSearch: boolean) => JSX.Element | null;
    filter?: string;
    renderFilterRow?: (handleFilter: ((event: React.FormEvent<HTMLInputElement>) => void) | undefined) => JSX.Element;
    page: number;
    term: string;
    onTermChange: (term: string) => void;
    intl: IntlShape;
    isDisabled?: boolean;

    // the type of user list row to render
    rowComponentType?: React.ComponentType<any>;
}

const renderView = (props: Record<string, unknown>): JSX.Element => (
    <div
        {...props}
        className='scrollbar--view'
    />
);

const renderThumbHorizontal = (): JSX.Element => (
    <div/>
);

const renderThumbVertical = (props: Record<string, unknown>): JSX.Element => (
    <div
        {...props}
        className='scrollbar--vertical'
    />
);

type State = {
    nextDisabled: boolean;
};

class SearchableUserList extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        users: [],
        usersPerPage: 50,
        extraInfo: {},
        actions: [],
        actionProps: {
            mfaEnabled: false,
            enableUserAccessTokens: false,
            experimentalEnableAuthenticationTransfer: false,
            doPasswordReset() {},
            doEmailReset() {},
            doManageTeams() {},
            doManageRoles() {},
            doManageTokens() {},
            isDisabled: false,
        },
        actionUserProps: {},
        focusOnMount: false,
    };

    private nextTimeoutId: NodeJS.Timeout;
    private scrollbarsRef: React.RefObject<Scrollbars>;
    private filterRef: React.RefObject<HTMLInputElement>;

    constructor(props: Props) {
        super(props);

        this.nextTimeoutId = {} as NodeJS.Timeout;

        this.state = {
            nextDisabled: false,
        };

        this.scrollbarsRef = React.createRef();
        this.filterRef = React.createRef();
    }

    public scrollToTop = (): void => {
        this.scrollbarsRef.current?.scrollToTop();
    };

    componentDidMount() {
        this.focusSearchBar();
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.page !== prevProps.page || this.props.term !== prevProps.term) {
            this.scrollToTop();
        }
    }

    componentWillUnmount() {
        clearTimeout(this.nextTimeoutId);
    }

    nextPage = (e: React.MouseEvent) => {
        e.preventDefault();

        this.setState({nextDisabled: true});
        this.nextTimeoutId = setTimeout(() => this.setState({nextDisabled: false}), NEXT_BUTTON_TIMEOUT);

        this.props.nextPage();
        this.scrollToTop();
    };

    previousPage = (e: React.MouseEvent) => {
        e.preventDefault();

        this.props.previousPage();
        this.scrollToTop();
    };

    focusSearchBar = () => {
        if (this.props.focusOnMount && this.filterRef.current) {
            this.filterRef.current.focus();
        }
    };

    handleInput = (e: React.FormEvent<HTMLInputElement> | undefined) => {
        if (e) {
            this.props.onTermChange(e.currentTarget.value);
            this.props.search(e.currentTarget.value);
        }
    };

    renderCount = (users: UserProfile[] | null | undefined) => {
        if (!users || !this.props.users) {
            return null;
        }

        if (this.props.filter) {
            return null;
        }

        const count = users.length;
        const total = this.props.total;
        const isSearch = Boolean(this.props.term);

        let startCount;
        let endCount;
        if (isSearch) {
            startCount = -1;
            endCount = -1;
        } else {
            startCount = this.props.page * this.props.usersPerPage;
            endCount = Math.min(startCount + this.props.usersPerPage, total);
            if (this.props.users.length < endCount) {
                endCount = this.props.users.length;
            }
        }

        if (this.props.renderCount) {
            return this.props.renderCount(count, this.props.total, startCount, endCount, isSearch);
        }

        if (this.props.total) {
            if (isSearch) {
                return (
                    <FormattedMessage
                        id='filtered_user_list.countTotal'
                        defaultMessage='{count, number} {count, plural, one {member} other {members}} of {total, number} total'
                        values={{
                            count,
                            total,
                        }}
                    />
                );
            }

            return (
                <FormattedMessage
                    id='filtered_user_list.countTotalPage'
                    defaultMessage='{startCount, number} - {endCount, number} {count, plural, one {member} other {members}} of {total, number} total'
                    values={{
                        count,
                        startCount: startCount + 1,
                        endCount,
                        total,
                    }}
                />
            );
        }

        return null;
    };

    render() {
        let nextButton;
        let previousButton;
        let usersToDisplay;
        const {formatMessage} = this.props.intl;

        if (this.props.term || !this.props.users) {
            usersToDisplay = this.props.users;
        } else if (!this.props.term) {
            const pageStart = this.props.page * this.props.usersPerPage;
            let pageEnd = pageStart + this.props.usersPerPage;
            if (this.props.users.length < pageEnd) {
                pageEnd = this.props.users.length;
            }

            usersToDisplay = this.props.users.slice(pageStart, pageEnd);

            if (pageEnd < this.props.total) {
                nextButton = (
                    <button
                        id='searchableUserListNextBtn'
                        className='btn btn-link filter-control filter-control__next'
                        onClick={this.nextPage}
                        disabled={this.state.nextDisabled}
                    >
                        <FormattedMessage
                            id='filtered_user_list.next'
                            defaultMessage='Next'
                        />
                    </button>
                );
            }

            if (this.props.page > 0) {
                previousButton = (
                    <button
                        id='searchableUserListPrevBtn'
                        className='btn btn-link filter-control filter-control__prev'
                        onClick={this.previousPage}
                    >
                        <FormattedMessage
                            id='filtered_user_list.prev'
                            defaultMessage='Previous'
                        />
                    </button>
                );
            }
        }

        let filterRow;
        if (this.props.renderFilterRow) {
            filterRow = this.props.renderFilterRow(this.handleInput);
        } else {
            const searchUsersPlaceholder = {id: t('filtered_user_list.search'), defaultMessage: 'Search users'};
            filterRow = (
                <div className='col-xs-12'>
                    <label
                        className='hidden-label'
                        htmlFor='searchUsersInput'
                    >
                        <FormattedMessage
                            id='filtered_user_list.search'
                            defaultMessage='Search users'
                        />
                    </label>
                    <QuickInput
                        id='searchUsersInput'
                        ref={this.filterRef}
                        className='form-control filter-textbox'
                        placeholder={searchUsersPlaceholder}
                        inputComponent={LocalizedInput}
                        value={this.props.term}
                        onInput={this.handleInput}
                        aria-label={formatMessage(searchUsersPlaceholder).toLowerCase()}
                    />
                </div>
            );
        }

        return (
            <div className='filtered-user-list'>
                <div className='filter-row'>
                    {filterRow}
                    <div className='col-sm-12'>
                        <span
                            id='searchableUserListTotal'
                            className='member-count pull-left'
                            aria-live='polite'
                        >
                            {this.renderCount(usersToDisplay)}
                        </span>
                    </div>
                </div>
                <div className='more-modal__list'>
                    <Scrollbars
                        ref={this.scrollbarsRef}
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                        renderThumbHorizontal={renderThumbHorizontal}
                        renderThumbVertical={renderThumbVertical}
                        renderView={renderView}
                    >
                        <UserList
                            users={usersToDisplay}
                            extraInfo={this.props.extraInfo}
                            actions={this.props.actions}
                            actionProps={this.props.actionProps}
                            actionUserProps={this.props.actionUserProps}
                            rowComponentType={this.props.rowComponentType}
                            isDisabled={this.props.isDisabled}
                        />
                    </Scrollbars>
                </div>
                <div className='filter-controls'>
                    {previousButton}
                    {nextButton}
                </div>
            </div>
        );
    }
}

export default injectIntl(SearchableUserList);
