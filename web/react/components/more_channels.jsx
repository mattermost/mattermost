// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var asyncClient = require('../utils/async_client.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var LoadingScreen = require('./loading_screen.jsx');

function getStateFromStores() {
    return {
        channels: ChannelStore.getMoreAll(),
        serverError: null
    };
}

module.exports = React.createClass({
    displayName: 'MoreChannelsModal',

    componentDidMount: function() {
        ChannelStore.addMoreChangeListener(this._onChange);
        $(this.refs.modal.getDOMNode()).on('shown.bs.modal', function shown() {
            asyncClient.getMoreChannels(true);
        });

        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function show(e) {
            var button = e.relatedTarget;
            self.setState({channelType: $(button).attr('data-channeltype')});
        });
    },
    componentWillUnmount: function() {
        ChannelStore.removeMoreChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState.channels, this.state.channels)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        var initState = getStateFromStores();
        initState.channelType = '';
        return initState;
    },
    handleJoin: function(id) {
        client.joinChannel(id,
            function() {
                $(this.refs.modal.getDOMNode()).modal('hide');
                asyncClient.getChannel(id);
            }.bind(this),
            function(err) {
                this.state.serverError = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    handleNewChannel: function() {
        $(this.refs.modal.getDOMNode()).modal('hide');
    },
    render: function() {
        var serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var outter = this;
        var moreChannels;

        if (this.state.channels != null) {
            var channels = this.state.channels;
            if (!channels.loading) {
                if (channels.length) {
                    moreChannels = (
                        <table className='more-channel-table table'>
                            <tbody>
                                {channels.map(function cMap(channel) {
                                    return (
                                        <tr key={channel.id}>
                                            <td>
                                                <p className='more-channel-name'>{channel.display_name}</p>
                                                <p className='more-channel-description'>{channel.description}</p>
                                            </td>
                                            <td className='td--action'><button onClick={outter.handleJoin.bind(outter, channel.id)} className='btn btn-primary'>Join</button></td>
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
            } else {
                moreChannels = <LoadingScreen />;
            }
        }

        return (
            <div className='modal fade' id='more_channels' ref='modal' tabIndex='-1' role='dialog' aria-hidden='true'>
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button type='button' className='close' data-dismiss='modal'>
                                <span aria-hidden='true'>&times;</span>
                                <span className='sr-only'>Close</span>
                            </button>
                            <h4 className='modal-title'>More Channels</h4>
                            <button data-toggle='modal' data-target='#new_channel' data-channeltype={this.state.channelType} type='button' className='btn btn-primary channel-create-btn' onClick={this.handleNewChannel}>Create New Channel</button>
                        </div>
                        <div className='modal-body'>
                            {moreChannels}
                            {serverError}
                        </div>
                        <div className='modal-footer'>
                            <button type='button' className='btn btn-default' data-dismiss='modal'>Close</button>
                        </div>
                    </div>
                </div>
            </div>

        );
    }
});
