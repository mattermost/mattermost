// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import BodyMainActionText from 'components/remove_flagged_message_confirmation_modal/body_main_action_text';

import './flagged_message_body.scss';

type Props = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
};

export default function FlaggedMessageBody({action, flaggedPost, reportingUser, contentFlaggingConfig}: Props) {
    const {formatMessage} = useIntl();

    const subtext = useMemo(() => {
        if (action === 'remove') {
            if (contentFlaggingConfig?.notify_reporter_on_removal) {
                return formatMessage({
                    id: 'keep_remove_quarantined_content_modal.action_remove.subtext.notify_reporter',
                    defaultMessage: 'If you confirm, the message will be removed from the channel and a notification will be sent to the reporter. This action cannot be reverted.',
                });
            }
            return formatMessage({
                id: 'keep_remove_quarantined_content_modal.action_remove.subtext.no_notify_reporter',
                defaultMessage: 'If you confirm, the message will be removed from the channel. This action cannot be reverted.',
            });
        } else if (contentFlaggingConfig?.notify_reporter_on_dismissal) {
            return formatMessage({
                id: 'keep_remove_quarantined_content_modal.action_keep.subtext.notify_reporter',
                defaultMessage: 'If you confirm, the message will be visible to all channel members and a notification will be sent to the reporter.',
            });
        }
        return formatMessage({
            id: 'keep_remove_quarantined_content_modal.action_keep.subtext.no_notify_reporter',
            defaultMessage: 'If you confirm, the message will be visible to all channel members.',
        });
    }, [action, contentFlaggingConfig?.notify_reporter_on_dismissal, contentFlaggingConfig?.notify_reporter_on_removal, formatMessage]);

    return (
        <div
            className='section message_body'
            data-testid='keep-remove-flagged-message-body'
        >
            <BodyMainActionText
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
            />
            <p data-testid='keep-remove-flagged-message-subtext'>{subtext}</p>
        </div>
    );
}
