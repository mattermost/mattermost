// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import NewChannelFlow from './new_channel_flow.jsx';
import SearchableChannelList from './searchable_channel_list.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import Constants from 'utils/constants.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import {joinChannel, searchMoreChannels} from 'actions/channel_actions.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const CHANNELS_CHUNK_SIZE = 50;
const CHANNELS_PER_PAGE = 50;
const SEARCH_TIMEOUT_MILLISECONDS = 100;

export default class MoreChannels extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.handleJoin = this.handleJoin.bind(this);
        this.handleNewChannel = this.handleNewChannel.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.search = this.search.bind(this);

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.searchTimeoutId = 0;

        this.state = {
            channelType: '',
            showNewChannelModal: false,
            search: false,
            channels: null,
            serverError: null
        };
    }

    componentDidMount() {
        const self = this;
        ChannelStore.addChangeListener(this.onChange);

        $(this.refs.modal).on('shown.bs.modal', () => {
            AsyncClient.getMoreChannelsPage(0, CHANNELS_CHUNK_SIZE * 2);
        });

        $(this.refs.modal).on('show.bs.modal', (e) => {
            const button = e.relatedTarget;
            self.setState({channelType: $(button).attr('data-channeltype')});
        });
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
    }

    onChange(force) {
        if (this.state.search && !force) {
            return;
        }

        this.setState({
            channels: ChannelStore.getMoreChannelsList(),
            serverError: null
        });
    }

    nextPage(page) {
        AsyncClient.getMoreChannelsPage((page + 1) * CHANNELS_PER_PAGE, CHANNELS_PER_PAGE);
    }

    handleJoin(channel, done) {
        joinChannel(
            channel,
            () => {
                $(this.refs.modal).modal('hide');
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
                if (done) {
                    done();
                }
            },
            (err) => {
                this.setState({serverError: err.message});
                if (done) {
                    done();
                }
            }
        );
    }

    handleNewChannel() {
        $(this.refs.modal).modal('hide');
        this.setState({showNewChannelModal: true});
    }

    search(term) {
        if (term === '') {
            this.onChange(true);
            this.setState({search: false});
            return;
        }

        clearTimeout(this.searchTimeoutId);

        this.searchTimeoutId = setTimeout(
            () => {
                searchMoreChannels(
                    term,
                    (channels) => {
                        this.setState({search: true, channels});
                    }
                );
            },
            SEARCH_TIMEOUT_MILLISECONDS
        );
    }

    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        let createNewChannelButton = (
            <button
                type='button'
                className='btn btn-primary channel-create-btn'
                onClick={this.handleNewChannel}
            >
                <FormattedMessage
                    id='more_channels.create'
                    defaultMessage='Create New Channel'
                />
            </button>
        );

        let createChannelHelpText = (
            <p className='secondary-message'>
                <FormattedMessage
                    id='more_channels.createClick'
                    defaultMessage="Click 'Create New Channel' to make a new one"
                />
            </p>
        );

        const isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

        if (global.window.mm_license.IsLicensed === 'true') {
            if (global.window.mm_config.RestrictPublicChannelManagement === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                createNewChannelButton = null;
                createChannelHelpText = null;
            } else if (global.window.mm_config.RestrictPublicChannelManagement === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                createNewChannelButton = null;
                createChannelHelpText = null;
            }
        }

        return (
            <div
                className='modal fade more-channel__modal'
                id='more_channels'
                ref='modal'
                tabIndex='-1'
                role='dialog'
                aria-hidden='true'
            >
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                            >
                                <span aria-hidden='true'>{'×'}</span>
                                <span className='sr-only'>
                                    <FormattedMessage
                                        id='more_channels.close'
                                        defaultMessage='Close'
                                    />
                                </span>
                            </button>
                            <h4 className='modal-title'>
                                <FormattedMessage
                                    id='more_channels.title'
                                    defaultMessage='More Channels'
                                />
                            </h4>
                            {createNewChannelButton}
                            <NewChannelFlow
                                show={this.state.showNewChannelModal}
                                channelType={this.state.channelType}
                                onModalDismissed={() => this.setState({showNewChannelModal: false})}
                            />
                        </div>
                        <div className='modal-body'>
                            <SearchableChannelList
                                channels={this.state.channels}
                                channelsPerPage={CHANNELS_PER_PAGE}
                                nextPage={this.nextPage}
                                search={this.search}
                                handleJoin={this.handleJoin}
                                noResultsText={createChannelHelpText}
                            />
                            {serverError}
                        </div>
                    </div>
                </div>
            </div>

        );
    }
}
