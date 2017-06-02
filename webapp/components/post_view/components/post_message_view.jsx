// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {Parser, ProcessNodeDefinitions} from 'html-to-react';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import AtMention from 'components/at_mention';

import Constants from 'utils/constants.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import {getSiteURL} from 'utils/url.jsx';
import * as Utils from 'utils/utils.jsx';

import {renderSystemMessage} from './system_message_helpers.jsx';

export default class PostMessageView extends React.Component {
    static propTypes = {
        options: PropTypes.object.isRequired,
        post: PropTypes.object.isRequired,
        emojis: PropTypes.object.isRequired,
        enableFormatting: PropTypes.bool.isRequired,
        mentionKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
        channelNamesMap: PropTypes.object.isRequired,
        team: PropTypes.object.isRequired,
        lastPostCount: PropTypes.number
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

        if (nextProps.lastPostCount !== this.props.lastPostCount) {
            return true;
        }

        // Don't check if props.channelNamesMap changes since it is very large and inefficient to do so.
        // This mimics previous behaviour, but could be changed if we decide it's worth it.

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

    postMessageHtmlToComponent(html) {
        const parser = new Parser();
        const attrib = 'data-mention';
        const processNodeDefinitions = new ProcessNodeDefinitions(React);

        function isValidNode() {
            return true;
        }

        const processingInstructions = [
            {
                replaceChildren: true,
                shouldProcessNode: (node) => node.attribs && node.attribs[attrib],
                processNode: (node) => {
                    const mentionName = node.attribs[attrib];

                    return <AtMention mentionName={mentionName}/>;
                }
            },
            {
                shouldProcessNode: () => true,
                processNode: processNodeDefinitions.processDefaultNode
            }
        ];

        return parser.parseWithInstructions(html, isValidNode, processingInstructions);
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
            atMentions: true,
            channelNamesMap: this.props.channelNamesMap,
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

        const htmlFormattedText = TextFormatting.formatText(this.props.post.message, options);
        const postMessageComponent = this.postMessageHtmlToComponent(htmlFormattedText);

        return (
            <div>
                <span
                    id={postId}
                    className='post-message__text'
                    onClick={Utils.handleFormattedTextClick}
                >
                    {postMessageComponent}
                </span>
                {this.renderEditedIndicator()}
            </div>
        );
    }
}
