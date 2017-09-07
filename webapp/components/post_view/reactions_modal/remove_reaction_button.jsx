// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as PostActions from 'actions/post_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class RemoveReactionButton extends React.Component {
    static propTypes = {
        post: PropTypes.object.isRequired,
        emojiName: PropTypes.string.isRequired
    }

    handleRemove = (e) => {
        const {post, emojiName} = this.props;
        e.preventDefault();
        PostActions.removeReaction(post.channe_id, post.id, emojiName);
    }

    render() {
        return (
            <button
                id='removeReaction'
                type='button'
                className='btn btn-danger btn-message'
                onClick={this.handleRemove}
            >
                <FormattedMessage
                    id='reaction.remove_reaction'
                    defaultMessage='Remove'
                />
            </button>
        );
    }
}
