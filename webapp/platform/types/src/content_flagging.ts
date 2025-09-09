// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IDMappedCollection} from '@mattermost/types/utilities';

import type {Post} from './posts';
import type {
    PropertyField,
    PropertyValue,
} from './properties';

export type ContentFlaggingEvent = 'flagged' | 'assigned' | 'removed' | 'dismissed';

export type NotificationTarget = 'reviewers' | 'author' | 'reporter';

export type ContentFlaggingConfig = {
    reasons: string[];
    reporter_comment_required: boolean;
    reviewer_comment_required: boolean;
    notify_reporter_on_dismissal?: boolean;
    notify_reporter_on_removal?: boolean;
};

export type ContentFlaggingState = {
    settings?: ContentFlaggingConfig;
    fields?: IDMappedCollection<PropertyField>;
    postValues?: {
        [key: Post['id']]: Array<PropertyValue<unknown>>;
    };
};
