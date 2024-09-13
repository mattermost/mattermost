// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Tag from 'components/widgets/tag/tag';

const errorCodeToErrorMessage: {[key: string]: {id: string; defaultMessage: string}} = {
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
};

type Props = {
    errorCode: string;
}

export default function ScheduledPostErrorCodeTag({errorCode}: Props) {
    const errorCodeTranslationID = errorCodeToErrorMessage[errorCode] || errorCodeToErrorMessage.unknown;

    return (
        <Tag
            text={(
                <FormattedMessage
                    id={errorCodeTranslationID.id}
                    defaultMessage={errorCodeTranslationID.defaultMessage}
                />
            )}
            variant={'danger'}
            uppercase={true}
            icon='alert-outline'
        />
    );
}
