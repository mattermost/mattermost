// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from './users';

export type UserAutocomplete = {
    users: UserProfile[];

    // out_of_channel contains users that aren't in the given channel. It's only populated when autocompleting users in
    // a given channel ID.
    out_of_channel?: UserProfile[];
};

export type AutocompleteSuggestion = {
    Complete: string;
    Suggestion: string;
    Hint: string;
    Description: string;
    IconData: string;
};
