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
};

export function GeneratedStepBody({action, flaggedPost, reportingUser, contentFlaggingConfig}: BodyProps) {
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

type FooterProps = {
    action: 'keep' | 'remove';
    submitting: boolean;
    onDownloadAgain: () => void;
    onBack: () => void;
    onPermanent: () => void;
};

export function GeneratedStepFooter({action, submitting, onDownloadAgain, onBack, onPermanent}: FooterProps) {
    const {formatMessage} = useIntl();

    const downloadAgainText = formatMessage({id: 'keep_remove_quarantined_content_modal.download_again.button_text', defaultMessage: 'Download again'});
    const backText = formatMessage({id: 'keep_remove_quarantined_content_modal.back.button_text', defaultMessage: 'Back'});
    const removePermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.permanent_button_text', defaultMessage: 'Remove permanently'});
    const keepPermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.permanent_button_text', defaultMessage: 'Keep permanently'});

    const permanentText = action === 'remove' ? removePermanentlyText : keepPermanentlyText;
    const permanentClass = action === 'remove' ? 'btn-danger' : 'btn-primary';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onDownloadAgain}
                    data-testid='generated-download-again-button'
                >
                    {downloadAgainText}
                </button>
            </div>
            <div className='ModalFooterRow__right'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onBack}
                    data-testid='generated-back-button'
                >
                    {backText}
                </button>
                <button
                    type='button'
                    className={classNames('GenericModal__button btn', permanentClass)}
                    onClick={onPermanent}
                    disabled={submitting}
                    data-testid='generated-permanent-button'
                >
                    {permanentText}
                </button>
            </div>
        </div>
    );
}
