// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Group} from '@mattermost/types/groups';

import {getSuggestionsSplitByMultiple} from './user_utils';

import {General} from '../constants';

export function filterGroupsMatchingTerm(groups: Group[], term: string): Group[] {
    const lowercasedTerm = term.toLowerCase();
    let trimmedTerm = lowercasedTerm;
    if (trimmedTerm.startsWith('@')) {
        trimmedTerm = trimmedTerm.substr(1);
    }

    return groups.filter((group: Group) => {
        if (!group) {
            return false;
        }

        const groupSuggestions: string[] = [];

        const groupnameSuggestions = getSuggestionsSplitByMultiple((group.name || '').toLowerCase(), General.AUTOCOMPLETE_SPLIT_CHARACTERS);

        groupSuggestions.push(...groupnameSuggestions);
        const displayname = (group.display_name || '').toLowerCase();
        groupSuggestions.push(displayname);

        return groupSuggestions.
            filter((suggestion) => suggestion !== '').
            some((suggestion) => suggestion.startsWith(trimmedTerm));
    });
}

export function sortGroups(groups: Group[] = [], locale: string = General.DEFAULT_LOCALE): Group[] {
    return groups.sort((a, b) => {
        if ((a.delete_at === 0 && b.delete_at === 0) || (a.delete_at > 0 && b.delete_at > 0)) {
            return a.display_name.localeCompare(b.display_name, locale, {numeric: true});
        }
        if (a.delete_at < b.delete_at) {
            return -1;
        }
        if (a.delete_at > b.delete_at) {
            return 1;
        }

        return 0;
    });
}
