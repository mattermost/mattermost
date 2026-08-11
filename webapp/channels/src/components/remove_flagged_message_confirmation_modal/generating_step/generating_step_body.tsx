// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import FlaggedMessageBody from '../flagged_message_body';
import ReportNotice from '../report_notice';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
};

export function GeneratingStepBody({
    action,
    flaggedPost,
    reportingUser,
    contentFlaggingConfig,
}: BodyProps) {
    return (
        <>
            <FlaggedMessageBody
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
                contentFlaggingConfig={contentFlaggingConfig}
            />
            <ReportNotice
                variant='info'
                testId='generating-section'
                icon={<LoadingSpinner/>}
                title={
                    <FormattedMessage
                        id='keep_remove_quarantined_content_modal.generating.title'
                        defaultMessage='Generating report…'
                    />
                }
                body={
                    action === 'remove' ? (
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.action_remove.generating.body'
                            defaultMessage='Please wait for the report to download before you remove the message permanently. There will be no way to recover the message contents once it is removed.'
                        />
                    ) : (
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.action_keep.generating.body'
                            defaultMessage='Please wait for the report to download before you keep the message permanently.'
                        />
                    )
                }
            />
        </>
    );
}
