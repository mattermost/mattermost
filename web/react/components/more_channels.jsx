// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var asyncClient = require('../utils/async_client.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var NewChannelFlow = require('./new_channel_flow.jsx');

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

        var initState = getStateFromStores();
        initState.channelType = '';
        initState.joiningChannel = -1;
        initState.showNewChannelModal = false;
        this.state = initState;
    }
    componentDidMount() {
        ChannelStore.addMoreChangeListener(this.onListenerChange);
        $(ReactDOM.findDOMNode(this.refs.modal)).on('shown.bs.modal', function shown() {
            asyncClient.getMoreChannels(true);
        });

        var self = this;
        $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', function show(e) {
            var button = e.relatedTarget;
            self.setState({channelType: $(button).attr('data-channeltype')});
        });
    }
    componentWillUnmount() {
        ChannelStore.removeMoreChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        var newState = getStateFromStores();
        if (!utils.areObjectsEqual(newState.channels, this.state.channels)) {
            this.setState(newState);
        }
    }
    handleJoin(channel, channelIndex) {
        this.setState({joiningChannel: channelIndex});
        client.joinChannel(channel.id,
            function joinSuccess() {
                $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');
                asyncClient.getChannel(channel.id);
                utils.switchChannel(channel);
                this.setState({joiningChannel: -1});
            }.bind(this),
            function joinFail(err) {
                this.setState({joiningChannel: -1, serverError: err.message});
            }.bind(this)
        );
    }
    handleNewChannel() {
        $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');
        this.setState({showNewChannelModal: true});
    }
    render() {
        var serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var self = this;
        var moreChannels;

        if (this.state.channels != null) {
            var channels = this.state.channels;
            if (channels.loading) {
                moreChannels = <LoadingScreen />;
            } else if (channels.length) {
                moreChannels = (
                    <table className='more-table table'>
                        <tbody>
                            {channels.map(function cMap(channel, index) {
                                var joinButton;
                                if (self.state.joiningChannel === index) {
                                    joinButton = (
                                        <img
                                            className='join-channel-loading-gif'
                                            src='/static/images/load.gif'
                                        />
                                        );
                                } else {
                                    joinButton = (
                                        <button
                                            onClick={self.handleJoin.bind(self, channel, index)}
                                            className='btn btn-primary'
                                        >
                                            Join
                                        </button>
                                        );
                                }

                                return (
                                    <tr key={channel.id}>
                                        <td>
                                            <p className='more-name'>{channel.display_name}</p>
                                            <p className='more-purpose'>{channel.purpose}</p>
                                        </td>
                                        <td className='td--action'>
                                            {joinButton}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                );
            } else {
                moreChannels = (
                    <div className='no-channel-message'>
                       <p className='primary-message'>No more channels to join</p>
                       <p className='secondary-message'>Click 'Create New Channel' to make a new one</p>
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
                                <span className='sr-only'>{'Close'}</span>
                            </button>
                            <h4 className='modal-title'>{'More Channels'}</h4>
                            <button
                                type='button'
                                className='btn btn-primary channel-create-btn'
                                onClick={this.handleNewChannel}
                            >
                                {'Create New Channel'}
                            </button>
                            <NewChannelFlow
                                show={this.state.showNewChannelModal}
                                channelType={this.state.channelType}
                                onModalDismissed={() => this.setState({showNewChannelModal: false})}
                            />
                        </div>
                        <div className='modal-body'>
                            {moreChannels}
                            {serverError}
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >
                                {'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        );
    }
}
