// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
var Popover = ReactBootstrap.Popover;
var Overlay = ReactBootstrap.Overlay;
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

import ChannelStore from '../stores/channel_store.jsx';

import {FormattedMessage} from 'mm-intl';

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

    componentDidUpdate() {
        $(ReactDOM.findDOMNode(this.refs.memebersPopover)).find('.popover-content').perfectScrollbar();
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        Utils.openDirectChannelToUser(
            teammate,
            (channel, channelAlreadyExisted) => {
                Utils.switchChannel(channel);
                if (channelAlreadyExisted) {
                    this.closePopover();
                }
            },
            () => {
                this.closePopover();
            }
        );
    }

    closePopover() {
        this.setState({showPopover: false});
    }

    render() {
        const popoverHtml = [];
        const members = this.props.members;
        const teamMembers = UserStore.getProfilesUsernameMap();
        const currentUserId = UserStore.getCurrentId();
        const ch = ChannelStore.getCurrent();

        if (members && teamMembers) {
            members.sort((a, b) => {
                const aName = Utils.displayUsername(a.id);
                const bName = Utils.displayUsername(b.id);

                return aName.localeCompare(bName);
            });

            members.forEach((m, i) => {
                let button = '';
                if (currentUserId !== m.id && ch.type !== 'D') {
                    button = (
                        <a
                            href='#'
                            className='btn-message'
                            onClick={(e) => this.handleShowDirectChannel(m, e)}
                        >
                            <FormattedMessage
                                id='members_popover.msg'
                                defaultMessage='Message'
                            />
                        </a>
                    );
                }

                let name = '';
                if (teamMembers[m.username]) {
                    name = Utils.displayUsername(teamMembers[m.username].id);
                }

                if (name) {
                    popoverHtml.push(
                        <div
                            className='text-nowrap'
                            key={'popover-member-' + i}
                        >

                            <img
                                className='profile-img rounded pull-left'
                                width='26px'
                                height='26px'
                                src={`/api/v1/users/${m.id}/image?time=${m.update_at}`}
                            />
                            <div className='pull-left'>
                                <div
                                    className='more-name'
                                >
                                    {name}
                                </div>
                            </div>
                            <div
                                className='pull-right'
                            >
                                {button}
                            </div>
                        </div>
                    );
                }
            });
        }

        let count = this.props.memberCount;
        let countText = '-';

        // fall back to checking the length of the member list if the count isn't set
        if (!count && members) {
            count = members.length;
        }

        if (count > Constants.MAX_CHANNEL_POPOVER_COUNT) {
            countText = Constants.MAX_CHANNEL_POPOVER_COUNT + '+';
        } else if (count > 0) {
            countText = count.toString();
        }

        const title = (
            <FormattedMessage
                id='members_popover.title'
                defaultMessage='Members'
            />
        );
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
                        ref='memebersPopover'
                        title={title}
                        id='member-list-popover'
                    >
                        {popoverHtml}
                    </Popover>
                </Overlay>
            </div>
        );
    }
}

PopoverListMembers.propTypes = {
    members: React.PropTypes.array.isRequired,
    memberCount: React.PropTypes.number,
    channelId: React.PropTypes.string.isRequired
};
