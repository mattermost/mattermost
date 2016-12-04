// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import LoadingScreen from './loading_screen.jsx';
import NewChannelFlow from './new_channel_flow.jsx';
import MoreChannelsList from './more_channels_list.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const config = global.window.mm_config;

export default class MoreChannelsNew extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleExit = this.handleExit.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleJoin = this.handleJoin.bind(this);
        this.handleNewChannel = this.handleNewChannel.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.search = this.search.bind(this);

        this.state = {
            channels: null,
            serverError: null,
            showNewChannelModal: false,
            show: true,
            search: ''
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        AsyncClient.getPaginatedChannels(Constants.CHANNELS_CHUNK_SIZE);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
    }

    handleHide() {
        this.setState({show: false});
    }

    handleExit() {
        if (this.exitToDirectChannel) {
            browserHistory.push(this.exitToDirectChannel);
        }

        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    }

    handleJoin(channel, done) {
        GlobalActions.emitJoinChannelEvent(
            channel,
            () => {
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
                this.handleHide();
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
        this.setState({showNewChannelModal: true});
    }

    closeNewChannel() {
        this.setState({showNewChannelModal: false, show: false});
    }

    getStateFromStores() {
        return {
            channels: ChannelStore.getPaginatedChannels(),
            serverError: null
        };
    }

    onChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState.channels, this.state.channels)) {
            this.setState(newState);
        }
    }

    nextPage(page) {
        AsyncClient.getPaginatedChannelsNext(page * Constants.CHANNELS_CHUNK_SIZE, Constants.CHANNELS_CHUNK_SIZE, this.state.search);
    }

    search(term) {
        this.setState({search: $.trim(term)});
        AsyncClient.getPaginatedChannels(Constants.CHANNELS_CHUNK_SIZE, term);
    }

    render() {
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
            if (config.RestrictPublicChannelManagement === Constants.PERMISSIONS_SYSTEM_ADMIN && !isSystemAdmin) {
                createNewChannelButton = null;
                createChannelHelpText = null;
            } else if (config.RestrictPublicChannelManagement === Constants.PERMISSIONS_TEAM_ADMIN && !isAdmin) {
                createNewChannelButton = null;
                createChannelHelpText = null;
            }
        }

        let moreChannels;
        const channels = this.state.channels;
        if (channels == null) {
            moreChannels = <LoadingScreen/>;
        } else if (this.state.search !== '' || Object.keys(channels).length > 0) {
            moreChannels = (
                <MoreChannelsList
                    ref='channelList'
                    channels={channels}
                    channelsPerPage={Constants.CHANNELS_CHUNK_SIZE}
                    handleJoin={this.handleJoin}
                    search={this.search}
                    nextPage={this.nextPage}
                    total={ChannelStore.getPaginatedChannelsCount()}
                />
            );
        } else {
            moreChannels = (
                <div className='no-channel-message'>
                    <p className='primary-message'>
                        <FormattedMessage
                            id='more_channels.noMore'
                            defaultMessage='No more channels to join'
                        />
                    </p>
                    {createChannelHelpText}
                </div>
            );
        }

        return (
            <Modal
                dialogClassName='more-modal more-direct-channels'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='more_channels.title'
                            defaultMessage='More Channels'
                        />
                    </Modal.Title>
                    {createNewChannelButton}
                    <NewChannelFlow
                        show={this.state.showNewChannelModal}
                        channelType={this.state.channelType}
                        onModalDismissed={() => this.closeNewChannel()}
                    />
                </Modal.Header>
                <Modal.Body>
                    {moreChannels}
                    {this.state.serverError &&
                        <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>
                    }
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        <FormattedMessage
                            id='more_channels.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

MoreChannelsNew.propTypes = {
    onModalDismissed: React.PropTypes.func
};
