// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName: 'MoreDirectChannels',
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function showModal(e) {
            var button = e.relatedTarget;
            self.setState({channels: $(button).data('channels')});
        });
    },
    getInitialState: function() {
        return {channels: [], loadingDMChannel: -1};
    },
    render: function() {
        var self = this;

        var directMessageItems = this.state.channels.map(function mapActivityToChannel(channel, index) {
            var badge = '';
            var titleClass = '';
            var active = '';
            var handleClick = null;

            if (!channel.fake) {
                if (channel.id === ChannelStore.getCurrentId()) {
                    active = 'active';
                }

                if (channel.unread) {
                    badge = <span className='badge pull-right small'>{channel.unread}</span>;
                    titleClass = 'unread-title';
                }

                handleClick = function clickHandler(e) {
                    e.preventDefault();
                    utils.switchChannel(channel, channel.teammate_username);
                    $(self.refs.modal.getDOMNode()).modal('hide');
                };
            } else {
                // It's a direct message channel that doesn't exist yet so let's create it now
                var otherUserId = utils.getUserIdFromChannelName(channel);

                if (self.state.loadingDMChannel === index) {
                    badge = <img className='channel-loading-gif pull-right' src='/static/images/load.gif'/>;
                }

                if (self.state.loadingDMChannel === -1) {
                    handleClick = function clickHandler(e) {
                        e.preventDefault();
                        self.setState({loadingDMChannel: index});

                        Client.createDirectChannel(channel, otherUserId,
                            function success(data) {
                                $(self.refs.modal.getDOMNode()).modal('hide');
                                self.setState({loadingDMChannel: -1});
                                AsyncClient.getChannel(data.id);
                                utils.switchChannel(data);
                            },
                            function error() {
                                self.setState({loadingDMChannel: -1});
                                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name;
                            }
                        );
                    };
                }
            }

            return (
                <li key={channel.name} className={active}><a className={'sidebar-channel ' + titleClass} href='#' onClick={handleClick}>{badge}{channel.display_name}</a></li>
            );
        });

        return (
            <div className='modal fade' id='more_direct_channels' ref='modal' tabIndex='-1' role='dialog' aria-hidden='true'>
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button type='button' className='close' data-dismiss='modal'>
                                <span aria-hidden='true'>&times;</span>
                                <span className='sr-only'>Close</span>
                            </button>
                            <h4 className='modal-title'>More Private Messages</h4>
                        </div>
                        <div className='modal-body'>
                            <ul className='nav nav-pills nav-stacked'>
                                {directMessageItems}
                            </ul>
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
