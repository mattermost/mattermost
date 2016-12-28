// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';

export default class PostMessageView extends React.Component {
    static propTypes = {
        options: React.PropTypes.object.isRequired,
        message: React.PropTypes.string.isRequired,
        emojis: React.PropTypes.object.isRequired,
        enableFormatting: React.PropTypes.bool.isRequired,
        mentionKeys: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
        usernameMap: React.PropTypes.object.isRequired,
        channelNamesMap: React.PropTypes.object.isRequired,
        team: React.PropTypes.object.isRequired
    };

    shouldComponentUpdate(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.options, this.props.options)) {
            return true;
        }

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

        // Don't check if props.usernameMap changes since it is very large and inefficient to do so.
        // This mimics previous behaviour, but could be changed if we decide it's worth it.
        // The same choice (and reasoning) is also applied to the this.props.channelNamesMap.

        return false;
    }

    render() {
        if (!this.props.enableFormatting) {
            return <span>{this.props.message}</span>;
        }

        const options = Object.assign({}, this.props.options, {
            emojis: this.props.emojis,
            siteURL: Utils.getSiteURL(),
            mentionKeys: this.props.mentionKeys,
            usernameMap: this.props.usernameMap,
            channelNamesMap: this.props.channelNamesMap,
            team: this.props.team
        });

        return (
            <span
                onClick={Utils.handleFormattedTextClick}
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.message, options)}}
            />
        );
    }
}
