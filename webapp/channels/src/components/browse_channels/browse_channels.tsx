// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelMembership, ChannelSearchOpts, ChannelsWithTotalCount} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import Permissions from 'mattermost-redux/constants/permissions';
import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingScreen from 'components/loading_screen';
import NewChannelModal from 'components/new_channel_modal/new_channel_modal';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import SearchableChannelList from 'components/searchable_channel_list';

import {getHistory} from 'utils/browser_history';
import Constants, {ModalIdentifiers, RHSStates, StoragePrefixes} from 'utils/constants';
import {getRelativeChannelURL} from 'utils/url';
import {localizeMessage} from 'utils/utils';

import type {ModalData} from 'types/actions';
import type {RhsState} from 'types/store/rhs';

import './browse_channels.scss';

const CHANNELS_CHUNK_SIZE = 50;
const CHANNELS_PER_PAGE = 50;
const SEARCH_TIMEOUT_MILLISECONDS = 100;
export enum Filter {
    All = 'All',
    Public = 'Public',
    Private = 'Private',
    Archived = 'Archived',
}

export enum Sort {
    Recommended = 'Recommended',
    Newest = 'Newest',
    MostMembers = 'MostMembers',
    AtoZ = 'AtoZ',
    ZtoA = 'ZtoA',
}

export type FilterType = keyof typeof Filter;
export type SortType = keyof typeof Sort;

type Actions = {
    getChannels: (teamId: string, page: number, perPage: number) => Promise<ActionResult<Channel[]>>;
    getArchivedChannels: (teamId: string, page: number, channelsPerPage: number) => Promise<ActionResult<Channel[]>>;
    joinChannel: (currentUserId: string, teamId: string, channelId: string) => Promise<ActionResult>;
    searchAllChannels: (term: string, opts?: ChannelSearchOpts) => Promise<ActionResult<Channel[] | ChannelsWithTotalCount>>;
    openModal: <P>(modalData: ModalData<P>) => void;
    closeModal: (modalId: string) => void;

    /*
     * Function to set a key-value pair in the local storage
     */
    setGlobalItem: (name: string, value: string) => void;
    closeRightHandSide: () => void;
    getChannelsMemberCount: (channelIds: string[]) => Promise<ActionResult>;
    getChannelMembers: (channelId: string) => Promise<ActionResult>;
}

export type Props = {
    channels: Channel[];
    archivedChannels: Channel[];
    privateChannels: Channel[];
    directMessageChannels: Channel[];
    currentUserId: string;
    teamId: string;
    teamName?: string;
    channelsRequestStarted?: boolean;
    myChannelMemberships: RelationOneToOne<Channel, ChannelMembership>;
    shouldHideJoinedChannels: boolean;
    rhsState?: RhsState;
    rhsOpen?: boolean;
    channelsMemberCount?: Record<string, number>;
    channelMembers: RelationOneToOne<Channel, Record<string, ChannelMembership>>;
    actions: Actions;
}

type State = {
    loading: boolean;
    filter: FilterType;
    sort: SortType;
    search: boolean;
    searchedChannels: Channel[];
    serverError: React.ReactNode | string;
    searching: boolean;
    searchTerm: string;
}

export default class BrowseChannels extends React.PureComponent<Props, State> {
    public searchTimeoutId: number;
    activeChannels: Channel[] = [];

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
            filter: Filter.All,
            sort: Sort.Recommended,
            search: false,
            searchedChannels: [],
            serverError: null,
            searching: false,
            searchTerm: '',
        };
    }

    componentDidMount() {
        if (!this.props.teamId) {
            this.loadComplete();
            return;
        }

        const promises = [
            this.props.actions.getChannels(this.props.teamId, 0, CHANNELS_CHUNK_SIZE * 2),
            this.props.actions.getArchivedChannels(this.props.teamId, 0, CHANNELS_CHUNK_SIZE * 2),
        ];

        Promise.all(promises).then((results) => {
            const channelIDsForMemberCount = results.flatMap((result) => {
                return result.data ? result.data.map((channel) => channel.id) : [];
            },
            );
            this.props.privateChannels.forEach((channel) => channelIDsForMemberCount.push(channel.id));
            if (channelIDsForMemberCount.length > 0) {
                this.props.actions.getChannelsMemberCount(channelIDsForMemberCount);
            }
        });
        this.loadComplete();
    }

    loadComplete = () => {
        this.setState({loading: false});
    };

    handleNewChannel = () => {
        this.handleExit();
        this.closeEditRHS();
        this.props.actions.openModal({
            modalId: ModalIdentifiers.NEW_CHANNEL_MODAL,
            dialogType: NewChannelModal,
        });
    };

    handleExit = () => {
        this.props.actions.closeModal(ModalIdentifiers.MORE_CHANNELS);
    };

    closeEditRHS = () => {
        if (this.props.rhsOpen && this.props.rhsState === RHSStates.EDIT_HISTORY) {
            this.props.actions.closeRightHandSide();
        }
    };

    onChange = (force: boolean) => {
        if (this.state.search && !force) {
            return;
        }

        this.setState({
            searchedChannels: [],
            serverError: null,
        });
    };

    nextPage = (page: number) => {
        this.props.actions.getChannels(this.props.teamId, page + 1, CHANNELS_PER_PAGE).then((result) => {
            if (result.data && result.data.length > 0) {
                this.props.actions.getChannelsMemberCount(result.data.map((channel) => channel.id));
            }
        });
    };

    handleJoin = async (channel: Channel, done: () => void) => {
        const {actions, currentUserId, teamId, teamName} = this.props;
        let result;

        if (!this.isMemberOfChannel(channel.id)) {
            result = await actions.joinChannel(currentUserId, teamId, channel.id);
        }

        if (result?.error) {
            this.setState({serverError: result.error.message});
        } else {
            this.props.actions.getChannelsMemberCount([channel.id]);
            getHistory().push(getRelativeChannelURL(teamName!, channel.name));
            this.closeEditRHS();
        }

        if (done) {
            done();
        }
    };

    search = (term: string) => {
        clearTimeout(this.searchTimeoutId);

        if (term === '') {
            this.onChange(true);
            this.setState({search: false, searchedChannels: [], searching: false, searchTerm: term});
            this.searchTimeoutId = 0;
            return;
        }
        this.setState({search: true, searching: true, searchTerm: term});

        const searchTimeoutId = window.setTimeout(
            async () => {
                try {
                    const {data} = await this.props.actions.searchAllChannels(term, {team_ids: [this.props.teamId], nonAdminSearch: true, include_deleted: true}) as ActionResult<Channel[]>;
                    if (searchTimeoutId !== this.searchTimeoutId) {
                        return;
                    }

                    if (data) {
                        const channelIDsForMemberCount = data.map((channel: Channel) => channel.id);
                        if (channelIDsForMemberCount.length > 0) {
                            this.props.actions.getChannelsMemberCount(channelIDsForMemberCount);
                        }
                        this.setSearchResults(data.filter((channel) => channel.team_id === this.props.teamId));
                    } else {
                        this.setState({searchedChannels: [], searching: false});
                    }
                } catch (ignoredErr) {
                    this.setState({searchedChannels: [], searching: false});
                }
            },
            SEARCH_TIMEOUT_MILLISECONDS,
        );

        this.searchTimeoutId = searchTimeoutId;
    };

    setSearchResults = (channels: Channel[]) => {
        // filter out private channels that the user is not a member of
        let searchedChannels = channels.filter((c) => c.type !== Constants.PRIVATE_CHANNEL || this.isMemberOfChannel(c.id));
        if (this.state.filter === Filter.Private) {
            searchedChannels = channels.filter((c) => c.type === Constants.PRIVATE_CHANNEL && this.isMemberOfChannel(c.id));
        }
        if (this.state.filter === Filter.Public) {
            searchedChannels = channels.filter((c) => c.type === Constants.OPEN_CHANNEL && c.delete_at === 0);
        }
        if (this.state.filter === Filter.Archived) {
            searchedChannels = channels.filter((c) => c.delete_at !== 0);
        }
        if (this.props.shouldHideJoinedChannels) {
            searchedChannels = this.getChannelsWithoutJoined(searchedChannels);
        }
        this.setState({searchedChannels, searching: false});
    };

    changeFilter = (filter: FilterType) => {
        // search again when switching channels to update search results
        this.search(this.state.searchTerm);
        this.setState({filter});
    };

    changeSort = (sort: SortType) => {
        // search again when switching sort to update search results
        this.search(this.state.searchTerm);
        this.setState({sort});
    };

    isMemberOfChannel(channelId: string) {
        return this.props.myChannelMemberships[channelId];
    }

    /**
     * Get user IDs from Direct Message channels
     */
    getDMUserIds = (): Set<string> => {
        const {directMessageChannels} = this.props;
        const dmUserIds = new Set<string>();

        directMessageChannels.forEach(dmChannel => {
            if (dmChannel.teammate_id) {
                dmUserIds.add(dmChannel.teammate_id);
            } 
        });

        return dmUserIds;
    };

    /**
     * Count how many DM contacts are members of a specific channel
     */
    countDMContactsInChannel = (channelId: string, dmUserIds: Set<string>): number => {
        const members = this.props.channelMembers[channelId] || {};
        return Object.keys(members).filter(userId => dmUserIds.has(userId)).length;
    };

    /**
     * Sort channels by recommendation (DM contacts priority)
     */
    getSortedChannelsByRecommendation = (channels: Channel[]): Channel[] => {
        const dmUserIds = this.getDMUserIds();

        return channels.sort((a, b) => {
            // Count DM contacts in each channel
            const dmContactsA = this.countDMContactsInChannel(a.id, dmUserIds);
            const dmContactsB = this.countDMContactsInChannel(b.id, dmUserIds);

            // Primary sort: DM contact count (descending)
            if (dmContactsA !== dmContactsB) {
                return dmContactsB - dmContactsA;
            }

            // Secondary sort: Recent activity (descending)
            if (a.last_post_at !== b.last_post_at) {
                return b.last_post_at - a.last_post_at;
            }

            // Tertiary sort: Member count (descending - more active channels first)
            const memberCountA = this.props.channelsMemberCount?.[a.id] || 0;
            const memberCountB = this.props.channelsMemberCount?.[b.id] || 0;
            if (memberCountA !== memberCountB) {
                return memberCountB - memberCountA;
            }

            // Final tie breaker: Alphabetical by display name
            return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
        });
    };

    handleShowJoinedChannelsPreference = (shouldHideJoinedChannels: boolean) => {
        // search again when switching channels to update search results
        this.search(this.state.searchTerm);
        this.props.actions.setGlobalItem(StoragePrefixes.HIDE_JOINED_CHANNELS, shouldHideJoinedChannels.toString());
    };

    getChannelsWithoutJoined = (channelList: Channel[]) => channelList.filter((channel) => !this.isMemberOfChannel(channel.id));

    sortChannels = (channels: Channel[], sortType: SortType): Channel[] => {
        switch (sortType) {
        case Sort.AtoZ:
            // Sort A-Z by display name (case insensitive)
            return [...channels].sort((a, b) =>
                a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase())
            );
        case Sort.ZtoA:
            // Sort Z-A by display name (case insensitive)
            return [...channels].sort((a, b) =>
                b.display_name.toLowerCase().localeCompare(a.display_name.toLowerCase())
            );
        case Sort.Newest:
            // Sort by creation date (newest first), with A-Z as tie breaker
            return [...channels].sort((a, b) => {
                // Primary sort: creation date (descending - newest first)
                if (a.create_at !== b.create_at) {
                    return b.create_at - a.create_at;
                }

                // Tie breaker: A-Z by display name (ascending)
                return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
            });
        case Sort.MostMembers:
            // Sort by member count (highest first), with A-Z as tie breaker
            return [...channels].sort((a, b) => {
                const memberCountA = this.props.channelsMemberCount?.[a.id] || 0;
                const memberCountB = this.props.channelsMemberCount?.[b.id] || 0;

                // Primary sort: member count (descending)
                if (memberCountA !== memberCountB) {
                    return memberCountB - memberCountA;
                }

                // Tie breaker: A-Z by display name (ascending)
                return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
            });
        case Sort.Recommended:
        default:
            return this.getSortedChannelsByRecommendation(channels);
        }
    };

    getActiveChannels = () => {
        const {channels, archivedChannels, shouldHideJoinedChannels, privateChannels} = this.props;
        const {search, searchedChannels, filter, sort} = this.state;

        const allChannels = channels.concat(privateChannels);
        const allChannelsWithoutJoined = this.getChannelsWithoutJoined(allChannels);
        const publicChannelsWithoutJoined = this.getChannelsWithoutJoined(channels);
        const archivedChannelsWithoutJoined = this.getChannelsWithoutJoined(archivedChannels);
        const privateChannelsWithoutJoined = this.getChannelsWithoutJoined(privateChannels);

        const filterOptions = {
            [Filter.All]: shouldHideJoinedChannels ? allChannelsWithoutJoined : allChannels,
            [Filter.Archived]: shouldHideJoinedChannels ? archivedChannelsWithoutJoined : archivedChannels,
            [Filter.Private]: shouldHideJoinedChannels ? privateChannelsWithoutJoined : privateChannels,
            [Filter.Public]: shouldHideJoinedChannels ? publicChannelsWithoutJoined : channels,
        };

        let activeChannels;
        if (search) {
            activeChannels = searchedChannels;
        } else {
            activeChannels = filterOptions[filter] || filterOptions[Filter.All];
        }

        // Apply sorting
        return this.sortChannels(activeChannels, sort);
    };

    render() {
        const {teamId, channelsRequestStarted, shouldHideJoinedChannels} = this.props;
        const {search, serverError: serverErrorState, searching} = this.state;

        this.activeChannels = this.getActiveChannels();

        let serverError;
        if (serverErrorState) {
            serverError =
                <div className='form-group has-error'><label className='control-label'>{serverErrorState}</label></div>;
        }

        const createNewChannelButton = (className: string, icon?: JSX.Element) => {
            const buttonClassName = classNames('btn', className);
            return (
                <TeamPermissionGate
                    teamId={teamId}
                    permissions={[Permissions.CREATE_PUBLIC_CHANNEL]}
                >
                    <button
                        type='button'
                        id='createNewChannelButton'
                        className={buttonClassName}
                        onClick={this.handleNewChannel}
                        aria-label={localizeMessage({id: 'more_channels.create', defaultMessage: 'Create New Channel'})}
                    >
                        {icon}
                        <FormattedMessage
                            id='more_channels.create'
                            defaultMessage='Create New Channel'
                        />
                    </button>
                </TeamPermissionGate>
            );
        };

        const noResultsText = (
            <>
                <p className='secondary-message'>
                    <FormattedMessage
                        id='more_channels.searchError'
                        defaultMessage='Try searching different keywords, checking for typos or adjusting the filters.'
                    />
                </p>
                {createNewChannelButton('btn-primary', <i className='icon-plus'/>)}
            </>
        );

        const body = this.state.loading ? <LoadingScreen/> : (
            <>
                <SearchableChannelList
                    channels={this.activeChannels}
                    channelsPerPage={CHANNELS_PER_PAGE}
                    nextPage={this.nextPage}
                    isSearch={search}
                    search={this.search}
                    handleJoin={this.handleJoin}
                    noResultsText={noResultsText}
                    loading={search ? searching : channelsRequestStarted}
                    changeFilter={this.changeFilter}
                    filter={this.state.filter}
                    changeSort={this.changeSort}
                    sort={this.state.sort}
                    myChannelMemberships={this.props.myChannelMemberships}
                    closeModal={this.props.actions.closeModal}
                    hideJoinedChannelsPreference={this.handleShowJoinedChannelsPreference}
                    rememberHideJoinedChannelsChecked={shouldHideJoinedChannels}
                    channelsMemberCount={this.props.channelsMemberCount}
                />
                {serverError}
            </>
        );

        const title = (
            <FormattedMessage
                id='more_channels.title'
                defaultMessage='Browse Channels'
            />
        );

        return (
            <GenericModal
                id='browseChannelsModal'
                onExited={this.handleExit}
                compassDesign={true}
                modalHeaderText={title}
                headerButton={createNewChannelButton('btn-secondary btn-sm')}
                autoCloseOnConfirmButton={false}
                aria-modal={true}
                enforceFocus={false}
                bodyPadding={false}
            >
                {body}
            </GenericModal>
        );
    }
}
