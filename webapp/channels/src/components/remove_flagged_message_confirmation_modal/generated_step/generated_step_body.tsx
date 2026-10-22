// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import FlaggedMessageBody from '../flagged_message_body';
import ReportNotice from '../report_notice';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
};

export default function GeneratedStepBody({
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
                variant='success'
                testId='generated-section'
                icon={<span className='icon icon-check'/>}
                title={
                    <FormattedMessage
                        id='keep_remove_quarantined_content_modal.generated.title'
                        defaultMessage='Report generated'
                    />
                }
                body={
                    action === 'remove' ? (
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.action_remove.generated.body'
                            defaultMessage='The report should now be downloading on your device. Once it is downloaded, you can remove the message permanently.'
                        />
                    ) : (
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.action_keep.generated.body'
                            defaultMessage='The report should now be downloading on your device. Once it is downloaded, you can keep the message permanently.'
                        />
                    )
                }
            />
        </>
    );
}
