// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {browserHistory} from 'react-router/es6';
import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';

export default class PostMessageView extends React.Component {
    static propTypes = {
        message: React.PropTypes.string.isRequired,
        emojis: React.PropTypes.object.isRequired,
        enableFormatting: React.PropTypes.bool.isRequired
    };

    shouldComponentUpdate(nextProps) {
        if (nextProps.message !== this.props.message) {
            return true;
        }

        // emojis are immutable
        if (nextProps.emojis !== this.props.emojis) {
            return true;
        }

        if (nextProps.enableFormatting !== this.props.enableFormatting) {
            return true;
        }

        return false;
    }

    handleClick(e) {
        // TODO should this be here or somewhere else? it's already copied from TextFormatting
        const mentionAttribute = e.target.getAttributeNode('data-mention');
        const hashtagAttribute = e.target.getAttributeNode('data-hashtag');
        const linkAttribute = e.target.getAttributeNode('data-link');

        if (mentionAttribute) {
            e.preventDefault();

            Utils.searchForTerm(mentionAttribute.value);
        } else if (hashtagAttribute) {
            e.preventDefault();

            Utils.searchForTerm(hashtagAttribute.value);
        } else if (linkAttribute) {
            const MIDDLE_MOUSE_BUTTON = 1;

            if (!(e.button === MIDDLE_MOUSE_BUTTON || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();

                browserHistory.push(linkAttribute.value);
            }
        }
    }

    render() {
        if (!this.props.enableFormatting) {
            return <span>{this.props.message}</span>;
        }

        const options = {
            emojis: this.props.emojis,
            siteURL: global.mm_config.SiteURL || window.location.origin
        };

        return (
            <span
                onClick={this.handleClick}
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.message, options)}}
            />
        );
    }
}