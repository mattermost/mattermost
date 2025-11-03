// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiRhsTypes} from 'utils/constants';

export function setWikiRhsMode(mode: 'outline' | 'comments') {
    return {
        type: WikiRhsTypes.SET_MODE,
        mode,
    };
}

export function setWikiRhsWikiId(wikiId: string | null) {
    return {
        type: WikiRhsTypes.SET_WIKI_ID,
        wikiId,
    };
}

export function setWikiRhsActiveTab(tab: 'page_comments' | 'all_threads') {
    return {
        type: WikiRhsTypes.SET_ACTIVE_TAB,
        tab,
    };
}
