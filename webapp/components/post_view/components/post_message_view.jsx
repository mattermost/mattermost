// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';

export default class PostMessageView extends React.Component {
    static propTypes = {
        message: React.PropTypes.string.isRequired,
        emojis: React.PropTypes.object.isRequired,
        enableFormatting: React.PropTypes.bool.isRequired,
        mentionKeys: React.PropTypes.arrayOf(React.PropTypes.string).isRequired
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

        if (!Utils.areObjectsEqual(nextProps.mentionKeys, this.props.mentionKeys)) {
            return true;
        }

        return false;
    }

    render() {
        if (!this.props.enableFormatting) {
            return <span>{this.props.message}</span>;
        }

        const options = {
            emojis: this.props.emojis,
            siteURL: Utils.getSiteURL(),
            mentionKeys: this.props.mentionKeys
        };

        return (
            <span
                onClick={Utils.handleFormattedTextClick}
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.message, options)}}
            />
        );
    }
}