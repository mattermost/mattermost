// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var Popover = ReactBootstrap.Popover;
var Overlay = ReactBootstrap.Overlay;
const Utils = require('../utils/utils.jsx');

const ChannelStore = require('../stores/channel_store.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const PreferenceStore = require('../stores/preference_store.jsx');
const Client = require('../utils/client.jsx');
const TeamStore = require('../stores/team_store.jsx');

const Constants = require('../utils/constants.jsx');

export default class PopoverListMembers extends React.Component {
    constructor(props) {
        super(props);

        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.closePopover = this.closePopover.bind(this);
    }

    componentWillMount() {
        this.setState({showPopover: false});
    }

    componentDidMount() {
        const originalLeave = $.fn.popover.Constructor.prototype.leave;
        $.fn.popover.Constructor.prototype.leave = function onLeave(obj) {
            let selfObj;
            if (obj instanceof this.constructor) {
                selfObj = obj;
            } else {
                selfObj = $(obj.currentTarget)[this.type](this.getDelegateOptions()).data(`bs.${this.type}`);
            }
            originalLeave.call(this, obj);

            if (obj.currentTarget && selfObj.$tip) {
                selfObj.$tip.one('mouseenter', function onMouseEnter() {
                    clearTimeout(selfObj.timeout);
                    selfObj.$tip.one('mouseleave', function onMouseLeave() {
                        $.fn.popover.Constructor.prototype.leave.call(selfObj, selfObj);
                    });
                });
            }
        };
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        const channelName = Utils.getDirectChannelName(UserStore.getCurrentId(), teammate.id);
        let channel = ChannelStore.getByName(channelName);

        const preference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammate.id, 'true');
        AsyncClient.savePreferences([preference]);

        if (channel) {
            Utils.switchChannel(channel);
            this.closePopover();
        } else {
            channel = {
                name: channelName,
                last_post_at: 0,
                total_msg_count: 0,
                type: 'D',
                display_name: teammate.username,
                teammate_id: teammate.id,
                status: UserStore.getStatus(teammate.id)
            };

            Client.createDirectChannel(
                channel,
                teammate.id,
                (data) => {
                    AsyncClient.getChannel(data.id);
                    Utils.switchChannel(data);

                    this.closePopover();
                },
                () => {
                    window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/' + channelName;
                    this.closePopover();
                }
            );
        }
    }

    closePopover() {
        this.setState({showPopover: false});
    }

    render() {
        let popoverHtml = [];
        let count = 0;
        let countText = '-';
        const members = this.props.members;
        const teamMembers = UserStore.getProfilesUsernameMap();
        const currentUserId = UserStore.getCurrentId();
        const ch = ChannelStore.getCurrent();

        if (members && teamMembers) {
            members.sort((a, b) => {
                return a.username.localeCompare(b.username);
            });

            members.forEach((m, i) => {
                const details = [];

                const fullName = Utils.getFullName(m);
                if (fullName) {
                    details.push(
                        <span
                            key={`${m.id}__full-name`}
                            className='full-name'
                        >
                            {fullName}
                        </span>
                    );
                }

                if (m.nickname) {
                    const separator = fullName ? ' - ' : '';
                    details.push(
                        <span
                            key={`${m.nickname}__nickname`}
                        >
                            {separator + m.nickname}
                        </span>
                    );
                }

                let button = '';
                if (currentUserId !== m.id && ch.type !== 'D') {
                    button = (
                        <button
                            type='button'
                            className='btn btn-primary btn-message'
                            onClick={(e) => this.handleShowDirectChannel(m, e)}
                        >
                            {'Message'}
                        </button>
                    );
                }

                if (teamMembers[m.username] && teamMembers[m.username].delete_at <= 0) {
                    popoverHtml.push(
                        <div
                            className='text--nowrap'
                            key={'popover-member-' + i}
                        >

                            <img
                                className='profile-img pull-left'
                                width='38'
                                height='38'
                                src={`/api/v1/users/${m.id}/image?time=${m.update_at}&${Utils.getSessionIndex()}`}
                            />
                            <div className='pull-left'>
                                <div
                                    className='more-name'
                                >
                                    {m.username}
                                </div>
                                <div
                                    className='more-description'
                                >
                                    {details}
                                </div>
                            </div>
                            <div
                                className='pull-right profile-action'
                            >
                                {button}
                            </div>
                        </div>
                    );
                    count++;
                }
            });

            if (count > 20) {
                countText = '20+';
            } else if (count > 0) {
                countText = count.toString();
            }
        }

        return (
            <div>
                <div
                    id='member_popover'
                    ref='member_popover_target'
                    onClick={(e) => this.setState({popoverTarget: e.target, showPopover: !this.state.showPopover})}
                >
                    <div>
                        {countText}
                        <span
                            className='fa fa-user'
                            aria-hidden='true'
                        />
                    </div>
                </div>
                <Overlay
                    rootClose={true}
                    onHide={this.closePopover}
                    show={this.state.showPopover}
                    target={() => this.state.popoverTarget}
                    placement='bottom'
                >
                    <Popover
                        title='Members'
                        id='member-list-popover'
                    >
                        <div>
                            {popoverHtml}
                        </div>
                    </Popover>
                </Overlay>
            </div>
        );
    }
}

PopoverListMembers.propTypes = {
    members: React.PropTypes.array.isRequired,
    channelId: React.PropTypes.string.isRequired
};
