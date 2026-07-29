// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, defineMessages, injectIntl, type WrappedComponentProps} from 'react-intl';

import {ArchiveOutlineIcon, CheckIcon, ChevronDownIcon, GlobeIcon, LockOutlineIcon, AccountOutlineIcon, GlobeCheckedIcon, AccountPlusOutlineIcon, ClockOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import * as UserAgent from '@mattermost/shared/utils/user_agent';
import type {Channel, ChannelJoinRequest, ChannelMembership} from '@mattermost/types/channels';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {ChannelIcon} from 'components/channel_type_icon';
import MagnifyingGlassSVG from 'components/common/svg_images_components/magnifying_glass_svg';
import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';
import QuickInput from 'components/quick_input';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {FilterType} from './browse_channels/browse_channels';
import {Filter} from './browse_channels/browse_channels';

const NEXT_BUTTON_TIMEOUT_MILLISECONDS = 500;

interface Props extends WrappedComponentProps {
    channels: Channel[];
    channelsPerPage: number;
    nextPage: (page: number) => void;
    isSearch: boolean;
    search: (term: string) => void;
    handleJoin: (channel: Channel, done: () => void) => void;
    noResultsText: JSX.Element;
    changeFilter: (filter: FilterType) => void;
    filter: FilterType;
    myChannelMemberships: RelationOneToOne<Channel, ChannelMembership>;
    closeModal: (modalId: string) => void;
    hideJoinedChannelsPreference: (shouldHideJoinedChannels: boolean) => void;
    rememberHideJoinedChannelsChecked: boolean;
    loading?: boolean;
    channelsMemberCount?: Record<string, number>;
    showRecommendedFilter?: boolean;

    // Discoverable Private Channels: when the FF is on, the parent passes
    // these so each row can render the right state machine without per-row
    // API calls. The two callbacks are no-ops on the parent if the FF is
    // off (children never render the affordance in that case).
    showDiscoverableFilters?: boolean;
    myPendingJoinRequests?: Record<string, ChannelJoinRequest>;
    handleRequestToJoin?: (channel: Channel, done: () => void) => void;
    handleWithdrawRequest?: (channel: Channel, done: () => void) => void;
}

type State = {
    joiningChannel: string;
    requestingChannel: string;
    withdrawingChannel: string;
    page: number;
    nextDisabled: boolean;
    channelSearchValue: string;
    isSearch?: boolean;
};

export class SearchableChannelList extends React.PureComponent<Props, State> {
    private nextTimeoutId: number | NodeJS.Timeout;
    private filter: React.RefObject<HTMLInputElement>;
    private channelListScroll: React.RefObject<HTMLDivElement>;

    static getDerivedStateFromProps(props: Props, state: State) {
        return {isSearch: props.isSearch, page: props.isSearch && !state.isSearch ? 0 : state.page};
    }

    constructor(props: Props) {
        super(props);

        this.nextTimeoutId = 0;

        this.state = {
            joiningChannel: '',
            requestingChannel: '',
            withdrawingChannel: '',
            page: 0,
            nextDisabled: false,
            channelSearchValue: '',
        };

        this.filter = React.createRef();
        this.channelListScroll = React.createRef();
    }

    componentDidMount() {
        // only focus the search box on desktop so that we don't cause the keyboard to open on mobile
        if (!UserAgent.isMobile() && this.filter.current) {
            this.filter.current.focus();
        }
        document.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);
    }

    onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isEnterKeyPressed = isKeyPressed(e, Constants.KeyCodes.ENTER);
        if (isEnterKeyPressed && (e.shiftKey || e.ctrlKey || e.altKey)) {
            return;
        }
        if (isEnterKeyPressed && target?.classList.contains('more-modal__row')) {
            target.click();
        }
    };

    handleJoin = (channel: Channel, e: React.MouseEvent) => {
        e.stopPropagation();
        this.setState({joiningChannel: channel.id});
        this.props.handleJoin(
            channel,
            () => {
                this.setState({joiningChannel: ''});
            },
        );
        if (this.isMemberOfChannel(channel.id)) {
            this.props.closeModal(ModalIdentifiers.MORE_CHANNELS);
        }
    };

    handleRequestToJoin = (channel: Channel, e: React.MouseEvent) => {
        e.stopPropagation();

        // Ignore re-entry (row click while a request is already in flight) so
        // clicking the row doesn't bypass the disabled button.
        if (!this.props.handleRequestToJoin || this.state.requestingChannel) {
            return;
        }
        this.setState({requestingChannel: channel.id});
        this.props.handleRequestToJoin(channel, () => {
            this.setState({requestingChannel: ''});
        });
    };

    handleWithdrawRequest = (channel: Channel, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!this.props.handleWithdrawRequest || this.state.withdrawingChannel) {
            return;
        }
        this.setState({withdrawingChannel: channel.id});
        this.props.handleWithdrawRequest(channel, () => {
            this.setState({withdrawingChannel: ''});
        });
    };

    isMemberOfChannel(channelId: string) {
        return this.props.myChannelMemberships[channelId];
    }

    // A channel is in the discoverable "Request to Join" surface when the FF
    // is on, the channel is private + discoverable, and the user is not a
    // member. The combined check folds the FF gate into one place so the
    // row rendering code stays linear.
    private isDiscoverableNonMember(channel: Channel) {
        return Boolean(this.props.showDiscoverableFilters) &&
            channel.type === Constants.PRIVATE_CHANNEL &&
            channel.discoverable === true &&
            !this.isMemberOfChannel(channel.id);
    }

    private getPendingRequest(channelId: string): ChannelJoinRequest | undefined {
        return this.props.myPendingJoinRequests?.[channelId];
    }

    createChannelRow = (channel: Channel) => {
        const channelTypeIcon = (
            <ChannelIcon
                channel={channel}
                size={18}
            />);
        let memberCount = 0;
        if (this.props.channelsMemberCount?.[channel.id]) {
            memberCount = this.props.channelsMemberCount[channel.id];
        }

        const membershipIndicator = this.isMemberOfChannel(channel.id) ? (
            <div
                id='membershipIndicatorContainer'
                aria-label={this.props.intl.formatMessage({id: 'more_channels.membership_indicator', defaultMessage: 'Membership Indicator: Joined'})}
            >
                <CheckIcon size={14}/>
                <FormattedMessage
                    id={'more_channels.joined'}
                    defaultMessage={'Joined'}
                />
            </div>
        ) : null;

        const isMember = Boolean(this.isMemberOfChannel(channel.id));
        const isDiscoverable = this.isDiscoverableNonMember(channel);

        // A non-member with an open request always gets the Withdraw affordance,
        // even if the channel's discoverable flag was flipped off after the
        // request was submitted — otherwise the row would fall through to a
        // Join button that the server rejects for a private channel.
        const pendingRequest = isMember ? undefined : this.getPendingRequest(channel.id);

        const ariaLabel = pendingRequest ?
            this.props.intl.formatMessage(
                {
                    id: 'more_channels.requested.aria',
                    defaultMessage: '{channelName}, join request pending',
                },
                {channelName: channel.display_name},
            ) :
            `${channel.display_name}, ${channel.purpose}`.toLowerCase();

        const discoverableIndicator = isDiscoverable ? (
            <div
                className='discoverableIndicatorContainer'
                data-testid='discoverable-indicator'
                aria-label={this.props.intl.formatMessage({id: 'more_channels.discoverable.aria', defaultMessage: 'Discoverable private channel'})}
            >
                <AccountPlusOutlineIcon size={14}/>
                <FormattedMessage
                    id='more_channels.discoverable'
                    defaultMessage='Discoverable'
                />
            </div>
        ) : null;

        const channelPurposeContainerAriaLabel = this.props.intl.formatMessage(
            messages.channelPurpose,
            {memberCount, channelPurpose: channel.purpose || ''},
        );

        const channelPurposeContainer = (
            <div
                id='channelPurposeContainer'
                aria-label={channelPurposeContainerAriaLabel}
            >
                {membershipIndicator}
                {membershipIndicator ? <span className='dot'/> : null}
                {discoverableIndicator}
                {discoverableIndicator ? <span className='dot'/> : null}
                <AccountOutlineIcon size={14}/>
                <span data-testid={`channelMemberCount-${channel.name}`} >{memberCount}</span>
                {channel.purpose.length > 0 ? <span className='dot'/> : null}
                <span className='more-modal__description'>{channel.purpose}</span>
            </div>
        );

        // Row state machine for the action area, in declarative order:
        //
        //   isMember               -> View (existing behavior; click row = navigate)
        //   discoverable + pending -> "Withdraw" on row hover (withdraws request)
        //   discoverable           -> "Request to Join" (calls handleRequestToJoin)
        //   default                -> Join (existing public-channel behavior)
        //
        const renderJoinOrViewButton = () => {
            const joinViewChannelButtonEmphasis = isMember ? 'secondary' : 'primary';
            const joinViewChannelButtonClass = isMember ? 'outlineButton' : 'primaryButton';
            return (
                <Button
                    id='joinViewChannelButton'
                    onClick={(e) => this.handleJoin(channel, e)}
                    emphasis={joinViewChannelButtonEmphasis}
                    size='sm'
                    className={joinViewChannelButtonClass}
                    disabled={Boolean(this.state.joiningChannel)}
                    tabIndex={-1}
                    aria-label={isMember ? this.props.intl.formatMessage({id: 'more_channels.view', defaultMessage: 'View'}) : this.props.intl.formatMessage({id: 'joinChannel.JoinButton', defaultMessage: 'Join'})}
                >
                    <LoadingWrapper
                        loading={this.state.joiningChannel === channel.id}
                        text={messages.joiningButton}
                    >
                        <FormattedMessage
                            id={isMember ? 'more_channels.view' : 'joinChannel.JoinButton'}
                            defaultMessage={isMember ? 'View' : 'Join'}
                        />
                    </LoadingWrapper>
                </Button>
            );
        };

        const renderRequestToJoinButton = () => (
            <Button
                id='requestToJoinChannelButton'
                onClick={(e) => this.handleRequestToJoin(channel, e)}
                emphasis='primary'
                size='sm'
                className='primaryButton'
                disabled={Boolean(this.state.requestingChannel)}
                tabIndex={-1}
                aria-label={this.props.intl.formatMessage({id: 'more_channels.requestToJoin', defaultMessage: 'Request to join'})}
            >
                <LoadingWrapper
                    loading={this.state.requestingChannel === channel.id}
                    text={messages.requesting}
                >
                    <FormattedMessage
                        id='more_channels.requestToJoin'
                        defaultMessage='Request to join'
                    />
                </LoadingWrapper>
            </Button>
        );

        const renderWithdrawButton = () => (
            <Button
                id='withdrawRequestButton'
                onClick={(e) => this.handleWithdrawRequest(channel, e)}
                emphasis='tertiary'
                size='sm'
                disabled={Boolean(this.state.withdrawingChannel)}
                aria-label={this.props.intl.formatMessage({id: 'more_channels.withdrawRequest', defaultMessage: 'Withdraw request'})}
            >
                <LoadingWrapper
                    loading={this.state.withdrawingChannel === channel.id}
                    text={messages.withdrawing}
                >
                    <FormattedMessage
                        id='more_channels.withdraw'
                        defaultMessage='Withdraw'
                    />
                </LoadingWrapper>
            </Button>
        );

        let actionElement: React.ReactNode;
        if (isMember) {
            actionElement = renderJoinOrViewButton();
        } else if (pendingRequest) {
            actionElement = renderWithdrawButton();
        } else if (isDiscoverable) {
            actionElement = renderRequestToJoinButton();
        } else {
            actionElement = renderJoinOrViewButton();
        }

        const sharedChannelIcon = channel.shared ? (
            <SharedChannelIndicator
                className='shared-channel-icon'
                withTooltip={true}
            />
        ) : null;

        // Row click behavior:
        // - Members: navigate (existing).
        // - Discoverable with pending request: no-op on row click; Withdraw
        //   on hover is the only affordance to avoid accidental withdraw.
        // - Discoverable without pending: open Request to Join.
        // - Otherwise: handleJoin (existing public-channel path).
        const handleRowClick = (e: React.MouseEvent) => {
            if (isMember) {
                this.handleJoin(channel, e);
                return;
            }
            if (pendingRequest) {
                e.stopPropagation();
                return;
            }
            if (isDiscoverable) {
                this.handleRequestToJoin(channel, e);
                return;
            }
            this.handleJoin(channel, e);
        };

        return (
            <div
                className='more-modal__row'
                key={channel.id}
                id={`ChannelRow-${channel.name}`}
                data-testid={`ChannelRow-${channel.name}`}
                aria-label={ariaLabel}
                onClick={handleRowClick}
                tabIndex={0}
            >
                <div className='more-modal__details'>
                    <div className='style--none more-modal__name'>
                        {channelTypeIcon}
                        <span id='channelName'>{channel.display_name}</span>
                        {sharedChannelIcon}
                    </div>
                    {channelPurposeContainer}
                </div>
                <div className='more-modal__actions'>
                    {actionElement}
                    {this.state.joiningChannel === channel.id && !isMember && (
                        <span
                            className='sr-only'
                            role='alert'
                        >
                            <FormattedMessage
                                id='more_channels.joinedChannel'
                                defaultMessage='Joined channel {channelName}'
                                values={{
                                    channelName: channel.display_name,
                                }}
                            />
                        </span>
                    )}
                </div>
            </div>
        );
    };

    nextPage = (e: React.MouseEvent) => {
        e.preventDefault();
        this.setState({page: this.state.page + 1, nextDisabled: true});
        this.nextTimeoutId = setTimeout(() => this.setState({nextDisabled: false}), NEXT_BUTTON_TIMEOUT_MILLISECONDS);
        this.props.nextPage(this.state.page + 1);
        this.channelListScroll.current?.scrollTo({top: 0});
    };

    previousPage = (e: React.MouseEvent) => {
        e.preventDefault();
        this.setState({page: this.state.page - 1});
        this.channelListScroll.current?.scrollTo({top: 0});
    };

    doSearch = () => {
        this.props.search(this.state.channelSearchValue);
        if (this.state.channelSearchValue === '') {
            this.setState({page: 0});
        }
    };
    filterChange = (filterType: FilterType) => {
        this.props.changeFilter(filterType);
        if (this.props.filter !== filterType) {
            this.setState({page: 0});
        }
    };
    handleChange = (e?: React.FormEvent<HTMLInputElement>) => {
        if (e?.currentTarget) {
            this.setState({channelSearchValue: e?.currentTarget.value}, () => this.doSearch());
        }
    };
    handleClear = () => {
        this.setState({channelSearchValue: ''}, () => this.doSearch());
    };
    handleChecked = () => {
        // If it was checked, and now we're unchecking it, clear the preference
        if (this.props.rememberHideJoinedChannelsChecked) {
            this.props.hideJoinedChannelsPreference(false);
        } else {
            this.props.hideJoinedChannelsPreference(true);
        }
    };
    getEmptyStateMessage = () => {
        if (this.state.channelSearchValue.length > 0) {
            return (
                <FormattedMessage
                    id='more_channels.noMore'
                    tagName='strong'
                    defaultMessage='No results for "{text}"'
                    values={{text: this.state.channelSearchValue}}
                />
            );
        }
        switch (this.props.filter) {
        case Filter.Archived:
            return (
                <FormattedMessage
                    id={'more_channels.noArchived'}
                    tagName='strong'
                    defaultMessage={'No archived channels'}
                />
            );
        case Filter.Private:
            return (
                <FormattedMessage
                    id={'more_channels.noPrivate'}
                    tagName='strong'
                    defaultMessage={'No private channels'}
                />
            );
        case Filter.Public:
            return (
                <FormattedMessage
                    id={'more_channels.noPublic'}
                    tagName='strong'
                    defaultMessage={'No public channels'}
                />
            );
        case Filter.Recommended:
            return (
                <FormattedMessage
                    id={'more_channels.noRecommended'}
                    tagName='strong'
                    defaultMessage={'No recommended channels'}
                />
            );
        case Filter.Discoverable:
            return (
                <FormattedMessage
                    id={'more_channels.noDiscoverable'}
                    tagName='strong'
                    defaultMessage={'No discoverable private channels'}
                />
            );
        case Filter.MyPendingRequests:
            return (
                <FormattedMessage
                    id={'more_channels.noPendingRequests'}
                    tagName='strong'
                    defaultMessage={'You have no pending join requests'}
                />
            );
        default:
            return (
                <FormattedMessage
                    id={'more_channels.noChannels'}
                    tagName='strong'
                    defaultMessage={'No channels'}
                />
            );
        }
    };
    getFilterLabel = () => {
        switch (this.props.filter) {
        case Filter.Archived:
            return (
                <FormattedMessage
                    id='more_channels.show_archived_channels'
                    defaultMessage='Channel Type: Archived'
                />
            );
        case Filter.Public:
            return (
                <FormattedMessage
                    id='more_channels.show_public_channels'
                    defaultMessage='Channel Type: Public'
                />
            );
        case Filter.Private:
            return (
                <FormattedMessage
                    id='more_channels.show_private_channels'
                    defaultMessage='Channel Type: Private'
                />
            );
        case Filter.Recommended:
            return (
                <FormattedMessage
                    id='more_channels.show_recommended_channels'
                    defaultMessage='Recommended channels'
                />
            );
        case Filter.Discoverable:
            return (
                <FormattedMessage
                    id='more_channels.show_discoverable_channels'
                    defaultMessage='Discoverable private channels'
                />
            );
        case Filter.MyPendingRequests:
            return (
                <FormattedMessage
                    id='more_channels.show_my_pending_requests'
                    defaultMessage='My pending requests'
                />
            );
        default:
            return (
                <FormattedMessage
                    id='more_channels.show_all_channels'
                    defaultMessage='Channel Type: All'
                />
            );
        }
    };

    render() {
        const channels = this.props.channels;
        let listContent;
        let nextButton;
        let previousButton;

        if (this.props.loading && channels.length === 0) {
            listContent = <LoadingScreen/>;
        } else if (channels.length === 0) {
            listContent = (
                <div
                    className='no-channel-message'
                    aria-label={this.state.channelSearchValue.length > 0 ? this.props.intl.formatMessage(messages.noMore, {text: this.state.channelSearchValue}) : this.props.intl.formatMessage({id: 'widgets.channels_input.empty', defaultMessage: 'No channels found'})
                    }
                >
                    <MagnifyingGlassSVG/>
                    <h3 className='primary-message'>
                        {this.getEmptyStateMessage()}
                    </h3>
                    {this.props.noResultsText}
                </div>
            );
        } else {
            const pageStart = this.state.page * this.props.channelsPerPage;
            const pageEnd = pageStart + this.props.channelsPerPage;
            const channelsToDisplay = this.props.channels.slice(pageStart, pageEnd);
            listContent = channelsToDisplay.map(this.createChannelRow);

            if (channelsToDisplay.length >= this.props.channelsPerPage && pageEnd < this.props.channels.length) {
                nextButton = (
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        className='filter-control filter-control__next'
                        onClick={this.nextPage}
                        disabled={this.state.nextDisabled}
                        aria-label={this.props.intl.formatMessage({id: 'more_channels.next', defaultMessage: 'Next'})}
                    >
                        <FormattedMessage
                            id='more_channels.next'
                            defaultMessage='Next'
                        />
                    </Button>
                );
            }

            if (this.state.page > 0) {
                previousButton = (
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        className='filter-control filter-control__prev'
                        onClick={this.previousPage}
                        aria-label={this.props.intl.formatMessage({id: 'more_channels.prev', defaultMessage: 'Previous'})}
                    >
                        <FormattedMessage
                            id='more_channels.prev'
                            defaultMessage='Previous'
                        />
                    </Button>
                );
            }
        }

        const input = (
            <div className='filter-row'>
                <span
                    id='searchIcon'
                    aria-hidden='true'
                >
                    <i className='icon icon-magnify'/>
                </span>
                <QuickInput
                    id='searchChannelsTextbox'
                    ref={this.filter}
                    className='form-control filter-textbox'
                    placeholder={this.props.intl.formatMessage({id: 'filtered_channels_list.search', defaultMessage: 'Search channels'})}
                    onInput={this.handleChange}
                    clearable={true}
                    onClear={this.handleClear}
                    value={this.state.channelSearchValue}
                    aria-label={this.props.intl.formatMessage({id: 'filtered_channels_list.search.label', defaultMessage: 'Search Channels'})}
                />
            </div>
        );

        const checkIcon = (
            <CheckIcon
                size={18}
                color={'var(--button-bg)'}
            />
        );
        const channelDropdownItems = [
            <Menu.Item
                key='channelsMoreDropdownAll'
                id='channelsMoreDropdownAll'
                onClick={() => this.filterChange(Filter.All)}
                leadingElement={<GlobeCheckedIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.all'
                        defaultMessage='All channel types'
                    />
                }
                trailingElements={this.props.filter === Filter.All ? checkIcon : null}
                aria-label={this.props.intl.formatMessage({id: 'suggestion.all', defaultMessage: 'All channel types'})}
            />,
            <Menu.Item
                key='channelsMoreDropdownPublic'
                id='channelsMoreDropdownPublic'
                onClick={() => this.filterChange(Filter.Public)}
                leadingElement={<GlobeIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.public'
                        defaultMessage='Public channels'
                    />
                }
                trailingElements={this.props.filter === Filter.Public ? checkIcon : null}
                aria-label={this.props.intl.formatMessage({id: 'suggestion.public', defaultMessage: 'Public channels'})}
            />,
            <Menu.Item
                key='channelsMoreDropdownPrivate'
                id='channelsMoreDropdownPrivate'
                onClick={() => this.filterChange(Filter.Private)}
                leadingElement={<LockOutlineIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.private'
                        defaultMessage='Private channels'
                    />
                }
                trailingElements={this.props.filter === Filter.Private ? checkIcon : null}
                aria-label={this.props.intl.formatMessage({id: 'suggestion.private', defaultMessage: 'Private channels'})}
            />,
        ];

        if (this.props.showRecommendedFilter) {
            channelDropdownItems.push(
                <Menu.Separator key='channelsMoreDropdownRecommendedSeparator'/>,
                <Menu.Item
                    key='channelsMoreDropdownRecommended'
                    id='channelsMoreDropdownRecommended'
                    onClick={() => this.filterChange(Filter.Recommended)}
                    leadingElement={<GlobeCheckedIcon size={16}/>}
                    labels={
                        <FormattedMessage
                            id='suggestion.recommended'
                            defaultMessage='Recommended channels'
                        />
                    }
                    trailingElements={this.props.filter === Filter.Recommended ? checkIcon : null}
                    aria-label={this.props.intl.formatMessage({id: 'suggestion.recommended', defaultMessage: 'Recommended channels'})}
                />,
            );
        }

        // Discoverable Private Channels filters. Only rendered when the FF
        // is on so non-enterprise / flag-off deployments don't see new menu
        // items they can't act on.
        if (this.props.showDiscoverableFilters) {
            channelDropdownItems.push(
                <Menu.Separator key='channelsMoreDropdownDiscoverableSeparator'/>,
                <Menu.Item
                    key='channelsMoreDropdownDiscoverable'
                    id='channelsMoreDropdownDiscoverable'
                    onClick={() => this.filterChange(Filter.Discoverable)}
                    leadingElement={<AccountPlusOutlineIcon size={16}/>}
                    labels={
                        <FormattedMessage
                            id='suggestion.discoverable'
                            defaultMessage='Discoverable private channels'
                        />
                    }
                    trailingElements={this.props.filter === Filter.Discoverable ? checkIcon : null}
                    aria-label={this.props.intl.formatMessage({id: 'suggestion.discoverable', defaultMessage: 'Discoverable private channels'})}
                />,
                <Menu.Item
                    key='channelsMoreDropdownMyPending'
                    id='channelsMoreDropdownMyPending'
                    onClick={() => this.filterChange(Filter.MyPendingRequests)}
                    leadingElement={<ClockOutlineIcon size={16}/>}
                    labels={
                        <FormattedMessage
                            id='suggestion.my_pending_requests'
                            defaultMessage='My pending requests'
                        />
                    }
                    trailingElements={this.props.filter === Filter.MyPendingRequests ? checkIcon : null}
                    aria-label={this.props.intl.formatMessage({id: 'suggestion.my_pending_requests', defaultMessage: 'My pending requests'})}
                />,
            );
        }

        channelDropdownItems.push(
            <Menu.Separator key='channelsMoreDropdownSeparator'/>,
            <Menu.Item
                key='channelsMoreDropdownArchived'
                id='channelsMoreDropdownArchived'
                onClick={() => this.filterChange(Filter.Archived)}
                leadingElement={<ArchiveOutlineIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.archive'
                        defaultMessage='Archived channels'
                    />
                }
                trailingElements={this.props.filter === Filter.Archived ? checkIcon : null}
                aria-label={this.props.intl.formatMessage({id: 'suggestion.archive', defaultMessage: 'Archived channels'})}
            />,
        );
        const menuButton = (
            <>
                {this.getFilterLabel()}
                <ChevronDownIcon
                    color={'rgba(var(--center-channel-color-rgb), 0.64)'}
                    size={16}
                />
            </>
        );
        const channelDropdown = (
            <>
                <div
                    role='status'
                    aria-atomic='true'
                    className='sr-only'
                >
                    {this.props.intl.formatMessage({
                        id: 'more_channels.channel_type_filter.filter_type_set',
                        defaultMessage: 'Channel type filter set to {filterType}',
                    }, {
                        filterType: this.props.filter,
                    })}
                </div>
                <Menu.Container
                    menuButton={{
                        id: 'menuWrapper',
                        children: menuButton,
                        'aria-label': this.props.intl.formatMessage({id: 'more_channels.channel_type_filter', defaultMessage: 'Channel type filter'}),
                    }}
                    menu={{
                        id: 'browseChannelsDropdown',
                        'aria-label': this.props.intl.formatMessage({id: 'more_channels.channel_type_filter', defaultMessage: 'Channel type filter'}),
                    }}
                >
                    {channelDropdownItems.map((item) => item)}
                </Menu.Container>
            </>
        );

        const hideJoinedButtonClass = classNames('get-app__checkbox', {checked: this.props.rememberHideJoinedChannelsChecked});
        const hideJoinedPreferenceCheckbox = (
            <div
                id={'hideJoinedPreferenceCheckbox'}
                onClick={this.handleChecked}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' || e.key === ' ') {
                        this.handleChecked();
                    }
                }}
                role='checkbox'
                aria-checked={this.props.rememberHideJoinedChannelsChecked}
                aria-label={this.props.intl.formatMessage({id: 'more_channels.hide_joined_channels', defaultMessage: 'Hide joined channels'})}
                tabIndex={0}
            >
                <div className={hideJoinedButtonClass}>
                    {this.props.rememberHideJoinedChannelsChecked ? <CheckboxCheckedIcon/> : null}
                </div>
                <FormattedMessage
                    id='more_channels.hide_joined'
                    defaultMessage='Hide Joined'
                />
            </div>
        );

        let channelCountLabel;
        if (channels.length === 0) {
            channelCountLabel = this.props.intl.formatMessage({id: 'more_channels.count_zero', defaultMessage: '0 Results'});
        } else if (channels.length === 1) {
            channelCountLabel = this.props.intl.formatMessage({id: 'more_channels.count_one', defaultMessage: '1 Result'});
        } else if (channels.length > 1) {
            channelCountLabel = this.props.intl.formatMessage(messages.channelCount, {count: channels.length});
        } else {
            channelCountLabel = this.props.intl.formatMessage({id: 'more_channels.count_zero', defaultMessage: '0 Results'});
        }

        const dropDownContainer = (
            <div className='more-modal__dropdown'>
                <span id='channelCountLabel'>{channelCountLabel}</span>
                <span
                    className='sr-only'
                    role='status'
                    aria-live='polite'
                >
                    {channelCountLabel}
                </span>
                <div id='modalPreferenceContainer'>
                    {channelDropdown}
                    {hideJoinedPreferenceCheckbox}
                </div>
            </div>
        );

        return (
            <div className='filtered-user-list'>
                {input}
                {dropDownContainer}
                <div
                    role='search'
                    className='more-modal__list'
                    tabIndex={-1}
                >
                    <div
                        id='moreChannelsList'
                        tabIndex={-1}
                        ref={this.channelListScroll}
                    >
                        {listContent}
                    </div>
                </div>
                <div className='filter-controls'>
                    {previousButton}
                    {nextButton}
                </div>
            </div>
        );
    }
}

const messages = defineMessages({
    channelCount: {
        id: 'more_channels.count',
        defaultMessage: '{count} Results',
    },
    channelPurpose: {
        id: 'more_channels.channel_purpose',
        defaultMessage: 'Channel Information: Membership Indicator: Joined, Member count {memberCount} , Purpose: {channelPurpose}',
    },
    joiningButton: {
        id: 'joinChannel.joiningButton',
        defaultMessage: 'Joining...',
    },
    requesting: {
        id: 'more_channels.requesting',
        defaultMessage: 'Requesting...',
    },
    withdrawing: {
        id: 'more_channels.withdrawing',
        defaultMessage: 'Withdrawing...',
    },
    noMore: {
        id: 'more_channels.noMore',
        defaultMessage: 'No results for "{text}"',
    },
});

export default injectIntl(SearchableChannelList);
