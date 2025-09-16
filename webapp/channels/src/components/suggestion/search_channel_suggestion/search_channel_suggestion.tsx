// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import usePrefixedIds from 'components/common/hooks/usePrefixedIds';
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
                alt=''
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

const SearchChannelSuggestion = React.forwardRef<HTMLLIElement, Props>(({
    id,
    item,
    teammateIsBot,
    currentUserId,
    ...otherProps
}, ref) => {
    const ids = usePrefixedIds(id, {
        name: null,
        channelType: null,
        botTag: null,
    });

    const nameObject = itemToName(item, currentUserId);
    if (!nameObject) {
        return (<></>);
    }

    const {icon, name, description} = nameObject;

    const tag = item.type === Constants.DM_CHANNEL && teammateIsBot ? <BotTag/> : null;

    return (
        <SuggestionContainer
            ref={ref}
            id={id}
            item={item}
            {...otherProps}
            aria-labelledby={ids.name}
            aria-describedby={ids.botTag}
        >
            {icon}
            <div className='suggestion-list__ellipsis'>
                <span
                    id={ids.name}
                    className='suggestion-list__main'
                >
                    {name}
                </span>
                {description}
            </div>
            {tag && <span id={ids.botTag}>{tag}</span>}
        </SuggestionContainer>
    );
});
SearchChannelSuggestion.displayName = 'SearchChannelSuggestion';
export default SearchChannelSuggestion;
