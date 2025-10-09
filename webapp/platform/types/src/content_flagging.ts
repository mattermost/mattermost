// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from './posts';
import type {
    NameMappedPropertyFields,
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
    fields?: NameMappedPropertyFields;
    postValues?: {
        [key: Post['id']]: Array<PropertyValue<unknown>>;
    };
};

export enum ContentFlaggingStatus {
    Pending = 'Pending',
    Assigned = 'Assigned',
    Removed = 'Removed',
    Retained = 'Retained',
}
