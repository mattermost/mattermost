// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import LoadingScreen from './loading_screen.jsx';
import NewChannelFlow from './new_channel_flow.jsx';

import {FormattedMessage} from 'mm-intl';

function getStateFromStores() {
    return {
        channels: ChannelStore.getMoreAll(),
        serverError: null
    };
}

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
                AsyncClient.getChannel(channel.id);
                Utils.switchChannel(channel);
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
                    src='/static/images/load.gif'
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
            <tr key={channel.id}>
                <td className='more-row'>
                    <div className='more-details'>
                        <p className='more-name'>{channel.display_name}</p>
                        <p className='more-description'>{channel.purpose}</p>
                    </div>
                    <div className='more-actions'>
                        {joinButton}
                    </div>
                </td>
            </tr>
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
                    <table className='more-table table'>
                        <tbody>
                            {channels.map(this.createChannelRow)}
                        </tbody>
                    </table>
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
                className='modal fade'
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
