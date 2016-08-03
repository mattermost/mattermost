// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import {Popover, Overlay} from 'react-bootstrap';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import Client from 'client/web_client.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

import React from 'react';

export default class PopoverListMembers extends React.Component {
    constructor(props) {
        super(props);

        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.closePopover = this.closePopover.bind(this);
    }

    componentDidUpdate() {
        $('.member-list__popover .popover-content').perfectScrollbar();
    }

    componentWillMount() {
        this.setState({showPopover: false});
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        Utils.openDirectChannelToUser(
            teammate,
            (channel, channelAlreadyExisted) => {
                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name);
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

        if (members && teamMembers) {
            members.sort((a, b) => {
                const aName = Utils.displayUsername(a.id);
                const bName = Utils.displayUsername(b.id);

                return aName.localeCompare(bName);
            });

            members.forEach((m, i) => {
                let button = '';
                if (currentUserId !== m.id && this.props.channel.type !== 'D') {
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
                    if (!m.status) {
                        var status = UserStore.getStatus(m.id);
                        m.status = status ? 'status-' + status : '';
                    }
                    popoverHtml.push(
                        <div
                            className='more-modal__row'
                            key={'popover-member-' + i}
                        >

                            <span className={`more-modal__image-wrapper ${m.status}`}>
                                <img
                                    className='more-modal__image'
                                    width='26px'
                                    height='26px'
                                    src={`${Client.getUsersRoute()}/${m.id}/image?time=${m.update_at}`}
                                />
                            </span>
                            <div className='more-modal__details'>
                                <div
                                    className='more-modal__name'
                                >
                                    {name}
                                </div>
                            </div>
                            <div
                                className='more-modal__actions'
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
                    className='member-popover__trigger'
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
                        className='member-list__popover'
                        id='member-list-popover'
                    >
                        <div className='more-modal__list'>{popoverHtml}</div>
                    </Popover>
                </Overlay>
            </div>
        );
    }
}

PopoverListMembers.propTypes = {
    channel: React.PropTypes.object.isRequired,
    members: React.PropTypes.array.isRequired,
    memberCount: React.PropTypes.number
};
