// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group} from '@mattermost/types/groups';

import {General} from '../constants';

import {getSuggestionsSplitByMultiple} from './user_utils';

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
        return a.display_name.localeCompare(b.display_name, locale, {numeric: true});
    });
}
