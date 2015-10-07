// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var TeamStore = require('../stores/team_store.jsx');
var Client = require('../utils/client.jsx');
var Constants = require('../utils/constants.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var PreferenceStore = require('../stores/preference_store.jsx');
var utils = require('../utils/utils.jsx');

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.state = {channels: [], loadingDMChannel: -1};
    }

    componentDidMount() {
        $(React.findDOMNode(this.refs.modal)).on('show.bs.modal', (e) => {
            var button = e.relatedTarget;
            this.setState({channels: $(button).data('channels')}); // eslint-disable-line react/no-did-mount-set-state
        });
    }

    handleJoinDirectChannel(channel) {
        const preference = PreferenceStore.setPreferenceWithAltId(Constants.Preferences.CATEGORY_DIRECT_CHANNELS,
            Constants.Preferences.NAME_SHOW, channel.teammate_id, 'true');
        AsyncClient.setPreferences([preference]);
    }

    render() {
        var directMessageItems = this.state.channels.map((channel, index) => {
            var badge = '';
            var titleClass = '';
            var handleClick = null;

            if (channel.fake) {
                // It's a direct message channel that doesn't exist yet so let's create it now
                var otherUserId = utils.getUserIdFromChannelName(channel);

                if (this.state.loadingDMChannel === index) {
                    badge = (
                        <img
                            className='channel-loading-gif pull-right'
                            src='/static/images/load.gif'
                        />
                    );
                }

                if (this.state.loadingDMChannel === -1) {
                    handleClick = (e) => {
                        e.preventDefault();
                        this.setState({loadingDMChannel: index});
                        this.handleJoinDirectChannel(channel);

                        Client.createDirectChannel(channel, otherUserId,
                            (data) => {
                                $(React.findDOMNode(this.refs.modal)).modal('hide');
                                this.setState({loadingDMChannel: -1});
                                AsyncClient.getChannel(data.id);
                                utils.switchChannel(data);
                            },
                            () => {
                                this.setState({loadingDMChannel: -1});
                                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name;
                            }
                        );
                    };
                }
            } else {
                if (channel.unread) {
                    badge = <span className='badge pull-right small'>{channel.unread}</span>;
                    titleClass = 'unread-title';
                }

                handleClick = (e) => {
                    e.preventDefault();
                    this.handleJoinDirectChannel(channel);
                    utils.switchChannel(channel);
                    $(React.findDOMNode(this.refs.modal)).modal('hide');
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
                                <span aria-hidden='true'>{'×'}</span>
                                <span className='sr-only'>{'Close'}</span>
                            </button>
                            <h4 className='modal-title'>{'More Direct Messages'}</h4>
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
                            >{'Close'}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
