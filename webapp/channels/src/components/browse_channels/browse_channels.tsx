// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button, type ButtonEmphasis, type ButtonSize} from '@mattermost/shared/components/button';
import type {Channel, ChannelMembership, ChannelSearchOpts, ChannelsWithTotalCount} from '@mattermost/types/channels';
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
    Recommended = 'Recommended',
}

export type FilterType = keyof typeof Filter;

// Resolve the initial filter, defending against callers that ask for
// `Recommended` when ABAC isn't enabled — the dropdown would hide that menu
// item server-side, leaving the UI stuck on a filter the user can't toggle off.
function resolveInitialFilter(initialFilter: FilterType | undefined, accessControlEnabled: boolean): FilterType {
    if (!initialFilter) {
        return Filter.All;
    }
    if (initialFilter === Filter.Recommended && !accessControlEnabled) {
        return Filter.All;
    }
    return initialFilter;
}

type Actions = {
    getChannels: (teamId: string, page: number, perPage: number) => Promise<ActionResult<Channel[]>>;
    getArchivedChannels: (teamId: string, page: number, channelsPerPage: number) => Promise<ActionResult<Channel[]>>;
    getRecommendedChannelsForUser: (teamId: string) => Promise<ActionResult<Channel[]>>;
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
}

export type Props = {
    channels: Channel[];
    archivedChannels: Channel[];
    privateChannels: Channel[];
    currentUserId: string;
    teamId: string;
    teamName?: string;
    channelsRequestStarted?: boolean;
    myChannelMemberships: RelationOneToOne<Channel, ChannelMembership>;
    shouldHideJoinedChannels: boolean;
    rhsState?: RhsState;
    rhsOpen?: boolean;
    channelsMemberCount?: Record<string, number>;
    accessControlEnabled: boolean;
    initialFilter?: FilterType;
    actions: Actions;
}

type State = {
    loading: boolean;
    filter: FilterType;
    search: boolean;
    searchedChannels: Channel[];
    serverError: React.ReactNode | string;
    searching: boolean;
    searchTerm: string;
    recommendedChannels: Channel[];
}

export default class BrowseChannels extends React.PureComponent<Props, State> {
    public searchTimeoutId: number;
    activeChannels: Channel[] = [];

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
            filter: resolveInitialFilter(props.initialFilter, props.accessControlEnabled),
            search: false,
            searchedChannels: [],
            serverError: null,
            searching: false,
            searchTerm: '',
            recommendedChannels: [],
        };
    }

    componentDidMount() {
        if (!this.props.teamId) {
            this.loadComplete();
            return;
        }

        const promises: Array<Promise<ActionResult<Channel[]>>> = [
            this.props.actions.getChannels(this.props.teamId, 0, CHANNELS_CHUNK_SIZE * 2),
            this.props.actions.getArchivedChannels(this.props.teamId, 0, CHANNELS_CHUNK_SIZE * 2),
        ];

        if (this.props.accessControlEnabled) {
            promises.push(this.props.actions.getRecommendedChannelsForUser(this.props.teamId).then((result) => {
                if (result.data) {
                    this.setState({recommendedChannels: result.data});
                }
                return result;
            }));
        }

        Promise.all(promises).then((results) => {
            // Dedupe across the result lists + privateChannels: a recommended
            // channel is also a public channel, so the same id can show up in
            // both `getChannels` and `getRecommendedChannelsForUser` results.
            // getChannelsMemberCount tolerates dupes but issuing them is
            // wasted work and noisy.
            const ids = new Set<string>();
            for (const result of results) {
                if (result.data) {
                    for (const channel of result.data) {
                        ids.add(channel.id);
                    }
                }
            }
            for (const channel of this.props.privateChannels) {
                ids.add(channel.id);
            }
            if (ids.size > 0) {
                this.props.actions.getChannelsMemberCount(Array.from(ids));
            }
            this.loadComplete();
        }).catch(() => {
            this.loadComplete();
        });
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
        if (this.state.filter === Filter.Recommended) {
            const recommendedIds = new Set(this.state.recommendedChannels.map((c) => c.id));
            searchedChannels = channels.filter((c) => recommendedIds.has(c.id));
        }
        if (this.props.shouldHideJoinedChannels) {
            searchedChannels = this.getChannelsWithoutJoined(searchedChannels);
        }
        searchedChannels = this.boostRecommendedChannels(searchedChannels);
        this.setState({searchedChannels, searching: false});
    };

    // Boost recommended channels to the top of a list. Used as a light-touch
    // prioritization signal so matching public channels surface first in the
    // generic Browse Channels views.
    boostRecommendedChannels = (channels: Channel[]): Channel[] => {
        if (this.state.recommendedChannels.length === 0) {
            return channels;
        }
        const recommendedIds = new Set(this.state.recommendedChannels.map((c) => c.id));
        const recommended: Channel[] = [];
        const rest: Channel[] = [];
        for (const c of channels) {
            if (recommendedIds.has(c.id)) {
                recommended.push(c);
            } else {
                rest.push(c);
            }
        }
        return [...recommended, ...rest];
    };

    changeFilter = (filter: FilterType) => {
        // search again when switching channels to update search results
        this.search(this.state.searchTerm);
        this.setState({filter});
    };

    isMemberOfChannel(channelId: string) {
        return this.props.myChannelMemberships[channelId];
    }

    handleShowJoinedChannelsPreference = (shouldHideJoinedChannels: boolean) => {
        // search again when switching channels to update search results
        this.search(this.state.searchTerm);
        this.props.actions.setGlobalItem(StoragePrefixes.HIDE_JOINED_CHANNELS, shouldHideJoinedChannels.toString());
    };

    getChannelsWithoutJoined = (channelList: Channel[]) => channelList.filter((channel) => !this.isMemberOfChannel(channel.id));

    getActiveChannels = () => {
        const {channels, archivedChannels, shouldHideJoinedChannels, privateChannels} = this.props;
        const {search, searchedChannels, filter, recommendedChannels} = this.state;

        const allChannels = channels.concat(privateChannels).sort((a, b) => a.display_name.localeCompare(b.display_name));
        const allChannelsWithoutJoined = this.getChannelsWithoutJoined(allChannels);
        const publicChannelsWithoutJoined = this.getChannelsWithoutJoined(channels);
        const archivedChannelsWithoutJoined = this.getChannelsWithoutJoined(archivedChannels);
        const privateChannelsWithoutJoined = this.getChannelsWithoutJoined(privateChannels);
        const recommendedChannelsWithoutJoined = this.getChannelsWithoutJoined(recommendedChannels);

        const filterOptions: Record<FilterType, Channel[]> = {
            [Filter.All]: shouldHideJoinedChannels ? allChannelsWithoutJoined : allChannels,
            [Filter.Archived]: shouldHideJoinedChannels ? archivedChannelsWithoutJoined : archivedChannels,
            [Filter.Private]: shouldHideJoinedChannels ? privateChannelsWithoutJoined : privateChannels,
            [Filter.Public]: shouldHideJoinedChannels ? publicChannelsWithoutJoined : channels,
            [Filter.Recommended]: shouldHideJoinedChannels ? recommendedChannelsWithoutJoined : recommendedChannels,
        };

        if (search) {
            return searchedChannels;
        }

        const activeList = filterOptions[filter] || filterOptions[Filter.All];
        if (filter === Filter.Recommended) {
            return activeList;
        }
        return this.boostRecommendedChannels(activeList);
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

        const createNewChannelButton = (emphasis: ButtonEmphasis, size: ButtonSize, icon?: JSX.Element) => {
            return (
                <TeamPermissionGate
                    teamId={teamId}
                    permissions={[Permissions.CREATE_PUBLIC_CHANNEL]}
                >
                    <Button
                        type='button'
                        id='createNewChannelButton'
                        emphasis={emphasis}
                        onClick={this.handleNewChannel}
                        aria-label={localizeMessage({id: 'more_channels.create', defaultMessage: 'Create New Channel'})}
                    >
                        {icon}
                        <FormattedMessage
                            id='more_channels.create'
                            defaultMessage='Create New Channel'
                        />
                    </Button>
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
                {createNewChannelButton('primary', 'md', <i className='icon-plus'/>)}
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
                    showRecommendedFilter={this.props.accessControlEnabled}
                    changeFilter={this.changeFilter}
                    filter={this.state.filter}
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
                headerButton={createNewChannelButton('secondary', 'sm')}
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
