// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import FlaggedMessageBody from './flagged_message_body';
import ReportNotice from './report_notice';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
    onRetry: () => void;
};

export function ErrorStepBody({action, flaggedPost, reportingUser, contentFlaggingConfig, onRetry}: BodyProps) {
    const {formatMessage} = useIntl();

    const tryAgainText = formatMessage({id: 'keep_remove_quarantined_content_modal.try_again.button_text', defaultMessage: 'Try again'});

    return (
        <>
            <FlaggedMessageBody
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
                contentFlaggingConfig={contentFlaggingConfig}
            />
            <ReportNotice
                variant='danger'
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

type FooterProps = {
    action: 'keep' | 'remove';
    onSkip: () => void;
    onBack: () => void;
};

export function ErrorStepFooter({action, onSkip, onBack}: FooterProps) {
    const {formatMessage} = useIntl();

    const skipText = formatMessage({id: 'keep_remove_quarantined_content_modal.skip_report_download.button_text', defaultMessage: 'Skip report download'});
    const removePermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.permanent_button_text', defaultMessage: 'Remove permanently'});
    const keepPermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.permanent_button_text', defaultMessage: 'Keep permanently'});
    const backText = formatMessage({
        id: 'keep_remove_quarantined_content_modal.back.button_text',
        defaultMessage: 'Back',
    });

    const permanentText = action === 'remove' ? removePermanentlyText : keepPermanentlyText;
    const permanentClass = action === 'remove' ? 'btn-danger' : 'btn-primary';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary btn-danger skipReportBtn'
                    onClick={onSkip}
                    data-testid='error-skip-button'
                >
                    {skipText}
                </button>
            </div>
            <div className='ModalFooterRow__right'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onBack}
                    data-testid='skip-confirm-back-button'
                >
                    {backText}
                </button>
                <button
                    type='button'
                    className={classNames(
                        'GenericModal__button btn',
                        permanentClass,
                    )}
                    disabled={true}
                    data-testid='error-permanent-button'
                >
                    {permanentText}
                </button>
            </div>
        </div>
    );
}
