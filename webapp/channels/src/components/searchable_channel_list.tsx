// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ArchiveOutlineIcon, CheckIcon, ChevronDownIcon, GlobeIcon, LockOutlineIcon, MagnifyIcon, AccountOutlineIcon, GlobeCheckedIcon} from '@mattermost/compass-icons/components';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {RelationOneToOne} from '@mattermost/types/utilities';
import {isPrivateChannel} from 'mattermost-redux/utils/channel_utils';

import classNames from 'classnames';

import LoadingScreen from 'components/loading_screen';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';
import QuickInput from 'components/quick_input';
import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';
import LocalizedInput from 'components/localized_input/localized_input';
import MagnifyingGlassSVG from 'components/common/svg_images_components/magnifying_glass_svg';
import * as Menu from 'components/menu';

import * as UserAgent from 'utils/user_agent';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {localizeMessage, localizeAndFormatMessage} from 'utils/utils';
import {isArchivedChannel} from 'utils/channel_utils';

import {t} from 'utils/i18n';
import {isKeyPressed} from 'utils/keyboard';
import {Filter, FilterType} from './browse_channels/browse_channels';

const NEXT_BUTTON_TIMEOUT_MILLISECONDS = 500;

type Props = {
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
    canShowArchivedChannels?: boolean;
    loading?: boolean;
    channelsMemberCount?: Record<string, number>;
}

type State = {
    joiningChannel: string;
    page: number;
    nextDisabled: boolean;
    channelSearchValue: string;
    isSearch?: boolean;
}

export default class SearchableChannelList extends React.PureComponent<Props, State> {
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

    isMemberOfChannel(channelId: string) {
        return this.props.myChannelMemberships[channelId];
    }

    createChannelRow = (channel: Channel) => {
        const ariaLabel = `${channel.display_name}, ${channel.purpose}`.toLowerCase();
        let channelTypeIcon;

        if (isArchivedChannel(channel)) {
            channelTypeIcon = <ArchiveOutlineIcon size={18}/>;
        } else if (isPrivateChannel(channel)) {
            channelTypeIcon = <LockOutlineIcon size={18}/>;
        } else {
            channelTypeIcon = <GlobeIcon size={18}/>;
        }
        let memberCount = 0;
        if (this.props.channelsMemberCount?.[channel.id]) {
            memberCount = this.props.channelsMemberCount[channel.id];
        }

        const membershipIndicator = this.isMemberOfChannel(channel.id) ? (
            <div
                id='membershipIndicatorContainer'
                aria-label={localizeMessage('more_channels.membership_indicator', 'Membership Indicator: Joined')}
            >
                <CheckIcon size={14}/>
                <FormattedMessage
                    id={'more_channels.joined'}
                    defaultMessage={'Joined'}
                />
            </div>
        ) : null;

        const channelPurposeContainerAriaLabel = localizeAndFormatMessage(
            t('more_channels.channel_purpose'),
            'Channel Information: Membership Indicator: Joined, Member count {memberCount}, Purpose: {channelPurpose}',
            {memberCount, channelPurpose: channel.purpose || ''},
        );

        const channelPurposeContainer = (
            <div
                id='channelPurposeContainer'
                aria-label={channelPurposeContainerAriaLabel}
            >
                {membershipIndicator}
                {membershipIndicator ? <span className='dot'/> : null}
                <AccountOutlineIcon size={14}/>
                <span data-testid={`channelMemberCount-${channel.name}`} >{memberCount}</span>
                {channel.purpose.length > 0 ? <span className='dot'/> : null}
                <span className='more-modal__description'>{channel.purpose}</span>
            </div>
        );

        const joinViewChannelButtonClass = classNames('btn', {
            outlineButton: this.isMemberOfChannel(channel.id),
            primaryButton: !this.isMemberOfChannel(channel.id),
        });

        const joinViewChannelButton = (
            <button
                id='joinViewChannelButton'
                onClick={(e) => this.handleJoin(channel, e)}
                className={joinViewChannelButtonClass}
                disabled={Boolean(this.state.joiningChannel)}
                tabIndex={-1}
                aria-label={this.isMemberOfChannel(channel.id) ? localizeMessage('more_channels.view', 'View') : localizeMessage('joinChannel.JoinButton', 'Join')}
            >
                <LoadingWrapper
                    loading={this.state.joiningChannel === channel.id}
                    text={localizeMessage('joinChannel.joiningButton', 'Joining...')}
                >
                    <FormattedMessage
                        id={this.isMemberOfChannel(channel.id) ? 'more_channels.view' : 'joinChannel.JoinButton'}
                        defaultMessage={this.isMemberOfChannel(channel.id) ? 'View' : 'Join'}
                    />
                </LoadingWrapper>
            </button>
        );

        return (
            <div
                className='more-modal__row'
                key={channel.id}
                id={`ChannelRow-${channel.name}`}
                data-testid={`ChannelRow-${channel.name}`}
                aria-label={ariaLabel}
                onClick={(e) => this.handleJoin(channel, e)}
                tabIndex={0}
            >
                <div className='more-modal__details'>
                    <div className='style--none more-modal__name'>
                        {channelTypeIcon}
                        <span id='channelName'>{channel.display_name}</span>
                    </div>
                    {channelPurposeContainer}
                </div>
                <div className='more-modal__actions'>
                    {joinViewChannelButton}
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
                    defaultMessage='No results for {text}'
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
            return <span>{localizeMessage('more_channels.show_archived_channels', 'Channel Type: Archived')}</span>;
        case Filter.Public:
            return <span>{localizeMessage('more_channels.show_public_channels', 'Channel Type: Public')}</span>;
        case Filter.Private:
            return <span>{localizeMessage('more_channels.show_private_channels', 'Channel Type: Private')}</span>;
        default:
            return <span>{localizeMessage('more_channels.show_all_channels', 'Channel Type: All')}</span>;
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
                    aria-label={this.state.channelSearchValue.length > 0 ?
                        localizeAndFormatMessage(t('more_channels.noMore'), 'No results for {text}', {text: this.state.channelSearchValue}) :
                        localizeMessage('widgets.channels_input.empty', 'No channels found')
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
                    <button
                        className='btn filter-control filter-control__next outlineButton'
                        onClick={this.nextPage}
                        disabled={this.state.nextDisabled}
                        aria-label={localizeMessage('more_channels.next', 'Next')}
                    >
                        <FormattedMessage
                            id='more_channels.next'
                            defaultMessage='Next'
                        />
                    </button>
                );
            }

            if (this.state.page > 0) {
                previousButton = (
                    <button
                        className='btn filter-control filter-control__prev outlineButton'
                        onClick={this.previousPage}
                        aria-label={localizeMessage('more_channels.prev', 'Previous')}
                    >
                        <FormattedMessage
                            id='more_channels.prev'
                            defaultMessage='Previous'
                        />
                    </button>
                );
            }
        }

        const input = (
            <div className='filter-row filter-row--full'>
                <span
                    id='searchIcon'
                    aria-hidden='true'
                >
                    <MagnifyIcon size={18}/>
                </span>
                <QuickInput
                    id='searchChannelsTextbox'
                    ref={this.filter}
                    className='form-control filter-textbox'
                    placeholder={{id: t('filtered_channels_list.search'), defaultMessage: 'Search channels'}}
                    inputComponent={LocalizedInput}
                    onInput={this.handleChange}
                    clearable={true}
                    onClear={this.handleClear}
                    value={this.state.channelSearchValue}
                    aria-label={localizeMessage('filtered_channels_list.search', 'Search Channels')}
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
                onClick={() => this.props.changeFilter(Filter.All)}
                leadingElement={<GlobeCheckedIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.all'
                        defaultMessage='All channel types'
                    />
                }
                trailingElements={this.props.filter === Filter.All ? checkIcon : null}
                aria-label={localizeMessage('suggestion.all', 'All channel types')}
            />,
            <Menu.Item
                key='channelsMoreDropdownPublic'
                id='channelsMoreDropdownPublic'
                onClick={() => this.props.changeFilter(Filter.Public)}
                leadingElement={<GlobeIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.public'
                        defaultMessage='Public channels'
                    />
                }
                trailingElements={this.props.filter === Filter.Public ? checkIcon : null}
                aria-label={localizeMessage('suggestion.public', 'Public channels')}
            />,
            <Menu.Item
                key='channelsMoreDropdownPrivate'
                id='channelsMoreDropdownPrivate'
                onClick={() => this.props.changeFilter(Filter.Private)}
                leadingElement={<LockOutlineIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='suggestion.private'
                        defaultMessage='Private channels'
                    />
                }
                trailingElements={this.props.filter === Filter.Private ? checkIcon : null}
                aria-label={localizeMessage('suggestion.private', 'Private channels')}
            />,
        ];

        if (this.props.canShowArchivedChannels) {
            channelDropdownItems.push(
                <Menu.Item
                    id='channelsMoreDropdownArchived'
                    onClick={() => this.props.changeFilter(Filter.Archived)}
                    leadingElement={<ArchiveOutlineIcon size={16}/>}
                    labels={
                        <FormattedMessage
                            id='suggestion.archive'
                            defaultMessage='Archived channels'
                        />
                    }
                    trailingElements={this.props.filter === Filter.Archived ? checkIcon : null}
                    aria-label={localizeMessage('suggestion.archive', 'Archived channels')}
                />,
            );
        }
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
            <Menu.Container
                menuButton={{
                    id: 'menuWrapper',
                    children: menuButton,
                }}
                menu={{
                    id: 'browseChannelsDropdown',
                    'aria-label': localizeMessage('more_channels.title', 'Browse channels'),
                }}
            >
                {channelDropdownItems.map((item) => item)}
            </Menu.Container >
        );

        const hideJoinedButtonClass = classNames('get-app__checkbox', {checked: this.props.rememberHideJoinedChannelsChecked});
        const hideJoinedPreferenceCheckbox = (
            <div
                id={'hideJoinedPreferenceCheckbox'}
                onClick={this.handleChecked}
            >
                <button
                    className={hideJoinedButtonClass}
                    aria-label={this.props.rememberHideJoinedChannelsChecked ? localizeMessage('more_channels.hide_joined_checked', 'Hide joined channels checkbox, checked') : localizeMessage('more_channels.hide_joined_not_checked', 'Hide joined channels checkbox, not checked')}
                >
                    {this.props.rememberHideJoinedChannelsChecked ? <CheckboxCheckedIcon/> : null}
                </button>
                <FormattedMessage
                    id='more_channels.hide_joined'
                    defaultMessage='Hide Joined'
                />
            </div>
        );

        let channelCountLabel;
        if (channels.length === 0) {
            channelCountLabel = localizeMessage('more_channels.count_zero', '0 Results');
        } else if (channels.length === 1) {
            channelCountLabel = localizeMessage('more_channels.count_one', '1 Result');
        } else if (channels.length > 1) {
            channelCountLabel = localizeAndFormatMessage(t('more_channels.count'), '0 Results', {count: channels.length});
        } else {
            channelCountLabel = localizeMessage('more_channels.count_zero', '0 Results');
        }

        const dropDownContainer = (
            <div className='more-modal__dropdown'>
                <span id='channelCountLabel'>{channelCountLabel}</span>
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
                    role='application'
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
