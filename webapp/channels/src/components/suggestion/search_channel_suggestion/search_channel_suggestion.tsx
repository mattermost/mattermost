// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import BotTag from 'components/widgets/tag/bot_tag';
import Avatar from 'components/widgets/users/avatar';

import Constants from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import {SuggestionContainer} from '../suggestion';
import type {SuggestionProps} from '../suggestion';

function itemToName(item: Channel, currentUserId: string): {icon: React.ReactElement; name: string; description: string} | null {
    if (item.type === Constants.DM_CHANNEL) {
        const profilePicture = (
            <Avatar
                url={imageURLForUser(getUserIdFromChannelName(currentUserId, item.name))}
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

type Props = SuggestionProps<Channel> & {
    currentUserId: string;
    teammateIsBot: boolean;
}

const SearchChannelSuggestion = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
    const {item, teammateIsBot, currentUserId} = props;

    const nameObject = itemToName(item, currentUserId);
    if (!nameObject) {
        return (<></>);
    }

    const {icon, name, description} = nameObject;

    const tag = item.type === Constants.DM_CHANNEL && teammateIsBot ? <BotTag/> : null;

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {icon}
            <div className='suggestion-list__ellipsis'>
                <span className='suggestion-list__main'>
                    {name}
                </span>
                {description}
            </div>
            {tag}
        </SuggestionContainer>
    );
});
SearchChannelSuggestion.displayName = 'SearchChannelSuggestion';
export default SearchChannelSuggestion;
