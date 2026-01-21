// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';
import type {Post} from './posts';
import type {
    NameMappedPropertyFields,
    PropertyValue,
} from './properties';
import type {Team} from './teams';

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
    postValues?: {[key: Post['id']]: Array<PropertyValue<unknown>>};
    flaggedPosts?: {[key: Post['id']]: Post};
    channels?: {[key: Channel['id']]: Channel};
    teams?: {[key: Team['id']]: Team};
};

export enum ContentFlaggingStatus {
    Pending = 'Pending',
    Assigned = 'Assigned',
    Removed = 'Removed',
    Retained = 'Retained',
}
