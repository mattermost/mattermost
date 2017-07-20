// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ProfilePopover from 'components/profile_popover.jsx';
import {Client4} from 'mattermost-redux/client';

import UserStore from 'stores/user_store.jsx';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import React from 'react';
import PropTypes from 'prop-types';
import {OverlayTrigger} from 'react-bootstrap';

export default class AtMention extends React.PureComponent {
    static propTypes = {
        mentionName: PropTypes.string.isRequired,
        usersByUsername: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            getUserByUsername: PropTypes.func.isRequired
        }).isRequired
    };

    constructor(props) {
        super(props);

        this.hideProfilePopover = this.hideProfilePopover.bind(this);

        const username = this.getUsernameFromMentionName(props);
        const user = this.getProfileByUsername(username);

        this.state = {
            username,
            user
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.mentionName !== this.props.mentionName || nextProps.usersByUsername !== this.props.usersByUsername) {
            const username = this.getUsernameFromMentionName(nextProps);
            const user = this.getProfileByUsername(username);

            this.setState({
                username,
                user
            });
        }
    }

    hideProfilePopover() {
        this.refs.overlay.hide();
    }

    getUsernameFromMentionName(props) {
        let mentionName = props.mentionName;

        while (mentionName.length > 0) {
            if (props.usersByUsername[mentionName]) {
                return props.usersByUsername[mentionName].username;
            }

            // Repeatedly trim off trailing punctuation in case this is at the end of a sentence
            if ((/[._-]$/).test(mentionName)) {
                mentionName = mentionName.substring(0, mentionName.length - 1);
            } else {
                break;
            }
        }

        return '';
    }

    getProfileByUsername(username) {
        if (!username) {
            return '';
        }

        let profile = UserStore.getProfileByUsername(username);
        if (!profile) {
            this.props.actions.getUserByUsername(username)(dispatch, getState).then(
                (data) => {
                    if (data) {
                        profile = data;
                    }
                }
            );
        }

        return profile;
    }

    render() {
        const username = this.state.username;
        const user = this.state.user;

        if (!username || !user) {
            return <span>{'@' + this.props.mentionName}</span>;
        }

        const suffix = this.props.mentionName.substring(username.length);

        return (
            <OverlayTrigger
                ref='overlay'
                trigger='click'
                placement='right'
                rootClose={true}
                overlay={
                    <ProfilePopover
                        user={user}
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        hide={this.hideProfilePopover}
                    />
                }
            >
                <span>
                    <a className='mention-link'>{'@' + username}</a>
                    {suffix}
                </span>
            </OverlayTrigger>
        );
    }
}
