// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';
import Suggestion from './suggestion.jsx';
import Constants from 'utils/constants.jsx';
import StatusIcon from 'components/status_icon.jsx';
import * as Utils from 'utils/utils.jsx';

class SwitchChannelSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        let displayName = '';
        if (item.type === Constants.DM_CHANNEL) {
            displayName = item.display_name + ' ' + Utils.localizeMessage('channel_switch_modal.dm', '(Direct Message)');
        } else {
            displayName = item.display_name + ' (' + item.name + ')';
        }

        let icon = null;
        if (item.type === Constants.OPEN_CHANNEL) {
            icon = <div className='status'><i className='fa fa-globe'></i></div>;
        } else if (item.type === Constants.PRIVATE_CHANNEL) {
            icon = <div className='status'><i className='fa fa-lock'></i></div>;
        } else {
            icon = <StatusIcon status={item.status}/>;
        }

        return (
            <div
                onClick={this.handleClick}
                className={className}
            >
            {icon}
            {displayName}
            </div>
        );
    }
}

export default class SwitchChannelProvider {
    handlePretextChanged(suggestionId, channelPrefix) {
        if (channelPrefix) {
            const allChannels = ChannelStore.getAll();
            const channels = [];

            for (const id of Object.keys(allChannels)) {
                const channel = allChannels[id];
                if (channel.display_name.toLowerCase().startsWith(channelPrefix.toLowerCase())) {
                    channels.push(channel);
                } else if (channel.type === Constants.DM_CHANNEL && Utils.getDirectTeammate(channel.id).username.startsWith(channelPrefix.toLowerCase())) {
                    // New channel to not modify existing channel
                    const otherUser = Utils.getDirectTeammate(channel.id);
                    const newChannel = {
                        display_name: otherUser.username,
                        name: otherUser.username + ' ' + Utils.localizeMessage('channel_switch_modal.dm', '(Direct Message)'),
                        type: Constants.DM_CHANNEL,
                        status: UserStore.getStatus(otherUser.id) || 'offline'
                    };
                    channels.push(newChannel);
                }
            }

            channels.sort((a, b) => {
                if (a.display_name === b.display_name) {
                    if (a.type !== Constants.DM_CHANNEL && b.type === Constants.DM_CHANNEL) {
                        return -1;
                    } else if (a.type === Constants.DM_CHANNEL && b.type !== Constants.DM_CHANNEL) {
                        return 1;
                    }
                    return a.name.localeCompare(b.name);
                }
                return a.display_name.localeCompare(b.display_name);
            });

            const channelNames = channels.map((channel) => channel.name);

            SuggestionStore.addSuggestions(suggestionId, channelNames, channels, SwitchChannelSuggestion, channelPrefix);
        }
    }
}
