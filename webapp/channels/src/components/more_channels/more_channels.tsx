// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ActionResult} from 'mattermost-redux/types/actions';
import {RelationOneToOne} from '@mattermost/types/utilities';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import Permissions from 'mattermost-redux/constants/permissions';

import NewChannelModal from 'components/new_channel_modal/new_channel_modal';
import SearchableChannelList from 'components/searchable_channel_list';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';

import {ModalData} from 'types/actions';
import {RhsState} from 'types/store/rhs';

import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers, RHSStates, StoragePrefixes} from 'utils/constants';
import {getRelativeChannelURL} from 'utils/url';
import {GenericModal} from '@mattermost/components';
import classNames from 'classnames';
import {localizeMessage} from 'utils/utils';
import LoadingScreen from 'components/loading_screen';

import './more_channels.scss';

const CHANNELS_CHUNK_SIZE = 50;
const CHANNELS_PER_PAGE = 50;
const SEARCH_TIMEOUT_MILLISECONDS = 100;

type Actions = {
    getChannels: (teamId: string, page: number, perPage: number) => void;
    getArchivedChannels: (teamId: string, page: number, channelsPerPage: number) => void;
    joinChannel: (currentUserId: string, teamId: string, channelId: string) => Promise<ActionResult>;
    searchMoreChannels: (term: string, shouldShowArchivedChannels: boolean, shouldHideJoinedChannels: boolean) => Promise<ActionResult>;
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
    currentUserId: string;
    teamId: string;
    teamName: string;
    channelsRequestStarted?: boolean;
    canShowArchivedChannels?: boolean;
    morePublicChannelsModalType?: string;
    myChannelMemberships: RelationOneToOne<Channel, ChannelMembership>;
    shouldHideJoinedChannels: boolean;
    rhsState?: RhsState;
    rhsOpen?: boolean;
    actions: Actions;
}

type State = {
    loading: boolean;
    shouldShowArchivedChannels: boolean;
    search: boolean;
    searchedChannels: Channel[];
    serverError: React.ReactNode | string;
    searching: boolean;
    searchTerm: string;
}

export default class MoreChannels extends React.PureComponent<Props, State> {
    public searchTimeoutId: number;
    activeChannels: Channel[] = [];

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;

        this.state = {
            loading: true,
            shouldShowArchivedChannels: this.props.morePublicChannelsModalType === 'private',
            search: false,
            searchedChannels: [],
            serverError: null,
            searching: false,
            searchTerm: '',
        };
    }

    componentDidMount() {
        this.props.actions.getChannels(this.props.teamId, 0, CHANNELS_CHUNK_SIZE * 2);
        if (this.props.canShowArchivedChannels) {
            this.props.actions.getArchivedChannels(this.props.teamId, 0, CHANNELS_CHUNK_SIZE * 2);
            // todo sinan allso get archived channels member count
        }
        if (this.props.channels.length > 0) {
            console.log("all channels: ", this.props.channels)
            this.props.actions.getChannelsMemberCount(this.props.channels.map((channel) => channel.id))
        }
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
        this.props.actions.getChannels(this.props.teamId, page + 1, CHANNELS_PER_PAGE);
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
            getHistory().push(getRelativeChannelURL(teamName, channel.name));
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
                    const {data} = await this.props.actions.searchMoreChannels(term, this.state.shouldShowArchivedChannels, this.props.shouldHideJoinedChannels);
                    if (searchTimeoutId !== this.searchTimeoutId) {
                        return;
                    }

                    if (data) {
                        this.setSearchResults(data);
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
        this.setState({searchedChannels: this.state.shouldShowArchivedChannels ? channels.filter((c) => c.delete_at !== 0) : channels.filter((c) => c.delete_at === 0), searching: false});
    };

    toggleArchivedChannels = (shouldShowArchivedChannels: boolean) => {
        // search again when switching channels to update search results
        this.search(this.state.searchTerm);
        this.setState({shouldShowArchivedChannels});
    };

    isMemberOfChannel(channelId: string) {
        return this.props.myChannelMemberships[channelId];
    }

    handleShowJoinedChannelsPreference = (shouldHideJoinedChannels: boolean) => {
        // search again when switching channels to update search results
        this.search(this.state.searchTerm);
        this.props.actions.setGlobalItem(StoragePrefixes.HIDE_JOINED_CHANNELS, shouldHideJoinedChannels.toString());
    };

    otherChannelsWithoutJoined = this.props.channels.filter((channel) => !this.isMemberOfChannel(channel.id));
    archivedChannelsWithoutJoined = this.props.archivedChannels.filter((channel) => !this.isMemberOfChannel(channel.id));

    render() {
        const {
            channels,
            archivedChannels,
            teamId,
            channelsRequestStarted,
            shouldHideJoinedChannels,
        } = this.props;

        const {
            search,
            searchedChannels,
            serverError: serverErrorState,
            searching,
            shouldShowArchivedChannels,
        } = this.state;

        const otherChannelsWithoutJoined = channels.filter((channel) => !this.isMemberOfChannel(channel.id));
        const archivedChannelsWithoutJoined = archivedChannels.filter((channel) => !this.isMemberOfChannel(channel.id));

        if (shouldShowArchivedChannels && shouldHideJoinedChannels) {
            this.activeChannels = search ? searchedChannels : archivedChannelsWithoutJoined;
        } else if (shouldShowArchivedChannels && !shouldHideJoinedChannels) {
            this.activeChannels = search ? searchedChannels : archivedChannels;
        } else if (!shouldShowArchivedChannels && shouldHideJoinedChannels) {
            this.activeChannels = search ? searchedChannels : otherChannelsWithoutJoined;
        } else {
            this.activeChannels = search ? searchedChannels : channels;
        }

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
                        aria-label={localizeMessage('more_channels.create', 'Create New Channel')}
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
                {createNewChannelButton('primaryButton', <i className='icon-plus' />)}
            </>
        );

        const body = this.state.loading ? <LoadingScreen /> : (
            <React.Fragment>
                <SearchableChannelList
                    channels={this.activeChannels}
                    channelsPerPage={CHANNELS_PER_PAGE}
                    nextPage={this.nextPage}
                    isSearch={search}
                    search={this.search}
                    handleJoin={this.handleJoin}
                    noResultsText={noResultsText}
                    loading={search ? searching : channelsRequestStarted}
                    toggleArchivedChannels={this.toggleArchivedChannels}
                    shouldShowArchivedChannels={this.state.shouldShowArchivedChannels}
                    canShowArchivedChannels={this.props.canShowArchivedChannels}
                    myChannelMemberships={this.props.myChannelMemberships}
                    closeModal={this.props.actions.closeModal}
                    hideJoinedChannelsPreference={this.handleShowJoinedChannelsPreference}
                    rememberHideJoinedChannelsChecked={shouldHideJoinedChannels}
                />
                {serverError}
            </React.Fragment>
        );

        const title = (
            <FormattedMessage
                id='more_channels.title'
                defaultMessage='Browse Channels'
            />
        );

        return (
            <GenericModal
                onExited={this.handleExit}
                id='moreChannelsModal'
                aria-labelledby='moreChannelsModalLabel'
                compassDesign={true}
                modalHeaderText={title}
                headerButton={createNewChannelButton('outlineButton')}
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
