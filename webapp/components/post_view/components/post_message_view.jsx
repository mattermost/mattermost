// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Constants from 'utils/constants.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';
import {getSiteURL} from 'utils/url.jsx';

import {renderSystemMessage} from './system_message_helpers.jsx';

export default class PostMessageView extends React.Component {
    static propTypes = {
        options: React.PropTypes.object.isRequired,
        post: React.PropTypes.object.isRequired,
        emojis: React.PropTypes.object.isRequired,
        enableFormatting: React.PropTypes.bool.isRequired,
        mentionKeys: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
        usernameMap: React.PropTypes.object.isRequired,
        channelNamesMap: React.PropTypes.object.isRequired,
        team: React.PropTypes.object.isRequired,
        isLastPost: React.PropTypes.bool
    };

    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.options, this.props.options)) {
            return true;
        }

        if (nextProps.post.message !== this.props.post.message) {
            return true;
        }

        if (nextProps.post.state !== this.props.post.state) {
            return true;
        }

        if (nextProps.post.type !== this.props.post.type) {
            return true;
        }

        // emojis are immutable
        if (nextProps.emojis !== this.props.emojis) {
            return true;
        }

        if (nextProps.enableFormatting !== this.props.enableFormatting) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.mentionKeys, this.props.mentionKeys)) {
            return true;
        }

        // Don't check if props.usernameMap changes since it is very large and inefficient to do so.
        // This mimics previous behaviour, but could be changed if we decide it's worth it.
        // The same choice (and reasoning) is also applied to the this.props.channelNamesMap.

        return false;
    }

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
        if (this.props.post.state === Constants.POST_DELETED) {
            return this.renderDeletedPost();
        }

        if (!this.props.enableFormatting) {
            return <span>{this.props.post.message}</span>;
        }

        const options = Object.assign({}, this.props.options, {
            emojis: this.props.emojis,
            siteURL: getSiteURL(),
            mentionKeys: this.props.mentionKeys,
            usernameMap: this.props.usernameMap,
            channelNamesMap: this.props.channelNamesMap,
            team: this.props.team
        });

        const renderedSystemMessage = renderSystemMessage(this.props.post, options);
        if (renderedSystemMessage) {
            return <div>{renderedSystemMessage}</div>;
        }

        return (
            <div>
                <span
                    id={this.props.isLastPost ? 'lastPostMessageText' : null}
                    className='post-message__text'
                    onClick={Utils.handleFormattedTextClick}
                    dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.post.message, options)}}
                />
                {this.renderEditedIndicator()}
            </div>
        );
    }
}
