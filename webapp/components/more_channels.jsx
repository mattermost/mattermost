// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import LoadingScreen from './loading_screen.jsx';
import NewChannelFlow from './new_channel_flow.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router';

import loadingGif from 'images/load.gif';

function getStateFromStores() {
    return {
        channels: ChannelStore.getMoreAll(),
        serverError: null
    };
}

import React from 'react';

export default class MoreChannels extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleJoin = this.handleJoin.bind(this);
        this.handleNewChannel = this.handleNewChannel.bind(this);
        this.createChannelRow = this.createChannelRow.bind(this);

        var initState = getStateFromStores();
        initState.channelType = '';
        initState.joiningChannel = -1;
        initState.showNewChannelModal = false;
        this.state = initState;
    }
    componentDidMount() {
        ChannelStore.addMoreChangeListener(this.onListenerChange);
        $(ReactDOM.findDOMNode(this.refs.modal)).on('shown.bs.modal', () => {
            AsyncClient.getMoreChannels(true);
        });

        var self = this;
        $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', (e) => {
            var button = e.relatedTarget;
            self.setState({channelType: $(button).attr('data-channeltype')});
        });
    }
    componentWillUnmount() {
        ChannelStore.removeMoreChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        var newState = getStateFromStores();
        if (!Utils.areObjectsEqual(newState.channels, this.state.channels)) {
            this.setState(newState);
        }
    }
    handleJoin(channel, channelIndex) {
        this.setState({joiningChannel: channelIndex});
        client.joinChannel(channel.id,
            () => {
                $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');
                browserHistory.push(Utils.getTeamURLNoOriginFromAddressBar() + '/channels/' + channel.name);
                this.setState({joiningChannel: -1});
            },
            (err) => {
                this.setState({joiningChannel: -1, serverError: err.message});
            }
        );
    }
    handleNewChannel() {
        $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');
        this.setState({showNewChannelModal: true});
    }
    createChannelRow(channel, index) {
        let joinButton;
        if (this.state.joiningChannel === index) {
            joinButton = (
                <img
                    className='join-channel-loading-gif'
                    src={loadingGif}
                />
            );
        } else {
            joinButton = (
                <button
                    onClick={this.handleJoin.bind(self, channel, index)}
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='more_channels.join'
                        defaultMessage='Join'
                    />
                </button>
            );
        }

        return (
            <div
                className='more-modal__row'
                key={channel.id}
            >
                <div className='more-modal__details'>
                    <p className='more-modal__name'>{channel.display_name}</p>
                    <p className='more-modal__description'>{channel.purpose}</p>
                </div>
                <div className='more-modal__actions'>
                    {joinButton}
                </div>
            </div>
        );
    }
    render() {
        let maxHeight = 1000;
        if (Utils.windowHeight() <= 1200) {
            maxHeight = Utils.windowHeight() - 300;
        }

        var serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var moreChannels;

        if (this.state.channels != null) {
            var channels = this.state.channels;
            if (channels.loading) {
                moreChannels = <LoadingScreen/>;
            } else if (channels.length) {
                moreChannels = (
                    <div className='more-modal__list'>
                        {channels.map(this.createChannelRow)}
                    </div>
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
                        <p className='secondary-message'>
                            <FormattedMessage
                                id='more_channels.createClick'
                                defaultMessage="Click 'Create New Channel' to make a new one"
                            />
                        </p>
                    </div>
                );
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
                            <NewChannelFlow
                                show={this.state.showNewChannelModal}
                                channelType={this.state.channelType}
                                onModalDismissed={() => this.setState({showNewChannelModal: false})}
                            />
                        </div>
                        <div
                            className='modal-body'
                            style={{maxHeight}}
                        >
                            {moreChannels}
                            {serverError}
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >
                                <FormattedMessage
                                    id='more_channels.close'
                                    defaultMessage='Close'
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        );
    }
}
