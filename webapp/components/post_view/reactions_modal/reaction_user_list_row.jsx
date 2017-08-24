// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ProfilePicture from 'components/profile_picture.jsx';
import RemoveReactionButton from './remove_reaction_button.jsx';

import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';
import {Client4} from 'mattermost-redux/client';

import PropTypes from 'prop-types';

import React from 'react';

export default class ReactionUserListRow extends React.Component {
    static propTypes = {
        user: PropTypes.object.isRequired,
        post: PropTypes.object.isRequired,
        reactions: PropTypes.arrayOf(PropTypes.object).isRequired,
        emojiName: PropTypes.string.isRequired
    };

    static defaultProps = {
        user: {},
        post: {},
        reactions: [],
        emojiName: 'All'
    };

    render() {
        const {user, emojiName, reactions} = this.props;

        let status;
        if (user.status) {
            status = user.status;
        } else {
            status = UserStore.getStatus(user.id);
        }

        const currentUser = UserStore.getCurrentUser();
        let removeButton;
        if (user.id === currentUser.id && emojiName !== 'All') {
            removeButton = (
                <RemoveReactionButton
                    post={this.props.post}
                    emojiName={this.props.emojiName}
                />
            );
        }

        const emojiImage = reactions.map((reaction) => {
            return (
                <span
                    key={reaction.name}
                    className='emoji-picker__item-wrapper'
                >
                    <img
                        className='emoji-picker__item emoticon'
                        src={reaction.url}
                    />
                </span>
            );
        });

        return (
            <div
                key={user.id}
                className='more-modal__row'
            >
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    status={status}
                    width='32'
                    height='32'
                />
                <div className='more-modal__details'>
                    <div className='more-modal__name'>
                        {Utils.displayEntireNameForUser(user)}
                    </div>
                </div>
                <div className='more-modal__actions'>
                    {emojiImage}
                </div>
                <div className='more-modal__actions'>
                    {removeButton}
                </div>
            </div>
        );
    }
}
