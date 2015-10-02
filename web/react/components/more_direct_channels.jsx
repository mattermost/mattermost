// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var TeamStore = require('../stores/team_store.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var PreferenceStore = require('../stores/preference_store.jsx');
var utils = require('../utils/utils.jsx');

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.state = {channels: [], loadingDMChannel: -1};
    }

    componentDidMount() {
        var self = this;
        $(React.findDOMNode(this.refs.modal)).on('show.bs.modal', function showModal(e) {
            var button = e.relatedTarget;
            self.setState({channels: $(button).data('channels')});
        });
    }

    handleJoinDirectChannel(channel) {
        const preference = PreferenceStore.setPreferenceWithAltId('direct_channels', 'show_hide', channel.teammate_id, 'true');
        AsyncClient.setPreferences([preference]);
    }

    render() {
        var self = this;

        var directMessageItems = this.state.channels.map((channel, index) => {
            var badge = '';
            var titleClass = '';
            var handleClick = null;

            if (!channel.fake) {
                if (channel.unread) {
                    badge = <span className='badge pull-right small'>{channel.unread}</span>;
                    titleClass = 'unread-title';
                }

                handleClick = (e) => {
                    e.preventDefault();
                    this.handleJoinDirectChannel(channel);
                    utils.switchChannel(channel);
                    $(React.findDOMNode(self.refs.modal)).modal('hide');
                };
            } else {
                // It's a direct message channel that doesn't exist yet so let's create it now
                var otherUserId = utils.getUserIdFromChannelName(channel);

                if (self.state.loadingDMChannel === index) {
                    badge = (
                        <img
                            className='channel-loading-gif pull-right'
                            src='/static/images/load.gif'
                        />
                    );
                }

                if (self.state.loadingDMChannel === -1) {
                    handleClick = (e) => {
                        e.preventDefault();
                        self.setState({loadingDMChannel: index});
                        this.handleJoinDirectChannel(channel);

                        Client.createDirectChannel(channel, otherUserId,
                            function success(data) {
                                $(React.findDOMNode(self.refs.modal)).modal('hide');
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
            } else {
                if (channel.id === ChannelStore.getCurrentId()) {
                    active = 'active';
                }

                if (channel.unread) {
                    badge = <span className='badge pull-right small'>{channel.unread}</span>;
                    titleClass = 'unread-title';
                }

                handleClick = function clickHandler(e) {
                    e.preventDefault();
                    utils.switchChannel(channel);
                    $(React.findDOMNode(self.refs.modal)).modal('hide');
                };
            }

            return (
                <li key={channel.name}>
                    <a
                        className={'sidebar-channel ' + titleClass}
                        href='#'
                        onClick={handleClick}
                    >{badge}{channel.display_name}</a>
                </li>
            );
        });

        return (
            <div
                className='modal fade'
                id='more_direct_channels'
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
                                <span aria-hidden='true'>&times;</span>
                                <span className='sr-only'>Close</span>
                            </button>
                            <h4 className='modal-title'>More Direct Messages</h4>
                        </div>
                        <div className='modal-body'>
                            <ul className='nav nav-pills nav-stacked'>
                                {directMessageItems}
                            </ul>
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >Close</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
