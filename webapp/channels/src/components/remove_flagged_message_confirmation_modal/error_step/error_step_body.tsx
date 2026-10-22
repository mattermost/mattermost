// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import FlaggedMessageBody from '../flagged_message_body';
import ReportNotice from '../report_notice';

import './error_step_body.scss';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
    onRetry: () => void;
};

export default function ErrorStepBody({
    action,
    flaggedPost,
    reportingUser,
    contentFlaggingConfig,
    onRetry,
}: BodyProps) {
    const {formatMessage} = useIntl();
    const tryAgainText = formatMessage({
        id: 'keep_remove_quarantined_content_modal.try_again.button_text',
        defaultMessage: 'Try again',
    });

    return (
        <>
            <FlaggedMessageBody
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
                contentFlaggingConfig={contentFlaggingConfig}
            />
            <ReportNotice
                variant='warning'
                testId='error-section'
                icon={<span className='icon icon-information-outline'/>}
                title={
                    <FormattedMessage
                        id='keep_remove_quarantined_content_modal.error.title'
                        defaultMessage='Report could not be generated'
                    />
                }
                body={
                    <div className='ErrorStepBody'>
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.error.body'
                            defaultMessage='We were unable to generate and download the report to your device.'
                        />
                        <button
                            type='button'
                            className='GenericModal__button btn btn-primary errorRetryBtn'
                            onClick={onRetry}
                            data-testid='error-retry-button'
                        >
                            {tryAgainText}
                        </button>
                    </div>
                }
            />
        </>
    );
}
