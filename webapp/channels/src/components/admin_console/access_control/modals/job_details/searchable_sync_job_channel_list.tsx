// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import {FormattedMessage, defineMessages, injectIntl, type WrappedComponentProps} from 'react-intl';

import {ArchiveOutlineIcon, GlobeIcon, LockOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {isPrivateChannel} from 'mattermost-redux/utils/channel_utils';

import MagnifyingGlassSVG from 'components/common/svg_images_components/magnifying_glass_svg';
import LoadingScreen from 'components/loading_screen';
import QuickInput from 'components/quick_input';

import {isArchivedChannel} from 'utils/channel_utils';
import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {ChannelMembersSyncResults} from '../user_sync/user_sync_modal';

export type SyncResults = {
    [channelId: string]: ChannelMembersSyncResults;
};

interface Props extends WrappedComponentProps {
    channels: Channel[];
    teams: IDMappedObjects<Team>;
    channelsPerPage: number;
    nextPage: (page: number) => void;
    isSearch: boolean;
    search: (term: string) => void;
    onViewDetails?: (channelId: string, channelName: string, results: ChannelMembersSyncResults) => void;
    noResultsText: JSX.Element;
    loading?: boolean;
    syncResults: SyncResults;
}

const SearchableSyncJobChannelList = (props: Props) => {
    const [page, setPage] = useState(0);
    const [nextDisabled, setNextDisabled] = useState(false);
    const [channelSearchValue, setChannelSearchValue] = useState('');
    const [isSearch, setIsSearch] = useState(props.isSearch);

    const channelListScroll = useRef<HTMLDivElement>(null);

    // Handle getDerivedStateFromProps
    useEffect(() => {
        setIsSearch(props.isSearch);
        if (props.isSearch && !isSearch) {
            setPage(0);
        }
    }, [props.isSearch, isSearch]);

    // Handle componentDidMount and componentWillUnmount
    useEffect(() => {
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isEnterKeyPressed = isKeyPressed(e, Constants.KeyCodes.ENTER);
        if (isEnterKeyPressed && (e.shiftKey || e.ctrlKey || e.altKey)) {
            return;
        }
        if (isEnterKeyPressed && target?.classList.contains('more-modal__row')) {
            target.click();
        }
    };

    const handleRowClick = (channel: Channel) => {
        if (props.onViewDetails && props.syncResults[channel.id]) {
            props.onViewDetails(channel.id, channel.display_name, props.syncResults[channel.id]);
        }
    };

    const createChannelRow = (channel: Channel) => {
        const ariaLabel = `${channel.display_name}, ${channel.purpose}`.toLowerCase();
        let channelTypeIcon;

        if (isArchivedChannel(channel)) {
            channelTypeIcon = <ArchiveOutlineIcon size={18}/>;
        } else if (isPrivateChannel(channel)) {
            channelTypeIcon = <LockOutlineIcon size={18}/>;
        } else {
            channelTypeIcon = <GlobeIcon size={18}/>;
        }

        const team = props.teams[channel.team_id];

        const channelMoreInfoContainer = (
            <div
                id='channelMoreInfoContainer'
                aria-label={`${team.display_name}`}
            >
                <span className='more-modal__description'>{`${team.display_name}`}</span>
            </div>
        );

        const channelSyncData = props.syncResults[channel.id];
        const syncChangesDisplay = channelSyncData ? (
            <div className='changes-cell'>
                <span className='changes-summary'>
                    <span className='added'>
                        {'+' + (channelSyncData.MembersAdded?.length || 0)}
                    </span>
                    {' / '}
                    <span className='removed'>
                        {'-' + (channelSyncData.MembersRemoved?.length || 0)}
                    </span>
                </span>
            </div>
        ) : null;

        return (
            <div
                className='more-modal__row job-sync-row'
                key={channel.id}
                id={`ChannelRow-${channel.name}`}
                data-testid={`ChannelRow-${channel.name}`}
                aria-label={ariaLabel}
                onClick={() => handleRowClick(channel)}
                tabIndex={0}
            >
                <div className='more-modal__details'>
                    <div className='style--none more-modal__name'>
                        {channelTypeIcon}
                        <span id='channelName'>{channel.display_name}</span>
                    </div>
                    {team && channelMoreInfoContainer}
                </div>
                <div className='more-modal__actions'>
                    {syncChangesDisplay}
                </div>
            </div>
        );
    };

    const nextPage = (e: React.MouseEvent) => {
        e.preventDefault();
        setPage(page + 1);
        setNextDisabled(true);
        props.nextPage(page + 1);
        channelListScroll.current?.scrollTo({top: 0});
    };

    const previousPage = (e: React.MouseEvent) => {
        e.preventDefault();
        setPage(page - 1);
        channelListScroll.current?.scrollTo({top: 0});
    };

    const handleChange = (e?: React.FormEvent<HTMLInputElement>) => {
        if (e?.currentTarget) {
            setChannelSearchValue(e.currentTarget.value);
            props.search(e.currentTarget.value);
        }
    };

    const handleClear = () => {
        setChannelSearchValue('');
        props.search('');
    };

    const getEmptyStateMessage = () => {
        return (
            <FormattedMessage
                id='more_channels.noMore'
                tagName='strong'
                defaultMessage='No results for {text}'
                values={{text: channelSearchValue}}
            />
        );
    };

    const channels = props.channels;
    let listContent;
    let nextButton;
    let previousButton;

    if (props.loading && channels.length === 0) {
        listContent = <LoadingScreen/>;
    } else if (channels.length === 0) {
        listContent = (
            <div
                className='no-channel-message channel-switcher__suggestion-box'
                aria-label={channelSearchValue.length > 0 ? props.intl.formatMessage(messages.noMore, {text: channelSearchValue}) : props.intl.formatMessage({id: 'widgets.channels_input.empty', defaultMessage: 'No channels found'})
                }
            >
                <MagnifyingGlassSVG/>
                <h3 className='primary-message'>
                    {getEmptyStateMessage()}
                </h3>
                {props.noResultsText}
            </div>
        );
    } else {
        const pageStart = page * props.channelsPerPage;
        const pageEnd = pageStart + props.channelsPerPage;
        const channelsToDisplay = props.channels.slice(pageStart, pageEnd);
        listContent = channelsToDisplay.map(createChannelRow);

        if (channelsToDisplay.length >= props.channelsPerPage && pageEnd < props.channels.length) {
            nextButton = (
                <button
                    className='btn btn-sm btn-tertiary filter-control filter-control__next'
                    onClick={nextPage}
                    disabled={nextDisabled}
                    aria-label={props.intl.formatMessage({id: 'more_channels.next', defaultMessage: 'Next'})}
                >
                    <FormattedMessage
                        id='more_channels.next'
                        defaultMessage='Next'
                    />
                </button>
            );
        }

        if (page > 0) {
            previousButton = (
                <button
                    className='btn btn-sm btn-tertiary filter-control filter-control__prev'
                    onClick={previousPage}
                    aria-label={props.intl.formatMessage({id: 'more_channels.prev', defaultMessage: 'Previous'})}
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
                <i className='icon icon-magnify'/>
            </span>
            <QuickInput
                id='searchChannelsTextbox'
                className='form-control filter-textbox'
                placeholder={props.intl.formatMessage({id: 'filtered_channels_list.search', defaultMessage: 'Search channels'})}
                onInput={handleChange}
                clearable={true}
                onClear={handleClear}
                value={channelSearchValue}
                aria-label={props.intl.formatMessage({id: 'filtered_channels_list.search', defaultMessage: 'Search Channels'})}
            />
        </div>
    );

    let channelCountLabel;
    if (channels.length === 0) {
        channelCountLabel = props.intl.formatMessage({id: 'more_channels.count_zero', defaultMessage: '0 Results'});
    } else if (channels.length === 1) {
        channelCountLabel = props.intl.formatMessage({id: 'more_channels.count_one', defaultMessage: '1 Result'});
    } else if (channels.length > 1) {
        channelCountLabel = props.intl.formatMessage(messages.channelCount, {count: channels.length});
    } else {
        channelCountLabel = props.intl.formatMessage({id: 'more_channels.count_zero', defaultMessage: '0 Results'});
    }

    return (
        <div className='filtered-user-list'>
            {input}
            <div className='more-modal__dropdown'>
                <span className='sync-job-channel-count-label'>
                    {channelCountLabel}
                </span>
            </div>
            <div
                role='search'
                className='more-modal__list'
                tabIndex={-1}
            >
                <div
                    id='moreChannelsList'
                    tabIndex={-1}
                    ref={channelListScroll}
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
};

const messages = defineMessages({
    channelCount: {
        id: 'more_channels.count',
        defaultMessage: '{count} Results',
    },
    noMore: {
        id: 'more_channels.noMore',
        defaultMessage: 'No results for {text}',
    },
});

export default injectIntl(SearchableSyncJobChannelList);
