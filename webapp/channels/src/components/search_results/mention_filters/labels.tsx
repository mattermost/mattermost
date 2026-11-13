// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {MentionDateRange, MentionType} from 'types/store/rhs';

export const mentionTypeLabels: Record<MentionType, MessageDescriptor> = {
    direct: defineMessage({
        id: 'search_results.mention_filters.type.direct',
        defaultMessage: 'Directly mentioning you',
    }),
    group: defineMessage({
        id: 'search_results.mention_filters.type.group',
        defaultMessage: 'Group mentions',
    }),
    keyword: defineMessage({
        id: 'search_results.mention_filters.type.keyword',
        defaultMessage: 'Keywords triggering mentions',
    }),
};

export const dateRangeLabels: Record<MentionDateRange, MessageDescriptor> = {
    any: defineMessage({
        id: 'search_results.mention_filters.date.any',
        defaultMessage: 'Any time',
    }),
    today: defineMessage({
        id: 'search_results.mention_filters.date.today',
        defaultMessage: 'Today',
    }),
    last_7_days: defineMessage({
        id: 'search_results.mention_filters.date.last_7_days',
        defaultMessage: 'Last 7 days',
    }),
};
