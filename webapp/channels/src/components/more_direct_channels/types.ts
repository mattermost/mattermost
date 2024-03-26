// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {Value} from 'components/multiselect/multiselect';

// Not to be confused with the GroupChannel type used for LDAP groups
export type GroupChannel = Channel & {
    profiles: UserProfile[];
}

export function isGroupChannel(option: UserProfile | GroupChannel): option is GroupChannel {
    return (option as GroupChannel)?.type === 'G';
}

export type Option = (UserProfile & {last_post_at?: number}) | GroupChannel;

export type OptionValue = Option & Value;

export function optionValue(option: Option): OptionValue {
    return {
        value: option.id,
        label: isGroupChannel(option) ? option.display_name : option.username,
        ...option,
    };
}
