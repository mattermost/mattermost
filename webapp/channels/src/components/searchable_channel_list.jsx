// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ArchiveOutlineIcon} from '@mattermost/compass-icons/components';

import LoadingScreen from 'components/loading_screen';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';
import QuickInput from 'components/quick_input';
import * as UserAgent from 'utils/user_agent';
import {localizeMessage} from 'utils/utils';
import LocalizedInput from 'components/localized_input/localized_input';

import SharedChannelIndicator from 'components/shared_channel_indicator';

import {t} from 'utils/i18n';

import MenuWrapper from './widgets/menu/menu_wrapper';
import Menu from './widgets/menu/menu';

const NEXT_BUTTON_TIMEOUT_MILLISECONDS = 500;

export default class SearchableChannelList extends React.PureComponent {
    static getDerivedStateFromProps(props, state) {
        return {isSearch: props.isSearch, page: props.isSearch && !state.isSearch ? 0 : state.page};
    }

    constructor(props) {
        super(props);

        this.nextTimeoutId = 0;

        this.state = {
            joiningChannel: '',
            page: 0,
            nextDisabled: false,
        };

        this.filter = React.createRef();
        this.channelListScroll = React.createRef();
    }

    componentDidMount() {
        // only focus the search box on desktop so that we don't cause the keyboard to open on mobile
        if (!UserAgent.isMobile() && this.filter.current) {
            this.filter.current.focus();
        }
    }

    handleJoin(channel) {
        this.setState({joiningChannel: channel.id});
        this.props.handleJoin(
            channel,
            () => {
                this.setState({joiningChannel: ''});
            },
        );
    }

    createChannelRow = (channel) => {
        const ariaLabel = `${channel.display_name}, ${channel.purpose}`.toLowerCase();
        let archiveIcon;
        let sharedIcon;
        const {shouldShowArchivedChannels} = this.props;

        if (shouldShowArchivedChannels) {
            archiveIcon = (
                <ArchiveOutlineIcon
                    size={20}
                    color={'currentColor'}
                />
            );
        }

        if (channel.shared) {
            sharedIcon = (
                <SharedChannelIndicator
                    className='shared-channel-icon'
                    channelType={channel.type}
                    withTooltip={true}
                />
            );
        }

        return (
            <div
                className='more-modal__row'
                key={channel.id}
                id={`ChannelRow-${channel.name}`}
            >
                <div className='more-modal__details'>
                    <button
                        onClick={this.handleJoin.bind(this, channel)}
                        aria-label={ariaLabel}
                        className='style--none more-modal__name'
                    >
                        {archiveIcon}
                        {channel.display_name}
                        {sharedIcon}
                    </button>
                    <p className='more-modal__description'>{channel.purpose}</p>
                </div>
                <div className='more-modal__actions'>
                    <button
                        onClick={this.handleJoin.bind(this, channel)}
                        className='btn btn-primary'
                        disabled={this.state.joiningChannel}
                    >
                        <LoadingWrapper
                            loading={this.state.joiningChannel === channel.id}
                            text={localizeMessage('more_channels.joining', 'Joining...')}
                        >
                            <FormattedMessage
                                id={shouldShowArchivedChannels ? t('more_channels.view') : t('more_channels.join')}
                                defaultMessage={shouldShowArchivedChannels ? 'View' : 'Join'}
                            />
                        </LoadingWrapper>
                    </button>
                </div>
            </div>
        );
    }

    nextPage = (e) => {
        e.preventDefault();
        this.setState({page: this.state.page + 1, nextDisabled: true});
        this.nextTimeoutId = setTimeout(() => this.setState({nextDisabled: false}), NEXT_BUTTON_TIMEOUT_MILLISECONDS);
        this.props.nextPage(this.state.page + 1);
        this.channelListScroll.current?.scrollTo({top: 0});
    }

    previousPage = (e) => {
        e.preventDefault();
        this.setState({page: this.state.page - 1});
        this.channelListScroll.current?.scrollTo({top: 0});
    }

    doSearch = () => {
        const term = this.filter.current.value;
        this.props.search(term);
        if (term === '') {
            this.setState({page: 0});
        }
    }
    toggleArchivedChannelsOn = () => {
        this.props.toggleArchivedChannels(true);
    }
    toggleArchivedChannelsOff = () => {
        this.props.toggleArchivedChannels(false);
    }

    render() {
        const channels = this.props.channels;
        let listContent;
        let nextButton;
        let previousButton;

        if (this.props.loading && channels.length === 0) {
            listContent = <LoadingScreen/>;
        } else if (channels.length === 0) {
            listContent = (
                <div className='no-channel-message'>
                    <h3 className='primary-message'>
                        <FormattedMessage
                            id='more_channels.noMore'
                            tagName='strong'
                            defaultMessage='No more channels to join'
                        />
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
                        className='btn btn-link filter-control filter-control__next'
                        onClick={this.nextPage}
                        disabled={this.state.nextDisabled}
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
                        className='btn btn-link filter-control filter-control__prev'
                        onClick={this.previousPage}
                    >
                        <FormattedMessage
                            id='more_channels.prev'
                            defaultMessage='Previous'
                        />
                    </button>
                );
            }
        }

        let input = (
            <div className='filter-row filter-row--full'>
                <div className='col-sm-12'>
                    <QuickInput
                        id='searchChannelsTextbox'
                        ref={this.filter}
                        className='form-control filter-textbox'
                        placeholder={{id: t('filtered_channels_list.search'), defaultMessage: 'Search channels'}}
                        inputComponent={LocalizedInput}
                        onInput={this.doSearch}
                    />
                </div>
            </div>
        );

        if (this.props.createChannelButton) {
            input = (
                <div className='channel_search'>
                    <div className='search_input'>
                        <QuickInput
                            id='searchChannelsTextbox'
                            ref={this.filter}
                            className='form-control filter-textbox'
                            placeholder={{id: t('filtered_channels_list.search'), defaultMessage: 'Search channels'}}
                            inputComponent={LocalizedInput}
                            onInput={this.doSearch}
                        />
                    </div>
                    <div className='create_button'>
                        {this.props.createChannelButton}
                    </div>
                </div>
            );
        }

        let channelDropdown;

        if (this.props.canShowArchivedChannels) {
            channelDropdown = (
                <div className='more-modal__dropdown'>
                    <MenuWrapper id='channelsMoreDropdown'>
                        <a>
                            <span>{this.props.shouldShowArchivedChannels ? localizeMessage('more_channels.show_archived_channels', 'Show: Archived Channels') : localizeMessage('more_channels.show_public_channels', 'Show: Public Channels')}</span>
                            <span className='caret'/>
                        </a>
                        <Menu
                            openLeft={false}
                            ariaLabel={localizeMessage('team_members_dropdown.menuAriaLabel', 'Change the role of a team member')}
                        >
                            <Menu.ItemAction
                                id='channelsMoreDropdownPublic'
                                onClick={this.toggleArchivedChannelsOff}
                                text={localizeMessage('suggestion.search.public', 'Public Channels')}
                            />
                            <Menu.ItemAction
                                id='channelsMoreDropdownArchived'
                                onClick={this.toggleArchivedChannelsOn}
                                text={localizeMessage('suggestion.archive', 'Archived Channels')}
                            />
                        </Menu>
                    </MenuWrapper>
                </div>
            );
        }

        return (
            <div className='filtered-user-list'>
                {input}
                {channelDropdown}
                <div
                    role='application'
                    className='more-modal__list'
                >
                    <div
                        id='moreChannelsList'
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

SearchableChannelList.defaultProps = {
    channels: [],
    isSearch: false,
};

SearchableChannelList.propTypes = {
    channels: PropTypes.arrayOf(PropTypes.object),
    channelsPerPage: PropTypes.number,
    nextPage: PropTypes.func.isRequired,
    isSearch: PropTypes.bool,
    search: PropTypes.func.isRequired,
    handleJoin: PropTypes.func.isRequired,
    noResultsText: PropTypes.object,
    loading: PropTypes.bool,
    createChannelButton: PropTypes.element,
    toggleArchivedChannels: PropTypes.func.isRequired,
    shouldShowArchivedChannels: PropTypes.bool.isRequired,
    canShowArchivedChannels: PropTypes.bool.isRequired,
};
