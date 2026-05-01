// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import BodyMainActionText from 'components/remove_flagged_message_confirmation_modal/body_main_action_text';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
};

export function SkipConfirmStepBody({
    action,
    flaggedPost,
    reportingUser,
}: BodyProps) {
    const {formatMessage} = useIntl();

    const removeText = formatMessage({
        id: 'keep_remove_quarantined_content_modal.action_remove.skip_confirm.body',
        defaultMessage:
            'You are proceeding with content removal without downloading a report. Any subsequently generated report will not contain the original message contents. This action cannot be reverted.',
    });
    const keepText = formatMessage({
        id: 'keep_remove_quarantined_content_modal.action_keep.skip_confirm.body',
        defaultMessage:
            'You are proceeding with content retention without downloading a report. Any subsequently generated report will not contain the original message contents.',
    });
    const text = action === 'remove' ? removeText : keepText;

    return (
        <div
            className='section'
            data-testid='skip-confirm-body'
        >
            <BodyMainActionText
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
            />
            {text}
        </div>
    );
}
