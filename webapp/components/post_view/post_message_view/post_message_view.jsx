// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

import * as PostUtils from 'utils/post_utils.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';

import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Posts} from 'mattermost-redux/constants';
import store from 'stores/redux_store.jsx';

import {renderSystemMessage} from './system_message_helpers.jsx';

export default class PostMessageView extends React.PureComponent {
    static propTypes = {

        /*
         * The post to render the message for
         */
        post: PropTypes.object.isRequired,

        /*
         * Object using emoji names as keys with custom emojis as the values
         */
        emojis: PropTypes.object.isRequired,

        /*
         *
         */
        team: PropTypes.object.isRequired,

        /*
         * Set to enable Markdown formatting
         */
        enableFormatting: PropTypes.bool,

        /*
         * An array of words that can be used to mention a user
         */
        mentionKeys: PropTypes.arrayOf(PropTypes.string),

        /*
         * Object mapping usernames to users
         */
        usernameMap: PropTypes.object,

        /*
         * The URL that the app is hosted on
         */
        siteUrl: PropTypes.string,

        /*
         * Options specific to text formatting
         */
        options: PropTypes.object,

        /*
         * Post identifiers for selenium tests
         */
        lastPostCount: PropTypes.number
    };

    static defaultProps = {
        options: {},
        mentionKeys: [],
        usernameMap: {}
    };

    renderDeletedPost() {
        return (
            <p>
                <FormattedMessage
                    id='post_body.deleted'
                    defaultMessage='(message deleted)'
                />
            </p>
        );
    }

    renderEditedIndicator() {
        if (!PostUtils.isEdited(this.props.post)) {
            return null;
        }

        return (
            <span className='post-edited-indicator'>
                <FormattedMessage
                    id='post_message_view.edited'
                    defaultMessage='(edited)'
                />
            </span>
        );
    }

    render() {
        if (this.props.post.state === Posts.POST_DELETED) {
            return this.renderDeletedPost();
        }

        if (!this.props.enableFormatting) {
            return <span>{this.props.post.message}</span>;
        }

        const options = Object.assign({}, this.props.options, {
            emojis: this.props.emojis,
            siteURL: this.props.siteUrl,
            mentionKeys: this.props.mentionKeys,
            usernameMap: this.props.usernameMap,
            channelNamesMap: getChannelsNameMapInCurrentTeam(store.getState()),
            team: this.props.team
        });

        const renderedSystemMessage = renderSystemMessage(this.props.post, options);
        if (renderedSystemMessage) {
            return <div>{renderedSystemMessage}</div>;
        }

        let postId = null;
        if (this.props.lastPostCount >= 0) {
            postId = Utils.createSafeId('lastPostMessageText' + this.props.lastPostCount);
        }

        return (
            <div>
                <span
                    id={postId}
                    className='post-message__text'
                    onClick={Utils.handleFormattedTextClick}
                    dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.post.message, options)}}
                />
                {this.renderEditedIndicator()}
            </div>
        );
    }
}
