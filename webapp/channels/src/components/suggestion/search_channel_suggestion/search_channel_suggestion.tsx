// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import ChannelTypeIcon from 'components/channel_type_icon';
import usePrefixedIds from 'components/common/hooks/usePrefixedIds';
import BotTag from 'components/widgets/tag/bot_tag';
import Avatar from 'components/widgets/users/avatar';

import Constants from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import {SuggestionContainer} from '../suggestion';
import type {SuggestionProps} from '../suggestion';

type Props = SuggestionProps<Channel> & {
    currentUserId: string;
    teammateIsBot: boolean;
};

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

    let icon: React.ReactElement | null = null;
    let name = '';
    let description = '';

    if (item.type === Constants.DM_CHANNEL) {
        icon = (
            <Avatar
                alt=''
                url={imageURLForUser(getUserIdFromChannelName(currentUserId, item.name))}
                size='sm'
            />
        );
        name = '@' + item.display_name;
        description = '';
    } else if (item.type === Constants.GM_CHANNEL) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <div className='status status--group'>{'G'}</div>
            </span>
        );
        name = '@' + item.display_name.replace(/ /g, '');
        description = '';
    } else if (item.type === Constants.OPEN_CHANNEL || item.type === Constants.PRIVATE_CHANNEL) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <ChannelTypeIcon
                    channel={item}
                    className='icon--standard icon--no-spacing'
                />
            </span>
        );
        name = item.display_name;
        description = '~' + item.name;
    } else {
        return (<></>);
    }

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
                    data-testid='suggestion-list__main'
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
