// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var asyncClient = require('../utils/async_client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var LoadingScreen = require('./loading_screen.jsx');

function getStateFromStores() {
  return {
    channels: ChannelStore.getMoreAll(),
    server_error: null
  };
}

module.exports = React.createClass({
    displayName: "MoreChannelsModal",

    componentDidMount: function() {
        ChannelStore.addMoreChangeListener(this._onChange);
        $(this.refs.modal.getDOMNode()).on('shown.bs.modal', function (e) {
            asyncClient.getMoreChannels(true);
        });

        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            self.setState({ channel_type: $(button).attr('data-channeltype') });
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
        initState.channel_type = "";
        return initState;
    },
    handleJoin: function(e) {
        var self = this;
        client.joinChannel(e,
            function(data) {
                $(self.refs.modal.getDOMNode()).modal('hide');
                asyncClient.getChannels(true);
            }.bind(this),
            function(err) {
                this.state.server_error = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    handleNewChannel: function() {
        $(this.refs.modal.getDOMNode()).modal('hide');
    },
    render: function() {
        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;
        var outter = this;
        var moreChannels;

        if (this.state.channels != null)
            moreChannels = this.state.channels;

        return (
            <div className="modal fade" id="more_channels" ref="modal" tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal">
                                <span aria-hidden="true">&times;</span>
                                <span className="sr-only">Close</span>
                            </button>
                            <h4 className="modal-title">More Channels</h4>
                            <button data-toggle="modal" data-target="#new_channel" data-channeltype={this.state.channel_type} type="button" className="btn btn-primary channel-create-btn" onClick={this.handleNewChannel}>Create New Channel</button>
                        </div>
                        <div className="modal-body">
                            {!moreChannels.loading ?
                                (moreChannels.length ?
                                    <table className="more-channel-table table">
                                        <tbody>
                                            {moreChannels.map(function(channel) {
                                                return (
                                                    <tr key={channel.id}>
                                                        <td>
                                                            <p className="more-channel-name">{channel.display_name}</p>
                                                            <p className="more-channel-description">{channel.description}</p>
                                                        </td>
                                                        <td className="td--action"><button onClick={outter.handleJoin.bind(outter, channel.id)} className="btn btn-primary">Join</button></td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                    :   <div className="no-channel-message">
                                            <p className="primary-message">No more channels to join</p>
                                            <p className="secondary-message">Click 'Create New Channel' to make a new one</p>
                                        </div>)
                            :   <LoadingScreen /> }
                            { server_error }
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>

        );
    }
});
