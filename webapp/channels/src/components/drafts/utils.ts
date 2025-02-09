// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';
import {defineMessages} from 'react-intl';

import type {ScheduledPostErrorCode} from '@mattermost/types/schedule_post';

const errorCodeToErrorMessage = defineMessages<ScheduledPostErrorCode>({
    unknown: {
        id: 'scheduled_post.error_code.unknown_error',
        defaultMessage: 'Unknown Error',
    },
    channel_archived: {
        id: 'scheduled_post.error_code.channel_archived',
        defaultMessage: 'Channel Archived',
    },
    channel_not_found: {
        id: 'scheduled_post.error_code.channel_removed',
        defaultMessage: 'Channel Removed',
    },
    user_missing: {
        id: 'scheduled_post.error_code.user_missing',
        defaultMessage: 'User Deleted',
    },
    user_deleted: {
        id: 'scheduled_post.error_code.user_deleted',
        defaultMessage: 'User Deleted',
    },
    no_channel_permission: {
        id: 'scheduled_post.error_code.no_channel_permission',
        defaultMessage: 'Missing Permission',
    },
    no_channel_member: {
        id: 'scheduled_post.error_code.no_channel_member',
        defaultMessage: 'Not In Channel',
    },
    thread_deleted: {
        id: 'scheduled_post.error_code.thread_deleted',
        defaultMessage: 'Thread Deleted',
    },
    unable_to_send: {
        id: 'scheduled_post.error_code.unable_to_send',
        defaultMessage: 'Unable to Send',
    },
    invalid_post: {
        id: 'scheduled_post.error_code.invalid_post',
        defaultMessage: 'Invalid Post',
    },
});

export function getErrorStringFromCode(intl: IntlShape, errorCode: ScheduledPostErrorCode = 'unknown') {
    const textDefinition = errorCodeToErrorMessage[errorCode] ?? errorCodeToErrorMessage.unknown;
    return intl.formatMessage(textDefinition).toUpperCase();
}
