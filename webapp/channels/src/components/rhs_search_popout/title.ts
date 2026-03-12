// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/enforce-placeholders */

import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import {RHSStates} from 'utils/constants';

export function getSearchPopoutTitle(mode: string): MessageDescriptor {
    switch (mode) {
    case RHSStates.MENTION:
        return defineMessage({
            id: 'rhs_search_popout.title.mentions',
            defaultMessage: 'Recent Mentions - {serverName}',
        });
    case RHSStates.FLAG:
        return defineMessage({
            id: 'rhs_search_popout.title.saved',
            defaultMessage: 'Saved Messages - {serverName}',
        });
    case RHSStates.PIN:
        return defineMessage({
            id: 'rhs_search_popout.title.pinned',
            defaultMessage: 'Pinned Messages - {channelName} - {serverName}',
        });
    case RHSStates.CHANNEL_FILES:
        return defineMessage({
            id: 'rhs_search_popout.title.channel_files',
            defaultMessage: 'Channel Files - {channelName} - {serverName}',
        });
    default:
        return defineMessage({
            id: 'rhs_search_popout.title.search',
            defaultMessage: 'Search Results for "{searchTerms}" - {serverName}',
        });
    }
}
