// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button, type ButtonEmphasis, type ButtonSize} from '@mattermost/shared/components/button';
import type {Channel, ChannelJoinRequest, ChannelMembership, ChannelSearchOpts, ChannelsWithTotalCount, GetChannelJoinRequestsOptions} from '@mattermost/types/channels';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import Permissions from 'mattermost-redux/constants/permissions';
import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingScreen from 'components/loading_screen';
import NewChannelModal from 'components/new_channel_modal/new_channel_modal';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import RequestJoinChannelModal from 'components/request_join_channel_modal/request_join_channel_modal';
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
    Discoverable = 'Discoverable',
    MyPendingRequests = 'MyPendingRequests',
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

    // Discoverable Private Channels actions
    getMyChannelJoinRequests: (opts?: GetChannelJoinRequestsOptions) => Promise<ActionResult>;
    withdrawMyChannelJoinRequest: (channelId: string) => Promise<ActionResult<ChannelJoinRequest>>;
};

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

    // Discoverable Private Channels
    discoverableFeatureEnabled: boolean;
    myPendingJoinRequests: Record<string, ChannelJoinRequest>;

    actions: Actions;
};

type State = {
    loading: boolean;
    filter: FilterType;
    search: boolean;
    searchedChannels: Channel[];
    serverError: React.ReactNode | string;
    searching: boolean;
    searchTerm: string;
    recommendedChannels: Channel[];
    discoverableChannels: Channel[];
};

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
            discoverableChannels: [],
        };
    }

    componentDidMount() {
        if (!this.props.teamId) {
            this.loadComplete();
            return;
        }

        // Refresh the user's pending join requests so per-row affordances
        // ("Request to join" vs. "Requested") are accurate on first render.
        // Fire-and-forget — the result lands in redux via the
        // RECEIVED_MY_CHANNEL_JOIN_REQUESTS action.
        if (this.props.discoverableFeatureEnabled) {
            this.props.actions.getMyChannelJoinRequests({status: 'pending'});
            this.loadDiscoverableChannels();
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

    // Non-member discoverable private channels aren't returned by getChannels
    // (which only fetches public channels), so without this the Discoverable
    // filter and the default browse list would be empty until the user typed a
    // search term. An empty-term non-admin search returns every channel the
    // user can see for the team — including discoverable privates, already
    // ABAC-filtered server-side — which we narrow to the non-member
    // discoverable rows and surface directly.
    loadDiscoverableChannels = async () => {
        try {
            const {data} = await this.props.actions.searchAllChannels('', {team_ids: [this.props.teamId], nonAdminSearch: true}) as ActionResult<Channel[]>;
            if (!data) {
                return;
            }
            const discoverableChannels = data.filter((channel) =>
                channel.team_id === this.props.teamId &&
                channel.type === Constants.PRIVATE_CHANNEL &&
                channel.discoverable === true &&
                channel.delete_at === 0 &&
                !this.isMemberOfChannel(channel.id),
            );
            if (discoverableChannels.length > 0) {
                this.props.actions.getChannelsMemberCount(discoverableChannels.map((channel) => channel.id));
            }
            this.setState({discoverableChannels});
        } catch {
            // Discovery is best-effort; a failure just means the filter stays
            // empty until the user searches.
        }
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

    // Discoverable + no pending request → open the two-step Request to Join
    // modal. The modal handles submit + success routing internally; the
    // Browse row just needs to drop its loading state once the modal opens.
    handleRequestToJoin = (channel: Channel, done: () => void) => {
        this.props.actions.openModal({
            modalId: ModalIdentifiers.REQUEST_JOIN_CHANNEL,
            dialogType: RequestJoinChannelModal,
            dialogProps: {
                channel,
                teamName: this.props.teamName,
            },
        });
        done();
    };

    handleWithdrawRequest = async (channel: Channel, done: () => void) => {
        const result = await this.props.actions.withdrawMyChannelJoinRequest(channel.id);
        if (result?.error) {
            this.setState({serverError: result.error.message ?? result.error.server_error_id ?? 'Unknown error'});
        }
        done();
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
                } catch {
                    this.setState({searchedChannels: [], searching: false});
                }
            },
            SEARCH_TIMEOUT_MILLISECONDS,
        );

        this.searchTimeoutId = searchTimeoutId;
    };

    // Inclusive private-visibility rule:
    //   - Member of the channel, OR
    //   - Channel is discoverable AND the feature flag is on
    // The server-side autocomplete + searchAllChannels already enforces this
    // (PR #36580). The webapp check is a defense-in-depth filter on cached
    // results and feeds the per-row state machine in SearchableChannelList.
    private canSeePrivateChannel = (c: Channel) => {
        if (this.isMemberOfChannel(c.id)) {
            return true;
        }
        return this.props.discoverableFeatureEnabled && c.discoverable === true;
    };

    setSearchResults = (channels: Channel[]) => {
        // Loosened: include discoverable private channels for non-members.
        let searchedChannels = channels.filter((c) => c.type !== Constants.PRIVATE_CHANNEL || this.canSeePrivateChannel(c));
        if (this.state.filter === Filter.Private) {
            searchedChannels = channels.filter((c) => c.type === Constants.PRIVATE_CHANNEL && this.canSeePrivateChannel(c));
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
        if (this.state.filter === Filter.Discoverable) {
            // Only discoverable private channels the user is not a member of.
            // Members of a discoverable channel see it under their normal
            // joined channels, not in the discovery surface.
            searchedChannels = channels.filter((c) =>
                c.type === Constants.PRIVATE_CHANNEL &&
                c.discoverable === true &&
                !this.isMemberOfChannel(c.id),
            );
        }
        if (this.state.filter === Filter.MyPendingRequests) {
            searchedChannels = channels.filter((c) => this.props.myPendingJoinRequests[c.id]);
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
        const {channels, archivedChannels, shouldHideJoinedChannels, privateChannels, myPendingJoinRequests} = this.props;
        const {search, searchedChannels, filter, recommendedChannels, discoverableChannels} = this.state;

        // Discoverable private channels the user is not yet a member of. These
        // come from two sources, deduped by id: the privateChannels selector
        // (redux, hydrated by any prior search/autocomplete) and the mount-time
        // loadDiscoverableChannels fetch (so the surface is populated before
        // the user searches).
        const discoverableById = new Map<string, Channel>();
        for (const c of privateChannels) {
            if (c.discoverable === true && !this.isMemberOfChannel(c.id)) {
                discoverableById.set(c.id, c);
            }
        }
        for (const c of discoverableChannels) {
            if (!this.isMemberOfChannel(c.id)) {
                discoverableById.set(c.id, c);
            }
        }
        const discoverableNonMember = Array.from(discoverableById.values());

        // Fold the fetched discoverable channels into the "All" list so they
        // appear in the default browse view, not only under the Discoverable
        // filter. privateChannels-sourced rows are already in allChannels.
        const extraDiscoverable = discoverableChannels.filter((c) => !privateChannels.some((p) => p.id === c.id));
        const allChannels = channels.concat(privateChannels, extraDiscoverable).sort((a, b) => a.display_name.localeCompare(b.display_name));
        const allChannelsWithoutJoined = this.getChannelsWithoutJoined(allChannels);
        const publicChannelsWithoutJoined = this.getChannelsWithoutJoined(channels);
        const archivedChannelsWithoutJoined = this.getChannelsWithoutJoined(archivedChannels);
        const privateChannelsWithoutJoined = this.getChannelsWithoutJoined(privateChannels);
        const recommendedChannelsWithoutJoined = this.getChannelsWithoutJoined(recommendedChannels);

        // Channels the current user has pending requests against. The
        // requests slice maps channel_id -> ChannelJoinRequest, but the
        // channel itself may not be in our local list if the user is not
        // (and never was) a member. We resolve from the union of all known
        // channel lists.
        const knownChannelsById = new Map<string, Channel>();
        for (const c of allChannels) {
            knownChannelsById.set(c.id, c);
        }
        const myPending = Object.keys(myPendingJoinRequests).
            map((id) => knownChannelsById.get(id)).
            filter((c): c is Channel => Boolean(c));

        const filterOptions: Record<FilterType, Channel[]> = {
            [Filter.All]: shouldHideJoinedChannels ? allChannelsWithoutJoined : allChannels,
            [Filter.Archived]: shouldHideJoinedChannels ? archivedChannelsWithoutJoined : archivedChannels,
            [Filter.Private]: shouldHideJoinedChannels ? privateChannelsWithoutJoined : privateChannels,
            [Filter.Public]: shouldHideJoinedChannels ? publicChannelsWithoutJoined : channels,
            [Filter.Recommended]: shouldHideJoinedChannels ? recommendedChannelsWithoutJoined : recommendedChannels,
            [Filter.Discoverable]: discoverableNonMember,
            [Filter.MyPendingRequests]: myPending,
        };

        if (search) {
            return searchedChannels;
        }

        const activeList = filterOptions[filter] || filterOptions[Filter.All];
        if (filter === Filter.Recommended || filter === Filter.Discoverable || filter === Filter.MyPendingRequests) {
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
                    handleRequestToJoin={this.handleRequestToJoin}
                    handleWithdrawRequest={this.handleWithdrawRequest}
                    noResultsText={noResultsText}
                    loading={search ? searching : channelsRequestStarted}
                    showRecommendedFilter={this.props.accessControlEnabled}
                    showDiscoverableFilters={this.props.discoverableFeatureEnabled}
                    changeFilter={this.changeFilter}
                    filter={this.state.filter}
                    myChannelMemberships={this.props.myChannelMemberships}
                    myPendingJoinRequests={this.props.myPendingJoinRequests}
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
