// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import BotTag from 'components/widgets/tag/bot_tag';

import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';
import {imageURLForUser} from 'utils/utils';
import Constants from 'utils/constants';
import Avatar from 'components/widgets/users/avatar';
import Suggestion from '../suggestion';

import {Channel} from '@mattermost/types/channels';

function itemToName(item: Channel, currentUser: string): {icon: React.ReactElement; name: string; description: string} | null {
    if (item.type === Constants.DM_CHANNEL) {
        const profilePicture = (
            <Avatar
                url={imageURLForUser(getUserIdFromChannelName(currentUser, item.name))}
                size='sm'
            />
        );

        return {
            icon: profilePicture,
            name: '@' + item.display_name,
            description: '',
        };
    }

    if (item.type === Constants.GM_CHANNEL) {
        return {
            icon: (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <div className='status status--group'>{'G'}</div>
                </span>
            ),
            name: '@' + item.display_name.replace(/ /g, ''),
            description: '',
        };
    }

    if (item.type === Constants.OPEN_CHANNEL) {
        return {
            icon: (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon--standard icon--no-spacing icon-globe'/>
                </span>
            ),
            name: item.display_name,
            description: '~' + item.name,
        };
    }

    if (item.type === Constants.PRIVATE_CHANNEL) {
        return {
            icon: (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon--standard icon--no-spacing icon-lock-outline'/>
                </span>
            ),
            name: item.display_name,
            description: '~' + item.name,
        };
    }

    return null;
}

export default class SearchChannelSuggestion extends Suggestion {
    render(): JSX.Element {
        const {item, isSelection, teammate, currentUser} = this.props;

        let className = 'suggestion-list__item';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        const nameObject = itemToName(item, currentUser);
        if (!nameObject) {
            return (<></>);
        }

        const {icon, name, description} = nameObject;

        const tag = item.type === Constants.DM_CHANNEL && teammate && teammate.is_bot ? <BotTag/> : null;

        return (
            <div
                onClick={this.handleClick}
                onMouseMove={this.handleMouseMove}
                className={className}
                {...Suggestion.baseProps}
            >
                {icon}
                <div className='suggestion-list__ellipsis'>
                    <span className='suggestion-list__main'>
                        {name}
                    </span>
                    {description}
                </div>
                {tag}
            </div>
        );
    }
}
